/**
 * Smart-Action-Regel order_invoice_mismatch (Modul 08, Status/Payment-Trennung).
 *
 * Erkennt stille Widersprüche zwischen Auftrag und Rechnung: eine verknüpfte,
 * ausgestellte und als bezahlt markierte Rechnung, während der Auftrag NICHT
 * auf payment_status='paid' steht (z.B. Altdaten). Solche Fälle würden die
 * EÜR-Einnahme unterschlagen und werden deshalb sichtbar gemacht (danger).
 * Registrierung über registerSmartActionRules() im smartActionsService
 * (Registry-Mechanismus aus Modul 15, kein Fork).
 */
import { getDatabase } from '@/services/database';
import type { SmartActionResult, SmartActionRule } from '@/features/smart-actions/types';

interface CountRow {
  count: number | null;
}

const orderInvoiceMismatchRule: SmartActionRule = {
  id: 'order_invoice_mismatch',
  category: 'orders',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const rows = await getDatabase().select<CountRow[]>(
      `SELECT COUNT(*) AS count
       FROM orders o
       WHERE o.deleted_at IS NULL
         AND o.payment_status != 'paid'
         AND EXISTS (
           SELECT 1 FROM documents d
           WHERE d.order_id = o.id
             AND d.type = 'invoice'
             AND d.status = 'paid'
             AND d.deleted_at IS NULL
         )`,
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count === 0) return null;

    return {
      count,
      severity: 'danger',
      message:
        count === 1
          ? '1 Auftrag hat eine bezahlte Rechnung, ist aber nicht als bezahlt markiert'
          : `${count} Aufträge haben eine bezahlte Rechnung, sind aber nicht als bezahlt markiert`,
      targetRoute: '/orders',
      targetSearchParams: { view: 'table' },
    };
  },
};

export const ORDER_SMART_ACTION_RULES: SmartActionRule[] = [orderInvoiceMismatchRule];
