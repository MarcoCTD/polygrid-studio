/**
 * Search-Params der Aufgaben-Route.
 * - view=list: Listenansicht statt Wochenansicht öffnen
 * - overdue=1: Überfällig-Filter der Listenansicht vorsetzen
 */
export interface TasksSearch {
  view?: 'week' | 'list';
  overdue?: boolean;
}

function toBooleanFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function validateTasksSearch(search: Record<string, unknown>): TasksSearch {
  const result: TasksSearch = {};

  if (search.view === 'week' || search.view === 'list') {
    result.view = search.view;
  }
  if (toBooleanFlag(search.overdue)) {
    result.overdue = true;
  }

  return result;
}
