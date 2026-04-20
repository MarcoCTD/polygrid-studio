/**
 * Formatiert einen ISO-Timestamp als relatives Datum (z.B. "vor 3 Minuten").
 */
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSec < 60) return 'Gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  if (diffWeeks < 4) return `vor ${diffWeeks} Wo.`;
  if (diffMonths < 12) return `vor ${diffMonths} Mon.`;

  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formatiert einen Preis als EUR-String.
 */
export function formatEUR(value: number | null): string {
  if (value === null || value === undefined) return '–';
  return value.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
}
