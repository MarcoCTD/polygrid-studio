import { useEffect, useState } from 'react';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  verticalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  createVariant,
  deleteVariant,
  getListingVariants,
  setDefaultVariant,
  updateVariant,
  updateVariantOrder,
  type ListingDetail,
} from '../listingsService';
import type { ListingVariant } from '../schemas';

interface VariantsTabProps {
  listing: ListingDetail;
  onVariantsChanged: () => void;
}

export function VariantsTab({ listing, onVariantsChanged }: VariantsTabProps) {
  const [variants, setVariants] = useState<ListingVariant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const showStock = listing.inventory_mode === 'stock';

  function reloadVariants() {
    setIsLoading(true);
    getListingVariants(listing.id)
      .then(setVariants)
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Listing-Varianten konnten nicht geladen werden',
        );
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      getListingVariants(listing.id)
        .then((items) => {
          if (!cancelled) setVariants(items);
        })
        .catch((err) => {
          if (!cancelled) {
            toast.error(
              err instanceof Error ? err.message : 'Listing-Varianten konnten nicht geladen werden',
            );
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [listing.id]);

  async function handleAddVariant() {
    try {
      await createVariant(listing.id, {
        price: listing.base_price,
        stock_quantity: showStock ? 0 : null,
      });
      reloadVariants();
      onVariantsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Variante konnte nicht erstellt werden');
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = variants.findIndex((variant) => variant.id === active.id);
    const newIndex = variants.findIndex((variant) => variant.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextVariants = arrayMove(variants, oldIndex, newIndex).map((variant, index) => ({
      ...variant,
      sort_order: index,
    }));
    setVariants(nextVariants);

    try {
      await updateVariantOrder(
        nextVariants.map((variant) => ({ id: variant.id, sort_order: variant.sort_order })),
      );
      onVariantsChanged();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Varianten-Reihenfolge konnte nicht gespeichert werden',
      );
      reloadVariants();
    }
  }

  async function handleUpdateVariant(id: string, data: Parameters<typeof updateVariant>[1]) {
    try {
      await updateVariant(id, data);
      setVariants((current) =>
        current.map((variant) => (variant.id === id ? { ...variant, ...data } : variant)),
      );
      onVariantsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Variante konnte nicht gespeichert werden');
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultVariant(id, listing.id);
      setVariants((current) =>
        current.map((variant) => ({ ...variant, is_default: variant.id === id })),
      );
      onVariantsChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Default-Variante konnte nicht gesetzt werden',
      );
    }
  }

  async function handleDeleteVariant(id: string) {
    try {
      await deleteVariant(id);
      setVariants((current) => current.filter((variant) => variant.id !== id));
      onVariantsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Variante konnte nicht gelöscht werden');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Varianten</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Varianten ermöglichen verschiedene Ausführungen wie Farbe oder Größe zu
            unterschiedlichen Preisen.
          </p>
        </div>
        <Button onClick={() => void handleAddVariant()} className="gap-1.5">
          <Plus size={14} />
          Variante hinzufügen
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-56 items-center justify-center rounded-lg border border-border-subtle text-sm text-text-muted">
          Varianten werden geladen...
        </div>
      ) : variants.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle text-center text-sm text-text-muted">
          <p>Noch keine Varianten.</p>
          <p>Füge eine hinzu oder lass das Feld leer für ein einheitliches Produkt.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={variants.map((variant) => variant.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated">
              <div
                className={cn(
                  'grid gap-2 border-b border-border-subtle bg-bg-secondary px-3 py-2 text-xs font-medium text-text-secondary',
                  showStock
                    ? 'grid-cols-[32px_1.4fr_1fr_110px_100px_90px_80px_44px]'
                    : 'grid-cols-[32px_1.5fr_1fr_120px_90px_80px_44px]',
                )}
              >
                <span />
                <span>Name</span>
                <span>SKU-Suffix</span>
                <span>Preis</span>
                {showStock && <span>Lager</span>}
                <span>Farbe</span>
                <span>Default</span>
                <span />
              </div>

              <div>
                {variants.map((variant) => (
                  <SortableVariantRow
                    key={variant.id}
                    variant={variant}
                    showStock={showStock}
                    disableDelete={variants.length <= 1 || variant.is_default}
                    onUpdate={handleUpdateVariant}
                    onSetDefault={() => void handleSetDefault(variant.id)}
                    onDelete={() => void handleDeleteVariant(variant.id)}
                  />
                ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableVariantRow({
  variant,
  showStock,
  disableDelete,
  onUpdate,
  onSetDefault,
  onDelete,
}: {
  variant: ListingVariant;
  showStock: boolean;
  disableDelete: boolean;
  onUpdate: (id: string, data: Parameters<typeof updateVariant>[1]) => Promise<void>;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: variant.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'grid items-center gap-2 border-b border-border-subtle px-3 py-2 text-sm last:border-b-0',
        showStock
          ? 'grid-cols-[32px_1.4fr_1fr_110px_100px_90px_80px_44px]'
          : 'grid-cols-[32px_1.5fr_1fr_120px_90px_80px_44px]',
        isDragging && 'bg-bg-hover opacity-70',
      )}
    >
      <button
        type="button"
        className="cursor-grab rounded-md p-1 text-text-muted hover:bg-bg-hover active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Variante sortieren"
      >
        <GripVertical size={16} />
      </button>

      <Input
        defaultValue={variant.name}
        onBlur={(event) => {
          const value = event.target.value.trim();
          if (value && value !== variant.name) {
            void onUpdate(variant.id, { name: value });
          }
        }}
      />

      <Input
        defaultValue={variant.sku_suffix ?? ''}
        placeholder="-BLK"
        onBlur={(event) => {
          const value = nullableText(event.target.value);
          if (value !== variant.sku_suffix) {
            void onUpdate(variant.id, { sku_suffix: value });
          }
        }}
      />

      <Input
        type="number"
        min="0"
        step="0.01"
        defaultValue={variant.price}
        onBlur={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value) && value >= 0 && value !== variant.price) {
            void onUpdate(variant.id, { price: value });
          }
        }}
      />

      {showStock && (
        <Input
          type="number"
          min="0"
          step="1"
          defaultValue={variant.stock_quantity ?? ''}
          onBlur={(event) => {
            const value = nullableNumber(event.target.value);
            if (value !== variant.stock_quantity) {
              void onUpdate(variant.id, { stock_quantity: value });
            }
          }}
        />
      )}

      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={variant.color_hex ?? '#ffffff'}
          onChange={(event) => void onUpdate(variant.id, { color_hex: event.target.value })}
          className="h-8 w-10 p-1"
          aria-label="Farbe"
        />
        {variant.color_hex && (
          <button
            type="button"
            className="text-xs text-text-muted hover:text-text-primary"
            onClick={() => void onUpdate(variant.id, { color_hex: null })}
          >
            x
          </button>
        )}
      </div>

      <label className="flex items-center justify-center">
        <input
          type="radio"
          name={`default-variant-${variant.listing_id}`}
          checked={variant.is_default}
          onChange={onSetDefault}
          className="size-4 accent-[var(--pg-accent)]"
          aria-label="Als Default setzen"
        />
      </label>

      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disableDelete}
        title={
          disableDelete
            ? 'Die letzte Variante oder Default-Variante kann nicht gelöscht werden'
            : 'Variante löschen'
        }
        onClick={onDelete}
        aria-label="Variante löschen"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function nullableNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}
