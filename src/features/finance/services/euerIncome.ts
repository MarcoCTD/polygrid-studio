/**
 * EÜR-Einnahmen-Erkennung auf Auftragsseite – rein, ohne DB/Tauri, damit die
 * fachliche Invariante (keine Verschlechterung der Einnahmenerkennung durch die
 * Status/Payment-Trennung, Modul 08) unit-testbar bleibt.
 *
 * Vor der Trennung galt: `status IN ('paid','shipped','completed')` (ohne
 * payment_status-Prüfung, siehe euerExportService historisch). Der Auftragsstatus
 * 'paid' wurde abgeschafft; Migration 0017 setzt solche Aufträge auf
 * `confirmed` + `payment_status='paid'`. Die neue Erkennung übersetzt 'paid'
 * deshalb faithful zu `(status='confirmed' AND payment_status='paid')`.
 * shipped/completed bleiben unverändert. Ergebnis: exakt dieselbe Auftragsmenge
 * zählt weiter als Einnahme, keine fällt heraus.
 *
 * WICHTIG: SQL-Fragment und TS-Spiegel müssen synchron bleiben.
 */

/** SQL-Fragment für WHERE-Klauseln (Alias `o` = orders). */
export const EUER_ORDER_INCOME_SQL =
  "(o.status IN ('shipped', 'completed') OR (o.status = 'confirmed' AND o.payment_status = 'paid'))";

/** TS-Spiegel von EUER_ORDER_INCOME_SQL. */
export function orderCountsAsEuerIncome(status: string, paymentStatus: string): boolean {
  return (
    status === 'shipped' ||
    status === 'completed' ||
    (status === 'confirmed' && paymentStatus === 'paid')
  );
}
