/**
 * Baustein-Rendering für die Dokument-Layouts (Addendum Modul 17).
 *
 * Rendert ausschließlich die im Snapshot eingefrorenen (= beim Ausstellen
 * aktivierten) Bausteine. validity_signature erhält Unterschriftslinien
 * "Ort, Datum" und "Unterschrift {Empfänger}" (Spec 3.2).
 *
 * ContentBlocksSection ist die schlichte Variante für modern/classic;
 * das polygrid-Layout nutzt ContentBlockBody mit eigenem Rahmen.
 */
import type { ContentBlock, DocumentSnapshot } from '../../schemas';

export function ContentBlockBody({
  block,
  recipientName,
}: {
  block: ContentBlock;
  recipientName: string;
}) {
  return (
    <>
      {block.body_type === 'bullets' ? (
        <ul className="pg-doc-block-list">
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="pg-doc-block-text">{block.text}</p>
      )}
      {block.kind === 'validity_signature' ? (
        <div className="pg-doc-signature" data-testid="doc-signature">
          <div className="pg-doc-signature-field">
            <div className="pg-doc-signature-line" />
            <div>Ort, Datum</div>
          </div>
          <div className="pg-doc-signature-field">
            <div className="pg-doc-signature-line" />
            <div>Unterschrift {recipientName}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ContentBlocksSection({
  snapshot,
  titleColor,
}: {
  snapshot: DocumentSnapshot;
  titleColor?: string;
}) {
  if (snapshot.content_blocks.length === 0) return null;
  return (
    <div style={{ marginTop: '8mm' }} data-testid="doc-blocks">
      {snapshot.content_blocks.map((block) => (
        <section key={block.id} className="pg-doc-block" data-testid={`doc-block-${block.kind}`}>
          <h3 className="pg-doc-block-title" style={titleColor ? { color: titleColor } : undefined}>
            {block.title}
          </h3>
          <ContentBlockBody block={block} recipientName={snapshot.recipient.name} />
        </section>
      ))}
    </div>
  );
}
