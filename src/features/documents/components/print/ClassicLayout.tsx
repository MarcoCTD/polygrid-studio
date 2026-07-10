/**
 * Layout "Klassisch" (Modul 17): konservativ, schwarz-weiß, klare Linien.
 * Rendert ausschließlich aus dem Snapshot – keine Livedaten.
 */
import { DOCUMENT_TYPE_LABELS, lineItemTotal, type DocumentSnapshot } from '../../schemas';
import { formatDocumentDate, formatDocumentEUR, formatDocumentQuantity } from './format';

export function ClassicLayout({ snapshot }: { snapshot: DocumentSnapshot }) {
  const title = DOCUMENT_TYPE_LABELS[snapshot.type];
  const issuerName = snapshot.issuer.company_name || snapshot.issuer.owner_name;
  const senderLine = [
    issuerName,
    snapshot.issuer.street,
    `${snapshot.issuer.zip} ${snapshot.issuer.city}`.trim(),
  ]
    .filter(Boolean)
    .join(', ');

  const metaRows: Array<{ label: string; value: string }> = [
    { label: `${title}snummer:`, value: snapshot.number },
    { label: 'Datum:', value: formatDocumentDate(snapshot.issue_date) },
  ];
  if (snapshot.type === 'invoice' && snapshot.service_date) {
    metaRows.push({ label: 'Leistungsdatum:', value: snapshot.service_date });
  }
  if (snapshot.type === 'invoice' && snapshot.due_date) {
    metaRows.push({ label: 'Zahlbar bis:', value: formatDocumentDate(snapshot.due_date) });
  }
  if (snapshot.type === 'quote' && snapshot.valid_until) {
    metaRows.push({ label: 'Gültig bis:', value: formatDocumentDate(snapshot.valid_until) });
  }
  if (snapshot.related_document_number) {
    metaRows.push({ label: 'Referenz:', value: snapshot.related_document_number });
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#000' }}>
      {/* Briefkopf: zentriert, konservativ */}
      <div
        className="pg-doc-avoid-break"
        style={{
          textAlign: 'center',
          paddingBottom: '5mm',
          borderBottom: '1px solid #000',
        }}
      >
        {snapshot.logo ? (
          <img
            src={snapshot.logo}
            alt="Logo"
            style={{
              maxHeight: '14mm',
              maxWidth: '45mm',
              objectFit: 'contain',
              margin: '0 auto 2mm',
            }}
          />
        ) : null}
        <div style={{ fontSize: '14pt', fontWeight: 700 }}>{issuerName}</div>
        <div style={{ fontSize: '9pt' }}>
          {snapshot.issuer.owner_name && snapshot.issuer.company_name
            ? `Inhaber: ${snapshot.issuer.owner_name} · `
            : ''}
          {snapshot.issuer.street}, {snapshot.issuer.zip} {snapshot.issuer.city}
        </div>
      </div>

      {/* Empfänger + Metadaten */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', gap: '10mm', marginTop: '10mm' }}
      >
        <div style={{ maxWidth: '90mm' }}>
          <div
            style={{
              fontSize: '7pt',
              textDecoration: 'underline',
              marginBottom: '2mm',
            }}
          >
            {senderLine}
          </div>
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
                <td style={{ paddingRight: '6mm', whiteSpace: 'nowrap' }}>{row.label}</td>
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
        style={{
          fontSize: '13pt',
          fontWeight: 700,
          margin: '10mm 0 3mm',
          textDecoration: 'underline',
        }}
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
            <td colSpan={5} style={{ fontSize: '7pt', paddingBottom: '1.5mm' }} aria-hidden>
              {title} {snapshot.number} – {issuerName}
            </td>
          </tr>
          <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
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
            <tr key={index} style={{ borderBottom: '1px solid #bbb' }}>
              <td style={{ padding: '2.5mm 2mm 2.5mm 0' }}>{index + 1}</td>
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
              borderTop: '2px double #000',
              fontSize: '11.5pt',
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

      {/* Fußzeile */}
      <div
        className="pg-doc-avoid-break"
        style={{
          marginTop: '14mm',
          paddingTop: '3mm',
          borderTop: '1px solid #000',
          fontSize: '7.5pt',
          textAlign: 'center',
        }}
        data-testid="doc-footer"
      >
        <div>
          {[
            snapshot.issuer.bank_name,
            snapshot.issuer.iban ? `IBAN: ${snapshot.issuer.iban}` : '',
            snapshot.issuer.bic ? `BIC: ${snapshot.issuer.bic}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
        <div>
          {[
            snapshot.issuer.tax_number ? `Steuernummer: ${snapshot.issuer.tax_number}` : '',
            snapshot.issuer.vat_id ? `USt-IdNr: ${snapshot.issuer.vat_id}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
    </div>
  );
}
