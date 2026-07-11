/**
 * Positionsliste des Dokument-Editors (Modul 17): Zeilen hinzufügen,
 * entfernen und per Pfeiltasten umsortieren (bewusst ohne Drag-and-Drop,
 * siehe ENTSCHEIDUNGEN_MODUL_17 E17-11). Summen live.
 *
 * Addendum 2 (Spec 2.2): "Position hinzufügen" öffnet zuerst die Auswahl
 * "Aus Vorlage" (durchsuchbare Liste mit Name und Preis) oder "Leere
 * Position". Die Vorlage übernimmt Titel, Beschreibung, Preis und Menge;
 * danach frei editierbar – nur im Dokument, nie zurück auf die Vorlage.
 */
import { useEffect, useState } from 'react';
import { useFieldArray, useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { calculateDocumentTotal, lineItemTotal, type DocumentPositionTemplate } from '../schemas';
import { getPositionTemplates, lineItemFromPositionTemplate } from '../services';
import { formatDocumentEUR } from './print/format';
import type { DocumentFormValues } from './documentFormTypes';

interface LineItemsEditorProps {
  control: Control<DocumentFormValues>;
  register: UseFormRegister<DocumentFormValues>;
  disabled?: boolean;
}

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function LineItemsEditor({ control, register, disabled }: LineItemsEditorProps) {
  const { fields, append, remove, swap } = useFieldArray({ control, name: 'line_items' });
  const watchedItems = useWatch({ control, name: 'line_items' }) ?? [];
  const [templates, setTemplates] = useState<DocumentPositionTemplate[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templateQuery, setTemplateQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPositionTemplates()
      .then((loaded) => {
        if (!cancelled) setTemplates(loaded);
      })
      .catch((error: unknown) => {
        // Ohne Vorlagen bleibt "Leere Position" nutzbar – kein harter Fehler.
        console.error('[Documents] Positionsvorlagen konnten nicht geladen werden', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTemplates = templates.filter((template) =>
    `${template.name} ${template.title}`.toLowerCase().includes(templateQuery.trim().toLowerCase()),
  );

  function closePicker() {
    setPickerOpen(false);
    setTemplateQuery('');
  }

  function addFromTemplate(template: DocumentPositionTemplate) {
    append(lineItemFromPositionTemplate(template));
    closePicker();
  }

  function addEmpty() {
    append({ description: '', quantity: 1, unit_price: 0 });
    closePicker();
  }

  const sanitizedItems = watchedItems.map((item) => ({
    description: item?.description ?? '',
    quantity: toSafeNumber(item?.quantity),
    unit_price: toSafeNumber(item?.unit_price),
  }));
  const total = calculateDocumentTotal(
    sanitizedItems.map((item) => ({ ...item, description: item.description || '-' })),
  );

  return (
    <div className="space-y-2" data-testid="line-items-editor">
      <div className="grid grid-cols-[1fr_72px_96px_84px_88px] items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
        <span>Beschreibung</span>
        <span className="text-right">Menge</span>
        <span className="text-right">Einzelpreis</span>
        <span className="text-right">Summe</span>
        <span />
      </div>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-text-secondary">
          Noch keine Positionen. Mindestens eine Position ist Pflicht.
        </p>
      ) : null}

      {fields.map((field, index) => {
        const item = sanitizedItems[index] ?? { description: '', quantity: 0, unit_price: 0 };
        return (
          <div
            key={field.id}
            className="grid grid-cols-[1fr_72px_96px_84px_88px] items-start gap-2"
            data-testid={`line-item-row-${index}`}
          >
            {/* Textarea statt Input: die erste Zeile ist der Positionstitel
                (EB-03), Vorlagen übernehmen Titel + Beschreibung mehrzeilig –
                ein <input> würde die Zeilenumbrüche verwerfen. */}
            <Textarea
              rows={1}
              placeholder="Beschreibung der Leistung"
              disabled={disabled}
              className="min-h-8 py-1"
              aria-label={`Position ${index + 1}: Beschreibung`}
              {...register(`line_items.${index}.description`)}
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              className="text-right"
              disabled={disabled}
              aria-label={`Position ${index + 1}: Menge`}
              {...register(`line_items.${index}.quantity`, { valueAsNumber: true })}
            />
            <Input
              type="number"
              step="0.01"
              className="text-right"
              disabled={disabled}
              aria-label={`Position ${index + 1}: Einzelpreis`}
              {...register(`line_items.${index}.unit_price`, { valueAsNumber: true })}
            />
            <span className="text-right text-sm tabular-nums text-text-primary">
              {formatDocumentEUR(lineItemTotal({ ...item, description: item.description || '-' }))}
            </span>
            <div className="flex justify-end gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Nach oben"
                disabled={disabled || index === 0}
                onClick={() => swap(index, index - 1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Nach unten"
                disabled={disabled || index === fields.length - 1}
                onClick={() => swap(index, index + 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Position entfernen"
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4 text-danger" />
              </Button>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between border-t border-border pt-2">
        <Popover
          open={pickerOpen}
          onOpenChange={(open) => {
            if (disabled) return;
            setPickerOpen(open);
            if (!open) setTemplateQuery('');
          }}
        >
          <PopoverTrigger
            disabled={disabled}
            data-testid="add-line-item"
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm font-medium transition-colors hover:bg-bg-hover disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="size-4" />
            Position hinzufügen
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 gap-1.5 p-2">
            <Input
              autoFocus
              value={templateQuery}
              placeholder="Vorlage suchen..."
              aria-label="Positionsvorlage suchen"
              data-testid="line-item-template-search"
              onChange={(event) => setTemplateQuery(event.target.value)}
            />
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-bg-hover"
                  data-testid={`line-item-template-${template.name}`}
                  onClick={() => addFromTemplate(template)}
                >
                  <span className="truncate">{template.name}</span>
                  <span className="shrink-0 tabular-nums text-text-secondary">
                    {formatDocumentEUR(template.unit_price)}
                  </span>
                </button>
              ))}
              {filteredTemplates.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-text-secondary">
                  {templates.length === 0
                    ? 'Keine Vorlagen vorhanden – unter „Vorlagen verwalten" anlegen.'
                    : 'Keine Vorlage gefunden.'}
                </p>
              ) : null}
            </div>
            <Separator />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start gap-2"
              data-testid="add-line-item-empty"
              onClick={addEmpty}
            >
              <Plus className="size-4" />
              Leere Position
            </Button>
          </PopoverContent>
        </Popover>
        <div className="text-sm font-semibold tabular-nums" data-testid="line-items-total">
          Gesamt: {formatDocumentEUR(total)}
        </div>
      </div>
    </div>
  );
}
