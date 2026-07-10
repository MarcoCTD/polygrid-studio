import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { Client, ClientListItem, WebsiteProjectListItem } from '../schemas';
import { updateClient } from '../services';
import { CredentialsSection } from './CredentialsSection';
import { ProjectStatusBadge } from './WebsiteBadges';

interface ClientDetailPanelProps {
  client: ClientListItem;
  /** Projekte des Kunden (vorgefiltert von der Seite). */
  projects: WebsiteProjectListItem[];
  onChanged: () => void;
  onOpenProject: (project: WebsiteProjectListItem) => void;
}

interface ClientFormValues {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

function toFormValues(client: Client): ClientFormValues {
  return {
    name: client.name,
    contact_person: client.contact_person ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    address: client.address ?? '',
    notes: client.notes ?? '',
  };
}

export function ClientDetailPanel({
  client,
  projects,
  onChanged,
  onOpenProject,
}: ClientDetailPanelProps) {
  const [currentClient, setCurrentClient] = useState<Client>(client);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<ClientFormValues>({ defaultValues: toFormValues(client) });

  async function handleSave(values: ClientFormValues) {
    setIsSaving(true);
    try {
      const updated = await updateClient(currentClient.id, {
        name: values.name,
        contact_person: values.contact_person.trim() || null,
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        address: values.address.trim() || null,
        notes: values.notes.trim() || null,
      });
      setCurrentClient(updated);
      form.reset(toFormValues(updated));
      toast.success('Kunde gespeichert');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunde konnte nicht gespeichert werden');
    } finally {
      setIsSaving(false);
    }
  }

  async function persistCredentials(credentials: Client['credentials']) {
    const updated = await updateClient(currentClient.id, { credentials });
    setCurrentClient(updated);
    onChanged();
  }

  return (
    <div className="space-y-4" data-testid="client-detail-panel">
      <h2 className="text-base font-semibold text-text-primary">{currentClient.name}</h2>

      <form className="space-y-3" onSubmit={(event) => void form.handleSubmit(handleSave)(event)}>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Name</span>
          <Input {...form.register('name', { required: true })} />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Ansprechpartner</span>
          <Input {...form.register('contact_person')} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">E-Mail</span>
            <Input type="email" {...form.register('email')} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Telefon</span>
            <Input {...form.register('phone')} />
          </label>
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Rechnungsanschrift</span>
          <Textarea
            rows={3}
            placeholder={'Straße Hausnummer\nPLZ Ort'}
            data-testid="client-address"
            {...form.register('address')}
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Notizen</span>
          <Textarea rows={3} {...form.register('notes')} />
        </label>

        <Button type="submit" className="w-full" disabled={isSaving}>
          Speichern
        </Button>
      </form>

      <Separator />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">Projekte des Kunden</h3>
        {projects.length === 0 ? (
          <p className="text-sm text-text-muted">Keine Projekte vorhanden.</p>
        ) : (
          <ul className="space-y-1.5">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-secondary px-3 py-2 text-left text-sm hover:bg-bg-hover"
                  onClick={() => onOpenProject(project)}
                >
                  <span className="truncate">{project.name}</span>
                  <ProjectStatusBadge status={project.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />

      <CredentialsSection credentials={currentClient.credentials} onPersist={persistCredentials} />
    </div>
  );
}
