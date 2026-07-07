/**
 * Die 8 Start-Regeln der Smart Actions (Modul 15, Spec Abschnitt 4).
 *
 * Alle evaluate()-Implementierungen nutzen leichtgewichtige Aggregat-Queries
 * (COUNT/SUM mit Indizes), keine Volltabellen-Ladung.
 *
 * Hinweis zu orders_unshipped: Die Spec nennt einen Auftragsstatus "ready",
 * den das Datenmodell nicht kennt. Die Regel ist deshalb auf "bezahlt, aber
 * nach 2 Tagen noch nicht versendet" gemappt (status = 'paid' und
 * shipping_status nicht 'shipped'/'delivered'), siehe ENTSCHEIDUNGEN_MODUL_15.
 */
import { getDatabase } from '@/services/database';
import { getSettingWithDefault } from '@/services/settings';
import { getOverdueCount } from '@/features/tasks/services/taskService';
import type { SmartActionResult, SmartActionRule } from './types';
import {
  BACKUP_STALE_DAYS,
  MARGIN_LOW_THRESHOLD_PERCENT,
  ORDERS_STUCK_DAYS,
  ORDERS_UNSHIPPED_DAYS,
  PRODUCT_NO_LISTING_MIN_SALES,
} from './thresholds';

/** Verkaufsdefinition analog salesStatsService (Alias o = orders). */
const SALE_CONDITION = `o.deleted_at IS NULL
  AND o.payment_status = 'paid'
  AND o.status != 'cancelled'
  AND o.product_id IS NOT NULL`;

interface CountRow {
  count: number | null;
}

function isoTimestampDaysAgo(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function localIsoDateDaysAgo(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function countQuery(query: string, params: unknown[] = []): Promise<number> {
  const rows = await getDatabase().select<CountRow[]>(query, params);
  return Number(rows[0]?.count ?? 0);
}

/**
 * Zeitpunkt des letzten Statuswechsels IN den angegebenen Status,
 * Fallback updated_at (für Aufträge, die vor der Event-Timeline entstanden).
 */
function lastStatusChangeExpr(toValue: string): string {
  return `COALESCE(
    (SELECT MAX(e.created_at) FROM order_events e
      WHERE e.order_id = o.id AND e.event_type = 'status_change' AND e.to_value = '${toValue}'),
    o.updated_at
  )`;
}

const ordersStuckRule: SmartActionRule = {
  id: 'orders_stuck',
  category: 'orders',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const count = await countQuery(
      `SELECT COUNT(*) AS count
       FROM orders o
       WHERE o.deleted_at IS NULL
         AND o.status = 'in_production'
         AND ${lastStatusChangeExpr('in_production')} < $1`,
      [isoTimestampDaysAgo(ORDERS_STUCK_DAYS)],
    );
    if (count === 0) return null;

    return {
      count,
      severity: 'warning',
      message:
        count === 1
          ? `1 Auftrag hängt länger als ${ORDERS_STUCK_DAYS} Tage in Produktion`
          : `${count} Aufträge hängen länger als ${ORDERS_STUCK_DAYS} Tage in Produktion`,
      targetRoute: '/orders',
      targetSearchParams: { view: 'kanban', status: 'in_production' },
    };
  },
};

const ordersUnshippedRule: SmartActionRule = {
  id: 'orders_unshipped',
  category: 'orders',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const count = await countQuery(
      `SELECT COUNT(*) AS count
       FROM orders o
       WHERE o.deleted_at IS NULL
         AND o.status = 'paid'
         AND COALESCE(o.shipping_status, 'not_shipped') NOT IN ('shipped', 'delivered')
         AND ${lastStatusChangeExpr('paid')} < $1`,
      [isoTimestampDaysAgo(ORDERS_UNSHIPPED_DAYS)],
    );
    if (count === 0) return null;

    return {
      count,
      severity: 'warning',
      message:
        count === 1
          ? `1 bezahlter Auftrag ist seit über ${ORDERS_UNSHIPPED_DAYS} Tagen nicht versendet`
          : `${count} bezahlte Aufträge sind seit über ${ORDERS_UNSHIPPED_DAYS} Tagen nicht versendet`,
      targetRoute: '/orders',
      targetSearchParams: { view: 'kanban', status: 'paid' },
    };
  },
};

