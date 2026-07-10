/**
 * Die drei Website-Smart-Action-Regeln (Modul 16, Spec Abschnitt 5).
 *
 * Sie werden über registerSmartActionRules() in der Registry aus Modul 15
 * registriert (kein Fork) – die Registrierung übernimmt der
 * smartActionsService beim Modul-Load.
 */
import { getDatabase } from '@/services/database';
import type { SmartActionResult, SmartActionRule } from '@/features/smart-actions/types';

/** domain_expiring: Domains, deren Ablaufdatum innerhalb N Tagen liegt */
export const DOMAIN_EXPIRING_WARNING_DAYS = 30;
/** domain_expiring: darunter wird die Karte danger */
export const DOMAIN_EXPIRING_DANGER_DAYS = 7;
/** website_order_unpaid: offene Website-Aufträge älter als N Tage */
export const WEBSITE_ORDER_UNPAID_DAYS = 14;
/** project_deadline: Projekte mit Deadline innerhalb N Tagen (oder überschritten) */
export const PROJECT_DEADLINE_DAYS = 7;

interface CountRow {
  count: number | null;
}

function localIsoDate(offsetDays = 0, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function countQuery(query: string, params: unknown[] = []): Promise<number> {
  const rows = await getDatabase().select<CountRow[]>(query, params);
  return Number(rows[0]?.count ?? 0);
}

const domainExpiringRule: SmartActionRule = {
  id: 'domain_expiring',
  category: 'websites',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const warningLimit = localIsoDate(DOMAIN_EXPIRING_WARNING_DAYS);
    const dangerLimit = localIsoDate(DOMAIN_EXPIRING_DANGER_DAYS);

    const baseCondition = `deleted_at IS NULL
        AND active = 1
        AND type = 'domain'
        AND expires_at IS NOT NULL`;
    const count = await countQuery(
      `SELECT COUNT(*) AS count FROM website_services
       WHERE ${baseCondition} AND expires_at <= $1`,
      [warningLimit],
    );
    if (count === 0) return null;

    const dangerCount = await countQuery(
      `SELECT COUNT(*) AS count FROM website_services
       WHERE ${baseCondition} AND expires_at <= $1`,
      [dangerLimit],
    );

    return {
      count,
      severity: dangerCount > 0 ? 'danger' : 'warning',
      message:
        count === 1
          ? `1 Domain läuft innerhalb von ${DOMAIN_EXPIRING_WARNING_DAYS} Tagen ab`
          : `${count} Domains laufen innerhalb von ${DOMAIN_EXPIRING_WARNING_DAYS} Tagen ab`,
      targetRoute: '/websites',
      targetSearchParams: { tab: 'services', filter: 'expiring' },
    };
  },
};

const websiteOrderUnpaidRule: SmartActionRule = {
  id: 'website_order_unpaid',
  category: 'websites',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const count = await countQuery(
      `SELECT COUNT(*) AS count FROM orders
       WHERE deleted_at IS NULL
         AND platform = 'website'
         AND payment_status = 'pending'
         AND status != 'cancelled'
         AND order_date < $1`,
      [localIsoDate(-WEBSITE_ORDER_UNPAID_DAYS)],
    );
    if (count === 0) return null;

    return {
      count,
      severity: 'warning',
      message:
        count === 1
          ? `1 Website-Auftrag ist seit über ${WEBSITE_ORDER_UNPAID_DAYS} Tagen unbezahlt`
          : `${count} Website-Aufträge sind seit über ${WEBSITE_ORDER_UNPAID_DAYS} Tagen unbezahlt`,
      targetRoute: '/orders',
      targetSearchParams: { view: 'kanban', platform: 'website' },
    };
  },
};

const projectDeadlineRule: SmartActionRule = {
  id: 'project_deadline',
  category: 'websites',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const today = localIsoDate(0);
    const limit = localIsoDate(PROJECT_DEADLINE_DAYS);

    const baseCondition = `deleted_at IS NULL
        AND status IN ('in_progress', 'review')
        AND deadline IS NOT NULL`;
    const count = await countQuery(
      `SELECT COUNT(*) AS count FROM website_projects
       WHERE ${baseCondition} AND deadline <= $1`,
      [limit],
    );
    if (count === 0) return null;

    const overdueCount = await countQuery(
      `SELECT COUNT(*) AS count FROM website_projects
       WHERE ${baseCondition} AND deadline < $1`,
      [today],
    );

    return {
      count,
      severity: overdueCount > 0 ? 'danger' : 'warning',
      message:
        overdueCount > 0
          ? count === 1
            ? '1 Website-Projekt hat die Deadline überschritten'
            : `${count} Website-Projekte haben eine überschrittene oder nahe Deadline`
          : count === 1
            ? `1 Website-Projekt hat eine Deadline innerhalb von ${PROJECT_DEADLINE_DAYS} Tagen`
            : `${count} Website-Projekte haben eine Deadline innerhalb von ${PROJECT_DEADLINE_DAYS} Tagen`,
      targetRoute: '/websites',
      targetSearchParams: { tab: 'projects', filter: 'deadline' },
    };
  },
};

export const WEBSITE_SMART_ACTION_RULES: SmartActionRule[] = [
  domainExpiringRule,
  websiteOrderUnpaidRule,
  projectDeadlineRule,
];
