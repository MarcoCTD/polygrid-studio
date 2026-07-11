/**
 * Layout "PolyGrid" (Addendum Modul 17, Spec Abschnitt 2) – Default-Layout,
 * dem manuell erstellten Angebots-Design nachempfunden
 * (docs/assets/referenz-angebot.pdf). Rendert ausschließlich aus dem Snapshot.
 *
 * Aufbau: Logo links / Dokumenttyp groß rechts mit Metazeilen, kräftige
 * Markenfarben-Linie, VON/AN-Spalten, Positionstabelle mit dunkler Kopfzeile
 * (Mengenspalte nur bei Mengen ≠ 1), Summenzeile mit kräftigen Linien,
 * §19-Satz kursiv, danach die Bausteine. Fußzeile auf jeder Druckseite
 * über den tfoot des Rahmen-Table (pg-polygrid-frame).
 */
import { hexToHSL, hslToHex } from '@/utils/colors';
import { DOCUMENT_TYPE_LABELS, lineItemTotal, type DocumentSnapshot } from '../../schemas';
import { ContentBlockBody } from './ContentBlocksSection';
import { formatDocumentDate, formatDocumentEUR, formatDocumentQuantity } from './format';

const DARK = '#161616';

/** Positionstitel = erste Zeile der Beschreibung, Rest ist Detailtext (grau). */
function splitDescription(description: string): { title: string; detail: string } {
  const [first, ...rest] = description.split('\n');
  return { title: first, detail: rest.join('\n').trim() };
}

/**
 * Subtle-Variante der Markenfarbe für den Optional-Kasten (Addendum 2,
 * Spec 3): gleiche Formel wie das Akzentfarben-System (Hell-Modus), da der
 * Snapshot nur den aufgelösten Hex-Wert trägt und das Blatt immer hell ist.
 */
function subtleAccent(accentHex: string): string {
  try {
    const hsl = hexToHSL(accentHex);
    return hslToHex({ h: hsl.h, s: Math.max(0, hsl.s - 20), l: 95 });
  } catch {
    return '#F2F2F2';
  }
}

