import type { ExpensePeriod } from './utils';

/**
 * Search-Params der Ausgaben-Route.
 * - receipt=missing: nur steuerrelevante Sicht "Beleg fehlt" vorfiltern
 * - period: Zeitraum-Vorauswahl (z.B. current_year von Smart Actions)
 */
export interface ExpensesSearch {
  receipt?: 'missing';
  period?: ExpensePeriod;
}

const PERIODS: ExpensePeriod[] = ['current_month', 'previous_month', 'current_year', 'custom'];

export function validateExpensesSearch(search: Record<string, unknown>): ExpensesSearch {
  const result: ExpensesSearch = {};

  if (search.receipt === 'missing') {
    result.receipt = 'missing';
  }
  if (typeof search.period === 'string' && PERIODS.includes(search.period as ExpensePeriod)) {
    result.period = search.period as ExpensePeriod;
  }

  return result;
}
