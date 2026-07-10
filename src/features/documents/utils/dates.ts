/** Datums-Helfer für Modul 17 (lokale Zeitzone, analog Modul 16). */

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDaysISO(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return toISODate(new Date(year, month - 1, day + days));
}

/** YYYY-MM-DD → DD.MM.YYYY */
export function formatGermanDateFromISO(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}
