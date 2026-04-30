import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ImageIcon, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS, PLATFORM_LIMITS, PLATFORMS } from '../constants';
import {
  addListingImage,
  getListingImages,
  removeListingImage,
  updateListingImage,
  updateListingImageOrder,
  type ListingDetail,
  type ListingImageWithFile,
} from '../listingsService';
import type { Platform } from '../schemas';
import { ImagePickerDialog } from './ImagePickerDialog';

interface ImagesTabProps {
  listing: ListingDetail;
  onImagesChanged: () => void;
}

export function ImagesTab({ listing, onImagesChanged }: ImagesTabProps) {
  const [images, setImages] = useState<ListingImageWithFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const platformCounts = useMemo(() => {
    return {
      etsy: countForPlatform(images, 'etsy'),
      ebay: countForPlatform(images, 'ebay'),
      kleinanzeigen: countForPlatform(images, 'kleinanzeigen'),
    };
  }, [images]);

  function reloadImages() {
    setIsLoading(true);
    getListingImages(listing.id)
      .then(setImages)
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Listing-Bilder konnten nicht geladen werden',
        );
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      getListingImages(listing.id)
        .then((items) => {
          if (!cancelled) setImages(items);
        })
        .catch((err) => {
          if (!cancelled) {
            toast.error(
              err instanceof Error ? err.message : 'Listing-Bilder konnten nicht geladen werden',
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

  async function handleAdd(fileLinkIds: string[]) {
    try {
      for (const fileLinkId of fileLinkIds) {
        await addListingImage(listing.id, fileLinkId);
      }
      toast.success(
        `${fileLinkIds.length} ${fileLinkIds.length === 1 ? 'Bild' : 'Bilder'} hinzugefügt`,
      );
      setIsPickerOpen(false);
      reloadImages();
      onImagesChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bild konnte nicht hinzugefügt werden');
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((image) => image.id === active.id);
    const newIndex = images.findIndex((image) => image.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextImages = arrayMove(images, oldIndex, newIndex).map((image, index) => ({
      ...image,
      sort_order: index,
    }));
    setImages(nextImages);

    try {
      await updateListingImageOrder(
        nextImages.map((image) => ({ id: image.id, sort_order: image.sort_order })),
      );
      onImagesChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Bildreihenfolge konnte nicht gespeichert werden',
      );
      reloadImages();
    }
  }

  async function handleUpdateImage(
    imageId: string,
    data: Partial<Pick<ListingImageWithFile, 'alt_text' | 'platforms'>>,
  ) {
    try {
      await updateListingImage(imageId, data);
      setImages((current) =>
        current.map((image) => (image.id === imageId ? { ...image, ...data } : image)),
      );
      onImagesChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bild konnte nicht aktualisiert werden');
    }
  }

  async function handleRemove(imageId: string) {
    if (!window.confirm('Bildverknüpfung entfernen? Die Datei bleibt erhalten.')) return;

    try {
      await removeListingImage(imageId);
      setImages((current) => current.filter((image) => image.id !== imageId));
      onImagesChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bild konnte nicht entfernt werden');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {images.length} {images.length === 1 ? 'Bild' : 'Bilder'} (Etsy: {platformCounts.etsy}/
            {PLATFORM_LIMITS.etsy.maxImages} · eBay: {platformCounts.ebay}/
            {PLATFORM_LIMITS.ebay.maxImages} · KA: {platformCounts.kleinanzeigen}/
            {PLATFORM_LIMITS.kleinanzeigen.maxImages})
          </p>
          <p className="text-xs text-text-muted">
            Erstes Bild in der Reihenfolge ist das Hauptbild.
          </p>
        </div>
        <Button onClick={() => setIsPickerOpen(true)} className="gap-1.5">
          <Plus size={14} />
          Bild hinzufügen
        </Button>
      </div>

      {platformCounts.etsy > PLATFORM_LIMITS.etsy.maxImages && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Etsy erlaubt maximal {PLATFORM_LIMITS.etsy.maxImages} Bilder. Zusätzliche Bilder werden
          später beim Sync ignoriert.
        </div>
      )}

      {isLoading ? (
        <div className="flex h-56 items-center justify-center rounded-lg border border-border-subtle text-sm text-text-muted">
          Bilder werden geladen...
        </div>
      ) : images.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle text-center text-sm text-text-muted">
          <ImageIcon size={24} />
          <p>Noch keine Bilder verknüpft.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map((image) => image.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {images.map((image, index) => (
                <SortableImageCard
                  key={image.id}
                  image={image}
                  isPrimary={index === 0}
                  onUpdate={handleUpdateImage}
                  onRemove={() => void handleRemove(image.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <ImagePickerDialog
        open={isPickerOpen}
        listingId={listing.id}
        productId={listing.product_id}
        onOpenChange={setIsPickerOpen}
        onConfirm={(ids) => void handleAdd(ids)}
      />
    </div>
  );
}

function SortableImageCard({
  image,
  isPrimary,
  onUpdate,
  onRemove,
}: {
  image: ListingImageWithFile;
  isPrimary: boolean;
  onUpdate: (
    imageId: string,
    data: Partial<Pick<ListingImageWithFile, 'alt_text' | 'platforms'>>,
  ) => Promise<void>;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function togglePlatform(platform: Platform) {
    const current = image.platforms ?? [...PLATFORMS];
    const next = current.includes(platform)
      ? current.filter((item) => item !== platform)
      : [...current, platform];
    const normalized = next.length === PLATFORMS.length ? null : next;
    void onUpdate(image.id, { platforms: normalized });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-border-subtle bg-bg-elevated p-3 shadow-sm',
        isDragging && 'opacity-70 shadow-lg',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <button
          type="button"
          className="cursor-grab rounded-md p-1 text-text-muted hover:bg-bg-hover active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Bild sortieren"
        >
          <GripVertical size={16} />
        </button>
        {isPrimary && <Badge className="bg-pg-accent text-white">HAUPT</Badge>}
        <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Bild entfernen">
          <Trash2 size={14} />
        </Button>
      </div>

      <div className="mb-3 flex h-36 items-center justify-center rounded-md bg-bg-secondary">
        <img
          src={convertFileSrc(image.file_path)}
          alt={image.alt_text ?? displayName(image)}
          className="size-full rounded-md object-cover"
          draggable={false}
        />
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Alt-Text</label>
          <Input
            defaultValue={image.alt_text ?? ''}
            onBlur={(event) =>
              void onUpdate(image.id, {
                alt_text: event.target.value.trim() === '' ? null : event.target.value,
              })
            }
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-text-secondary">Plattformen</p>
          <div className="grid grid-cols-3 gap-1">
            {PLATFORMS.map((platform) => (
              <label key={platform} className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={image.platforms === null || image.platforms.includes(platform)}
                  onCheckedChange={() => togglePlatform(platform)}
                />
                <span>{shortPlatformLabel(platform)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function countForPlatform(images: ListingImageWithFile[], platform: Platform): number {
  return images.filter((image) => image.platforms === null || image.platforms.includes(platform))
    .length;
}

function displayName(image: ListingImageWithFile): string {
  if (image.display_name?.trim()) return image.display_name;
  const parts = image.file_path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? image.file_path;
}

function shortPlatformLabel(platform: Platform): string {
  if (platform === 'kleinanzeigen') return 'KA';
  return PLATFORM_LABELS[platform];
}
