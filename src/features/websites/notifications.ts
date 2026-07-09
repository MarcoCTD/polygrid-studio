/**
 * Toast-Ausgabe der Website-Recurring-Engine (Modul 16), getrennt von der
 * Engine selbst – gleiches Muster wie playbooks/notifications.ts.
 */
import { toast } from 'sonner';
import { MAX_CATCHUP_PERIODS, type WebsiteRecurringRunResult } from './services/recurringEngine';

export function notifyWebsiteRecurringResult(result: WebsiteRecurringRunResult): void {
  const parts: string[] = [];
  if (result.expensesCreated > 0) {
    parts.push(
      `${result.expensesCreated} ${result.expensesCreated === 1 ? 'Ausgabe' : 'Ausgaben'}`,
    );
  }
  if (result.ordersCreated > 0) {
    parts.push(
      `${result.ordersCreated} ${result.ordersCreated === 1 ? 'Auftrags-Entwurf' : 'Auftrags-Entwürfe'}`,
    );
  }
  if (parts.length > 0) {
    toast.success(`Website-Posten: ${parts.join(' und ')} automatisch erzeugt`);
  }

  for (const label of result.cappedLabels) {
    toast.warning(
      `„${label}“: mehr als ${MAX_CATCHUP_PERIODS} Perioden fällig – nur die letzten ${MAX_CATCHUP_PERIODS} wurden nachgeholt.`,
    );
  }

  for (const error of result.errors) {
    toast.error(`Website-Posten übersprungen – ${error}`);
  }
}
