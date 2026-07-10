/**
 * Neues Angebot / Neue Rechnung (Modul 17): legt einen Draft an und
 * öffnet den Editor. Kunde ist Pflicht, alles Weitere folgt im Editor.
 */
import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ClientListItem } from '@/features/websites/schemas';
import { DOCUMENT_TYPE_LABELS, type BusinessDocument, type DocumentType } from '../schemas';
import { createDocument } from '../services';

interface NewDocumentModalProps {
  /** null = geschlossen */
  type: DocumentType | null;
  onOpenChange: (open: boolean) => void;
  clients: ClientListItem[];
  onCreated: (document: BusinessDocument) => void;
}

export function NewDocumentModal({
  type,
  onOpenChange,
  clients,
  onCreated,
}: NewDocumentModalProps) {
  const [clientId, setClientId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate() {
    if (!type) return;
    if (!clientId) {
      toast.error('Bitte einen Kunden wählen.');
      return;
    }
    setIsSubmitting(true);
    try {
      const document = await createDocument({ type, client_id: clientId });
      toast.success(`${DOCUMENT_TYPE_LABELS[type]}s-Entwurf angelegt`);
      setClientId('');
      onOpenChange(false);
      onCreated(document);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dokument konnte nicht angelegt werden');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={type !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type ? `Neue${type === 'quote' ? 's Angebot' : ' Rechnung'}` : ''}
          </DialogTitle>
          <DialogDescription>
            Wähle den Kunden – Positionen und Texte folgen im Editor.
          </DialogDescription>
        </DialogHeader>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Kunde *</span>
          <Select value={clientId} onValueChange={(value) => setClientId(value ?? '')}>
            <SelectTrigger className="w-full" data-testid="new-document-client">
              <SelectValue>
                {clients.find((client) => client.id === clientId)?.name ?? 'Kunde wählen'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {clients.length === 0 ? (
          <p className="text-xs text-text-secondary">
            Noch keine Kunden vorhanden – lege zuerst im Tab „Kunden" einen an.
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || !clientId}
            data-testid="new-document-create"
            onClick={() => void handleCreate()}
          >
            Entwurf anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
