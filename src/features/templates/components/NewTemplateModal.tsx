import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  templateCategoryEnum,
  templateCreateSchema,
  type Template,
  type TemplateCategory,
  type TemplateCreate,
  type TemplatePlatform,
} from '../schemas';
import { createTemplate } from '../services';

interface NewTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (template: Template) => void;
}

const CATEGORY_OPTIONS: Array<{ value: TemplateCategory; label: string }> =
  templateCategoryEnum.options.map((value) => ({
    value,
    label:
      value === 'faq' ? 'FAQ' : value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' '),
  }));

const PLATFORM_OPTIONS: Array<{ value: TemplatePlatform; label: string }> = [
  { value: 'etsy', label: 'Etsy' },
  { value: 'ebay', label: 'eBay' },
  { value: 'kleinanzeigen', label: 'Kleinanzeigen' },
];

function defaultValues(): TemplateCreate {
  return {
    name: '',
    category: 'sonstiges',
    content: ' ',
    platforms: [],
    variables: [],
    is_legal: false,
    notes: null,
  };
}

export function NewTemplateModal({ open, onOpenChange, onCreated }: NewTemplateModalProps) {
  const form = useForm<TemplateCreate>({
    resolver: zodResolver(templateCreateSchema),
    defaultValues: defaultValues(),
  });
  const isSaving = form.formState.isSubmitting;

  async function handleSubmit(values: TemplateCreate) {
    try {
      const template = await createTemplate({
        ...values,
        name: values.name.trim(),
        content: values.content || ' ',
        platforms: values.platforms ?? [],
      });
      toast.success('Vorlage erstellt');
      form.reset(defaultValues());
      onCreated(template);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vorlage konnte nicht erstellt werden');
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset(defaultValues());
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Vorlage</DialogTitle>
          <DialogDescription>
            Lege eine neue Textvorlage an. Der eigentliche Inhalt wird im Editor gepflegt.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
        >
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input id="template-name" autoFocus {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-xs text-danger">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as TemplateCategory)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Plattformen</Label>
            <Controller
              control={form.control}
              name="platforms"
              render={({ field }) => {
                const selected = field.value ?? [];
                return (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PLATFORM_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary"
                      >
                        <Checkbox
                          checked={selected.includes(option.value)}
                          onCheckedChange={(checked) => {
                            field.onChange(
                              checked
                                ? [...selected, option.value]
                                : selected.filter((item) => item !== option.value),
                            );
                          }}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                );
              }}
            />
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary">
            <Controller
              control={form.control}
              name="is_legal"
              render={({ field }) => (
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                />
              )}
            />
            Rechtstext
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Erstelle...' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
