import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ColorVariant, ProductUpdate } from '../schema';

interface ColorVariantsEditorProps {
  form: UseFormReturn<ProductUpdate>;
  suggestions?: ColorVariant[];
}

export function ColorVariantsEditor({ form, suggestions = [] }: ColorVariantsEditorProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'color_variants' as never,
  });

  const variants = form.watch('color_variants') ?? [];

  function appendSuggestion(variant: ColorVariant) {
    if (variants.some((item) => item.name === variant.name)) return;
    append(variant as never);
  }

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          {/* Color Preview */}
          <div
            className="h-8 w-8 shrink-0 rounded-md border border-border-subtle"
            style={{ backgroundColor: (variants[index] as { hex?: string })?.hex || '#000000' }}
          />

          {/* Hex Input */}
          <Input
            {...form.register(`color_variants.${index}.hex` as never)}
            placeholder="#000000"
            className="w-28 font-mono text-xs"
          />

          {/* Color Picker */}
          <input
            type="color"
            value={(variants[index] as { hex?: string })?.hex || '#000000'}
            onChange={(e) =>
              form.setValue(`color_variants.${index}.hex` as never, e.target.value as never)
            }
            className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border-subtle bg-transparent"
          />

          {/* Name Input */}
          <Input
            {...form.register(`color_variants.${index}.name` as never)}
            placeholder="Farbname"
            className="flex-1"
          />

          {/* Remove */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove(index)}
            className="h-8 w-8 p-0 text-text-muted hover:text-[var(--accent-danger)]"
          >
            <X size={14} />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => append({ name: '', hex: '#000000' } as never)}
        className="w-fit gap-1 text-text-secondary"
      >
        <Plus size={14} />
        Variante hinzufügen
      </Button>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {suggestions.map((variant) => (
            <Button
              key={variant.name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendSuggestion(variant)}
              className="gap-1"
            >
              <span
                className="size-3 rounded-full border border-border-subtle"
                style={{ backgroundColor: variant.hex }}
              />
              {variant.name}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
