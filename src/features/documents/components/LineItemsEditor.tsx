/**
 * Positionsliste des Dokument-Editors (Modul 17): Zeilen hinzufügen,
 * entfernen und per Pfeiltasten umsortieren (bewusst ohne Drag-and-Drop,
 * siehe ENTSCHEIDUNGEN_MODUL_17 E17-11). Summen live.
 */
import { useFieldArray, useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { calculateDocumentTotal, lineItemTotal } from '../schemas';
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
            className="grid grid-cols-[1fr_72px_96px_84px_88px] items-center gap-2"
            data-testid={`line-item-row-${index}`}
          >
            <Input
              placeholder="Beschreibung der Leistung"
              disabled={disabled}
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled}
          data-testid="add-line-item"
          onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}
        >
          <Plus className="size-4" />
          Position hinzufügen
        </Button>
        <div className="text-sm font-semibold tabular-nums" data-testid="line-items-total">
          Gesamt: {formatDocumentEUR(total)}
        </div>
      </div>
    </div>
  );
}
