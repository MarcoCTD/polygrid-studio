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
  WEBSITE_PROJECT_STATUS_LABELS,
  WebsiteProjectStatusEnum,
  type ClientListItem,
  type WebsiteProjectStatus,
} from '../schemas';
import { createWebsiteProject } from '../services';
import { numberOrNull } from '@/utils';

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientListItem[];
  onCreated: () => void;
}

interface NewProjectFormValues {
  client_id: string;
  name: string;
  status: WebsiteProjectStatus;
  price: number | null;
  deadline: string;
  url: string;
  notes: string;
}

const EMPTY: NewProjectFormValues = {
  client_id: '',
  name: '',
  status: 'inquiry',
  price: null,
  deadline: '',
  url: '',
  notes: '',
};

export function NewProjectModal({ open, onOpenChange, clients, onCreated }: NewProjectModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<NewProjectFormValues>({ defaultValues: EMPTY });

  async function handleSubmit(values: NewProjectFormValues) {
    if (!values.client_id) {
      toast.error('Bitte einen Kunden wählen (oder zuerst anlegen).');
      return;
    }
    setIsSubmitting(true);
    try {
      await createWebsiteProject({
        client_id: values.client_id,
        name: values.name,
        status: values.status,
        price: values.price === null || Number.isNaN(values.price) ? null : values.price,
        deadline: values.deadline || null,
        url: values.url.trim() || null,
        notes: values.notes.trim() || null,
      });
      toast.success('Projekt angelegt');
      form.reset(EMPTY);
      onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Projekt konnte nicht angelegt werden');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neues Website-Projekt</DialogTitle>
          <DialogDescription>
            Einmaliges Projekt, z.B. „Relaunch Malerbetrieb Weber“. Abgerechnet wird später über
            einen Auftrag (Plattform Website).
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
        >
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
            <span className="font-medium">Name *</span>
            <Input
              placeholder="z.B. Relaunch Malerbetrieb Weber"
              {...form.register('name', { required: 'Name ist erforderlich' })}
            />
            {form.formState.errors.name && (
              <span className="text-xs text-destructive">{form.formState.errors.name.message}</span>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Deadline</span>
              <Input type="date" {...form.register('deadline')} />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Live-URL</span>
              <Input placeholder="https://" {...form.register('url')} />
            </label>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Notizen</span>
            <Textarea rows={3} {...form.register('notes')} />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Projekt anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
