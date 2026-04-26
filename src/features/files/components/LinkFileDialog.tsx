import { useEffect, useMemo, useState } from 'react';
import { FilePlus2, Search } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getFileInfo, getOneDriveBasePath, hasOneDriveBasePath } from '@/services/filesystem';
import { createFileLink, searchProductsForFileLinks } from '../db';
import { absoluteToRelative } from '../productFolders';
import type { FileType } from '../types';
import { newFileLinkSchema } from '../types';
import { formatUnknownError, getBaseName } from '../utils';

const FILE_TYPE_OPTIONS: { value: FileType; label: string }[] = [
  { value: 'stl', label: 'STL-Datei' },
  { value: 'slicer', label: 'Slicer-Datei' },
  { value: 'image', label: 'Produktbild' },
  { value: 'mockup', label: 'Mockup' },
  { value: 'beleg', label: 'Beleg' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

const OUTSIDE_ONEDRIVE_MESSAGE =
  'Diese Datei liegt außerhalb deines OneDrive-Ordners und kann nicht zuverlässig verknüpft werden. Verschiebe sie zuerst in deinen PolyGrid Studio Ordner.';

interface ProductSearchResult {
  id: string;
  name: string;
}

interface LinkFileDialogProps {
  filePath: string;
  initialProductId?: string;
  initialProductName?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function LinkFileDialog({
  filePath,
  initialProductId,
  initialProductName,
  onSuccess,
  onClose,
}: LinkFileDialogProps) {
  const [search, setSearch] = useState(initialProductName ?? '');
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(
    initialProductId && initialProductName
      ? { id: initialProductId, name: initialProductName }
      : null,
  );
  const [fileType, setFileType] = useState<FileType>('sonstiges');
  const [displayName, setDisplayName] = useState(getBaseName(filePath));
  const [note, setNote] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOutsideOneDrive, setIsOutsideOneDrive] = useState(false);

  const canSave = Boolean(selectedProduct) && displayName.trim().length > 0 && !isOutsideOneDrive;

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      Promise.all([hasOneDriveBasePath(), getOneDriveBasePath()])
        .then(([hasBasePath, basePath]) => {
          if (cancelled || !hasBasePath || !basePath) {
            return;
          }

          setIsOutsideOneDrive(!isPathInsideBasePath(filePath, basePath));
        })
        .catch((err) => {
          if (!cancelled) setError(formatUnknownError(err));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  useEffect(() => {
    if (initialProductId && initialProductName) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (search.trim().length < 2) {
        queueMicrotask(() => setProducts([]));
        return;
      }

      queueMicrotask(() => setIsLoadingProducts(true));
      searchProductsForFileLinks(search)
        .then((results) => {
          if (!cancelled) setProducts(results);
        })
        .catch((err) => {
          if (!cancelled) setError(formatUnknownError(err));
        })
        .finally(() => {
          if (!cancelled) setIsLoadingProducts(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [initialProductId, initialProductName, search]);

  const fileName = useMemo(() => getBaseName(filePath), [filePath]);

  async function handleSave() {
    if (!selectedProduct) {
      setError('Wähle ein Produkt aus.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const basePath = await getOneDriveBasePath();
      if (!basePath) {
        throw new Error('Kein OneDrive-Basispfad konfiguriert.');
      }

      const fileInfo = await getFileInfo(filePath);
      const payload = newFileLinkSchema.parse({
        entity_type: 'product',
        entity_id: selectedProduct.id,
        file_path: absoluteToRelative(filePath, basePath),
        file_type: fileType,
        note: note.trim() ? note.trim() : null,
        is_primary: 0,
        position: 0,
        file_size: fileInfo.size,
        mime_type: guessMimeType(fileInfo.extension),
        display_name: displayName.trim() || fileName,
      });

      await createFileLink(payload);
      onSuccess();
    } catch (err) {
      setError(formatUnknownError(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-bg-elevated text-text-primary sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 size={18} />
            Datei verknüpfen
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Verknüpfe die Datei mit einem Produkt und speichere den Pfad relativ zu OneDrive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant="secondary">
              Produkt
            </Button>
            <Button type="button" variant="outline" disabled title="Verfügbar ab Modul 04">
              Ausgabe
            </Button>
            <Button type="button" variant="outline" disabled title="Verfügbar ab Modul 08">
              Auftrag
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-text-secondary">Produkt suchen</Label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelectedProduct(null);
                }}
                placeholder="Produktname"
                className="pl-8"
                disabled={Boolean(initialProductId)}
              />
            </div>
            {selectedProduct ? (
              <p className="text-xs text-text-secondary">Ausgewählt: {selectedProduct.name}</p>
            ) : null}
            {!selectedProduct && products.length > 0 ? (
              <div className="rounded-md border border-border bg-bg-primary">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-hover"
                    onClick={() => {
                      setSelectedProduct(product);
                      setSearch(product.name);
                      setProducts([]);
                    }}
                  >
                    {product.name}
                  </button>
                ))}
              </div>
            ) : null}
            {isLoadingProducts ? <p className="text-xs text-text-muted">Suche läuft...</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-text-secondary">Dateityp</Label>
              <Select value={fileType} onValueChange={(value) => setFileType(value as FileType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-text-secondary">Anzeigename</Label>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-text-secondary">Notiz</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </div>

          {isOutsideOneDrive ? (
            <p className="rounded-md border border-danger bg-danger-subtle p-3 text-sm text-danger">
              {OUTSIDE_ONEDRIVE_MESSAGE}
            </p>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>

        <DialogFooter className="bg-bg-elevated">
          <Button type="button" variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="button" disabled={!canSave || isSaving} onClick={() => void handleSave()}>
            {isSaving ? 'Verknüpft...' : 'Verknüpfen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function guessMimeType(extension: string | null): string | null {
  if (!extension) return null;

  const normalized = extension.toLowerCase();
  if (normalized === 'png') return 'image/png';
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized === 'webp') return 'image/webp';
  if (normalized === 'stl') return 'model/stl';
  if (normalized === 'pdf') return 'application/pdf';
  return null;
}

function isPathInsideBasePath(filePath: string, basePath: string): boolean {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedBasePath = normalizePath(basePath);
  return (
    normalizedFilePath === normalizedBasePath ||
    normalizedFilePath.startsWith(`${normalizedBasePath}/`)
  );
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}
