import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, type Control, type UseFormReturn } from 'react-hook-form';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SUBCATEGORIES,
  EXPENSE_SUBCATEGORY_LABELS,
} from '@/features/expenses/constants';
import type { ExpenseCategory, ExpenseSubcategory } from '@/features/expenses/schemas';
import { OrderPlatformEnum, OrderStatusEnum, type OrderPlatform } from '@/features/orders/types';
import type { TaskPriority } from '@/features/tasks/schemas';
import { getAllTemplates } from '@/features/templates/services/templateService';
import type { Template } from '@/features/templates/schemas';
import { playbookCreateSchema, type PlaybookActionType, type PlaybookListItem } from '../schemas';
import { createPlaybook, updatePlaybook } from '../services/playbookService';
import { ACTION_TYPE_LABELS, ORDER_STATUS_LABELS, PLATFORM_LABELS } from './shared';

/** Variablen, die die Engine aus dem auslösenden Auftrag auflösen kann. */
const ENGINE_VARIABLES = [
  'produktname',
  'bestellnummer',
  'kundenname',
  'plattform',
  'trackingnummer',
  'datum',
  'firmenname',
] as const;

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  urgent: 'Dringend',
};

/**
 * Formular-Repräsentation: bewusst breiter als die discriminated union,
 * damit React Hook Form stabile Feldpfade hat. Die Zod-Validierung
 * (playbookCreateSchema) läuft beim Speichern und bleibt Source of Truth.
 */
export interface ActionFormValues {
  type: PlaybookActionType;
  title_template?: string;
  priority?: TaskPriority;
  due_offset_days?: number | null;
  link_order?: boolean;
  amount_gross?: number | null;
  amount_source?: 'shipping_cost' | 'platform_fee' | null;
  category?: ExpenseCategory;
  subcategory?: ExpenseSubcategory | null;
  vendor?: string;
  purpose_template?: string;
  template_id?: string;
}

interface PlaybookFormValues {
  name: string;
  enabled: boolean;
  /**
   * Rohtext statt OrderStatus: Beim Bearbeiten eines Alt-Playbooks kann hier
   * ein entfernter Status (z.B. 'paid') stehen. Die Zod-Validierung beim
   * Speichern erzwingt einen gültigen Enum-Wert.
   */
  trigger_status: string;
  platform_filter: OrderPlatform[];
  actions: ActionFormValues[];
}

function defaultAction(type: PlaybookActionType): ActionFormValues {
  switch (type) {
    case 'create_task':
      return {
        type,
        title_template: '',
        priority: 'medium',
        due_offset_days: null,
        link_order: true,
      };
    case 'create_expense':
      return {
        type,
        amount_gross: null,
        amount_source: 'shipping_cost',
        category: 'versand',
        subcategory: null,
        vendor: '',
        purpose_template: '',
      };
    case 'suggest_template':
      return { type, template_id: '' };
  }
}

function playbookToFormValues(playbook: PlaybookListItem | null): PlaybookFormValues {
  if (!playbook) {
    return {
      name: '',
      enabled: true,
      trigger_status: 'confirmed',
      platform_filter: [],
      actions: [defaultAction('create_task')],
    };
  }
  return {
    name: playbook.name,
    enabled: playbook.enabled,
    trigger_status: playbook.trigger_status,
    platform_filter: playbook.platform_filter ?? [],
    actions: playbook.actions.map((action) => ({ ...action })),
  };
}

function VariableChips({ onInsert }: { onInsert: (variable: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ENGINE_VARIABLES.map((variable) => (
        <button
          key={variable}
          type="button"
          onClick={() => onInsert(variable)}
          className="rounded-md border border-border bg-bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          {`{{${variable}}}`}
        </button>
      ))}
    </div>
  );
}

