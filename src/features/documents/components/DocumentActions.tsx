/**
 * Statusaktionen des Dokument-Editors (Modul 17, Etappe D).
 *
 * Draft: Ausstellen (Pflichtangaben-Gate, sonst deaktiviert mit Liste),
 * Löschen. Issued (Angebot): Angenommen/Abgelehnt, In Rechnung umwandeln.
 * Issued (Rechnung): Als bezahlt markieren (mit Auftrags-Kopplung bzw.
 * Hinweis-Dialog ohne Auftrag), Stornieren. Alle Übergänge laufen über die
 * Service-Funktionen – die UI umgeht die Unveränderbarkeit nie.
 */
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import {
  ArrowRightLeft,
  BadgeCheck,
  BadgeX,
  Ban,
  CheckCircle2,
  FileOutput,
  FileSearch,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BusinessDocument } from '../schemas';
import {
  cancelInvoice,
  convertQuoteToInvoice,
  issueDocument,
  markInvoicePaid,
  markInvoicePaidWithNewOrder,
  markQuoteAccepted,
  markQuoteRejected,
  softDeleteDocument,
} from '../services';

export interface DocumentActionsProps {
  document: BusinessDocument;
  /** Fehlende Pflichtangaben (deaktiviert das Ausstellen mit Begründung). */
  missingRequirements: string[];
  /** Speichert den Entwurf vor dem Ausstellen; null = Speichern fehlgeschlagen. */
  onBeforeIssue: () => Promise<BusinessDocument | null>;
  onChanged: () => void;
  onDeleted: () => void;
}

function errorToast(error: unknown, fallback: string): void {
  toast.error(error instanceof Error ? error.message : fallback);
}

