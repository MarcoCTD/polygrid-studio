/**
 * Zugangsdaten-Bereich (Modul 16) für Kunden- und Projekt-Detail-Panels.
 *
 * Metadaten (Label, Benutzername, URL) liegen am Datensatz, das Secret nur im
 * OS-Keychain. Anzeige maskiert, Auge-Button lädt das Secret erst auf Klick,
 * Kopieren liest aus dem Keychain ohne Anzeige. Löschen eines Eintrags löscht
 * auch den Keychain-Eintrag.
 */
import { useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound, Plus, Trash2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import type { CredentialMeta } from '../schemas';
import {
  copyCredentialSecret,
  deleteCredentialSecret,
  getCredentialSecret,
  setCredentialSecret,
} from '../services/credentialsService';

interface CredentialsSectionProps {
  credentials: CredentialMeta[];
  /** Persistiert die neue Metadaten-Liste am Kunden bzw. Projekt. */
  onPersist: (credentials: CredentialMeta[]) => Promise<void>;
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function CredentialRow({
  credential,
  onDelete,
}: {
  credential: CredentialMeta;
  onDelete: (credential: CredentialMeta) => void;
}) {
  const [visibleSecret, setVisibleSecret] = useState<string | null>(null);

  async function toggleSecret() {
    if (visibleSecret !== null) {
      setVisibleSecret(null);
      return;
    }
    try {
      const secret = await getCredentialSecret(credential.id);
      if (secret === null) {
        toast.error('Kein Secret im Keychain hinterlegt.');
        return;
      }
      setVisibleSecret(secret);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Secret konnte nicht gelesen werden');
    }
  }

  async function copySecret() {
    try {
      await copyCredentialSecret(credential.id);
      toast.success('Secret in die Zwischenablage kopiert');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Secret konnte nicht kopiert werden');
    }
  }

  return (
    <div
      className="rounded-lg border border-border-subtle bg-bg-secondary p-3"
      data-testid={`credential-${credential.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{credential.label}</p>
          {credential.username && (
            <p className="truncate text-xs text-text-secondary">{credential.username}</p>
          )}
          {credential.url && <p className="truncate text-xs text-text-muted">{credential.url}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title={visibleSecret === null ? 'Secret anzeigen' : 'Secret verbergen'}
            aria-label={visibleSecret === null ? 'Secret anzeigen' : 'Secret verbergen'}
            onClick={() => void toggleSecret()}
          >
            {visibleSecret === null ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Secret kopieren"
            aria-label="Secret kopieren"
            onClick={() => void copySecret()}
          >
            <Copy className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Zugangsdaten löschen"
            aria-label="Zugangsdaten löschen"
            onClick={() => onDelete(credential)}
          >
            <Trash2 className="size-4 text-danger" />
          </Button>
        </div>
      </div>
      <p className="mt-2 font-mono text-xs text-text-secondary" data-testid="credential-secret">
        {visibleSecret ?? '••••••••'}
      </p>
    </div>
  );
}

export function CredentialsSection({ credentials, onPersist }: CredentialsSectionProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [username, setUsername] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [credentialToDelete, setCredentialToDelete] = useState<CredentialMeta | null>(null);

  function resetForm() {
    setLabel('');
    setUsername('');
    setUrl('');
    setSecret('');
  }

  async function handleAdd() {
    if (!label.trim()) {
      toast.error('Bezeichnung ist erforderlich');
      return;
    }
    if (!secret) {
      toast.error('Secret ist erforderlich');
      return;
    }

    setIsSaving(true);
    const id = crypto.randomUUID();
    try {
      // Erst das Secret in den Keychain, dann die Metadaten in die DB –
      // schlägt der Keychain fehl, entsteht kein Metadaten-Waisen-Eintrag.
      await setCredentialSecret(id, secret);
      try {
        await onPersist([
          ...credentials,
          { id, label: label.trim(), username: textOrNull(username), url: textOrNull(url) },
        ]);
      } catch (error) {
        // Metadaten fehlgeschlagen: Keychain-Eintrag wieder entfernen
        await deleteCredentialSecret(id).catch(() => undefined);
        throw error;
      }
      toast.success('Zugangsdaten gespeichert');
      resetForm();
      setAddOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Zugangsdaten konnten nicht gespeichert werden',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!credentialToDelete) return;
    try {
      await onPersist(credentials.filter((item) => item.id !== credentialToDelete.id));
      await deleteCredentialSecret(credentialToDelete.id);
      toast.success('Zugangsdaten gelöscht');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Zugangsdaten konnten nicht gelöscht werden',
      );
    } finally {
      setCredentialToDelete(null);
    }
  }

  return (
    <section className="space-y-2" data-testid="credentials-section">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <KeyRound className="size-4" />
          Zugangsdaten
        </h3>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Neu
        </Button>
      </div>

      {credentials.length === 0 ? (
        <p className="text-sm text-text-muted">Keine Zugangsdaten hinterlegt.</p>
      ) : (
        <div className="space-y-2">
          {credentials.map((credential) => (
            <CredentialRow
              key={credential.id}
              credential={credential}
              onDelete={setCredentialToDelete}
            />
          ))}
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zugangsdaten hinzufügen</DialogTitle>
            <DialogDescription>
              Das Secret wird ausschließlich im Betriebssystem-Keychain gespeichert, niemals in der
              Datenbank.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Bezeichnung *</span>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="z.B. WordPress-Admin"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Benutzername</span>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">URL</span>
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Secret / Passwort *</span>
              <Input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void handleAdd()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={credentialToDelete !== null}
        onOpenChange={(open) => !open && setCredentialToDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zugangsdaten löschen?</DialogTitle>
            <DialogDescription>
              „{credentialToDelete?.label}“ wird entfernt – inklusive Secret im Keychain. Das kann
              nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCredentialToDelete(null)}>
              Abbrechen
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
