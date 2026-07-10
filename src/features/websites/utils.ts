/**
 * Formular-Helfer (Modul 16).
 *
 * setValueAs für optionale Zahlenfelder: React Hook Form reicht auch den
 * Default-Wert (null) durch setValueAs – ein naives Number(value) würde
 * daraus 0 machen (Number(null) === 0). Leere Eingaben bleiben hier null.
 */
export function numberOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
