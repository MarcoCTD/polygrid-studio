import { useEffect, useState } from 'react';
import { EyeOff, Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  deletePlatformCredential,
  getCredentialStatus,
  savePlatformCredential,
  type PlatformCredentialKey,
} from '@/features/platform-sync/services/platform-settings-service';

interface PlatformCredentialFieldProps {
  label: string;
  credentialKey: PlatformCredentialKey;
  placeholder?: string;
  onChanged?: () => void;
}

export function PlatformCredentialField({
  label,
  credentialKey,
  placeholder = 'Credential eingeben',
  onChanged,
}: PlatformCredentialFieldProps) {
  const [exists, setExists] = useState(false);
  const [maskedValue, setMaskedValue] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      setIsLoading(true);
      try {
        const status = await getCredentialStatus(credentialKey);
        if (!cancelled) {
          setExists(status.exists);
          setMaskedValue(status.maskedValue);
          setIsEditing(!status.exists);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Credential konnte nicht gelesen werden');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [credentialKey]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await savePlatformCredential(credentialKey, draft);
      const status = await getCredentialStatus(credentialKey);
      setExists(status.exists);
      setMaskedValue(status.maskedValue);
      setDraft('');
      setIsEditing(false);
      toast.success('Credential gespeichert');
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Credential konnte nicht gespeichert werden');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`${label} wirklich löschen?`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await deletePlatformCredential(credentialKey);
      setExists(false);
      setMaskedValue(null);
      setDraft('');
      setIsEditing(true);
      toast.success('Credential gelöscht');
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Credential konnte nicht gelöscht werden');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setDraft('');
    setIsEditing(false);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-10 items-center gap-2 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Credential-Status wird geladen
      </div>
    );
  }

  if (!isEditing && exists) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-10 flex-1 items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 text-sm text-text-primary">
          <EyeOff className="h-4 w-4 text-text-muted" />
          <span>{maskedValue ?? 'Gespeichert'}</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Ändern
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDelete} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Löschen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="password"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="min-w-[240px] flex-1"
        autoComplete="off"
      />
      <Button type="button" size="sm" onClick={handleSave} disabled={isSaving || !draft.trim()}>
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Speichern
      </Button>
      {exists ? (
        <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
          <X className="mr-2 h-4 w-4" />
          Abbrechen
        </Button>
      ) : null}
    </div>
  );
}