export function DocumentActions({
  document,
  missingRequirements,
  onBeforeIssue,
  onChanged,
  onDeleted,
}: DocumentActionsProps) {
  const navigate = useNavigate();
  const [isBusy, setIsBusy] = useState(false);
  const [paidDialogOpen, setPaidDialogOpen] = useState(false);

  const isDraft = document.status === 'draft';
  const isQuote = document.type === 'quote';
  const isInvoice = document.type === 'invoice';

  async function run(action: () => Promise<void>, fallback: string) {
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      errorToast(error, fallback);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleIssue() {
    await run(async () => {
      const saved = await onBeforeIssue();
      if (!saved) return;
      const issued = await issueDocument(saved.id);
      toast.success(`${isQuote ? 'Angebot' : 'Rechnung'} ${issued.number} ausgestellt`);
      onChanged();
    }, 'Ausstellen fehlgeschlagen');
  }

  async function handleDelete() {
    if (!window.confirm('Entwurf wirklich löschen?')) return;
    await run(async () => {
      await softDeleteDocument(document.id);
      toast.success('Entwurf gelöscht');
      onDeleted();
    }, 'Löschen fehlgeschlagen');
  }

  async function handleAccept() {
    await run(async () => {
      await markQuoteAccepted(document.id);
      toast.success('Angebot als angenommen markiert');
      onChanged();
    }, 'Aktion fehlgeschlagen');
  }

  async function handleReject() {
    await run(async () => {
      await markQuoteRejected(document.id);
      toast.success('Angebot als abgelehnt markiert');
      onChanged();
    }, 'Aktion fehlgeschlagen');
  }

  async function handleConvert() {
    await run(async () => {
      const { invoice } = await convertQuoteToInvoice(document.id);
      toast.success('Rechnungs-Entwurf aus Angebot erstellt');
      void navigate({ to: '/documents/$documentId', params: { documentId: invoice.id } });
    }, 'Umwandlung fehlgeschlagen');
  }

  async function handleMarkPaidClicked() {
    if (!document.order_id) {
      // Ohne verknüpften Auftrag: Hinweis-Dialog (Spec Abschnitt 5)
      setPaidDialogOpen(true);
      return;
    }
    await run(async () => {
      const { order } = await markInvoicePaid(document.id);
      toast.success(
        order
          ? `Rechnung bezahlt – Auftrag ${order.receipt_number} auf bezahlt/abgeschlossen gesetzt`
          : 'Rechnung als bezahlt markiert',
      );
      onChanged();
    }, 'Aktion fehlgeschlagen');
  }

  async function handleMarkPaidWithNewOrder() {
    setPaidDialogOpen(false);
    await run(async () => {
      const { order } = await markInvoicePaidWithNewOrder(document.id);
      toast.success(`Rechnung bezahlt – Auftrag ${order.receipt_number} (Website) erzeugt`);
      onChanged();
    }, 'Aktion fehlgeschlagen');
  }

  async function handleMarkPaidWithoutOrder() {
    setPaidDialogOpen(false);
    await run(async () => {
      await markInvoicePaid(document.id);
      toast.success('Rechnung als bezahlt markiert (ohne Auftrag)');
      onChanged();
    }, 'Aktion fehlgeschlagen');
  }

  async function handleCancel() {
    if (
      !window.confirm(
        `Rechnung ${document.number ?? ''} wirklich stornieren? Es wird eine Gegenrechnung mit negativen Positionen erstellt.`,
      )
    ) {
      return;
    }
    await run(async () => {
      const { storno } = await cancelInvoice(document.id);
      toast.success(`Storniert – Gegenrechnung ${storno.number} erstellt`);
      void navigate({ to: '/documents/$documentId', params: { documentId: storno.id } });
    }, 'Storno fehlgeschlagen');
  }

  async function handleOpenPdf() {
    if (!document.pdf_path) return;
    try {
      await revealItemInDir(document.pdf_path);
    } catch (error) {
      errorToast(error, 'PDF konnte nicht geöffnet werden');
    }
  }

  return (
    <>
      {isDraft ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            disabled={isBusy}
            data-testid="document-delete"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-4 text-danger" />
            Löschen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isBusy || missingRequirements.length > 0}
            title={
              missingRequirements.length > 0
                ? `Pflichtangaben fehlen: ${missingRequirements.join(', ')}`
                : undefined
            }
            data-testid="document-issue"
            onClick={() => void handleIssue()}
          >
            <FileOutput className="size-4" />
            Ausstellen
          </Button>
        </>
      ) : null}

      {isQuote && document.status === 'issued' ? (
        <>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isBusy}
            data-testid="quote-accept"
            onClick={() => void handleAccept()}
          >
            <BadgeCheck className="size-4" />
            Angenommen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isBusy}
            data-testid="quote-reject"
            onClick={() => void handleReject()}
          >
            <BadgeX className="size-4" />
            Abgelehnt
          </Button>
        </>
      ) : null}

      {isQuote && ['issued', 'accepted'].includes(document.status) ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isBusy}
          data-testid="quote-convert"
          onClick={() => void handleConvert()}
        >
          <ArrowRightLeft className="size-4" />
          In Rechnung umwandeln
        </Button>
      ) : null}

      {isInvoice && document.status === 'issued' && document.total >= 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isBusy}
          data-testid="invoice-mark-paid"
          onClick={() => void handleMarkPaidClicked()}
        >
          <CheckCircle2 className="size-4" />
          Als bezahlt markieren
        </Button>
      ) : null}

      {isInvoice && ['issued', 'paid'].includes(document.status) && document.total >= 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isBusy}
          data-testid="invoice-cancel"
          onClick={() => void handleCancel()}
        >
          <Ban className="size-4" />
          Stornieren
        </Button>
      ) : null}

      {document.pdf_path ? (
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          data-testid="document-open-pdf"
          onClick={() => void handleOpenPdf()}
        >
          <FileSearch className="size-4" />
          PDF anzeigen
        </Button>
      ) : null}

      {/* Bezahlt ohne verknüpften Auftrag: Auftrag jetzt erzeugen? */}
      <Dialog open={paidDialogOpen} onOpenChange={setPaidDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kein Auftrag verknüpft</DialogTitle>
            <DialogDescription>
              Damit Umsatz und EÜR stimmen, sollte zur bezahlten Rechnung ein Auftrag (Plattform
              Website) existieren. Jetzt einen bezahlten Auftrag über{' '}
              {document.total.toFixed(2).replace('.', ',')} EUR erzeugen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => setPaidDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="paid-without-order"
              onClick={() => void handleMarkPaidWithoutOrder()}
            >
              Ohne Auftrag markieren
            </Button>
            <Button
              type="button"
              data-testid="paid-create-order"
              onClick={() => void handleMarkPaidWithNewOrder()}
            >
              Auftrag erzeugen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
