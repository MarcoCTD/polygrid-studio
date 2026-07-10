import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  WEBSITE_SERVICE_INTERVAL_LABELS,
  WEBSITE_SERVICE_TYPE_LABELS,
  WebsiteServiceIntervalEnum,
  WebsiteServiceTypeEnum,
  type ClientListItem,
  type WebsiteProjectListItem,
  type WebsiteServiceInterval,
  type WebsiteServiceType,
} from '../schemas';
import { createWebsiteService } from '../services';

interface NewServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientListItem[];
  projects: WebsiteProjectListItem[];
  onCreated: () => void;
}

interface NewServiceFormValues {
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
  notes: string;
}

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function emptyValues(): NewServiceFormValues {
  return {
    client_id: '',
    project_id: null,
    type: 'hosting',
    label: '',
    cost_out: null,
    cost_out_vendor: '',
    price_in: null,
    interval: 'monthly',
    next_due: today(),
    expires_at: '',
    notes: '',
  };
}

export function NewServiceModal({
  open,
  onOpenChange,
  clients,
  projects,
  onCreated,
}: NewServiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<NewServiceFormValues>({ defaultValues: emptyValues() });

  async function handleSubmit(values: NewServiceFormValues) {
    if (!values.client_id) {
      toast.error('Bitte einen Kunden wählen (oder zuerst anlegen).');
      return;
    }
    setIsSubmitting(true);
    try {
      await createWebsiteService({
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
        notes: values.notes.trim() || null,
      });
      toast.success('Laufender Posten angelegt');
      form.reset(emptyValues());
      onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Posten konnte nicht angelegt werden');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuer laufender Posten</DialogTitle>
          <DialogDescription>
            Hosting, Domain oder Wartung. Mindestens Kosten (deine Ausgabe) oder Kundenpreis
            (Einnahme) muss gesetzt sein.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
        >
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
            <span className="font-medium">Label *</span>
            <Input
              placeholder="z.B. malerweber.de oder Hetzner Webspace"
              {...form.register('label', { required: 'Label ist erforderlich' })}
            />
            {form.formState.errors.label && (
              <span className="text-xs text-destructive">
                {form.formState.errors.label.message}
              </span>
            )}
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Kunde *</span>
            <Controller
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <Select value={field.value || 'none'} onValueChange={field.onChange}>
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
              <span className="font-medium">Kosten/Periode (ich zahle)</span>
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
            <span className="font-medium">Kundenpreis/Periode (Kunde zahlt)</span>
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
              <span className="font-medium">Nächste Fälligkeit *</span>
              <Input type="date" {...form.register('next_due', { required: true })} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Ablaufdatum</span>
              <Input type="date" {...form.register('expires_at')} />
            </label>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Notizen</span>
            <Textarea rows={2} {...form.register('notes')} />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Posten anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
