/** Formatierungs-Helfer für die Dokument-Layouts (deutsches Format). */

const EUR_FORMAT = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const QUANTITY_FORMAT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

export function formatDocumentEUR(value: number): string {
  return EUR_FORMAT.format(value);
}

export function formatDocumentQuantity(value: number): string {
  return QUANTITY_FORMAT.format(value);
}

/** ISO (YYYY-MM-DD) → DD.MM.YYYY; alles andere unverändert. */
export function formatDocumentDate(value: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}
