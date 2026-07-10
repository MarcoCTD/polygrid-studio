import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useForm, Controller } from 'react-hook-form';
import { Receipt, SquareArrowOutUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { formatEUR } from '@/features/products/utils';
import {
  WEBSITE_PROJECT_STATUS_LABELS,
  WebsiteProjectStatusEnum,
  type ClientListItem,
  type WebsiteProject,
  type WebsiteProjectListItem,
  type WebsiteProjectStatus,
} from '../schemas';
import { billWebsiteProject, updateWebsiteProject } from '../services';
import { numberOrNull } from '@/utils';
import { CredentialsSection } from './CredentialsSection';
import { ProjectStatusBadge } from './WebsiteBadges';

interface ProjectDetailPanelProps {
  project: WebsiteProjectListItem;
  clients: ClientListItem[];
  onChanged: () => void;
}

interface ProjectFormValues {
  client_id: string;
  name: string;
  status: WebsiteProjectStatus;
  price: number | null;
  deadline: string;
  url: string;
  notes: string;
}

function toFormValues(project: WebsiteProject): ProjectFormValues {
  return {
    client_id: project.client_id,
    name: project.name,
    status: project.status,
    price: project.price,
    deadline: project.deadline ?? '',
    url: project.url ?? '',
    notes: project.notes ?? '',
  };
}

export function ProjectDetailPanel({ project, clients, onChanged }: ProjectDetailPanelProps) {
  const router = useRouter();
  const [currentProject, setCurrentProject] = useState<WebsiteProject>(project);
  const [isSaving, setIsSaving] = useState(false);
  const [isBilling, setIsBilling] = useState(false);
  const form = useForm<ProjectFormValues>({ defaultValues: toFormValues(project) });

  async function handleSave(values: ProjectFormValues) {
    setIsSaving(true);
    try {
      const updated = await updateWebsiteProject(currentProject.id, {
        client_id: values.client_id,
        name: values.name,
        status: values.status,
        price: values.price === null || Number.isNaN(values.price) ? null : values.price,
        deadline: values.deadline || null,
        url: values.url.trim() || null,
        notes: values.notes.trim() || null,
      });
      setCurrentProject(updated);
      form.reset(toFormValues(updated));
      toast.success('Projekt gespeichert');
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Projekt konnte nicht gespeichert werden',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBill() {
    setIsBilling(true);
    try {
      const { project: billed, order } = await billWebsiteProject(currentProject.id);
      setCurrentProject(billed);
      toast.success(`Auftrag ${order.receipt_number} erstellt (Plattform Website)`);
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Projekt konnte nicht abgerechnet werden',
      );
    } finally {
      setIsBilling(false);
    }
  }

  async function persistCredentials(credentials: WebsiteProject['credentials']) {
    const updated = await updateWebsiteProject(currentProject.id, { credentials });
    setCurrentProject(updated);
    onChanged();
  }

  return (
    <div className="space-y-4" data-testid="project-detail-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{currentProject.name}</h2>
          <div className="mt-1">
            <ProjectStatusBadge status={currentProject.status} />
          </div>
        </div>
      </div>

      {/* Abrechnen: erzeugt Auftrag (Plattform website) und verknüpft ihn */}
      {currentProject.order_id ? (
        <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-secondary p-3 text-sm">
          <span className="text-text-secondary">Abgerechnet</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() =>
              void router.navigate({
                to: '/orders',
                search: { order: currentProject.order_id ?? undefined },
              })
            }
          >
            <SquareArrowOutUpRight className="size-4" />
            Zum Auftrag
          </Button>
        </div>
      ) : (
        <Button
          className="w-full gap-2"
          disabled={isBilling || currentProject.price === null}
          title={
            currentProject.price === null
              ? 'Erst einen Projektpreis eintragen und speichern'
              : undefined
          }
          onClick={() => void handleBill()}
        >
          <Receipt className="size-4" />
          Abrechnen
          {currentProject.price !== null && ` (${formatEUR(currentProject.price)})`}
        </Button>
      )}

      <Separator />

      <form className="space-y-3" onSubmit={(event) => void form.handleSubmit(handleSave)(event)}>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Name</span>
          <Input {...form.register('name', { required: true })} />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Kunde</span>
          <Controller
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {clients.find((client) => client.id === field.value)?.name ?? 'Kunde wählen'}
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
            )}
          />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Status</span>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>{WEBSITE_PROJECT_STATUS_LABELS[field.value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {WebsiteProjectStatusEnum.options.map((status) => (
                    <SelectItem key={status} value={status}>
                      {WEBSITE_PROJECT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Preis (brutto)</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              {...form.register('price', {
                setValueAs: numberOrNull,
              })}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Deadline</span>
            <Input type="date" {...form.register('deadline')} />
          </label>
        </div>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Live-URL</span>
          <Input placeholder="https://" {...form.register('url')} />
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

      <CredentialsSection credentials={currentProject.credentials} onPersist={persistCredentials} />
    </div>
  );
}