interface ProductNoListingRow {
  product_id: string;
  product_name: string;
  units: number;
}

const productNoListingRule: SmartActionRule = {
  id: 'product_no_listing',
  category: 'products',
  evaluate: async (): Promise<SmartActionResult | null> => {
    // Standard-Plattformen sind Etsy und eBay (Kleinanzeigen ist optional).
    const rows = await getDatabase().select<ProductNoListingRow[]>(
      `SELECT s.product_id, s.product_name, s.units
       FROM (
         SELECT o.product_id AS product_id, p.name AS product_name, SUM(o.quantity) AS units
         FROM orders o
         JOIN products p ON p.id = o.product_id AND p.deleted_at IS NULL
         WHERE ${SALE_CONDITION}
         GROUP BY o.product_id, p.name
         HAVING SUM(o.quantity) >= $1
       ) s
       WHERE NOT EXISTS (
         SELECT 1
         FROM listings l
         JOIN listing_platform_overrides lpo ON lpo.listing_id = l.id
         WHERE l.product_id = s.product_id
           AND l.deleted_at IS NULL
           AND l.status = 'online'
           AND lpo.is_active = 1
           AND lpo.platform IN ('etsy', 'ebay')
       )
       ORDER BY s.units DESC`,
      [PRODUCT_NO_LISTING_MIN_SALES],
    );
    if (rows.length === 0) return null;

    const top = rows[0];
    return {
      count: rows.length,
      severity: 'info',
      message:
        rows.length === 1
          ? `"${top.product_name}" hat ${PRODUCT_NO_LISTING_MIN_SALES}+ Verkäufe, aber kein aktives Listing`
          : `${rows.length} Produkte mit ${PRODUCT_NO_LISTING_MIN_SALES}+ Verkäufen haben kein aktives Listing`,
      targetRoute: '/products/$productId',
      targetParams: { productId: top.product_id },
      targetSearchParams: { tab: 'listings' },
    };
  },
};

const expensesNoReceiptRule: SmartActionRule = {
  id: 'expenses_no_receipt',
  category: 'expenses',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const count = await countQuery(
      `SELECT COUNT(*) AS count
       FROM expenses
       WHERE deleted_at IS NULL
         AND tax_relevant = 1
         AND receipt_attached = 0
         AND date >= $1`,
      [yearStart],
    );
    if (count === 0) return null;

    return {
      count,
      severity: 'info',
      message:
        count === 1
          ? '1 steuerrelevante Ausgabe ohne Beleg (laufendes Jahr)'
          : `${count} steuerrelevante Ausgaben ohne Beleg (laufendes Jahr)`,
      targetRoute: '/expenses',
      targetSearchParams: { receipt: 'missing', period: 'current_year' },
    };
  },
};

const tasksOverdueRule: SmartActionRule = {
  id: 'tasks_overdue',
  category: 'tasks',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const count = await getOverdueCount();
    if (count === 0) return null;

    return {
      count,
      severity: 'danger',
      message: count === 1 ? '1 Aufgabe ist überfällig' : `${count} Aufgaben sind überfällig`,
      targetRoute: '/tasks',
      targetSearchParams: { view: 'list', overdue: '1' },
    };
  },
};

