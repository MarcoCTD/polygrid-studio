/**
 * Smart-Action-Regel invoice_overdue (Modul 17, Spec Abschnitt 6).
 *
 * Rechnung issued, due_date überschritten, nicht paid/cancelled → danger,
 * Ziel: Dokumente-Tab der Websites-Seite, gefiltert auf überfällig.
 * Registrierung über registerSmartActionRules() im smartActionsService
 * (Registry-Mechanismus aus Modul 15, kein Fork).
 */
import { getDatabase } from '@/services/database';
import type { SmartActionResult, SmartActionRule } from '@/features/smart-actions/types';
import { toISODate } from './utils/dates';

interface CountRow {
  count: number | null;
}

const invoiceOverdueRule: SmartActionRule = {
  id: 'invoice_overdue',
  category: 'documents',
  evaluate: async (): Promise<SmartActionResult | null> => {
    const rows = await getDatabase().select<CountRow[]>(
      `SELECT COUNT(*) AS count FROM documents
       WHERE deleted_at IS NULL
         AND type = 'invoice'
         AND status = 'issued'
         AND due_date IS NOT NULL
         AND due_date < $1`,
      [toISODate(new Date())],
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count === 0) return null;

    return {
      count,
      severity: 'danger',
      message: count === 1 ? '1 Rechnung ist überfällig' : `${count} Rechnungen sind überfällig`,
      targetRoute: '/websites',
      targetSearchParams: { tab: 'documents', filter: 'overdue' },
    };
  },
};

export const DOCUMENT_SMART_ACTION_RULES: SmartActionRule[] = [invoiceOverdueRule];