export function PolygridLayout({ snapshot }: { snapshot: DocumentSnapshot }) {
  const accent = snapshot.accent_color;
  const title = DOCUMENT_TYPE_LABELS[snapshot.type];
  const issuerName =
    snapshot.issuer.company_name && snapshot.issuer.owner_name
      ? `${snapshot.issuer.company_name} – ${snapshot.issuer.owner_name}`
      : snapshot.issuer.company_name || snapshot.issuer.owner_name;
  // Mengenspalte nur, wenn nicht alle Positionen Menge 1 haben (Spec Abschnitt 2)
  const showQuantity = snapshot.line_items.some((item) => item.quantity !== 1);

  const metaRows: Array<{ label: string; value: string }> =
    snapshot.type === 'invoice'
      ? [
          { label: 'Rechnungsnr.:', value: snapshot.number },
          { label: 'Rechnungsdatum:', value: formatDocumentDate(snapshot.issue_date) },
          ...(snapshot.service_date
            ? [{ label: 'Leistungsdatum/-zeitraum:', value: snapshot.service_date }]
            : []),
          ...(snapshot.due_date
            ? [{ label: 'Fällig bis:', value: formatDocumentDate(snapshot.due_date) }]
            : []),
        ]
      : [
          { label: 'Angebotsnr.:', value: snapshot.number },
          { label: 'Datum:', value: formatDocumentDate(snapshot.issue_date) },
        ];
  if (snapshot.related_document_number) {
    metaRows.push({ label: 'Referenz:', value: snapshot.related_document_number });
  }

  const footerLine = [
    snapshot.issuer.company_name,
    snapshot.issuer.owner_name,
    snapshot.issuer.email,
    snapshot.issuer.website,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <table className="pg-polygrid-frame" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* tfoot wiederholt sich im Druck auf jeder Seite (Spec: Fußzeile jede Seite) */}
      <tfoot>
        <tr>
          <td>
            <div className="pg-polygrid-footer" data-testid="doc-footer">
              {footerLine}
            </div>
          </td>
        </tr>
      </tfoot>
      <tbody>
        <tr>
          <td>
            {/* Kopf: Logo links, Dokumenttyp groß rechts mit Metazeilen */}
            <div
              className="pg-doc-avoid-break"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div style={{ paddingTop: '1mm' }}>
                {snapshot.logo ? (
                  <img
                    src={snapshot.logo}
                    alt="Logo"
                    style={{ maxHeight: '22mm', maxWidth: '55mm', objectFit: 'contain' }}
                  />
                ) : (
                  // Ohne konfiguriertes Logo: Firmenname fett in Markenfarbe,
                  // nie eine leere Lücke (Addendum 2, Spec 5)
                  <div
                    style={{ fontSize: '14pt', fontWeight: 700, color: accent }}
                    data-testid="doc-logo-fallback"
                  >
                    {snapshot.issuer.company_name || snapshot.issuer.owner_name}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  data-testid="doc-title"
                  style={{
                    fontSize: '24pt',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    lineHeight: 1.15,
                  }}
                >
                  {title}
                </div>
                <table
                  data-testid="doc-meta"
                  style={{ fontSize: '9pt', marginLeft: 'auto', marginTop: '1.5mm' }}
                >
                  <tbody>
                    {metaRows.map((row) => (
                      <tr key={row.label}>
                        <td style={{ color: '#555', paddingRight: '3mm', textAlign: 'right' }}>
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
            </div>

            {/* Kräftige horizontale Linie in der Markenfarbe (ca. 3px) */}
            <div style={{ height: '3px', background: accent, margin: '4mm 0 7mm' }} />

            {/* Zwei Spalten: VON / AN */}
            <div style={{ display: 'flex', gap: '14mm', fontSize: '9.5pt' }}>
              <div style={{ flex: 1 }} data-testid="doc-issuer">
                <div className="pg-polygrid-label" style={{ color: accent }}>
                  VON
                </div>
                <div style={{ fontWeight: 700 }}>{issuerName}</div>
                {snapshot.issuer.street ? <div>{snapshot.issuer.street}</div> : null}
                {snapshot.issuer.zip || snapshot.issuer.city ? (
                  <div>
                    {snapshot.issuer.zip} {snapshot.issuer.city}
                  </div>
                ) : null}
                {snapshot.issuer.email ? <div>{snapshot.issuer.email}</div> : null}
                {snapshot.issuer.phone ? <div>{snapshot.issuer.phone}</div> : null}
              </div>
              <div style={{ flex: 1 }} data-testid="doc-recipient">
                <div className="pg-polygrid-label" style={{ color: accent }}>
                  AN
                </div>
                <div style={{ fontWeight: 700 }}>{snapshot.recipient.name}</div>
                {snapshot.recipient.contact_person ? (
                  <div>{snapshot.recipient.contact_person}</div>
                ) : null}
                {snapshot.recipient.address ? (
                  <div style={{ whiteSpace: 'pre-line' }}>{snapshot.recipient.address}</div>
                ) : null}
                {snapshot.recipient.email ? <div>{snapshot.recipient.email}</div> : null}
              </div>
            </div>

            {/* Anrede / Einleitungstext */}
            {snapshot.intro_text ? (
              <p style={{ margin: '7mm 0 0', whiteSpace: 'pre-line' }} data-testid="doc-intro">
                {snapshot.intro_text}
              </p>
            ) : null}

            {/* Positionstabelle: dunkle Kopfzeile, weiße Versalien */}
            <table
              className="pg-doc-positions pg-polygrid-positions"
              data-testid="doc-positions"
              style={{ marginTop: '6mm' }}
            >
              <thead>
                <tr>
                  <th style={{ width: '10mm' }}>POS.</th>
                  <th>BESCHREIBUNG</th>
                  {showQuantity ? (
                    <>
                      <th className="pg-doc-num" style={{ width: '16mm' }} data-testid="col-menge">
                        MENGE
                      </th>
                      <th className="pg-doc-num" style={{ width: '26mm' }}>
                        EINZELPREIS
                      </th>
                    </>
                  ) : null}
                  <th className="pg-doc-num" style={{ width: '26mm' }}>
                    BETRAG
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshot.line_items.map((item, index) => {
                  const { title: itemTitle, detail } = splitDescription(item.description);
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #e5e5e5' }}>
                      <td style={{ padding: '3mm 2mm 3mm 3mm', color: '#777' }}>{index + 1}</td>
                      <td style={{ padding: '3mm' }}>
                        <div style={{ fontWeight: 700 }}>{itemTitle}</div>
                        {detail ? (
                          <div
                            style={{
                              fontSize: '8.5pt',
                              color: '#666',
                              whiteSpace: 'pre-line',
                              marginTop: '1mm',
                            }}
                          >
                            {detail}
                          </div>
                        ) : null}
                      </td>
                      {showQuantity ? (
                        <>
                          <td className="pg-doc-num" style={{ padding: '3mm' }}>
                            {formatDocumentQuantity(item.quantity)}
                          </td>
                          <td className="pg-doc-num" style={{ padding: '3mm' }}>
                            {formatDocumentEUR(item.unit_price)}
                          </td>
                        </>
                      ) : null}
                      <td className="pg-doc-num" style={{ padding: '3mm' }}>
                        {formatDocumentEUR(lineItemTotal(item))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Summenzeile: fett, größer, oben und unten kräftige Linien */}
            <div
              className="pg-doc-avoid-break"
              data-testid="doc-total"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderTop: `2px solid ${DARK}`,
                borderBottom: `2px solid ${DARK}`,
                fontWeight: 700,
                fontSize: '12.5pt',
                padding: '3mm',
                marginTop: '1mm',
              }}
            >
              <span>{snapshot.type === 'quote' ? 'Gesamtbetrag (Festpreis)' : 'Gesamtbetrag'}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatDocumentEUR(snapshot.total)}
              </span>
            </div>

            {/* §19-Satz: direkt darunter, kursiv, klein (fix, nicht abwählbar) */}
            {snapshot.kleinunternehmer_hinweis ? (
              <p
                data-testid="doc-kleinunternehmer"
                style={{
                  margin: '2mm 3mm 0',
                  fontStyle: 'italic',
                  fontSize: '8.5pt',
                  color: '#555',
                }}
              >
                {snapshot.kleinunternehmer_hinweis}
              </p>
            ) : null}

            {snapshot.outro_text ? (
              <p style={{ margin: '5mm 0 0', whiteSpace: 'pre-line' }} data-testid="doc-outro">
                {snapshot.outro_text}
              </p>
            ) : null}

            {/* Bausteine fließen nach der Summenzeile (Spec Abschnitt 2).
                optional_offer (und nur dieser) wird als Markenfarben-Kasten
                gerendert (Addendum 2, Spec 3) – reine Darstellung des kind. */}
            {snapshot.content_blocks.length > 0 ? (
              <div style={{ marginTop: '9mm' }} data-testid="doc-blocks">
                {snapshot.content_blocks.map((block) => {
                  const isOptionalBox = block.kind === 'optional_offer';
                  return (
                    <section
                      key={block.id}
                      className={
                        isOptionalBox ? 'pg-doc-block pg-polygrid-optional' : 'pg-doc-block'
                      }
                      style={
                        isOptionalBox
                          ? {
                              background: subtleAccent(accent),
                              borderLeft: `3px solid ${accent}`,
                            }
                          : undefined
                      }
                      data-testid={`doc-block-${block.kind}`}
                    >
                      <h3
                        className="pg-doc-block-title"
                        style={{ color: isOptionalBox ? accent : DARK }}
                      >
                        {block.title}
                      </h3>
                      <ContentBlockBody block={block} recipientName={snapshot.recipient.name} />
                    </section>
                  );
                })}
              </div>
            ) : null}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
