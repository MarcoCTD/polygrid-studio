import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  WEBSITE_SERVICE_INTERVAL_LABELS,
  WEBSITE_SERVICE_TYPE_LABELS,
  WebsiteServiceIntervalEnum,
  WebsiteServiceTypeEnum,
  type ClientListItem,
  type WebsiteProjectListItem,
  type WebsiteService,
  type WebsiteServiceInterval,
  type WebsiteServiceListItem,
  type WebsiteServiceType,
} from '../schemas';
import { updateWebsiteService } from '../services';
import { ServiceTypeIcon } from './WebsiteBadges';

interface ServiceDetailPanelProps {
  service: WebsiteServiceListItem;
  clients: ClientListItem[];
  projects: WebsiteProjectListItem[];
  onChanged: () => void;
}

interface ServiceFormValues {
  client_id: string;
  project_id: string | null;
  type: WebsiteServiceType;
  label: string;
  cost_out: number | null;
  cost_out_vendor: string;
  price_in: number | null;
  interval: WebsiteServiceInterval;
  next_due: string;
  expires_at: string;
  active: boolean;
  notes: string;
}

function toFormValues(service: WebsiteService): ServiceFormValues {
  return {
    client_id: service.client_id,
    project_id: service.project_id,
    type: service.type,
    label: service.label,
    cost_out: service.cost_out,
    cost_out_vendor: service.cost_out_vendor ?? '',
    price_in: service.price_in,
    interval: service.interval,
    next_due: service.next_due,
    expires_at: service.expires_at ?? '',
    active: service.active,
    notes: service.notes ?? '',
  };
}

export function ServiceDetailPanel({
  service,
  clients,
  projects,
  onChanged,
}: ServiceDetailPanelProps) {
  const [currentService, setCurrentService] = useState<WebsiteService>(service);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<ServiceFormValues>({ defaultValues: toFormValues(service) });

  async function handleSave(values: ServiceFormValues) {
    setIsSaving(true);
    try {
      const updated = await updateWebsiteService(currentService.id, {
        client_id: values.client_id,
        project_id: values.project_id,
        type: values.type,
        label: values.label,
        cost_out:
          values.cost_out === null || Number.isNaN(values.cost_out) ? null : values.cost_out,
        cost_out_vendor: values.cost_out_vendor.trim() || null,
        price_in:
          values.price_in === null || Number.isNaN(values.price_in) ? null : values.price_in,
        interval: values.interval,
        next_due: values.next_due,
        expires_at: values.expires_at || null,
        active: values.active,
        notes: values.notes.trim() || null,
      });
      setCurrentService(updated);
      form.reset(toFormValues(updated));
      toast.success('Posten gespeichert');
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Posten konnte nicht gespeichert werden',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="service-detail-panel">
      <div>
        <h2 className="text-base font-semibold text-text-primary">{currentService.label}</h2>
        <div className="mt-1">
          <ServiceTypeIcon type={currentService.type} />
        </div>
      </div>

      <form className="space-y-3" onSubmit={(event) => void form.handleSubmit(handleSave)(event)}>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Label</span>
          <Input {...form.register('label', { required: true })} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Typ</span>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{WEBSITE_SERVICE_TYPE_LABELS[field.value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {WebsiteServiceTypeEnum.options.map((type) => (
                      <SelectItem key={type} value={type}>
                        {WEBSITE_SERVICE_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Intervall</span>
            <Controller
              control={form.control}
              name="interval"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{WEBSITE_SERVICE_INTERVAL_LABELS[field.value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {WebsiteServiceIntervalEnum.options.map((interval) => (
                      <SelectItem key={interval} value={interval}>
                        {WEBSITE_SERVICE_INTERVAL_LABELS[interval]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </label>
        </div>

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
          <span className="font-medium">Projekt (optional)</span>
          <Controller
            control={form.control}
            name="project_id"
            render={({ field }) => (
              <Select
                value={field.value ?? 'none'}
                onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {field.value
                      ? (projects.find((project) => project.id === field.value)?.name ??
                        'Projekt wählen')
                      : 'Kein Projekt'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Projekt</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Kosten/Periode</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              {...form.register('cost_out', {
                setValueAs: (value: string) => (value === '' ? null : Number(value)),
              })}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Händler (Ausgabe)</span>
            <Input placeholder="z.B. Hetzner" {...form.register('cost_out_vendor')} />
          </label>
        </div>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Kundenpreis/Periode</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            {...form.register('price_in', {
              setValueAs: (value: string) => (value === '' ? null : Number(value)),
            })}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Nächste Fälligkeit</span>
            <Input type="date" {...form.register('next_due', { required: true })} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Ablaufdatum</span>
            <Input type="date" {...form.register('expires_at')} />
          </label>
        </div>

        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              Aktiv (Recurring-Engine erzeugt Ausgaben/Aufträge)
            </label>
          )}
        />

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Notizen</span>
          <Textarea rows={3} {...form.register('notes')} />
        </label>

        <Button type="submit" className="w-full" disabled={isSaving}>
          Speichern
        </Button>
      </form>

      <Separator />

      <p className="text-xs text-text-muted">
        Zuletzt erzeugte Periode:{' '}
        {currentService.last_generated_until ?? 'noch keine automatische Buchung'}
      </p>
    </div>
  );
}
