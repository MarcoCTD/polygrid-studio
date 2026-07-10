import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '../services';

interface NewClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface NewClientFormValues {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  notes: string;
}

const EMPTY: NewClientFormValues = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  notes: '',
};

export function NewClientModal({ open, onOpenChange, onCreated }: NewClientModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<NewClientFormValues>({ defaultValues: EMPTY });

  async function handleSubmit(values: NewClientFormValues) {
    setIsSubmitting(true);
    try {
      await createClient({
        name: values.name,
        contact_person: values.contact_person.trim() || null,
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        notes: values.notes.trim() || null,
      });
      toast.success('Kunde angelegt');
      form.reset(EMPTY);
      onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunde konnte nicht angelegt werden');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuer Kunde</DialogTitle>
          <DialogDescription>Firmen- oder Personenname genügt für den Anfang.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
        >
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Name *</span>
            <Input
              placeholder="z.B. Malerbetrieb Weber"
              {...form.register('name', { required: 'Name ist erforderlich' })}
            />
            {form.formState.errors.name && (
              <span className="text-xs text-destructive">{form.formState.errors.name.message}</span>
            )}
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
            <span className="font-medium">Notizen</span>
            <Textarea rows={3} {...form.register('notes')} />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Kunde anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
