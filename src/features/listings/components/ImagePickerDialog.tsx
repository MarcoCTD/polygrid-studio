import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { getAvailableListingImageFileLinks, type ImageFileLinkOption } from '../listingsService';

interface ImagePickerDialogProps {
  open: boolean;
  listingId: string;
  productId: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (fileLinkIds: string[]) => void;
}

export function ImagePickerDialog({
  open,
  listingId,
  productId,
  onOpenChange,
  onConfirm,
}: ImagePickerDialogProps) {
  const [items, setItems] = useState<ImageFileLinkOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      setSelectedIds(new Set());
      getAvailableListingImageFileLinks(listingId, productId)
        .then((links) => {
          if (!cancelled) setItems(links);
        })
        .catch((err) => {
          if (!cancelled) {
            toast.error(err instanceof Error ? err.message : 'Bilder konnten nicht geladen werden');
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [listingId, open, productId]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bild hinzufügen</DialogTitle>
          <DialogDescription>
            Wähle vorhandene Bild-Verknüpfungen aus dem Dateimanager aus.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-56 items-center justify-center text-sm text-text-muted">
            Bilder werden geladen...
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle text-center text-sm text-text-muted">
            <ImageIcon size={24} />
            <p>Füge zuerst Bilder im Dateimanager zum Produktordner hinzu.</p>
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-auto pr-1 sm:grid-cols-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleSelected(item.id)}
                className={cn(
                  'flex min-h-36 flex-col rounded-lg border border-border-subtle bg-bg-elevated p-3 text-left transition-colors hover:bg-bg-hover',
                  selectedIds.has(item.id) && 'border-pg-accent ring-2 ring-pg-accent/20',
                )}
              >
                <div className="mb-3 flex h-20 items-center justify-center overflow-hidden rounded-md bg-bg-secondary">
                  <img
                    src={convertFileSrc(item.file_path)}
                    alt={displayName(item)}
                    className="size-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox checked={selectedIds.has(item.id)} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {displayName(item)}
                    </p>
                    <p className="truncate text-xs text-text-muted" title={item.file_path}>
                      {item.file_path}
                    </p>
                    {item.isProductFile && (
                      <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Produktbild
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            disabled={selectedIds.size === 0}
            onClick={() => onConfirm(Array.from(selectedIds))}
          >
            {selectedIds.size} hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function displayName(item: ImageFileLinkOption): string {
  if (item.display_name?.trim()) return item.display_name;
  const parts = item.file_path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? item.file_path;
}
