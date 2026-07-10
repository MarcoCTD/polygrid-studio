/**
 * A4-Blatt für Vorschau und Druck (Modul 17). Einziger Eingang: der
 * Snapshot – ausgestellte Dokumente übergeben ihren gespeicherten Snapshot,
 * die Editor-Vorschau einen live komponierten (composeDocumentSnapshot).
 */
import '../../documents-print.css';
import { cn } from '@/lib/utils';
import type { DocumentSnapshot } from '../../schemas';
import { ClassicLayout } from './ClassicLayout';
import { ModernLayout } from './ModernLayout';
import { PolygridLayout } from './PolygridLayout';

export function DocumentSheet({
  snapshot,
  className,
}: {
  snapshot: DocumentSnapshot;
  className?: string;
}) {
  return (
    <div className={cn('pg-doc-sheet shadow-lg', className)} data-testid="document-sheet">
      {snapshot.layout === 'classic' ? (
        <ClassicLayout snapshot={snapshot} />
      ) : snapshot.layout === 'modern' ? (
        <ModernLayout snapshot={snapshot} />
      ) : (
        <PolygridLayout snapshot={snapshot} />
      )}
    </div>
  );
}
