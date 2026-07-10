/**
 * Dokumente-Tab der Websites-Seite (Modul 17, Spec Abschnitt 5).
 * Tabelle mit Typ, Nummer, Kunde, Betrag, Status, Datum und
 * Fällig/Gültig-bis; Klick öffnet den Editor. Der Steuerberater-Hinweis
 * ist dauerhaft sichtbar (Spec Abschnitt 1).
 */
import { Info } from 'lucide-react';
import { formatEUR } from '@/features/products/utils';
import { cn } from '@/lib/utils';
import { isInvoiceOverdue, type DocumentListItem } from '../schemas';
import { toISODate } from '../utils/dates';
import { DocumentStatusBadge, DocumentTypeBadge } from './DocumentBadges';
import { formatDocumentDate } from './print/format';

interface DocumentsTabProps {
  documents: DocumentListItem[];
  isLoading: boolean;
  onOpenDocument: (document: DocumentListItem) => void;
}

export function DocumentsTab({ documents, isLoading, onOpenDocument }: DocumentsTabProps) {
  const today = toISODate(new Date());

  return (
    <div className="flex-1 overflow-auto p-6" data-testid="documents-tab">
      {/* Dauerhafter Hinweis (Spec 1): kein Ersatz für steuerliche Beratung */}
      <div
        className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-secondary"
        data-testid="steuerberater-hinweis"
      >
        <Info className="size-4 shrink-0 text-pg-accent" />
        Lass eine Beispielrechnung von deinem Steuerberater prüfen – die App erzwingt die
        Pflichtangaben, ersetzt aber keine steuerliche Beratung.
      </div>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Dokumente werden geladen...</p>
      ) : documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-secondary">
          Noch keine Dokumente. Lege über „Neues Angebot" oder „Neue Rechnung" los.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm" data-testid="documents-table">
            <thead className="bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">Typ</th>
                <th className="px-3 py-2 font-medium">Nummer</th>
                <th className="px-3 py-2 font-medium">Kunde</th>
                <th className="px-3 py-2 text-right font-medium">Betrag</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Datum</th>
                <th className="px-3 py-2 font-medium">Fällig / Gültig bis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((document) => {
                const overdue = isInvoiceOverdue(document, today);
                return (
                  <tr
                    key={document.id}
                    className="cursor-pointer bg-bg-elevated transition-colors hover:bg-bg-hover"
                    data-testid={`document-row-${document.id}`}
                    onClick={() => onOpenDocument(document)}
                  >
                    <td className="px-3 py-2">
                      <DocumentTypeBadge type={document.type} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {document.number ?? <span className="text-text-muted">Entwurf</span>}
                    </td>
                    <td className="px-3 py-2">{document.client_name}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        document.total < 0 && 'text-red-700 dark:text-red-400',
                      )}
                    >
                      {formatEUR(document.total)}
                    </td>
                    <td className="px-3 py-2">
                      <DocumentStatusBadge status={document.status} overdue={overdue} />
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {formatDocumentDate(document.issue_date) ||
                        formatDocumentDate(document.created_at.slice(0, 10))}
                    </td>
                    <td
                      className={cn('px-3 py-2', overdue ? 'text-danger' : 'text-text-secondary')}
                    >
                      {document.type === 'invoice'
                        ? formatDocumentDate(document.due_date)
                        : formatDocumentDate(document.valid_until)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