function SortableActionCard({
  fieldId,
  index,
  form,
  templates,
  onRemove,
}: {
  fieldId: string;
  index: number;
  form: UseFormReturn<PlaybookFormValues>;
  templates: Template[];
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fieldId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const action = form.watch(`actions.${index}`);

  function appendVariable(field: 'title_template' | 'purpose_template') {
    return (variable: string) => {
      const current = form.getValues(`actions.${index}.${field}`) ?? '';
      form.setValue(`actions.${index}.${field}`, `${current}{{${variable}}}`, {
        shouldDirty: true,
      });
    };
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`playbook-action-${index}`}
      className="rounded-lg border border-border bg-bg-primary p-3"
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          aria-label="Aktion verschieben"
          className="cursor-grab touch-none text-text-muted"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className="text-sm font-medium text-text-primary">
          {index + 1}. {ACTION_TYPE_LABELS[action.type]}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto text-text-muted hover:text-red-600"
          aria-label="Aktion entfernen"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {action.type === 'create_task' ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`action-${index}-title`}>Aufgaben-Titel</Label>
            <Input
              id={`action-${index}-title`}
              placeholder="z.B. {{produktname}} für {{kundenname}} drucken"
              {...form.register(`actions.${index}.title_template`)}
            />
            <VariableChips onInsert={appendVariable('title_template')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Priorität</Label>
              <Select
                value={action.priority ?? 'medium'}
                onValueChange={(value) =>
                  form.setValue(`actions.${index}.priority`, value as TaskPriority, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`action-${index}-due`}>Fällig in (Tagen)</Label>
              <Input
                id={`action-${index}-due`}
                type="number"
                min={0}
                max={365}
                placeholder="leer = kein Datum"
                {...form.register(`actions.${index}.due_offset_days`, {
                  setValueAs: (value: unknown) =>
                    value === '' || value === null || value === undefined ? null : Number(value),
                })}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <Checkbox
                  checked={action.link_order ?? true}
                  onCheckedChange={(checked) =>
                    form.setValue(`actions.${index}.link_order`, checked === true, {
                      shouldDirty: true,
                    })
                  }
                />
                Mit Auftrag verknüpfen
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {action.type === 'create_expense' ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Betrag</Label>
              <Select
                value={
                  action.amount_source !== null && action.amount_source !== undefined
                    ? 'source'
                    : 'fixed'
                }
                onValueChange={(value) => {
                  if (value === 'fixed') {
                    form.setValue(`actions.${index}.amount_source`, null, { shouldDirty: true });
                  } else {
                    form.setValue(`actions.${index}.amount_gross`, null, { shouldDirty: true });
                    form.setValue(`actions.${index}.amount_source`, 'shipping_cost', {
                      shouldDirty: true,
                    });
                  }
                }}
              >
                <SelectTrigger aria-label="Betragsart">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fester Betrag</SelectItem>
                  <SelectItem value="source">Aus dem Auftrag lesen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {action.amount_source !== null && action.amount_source !== undefined ? (
              <div className="space-y-1.5">
                <Label>Betragsquelle</Label>
                <Select
                  value={action.amount_source}
                  onValueChange={(value) =>
                    form.setValue(
                      `actions.${index}.amount_source`,
                      value as 'shipping_cost' | 'platform_fee',
                      { shouldDirty: true },
                    )
                  }
                >
                  <SelectTrigger aria-label="Betragsquelle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shipping_cost">Versandkosten des Auftrags</SelectItem>
                    <SelectItem value="platform_fee">Plattformgebühr des Auftrags</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`action-${index}-amount`}>Betrag (EUR)</Label>
                <Input
                  id={`action-${index}-amount`}
                  type="number"
                  step="0.01"
                  min={0}
                  {...form.register(`actions.${index}.amount_gross`, {
                    setValueAs: (value: unknown) =>
                      value === '' || value === null || value === undefined ? null : Number(value),
                  })}
                />
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select
                value={action.category ?? 'versand'}
                onValueChange={(value) => {
                  form.setValue(`actions.${index}.category`, value as ExpenseCategory, {
                    shouldDirty: true,
                  });
                  form.setValue(`actions.${index}.subcategory`, null, { shouldDirty: true });
                }}
              >
                <SelectTrigger aria-label="Kategorie">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {EXPENSE_CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unterkategorie</Label>
              <Select
                value={action.subcategory ?? 'none'}
                onValueChange={(value) =>
                  form.setValue(
                    `actions.${index}.subcategory`,
                    value === 'none' ? null : (value as ExpenseSubcategory),
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger aria-label="Unterkategorie">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine</SelectItem>
                  {EXPENSE_SUBCATEGORIES[action.category ?? 'versand'].map((subcategory) => (
                    <SelectItem key={subcategory} value={subcategory}>
                      {EXPENSE_SUBCATEGORY_LABELS[subcategory]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`action-${index}-vendor`}>Anbieter/Händler</Label>
            <Input
              id={`action-${index}-vendor`}
              placeholder="z.B. Versanddienstleister"
              {...form.register(`actions.${index}.vendor`)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`action-${index}-purpose`}>Verwendungszweck</Label>
            <Input
              id={`action-${index}-purpose`}
              placeholder="z.B. Versand Bestellung {{bestellnummer}}"
              {...form.register(`actions.${index}.purpose_template`)}
            />
            <VariableChips onInsert={appendVariable('purpose_template')} />
          </div>
        </div>
      ) : null}

      {action.type === 'suggest_template' ? (
        <div className="space-y-1.5">
          <Label>Vorlage</Label>
          <Select
            value={action.template_id || undefined}
            onValueChange={(value) =>
              form.setValue(`actions.${index}.template_id`, value ?? '', { shouldDirty: true })
            }
          >
            <SelectTrigger aria-label="Vorlage wählen">
              <SelectValue placeholder="Vorlage wählen" />
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-text-muted">Keine Vorlagen vorhanden</div>
              ) : (
                templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-text-secondary">
            Beim Erreichen des Status erscheint im Auftrags-Detail ein Banner, das den
            Kopieren-Dialog vorbefüllt öffnet.
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface PlaybookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = neues Playbook anlegen */
  playbook: PlaybookListItem | null;
  onSaved: () => void;
}

export function PlaybookFormDialog({
  open,
  onOpenChange,
  playbook,
  onSaved,
}: PlaybookFormDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<PlaybookFormValues>({
    defaultValues: playbookToFormValues(playbook),
  });
  const { fields, append, remove, move } = useFieldArray({
    control: form.control as Control<PlaybookFormValues>,
    name: 'actions',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (open) {
      form.reset(playbookToFormValues(playbook));
    }
    // form ist stabil (useForm-Instanz), playbook/open steuern den Reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, playbook]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getAllTemplates()
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Vorlagen konnten nicht geladen werden',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const triggerStatus = form.watch('trigger_status');
  const platformFilter = form.watch('platform_filter');

  const statusOptions = useMemo(() => OrderStatusEnum.options, []);
  const platformOptions = useMemo(() => OrderPlatformEnum.options, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = fields.findIndex((field) => field.id === active.id);
    const toIndex = fields.findIndex((field) => field.id === over.id);
    if (fromIndex >= 0 && toIndex >= 0) move(fromIndex, toIndex);
  }

  async function onSubmit(values: PlaybookFormValues) {
    if (!OrderStatusEnum.safeParse(values.trigger_status).success) {
      toast.error(
        'Der Trigger-Status dieses Playbooks ist veraltet – bitte einen neuen Status wählen.',
      );
      return;
    }
    const parsed = playbookCreateSchema.safeParse({
      ...values,
      platform_filter: values.platform_filter.length > 0 ? values.platform_filter : null,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.join('.');
      toast.error(`Playbook unvollständig: ${path ? `${path}: ` : ''}${issue.message}`);
      return;
    }

    setIsSaving(true);
    try {
      if (playbook) {
        await updatePlaybook(playbook.id, parsed.data);
        toast.success('Playbook aktualisiert');
      } else {
        await createPlaybook(parsed.data);
        toast.success('Playbook angelegt');
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Playbook konnte nicht gespeichert werden',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{playbook ? 'Playbook bearbeiten' : 'Neues Playbook'}</DialogTitle>
          <DialogDescription>
            Wenn ein Auftrag den Trigger-Status erreicht, laufen die Aktionen in der angegebenen
            Reihenfolge.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
          className="space-y-5"
          data-testid="playbook-form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="playbook-name">Name</Label>
            <Input
              id="playbook-name"
              placeholder="z.B. Versandaufgabe bei Zahlungseingang"
              {...form.register('name')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Trigger-Status</Label>
              <Select
                value={triggerStatus}
                onValueChange={(value) => {
                  if (value) form.setValue('trigger_status', value, { shouldDirty: true });
                }}
              >
                <SelectTrigger aria-label="Trigger-Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ORDER_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!OrderStatusEnum.safeParse(triggerStatus).success ? (
                <p className="text-xs text-amber-700" data-testid="trigger-status-outdated-hint">
                  Der gespeicherte Trigger-Status „{triggerStatus}“ existiert nicht mehr – bitte
                  einen neuen Status wählen.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Plattform-Filter (leer = alle)</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5">
                {platformOptions.map((platform) => (
                  <label
                    key={platform}
                    className="flex items-center gap-2 text-sm text-text-primary"
                  >
                    <Checkbox
                      checked={platformFilter.includes(platform)}
                      onCheckedChange={(checked) => {
                        const next =
                          checked === true
                            ? [...platformFilter, platform]
                            : platformFilter.filter((entry) => entry !== platform);
                        form.setValue('platform_filter', next, { shouldDirty: true });
                      }}
                    />
                    {PLATFORM_LABELS[platform]}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Aktionen (Reihenfolge = Ausführungsreihenfolge)</Label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button type="button" variant="outline" size="sm" className="gap-1.5" />}
                >
                  <Plus className="size-4" />
                  Aktion hinzufügen
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(ACTION_TYPE_LABELS) as PlaybookActionType[]).map((type) => (
                    <DropdownMenuItem key={type} onClick={() => append(defaultAction(type))}>
                      {ACTION_TYPE_LABELS[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {fields.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-subtle p-4 text-sm text-text-muted">
                Noch keine Aktionen. Mindestens eine Aktion ist erforderlich.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((field) => field.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <SortableActionCard
                        key={field.id}
                        fieldId={field.id}
                        index={index}
                        form={form}
                        templates={templates}
                        onRemove={() => remove(index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Speichern…' : 'Speichern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
