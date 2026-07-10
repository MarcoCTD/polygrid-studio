/**
 * Layout "Modern" (Modul 17): viel Weißraum, Akzentfarblinie, Inter.
 * Rendert ausschließlich aus dem Snapshot – keine Livedaten.
 */
import { DOCUMENT_TYPE_LABELS, lineItemTotal, type DocumentSnapshot } from '../../schemas';
import { formatDocumentDate, formatDocumentEUR, formatDocumentQuantity } from './format';

export function ModernLayout({ snapshot }: { snapshot: DocumentSnapshot }) {
  const accent = snapshot.accent_color;
  const title = DOCUMENT_TYPE_LABELS[snapshot.type];
  const issuerName = snapshot.issuer.company_name || snapshot.issuer.owner_name;
  const senderLine = [
    issuerName,
    snapshot.issuer.street,
    `${snapshot.issuer.zip} ${snapshot.issuer.city}`.trim(),
  ]
    .filter(Boolean)
    .join(' · ');

  const metaRows: Array<{ label: string; value: string }> = [
    { label: `${title}snummer`, value: snapshot.number },
    { label: 'Datum', value: formatDocumentDate(snapshot.issue_date) },
  ];
  if (snapshot.type === 'invoice' && snapshot.service_date) {
    metaRows.push({ label: 'Leistungsdatum', value: snapshot.service_date });
  }
  if (snapshot.type === 'invoice' && snapshot.due_date) {
    metaRows.push({ label: 'Fällig am', value: formatDocumentDate(snapshot.due_date) });
  }
  if (snapshot.type === 'quote' && snapshot.valid_until) {
    metaRows.push({ label: 'Gültig bis', value: formatDocumentDate(snapshot.valid_until) });
  }
  if (snapshot.related_document_number) {
    metaRows.push({ label: 'Referenz', value: snapshot.related_document_number });
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Briefkopf */}
      <div
        className="pg-doc-avoid-break"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingBottom: '6mm',
          borderBottom: `2px solid ${accent}`,
        }}
      >
        <div>
          <div style={{ fontSize: '16pt', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {issuerName}
          </div>
          {snapshot.issuer.owner_name && snapshot.issuer.company_name ? (
            <div style={{ fontSize: '9pt', color: '#555' }}>{snapshot.issuer.owner_name}</div>
          ) : null}
        </div>
        {snapshot.logo ? (
          <img
            src={snapshot.logo}
            alt="Logo"
            style={{ maxHeight: '18mm', maxWidth: '50mm', objectFit: 'contain' }}
          />
        ) : null}
      </div>

      {/* Empfänger + Metadaten */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10mm',
          marginTop: '10mm',
        }}
      >
        <div style={{ maxWidth: '90mm' }}>
          <div style={{ fontSize: '7pt', color: '#888', marginBottom: '2mm' }}>{senderLine}</div>
          <div style={{ whiteSpace: 'pre-line' }} data-testid="doc-recipient">
            <strong>{snapshot.recipient.name}</strong>
            {snapshot.recipient.contact_person ? `\n${snapshot.recipient.contact_person}` : ''}
            {snapshot.recipient.address ? `\n${snapshot.recipient.address}` : ''}
          </div>
        </div>
        <table style={{ fontSize: '9.5pt', alignSelf: 'flex-end' }}>
          <tbody>
            {metaRows.map((row) => (
              <tr key={row.label}>
                <td style={{ color: '#666', paddingRight: '6mm', whiteSpace: 'nowrap' }}>
                  {row.label}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Titel */}
      <h1
        style={{ fontSize: '15pt', fontWeight: 700, margin: '10mm 0 3mm', color: accent }}
        data-testid="doc-title"
      >
        {title} {snapshot.number}
      </h1>

      {snapshot.intro_text ? (
        <p style={{ margin: '0 0 5mm', whiteSpace: 'pre-line' }} data-testid="doc-intro">
          {snapshot.intro_text}
        </p>
      ) : null}

      {/* Positionen – thead wiederholt sich auf Folgeseiten */}
      <table className="pg-doc-positions" data-testid="doc-positions">
        <thead>
          <tr>
            <td
              colSpan={5}
              style={{ fontSize: '7pt', color: '#999', paddingBottom: '1.5mm' }}
              aria-hidden
            >
              {title} {snapshot.number} · {issuerName}
            </td>
          </tr>
          <tr style={{ borderBottom: `1.5px solid ${accent}` }}>
            <th style={{ padding: '2mm 2mm 2mm 0', width: '8mm' }}>Pos.</th>
            <th style={{ padding: '2mm' }}>Beschreibung</th>
            <th className="pg-doc-num" style={{ padding: '2mm', width: '18mm' }}>
              Menge
            </th>
            <th className="pg-doc-num" style={{ padding: '2mm', width: '26mm' }}>
              Einzelpreis
            </th>
            <th className="pg-doc-num" style={{ padding: '2mm 0 2mm 2mm', width: '26mm' }}>
              Gesamt
            </th>
          </tr>
        </thead>
        <tbody>
          {snapshot.line_items.map((item, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '2.5mm 2mm 2.5mm 0', color: '#888' }}>{index + 1}</td>
              <td style={{ padding: '2.5mm 2mm', whiteSpace: 'pre-line' }}>{item.description}</td>
              <td className="pg-doc-num" style={{ padding: '2.5mm 2mm' }}>
                {formatDocumentQuantity(item.quantity)}
              </td>
              <td className="pg-doc-num" style={{ padding: '2.5mm 2mm' }}>
                {formatDocumentEUR(item.unit_price)}
              </td>
              <td className="pg-doc-num" style={{ padding: '2.5mm 0 2.5mm 2mm' }}>
                {formatDocumentEUR(lineItemTotal(item))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summen */}
      <div
        className="pg-doc-avoid-break"
        style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4mm' }}
      >
        <div style={{ minWidth: '70mm' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10mm',
              padding: '2.5mm 0',
              borderTop: `2px solid ${accent}`,
              fontSize: '12pt',
              fontWeight: 700,
            }}
            data-testid="doc-total"
          >
            <span>Gesamtbetrag</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatDocumentEUR(snapshot.total)}
            </span>
          </div>
        </div>
      </div>

      {/* §19-Satz (Rechnung, Pflicht) + Zahlungshinweis */}
      <div className="pg-doc-avoid-break" style={{ marginTop: '6mm' }}>
        {snapshot.kleinunternehmer_hinweis ? (
          <p style={{ margin: '0 0 2mm', fontSize: '9pt' }} data-testid="doc-kleinunternehmer">
            {snapshot.kleinunternehmer_hinweis}
          </p>
        ) : null}
        {snapshot.type === 'invoice' && snapshot.due_date && snapshot.total >= 0 ? (
          <p style={{ margin: '0 0 2mm', fontSize: '9pt' }}>
            Bitte überweisen Sie den Gesamtbetrag bis zum {formatDocumentDate(snapshot.due_date)}{' '}
            auf das unten angegebene Konto.
          </p>
        ) : null}
        {snapshot.outro_text ? (
          <p style={{ margin: '2mm 0 0', whiteSpace: 'pre-line' }} data-testid="doc-outro">
            {snapshot.outro_text}
          </p>
        ) : null}
      </div>

      {/* Fußzeile: Kontakt / Bank / Steuer */}
      <div
        className="pg-doc-avoid-break"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8mm',
          marginTop: '14mm',
          paddingTop: '3mm',
          borderTop: '1px solid #ddd',
          fontSize: '7.5pt',
          color: '#666',
        }}
        data-testid="doc-footer"
      >
        <div>
          <div>{issuerName}</div>
          <div>{snapshot.issuer.street}</div>
          <div>
            {snapshot.issuer.zip} {snapshot.issuer.city}
          </div>
        </div>
        <div>
          {snapshot.issuer.bank_name ? <div>{snapshot.issuer.bank_name}</div> : null}
          {snapshot.issuer.iban ? <div>IBAN: {snapshot.issuer.iban}</div> : null}
          {snapshot.issuer.bic ? <div>BIC: {snapshot.issuer.bic}</div> : null}
        </div>
        <div>
          {snapshot.issuer.tax_number ? (
            <div>Steuernummer: {snapshot.issuer.tax_number}</div>
          ) : null}
          {snapshot.issuer.vat_id ? <div>USt-IdNr: {snapshot.issuer.vat_id}</div> : null}
        </div>
      </div>
    </div>
  );
}