const listingsIncompleteRule: SmartActionRule = {
  id: 'listings_incomplete',
  category: 'listings',
  evaluate: async (): Promise<SmartActionResult | null> => {
    // SQL-Näherung der roten Vollständigkeits-Ampel (calculateCompleteness):
    // Pflichtfelder fehlen (Titel, Preis, Tags) oder der effektive Titel
    // (Override, sonst Master) überschreitet ein Plattform-Limit.
    const count = await countQuery(
      `SELECT COUNT(*) AS count
       FROM listings l
       WHERE l.deleted_at IS NULL
         AND l.status IN ('online', 'draft')
         AND (
           trim(l.master_title) = ''
           OR l.base_price <= 0
           OR trim(COALESCE(l.master_tags, '[]')) IN ('', '[]')
           OR length(COALESCE((SELECT NULLIF(trim(k.title_override), '') FROM listing_platform_overrides k WHERE k.listing_id = l.id AND k.platform = 'kleinanzeigen'), l.master_title)) > 65
           OR length(COALESCE((SELECT NULLIF(trim(k.title_override), '') FROM listing_platform_overrides k WHERE k.listing_id = l.id AND k.platform = 'ebay'), l.master_title)) > 80
           OR length(COALESCE((SELECT NULLIF(trim(k.title_override), '') FROM listing_platform_overrides k WHERE k.listing_id = l.id AND k.platform = 'etsy'), l.master_title)) > 140
         )`,
    );
    if (count === 0) return null;

    return {
      count,
      severity: 'info',
      message:
        count === 1
          ? '1 Listing hat unvollständige Pflichtfelder (rote Ampel)'
          : `${count} Listings haben unvollständige Pflichtfelder (rote Ampel)`,
      targetRoute: '/listings',
      targetSearchParams: { completeness: 'red', status: 'online,draft' },
    };
  },
};

interface MarginLowRow {
  product_id: string;
  product_name: string;
  estimated_margin: number;
}

const marginLowSellerRule: SmartActionRule = {
  id: 'margin_low_seller',
  category: 'products',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const rows = await getDatabase().select<MarginLowRow[]>(
      `SELECT p.id AS product_id, p.name AS product_name, p.estimated_margin
       FROM orders o
       JOIN products p ON p.id = o.product_id AND p.deleted_at IS NULL
       WHERE ${SALE_CONDITION}
         AND o.order_date >= $1
         AND p.estimated_margin IS NOT NULL
         AND p.estimated_margin < $2
       GROUP BY p.id, p.name, p.estimated_margin
       ORDER BY p.estimated_margin ASC`,
      [localIsoDateDaysAgo(90), MARGIN_LOW_THRESHOLD_PERCENT],
    );
    if (rows.length === 0) return null;

    const worst = rows[0];
    return {
      count: rows.length,
      severity: 'warning',
      message:
        rows.length === 1
          ? `"${worst.product_name}" verkauft sich, hat aber nur ${Math.round(worst.estimated_margin)}% Marge`
          : `${rows.length} Produkte mit Verkäufen haben unter ${MARGIN_LOW_THRESHOLD_PERCENT}% Marge`,
      targetRoute: '/products/$productId',
      targetParams: { productId: worst.product_id },
      targetSearchParams: { tab: 'costs' },
    };
  },
};

const backupStaleRule: SmartActionRule = {
  id: 'backup_stale',
  category: 'system',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const lastBackupAt = await getSettingWithDefault<string>('last_backup_at', '');
    const target = {
      targetRoute: '/settings/$tab',
      targetParams: { tab: 'data' },
    };

    if (!lastBackupAt) {
      return {
        count: 1,
        severity: 'danger',
        message: 'Noch kein Backup erstellt',
        ...target,
      };
    }

    const lastBackup = new Date(lastBackupAt);
    if (Number.isNaN(lastBackup.getTime())) return null;

    const daysSince = Math.floor((Date.now() - lastBackup.getTime()) / 86_400_000);
    if (daysSince <= BACKUP_STALE_DAYS) return null;

    return {
      // Count = Tage seit dem letzten Backup: so holt die Verschärfung
      // (jeder weitere Tag) eine gesnoozte Karte automatisch zurück.
      count: daysSince,
      severity: 'danger',
      message: `Letztes Backup ist ${daysSince} Tage alt`,
      ...target,
    };
  },
};

export const SMART_ACTION_RULES: SmartActionRule[] = [
  ordersStuckRule,
  ordersUnshippedRule,
  productNoListingRule,
  expensesNoReceiptRule,
  tasksOverdueRule,
  listingsIncompleteRule,
  marginLowSellerRule,
  backupStaleRule,
];
