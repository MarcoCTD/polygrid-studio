import { useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { ExternalLink, FilePlus2, FolderPlus, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { checkPathExists, getOneDriveBasePath, openInExplorer } from '@/services/filesystem';
import { deleteFileLink, getFileLinksByEntity, setPrimaryFileLink } from '@/features/files/db';
import { LinkFileDialog } from '@/features/files/components';
import {
  createProductFolderStructure,
  getProductFolderPath,
  relativeToAbsolute,
} from '@/features/files/productFolders';
import type { FileLink } from '@/features/files/types';
import type { Product } from '../schema';

const FILE_TYPE_LABELS: Record<string, string> = {
  stl: 'STL-Dateien',
  slicer: 'Slicer-Dateien',
  image: 'Bilder',
  mockup: 'Mockups',
  beleg: 'Belege',
  sonstiges: 'Sonstiges',
};

interface ProductFilesTabProps {
  product: Product;
}

export function ProductFilesTab({ product }: ProductFilesTabProps) {
  const [basePath, setBasePath] = useState<string | null>(null);
  const [folderExists, setFolderExists] = useState(false);
  const [links, setLinks] = useState<FileLink[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const productFolderPath = basePath ? getProductFolderPath(basePath, product.name) : null;

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      setIsLoading(true);
      setError(null);
      loadData()
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    async function loadData() {
      const configuredBasePath = await getOneDriveBasePath();
      if (cancelled) return;
      setBasePath(configuredBasePath);

      if (configuredBasePath) {
        const expectedFolder = getProductFolderPath(configuredBasePath, product.name);
        const exists = await checkPathExists(expectedFolder);
        if (!cancelled) setFolderExists(exists);
      } else {
        setFolderExists(false);
      }

      const fileLinks = await getFileLinksByEntity('product', product.id);
      if (!cancelled) setLinks(fileLinks);
    }

    return () => {
      cancelled = true;
    };
  }, [product.id, product.name, refreshCounter]);

  const groupedLinks = useMemo(() => {
    return links.reduce<Record<string, FileLink[]>>((groups, link) => {
      groups[link.file_type] ??= [];
      groups[link.file_type].push(link);
      return groups;
    }, {});
  }, [links]);

  async function handleCreateFolder() {
    if (!basePath) {
      setError('Kein OneDrive-Basispfad konfiguriert.');
      return;
    }

    setIsCreatingFolder(true);
    setError(null);
    try {
      await createProductFolderStructure(basePath, product.name);
      setFolderExists(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreatingFolder(false);
    }
  }

  async function handleOpenFolder() {
    if (!productFolderPath) return;
    try {
      await openInExplorer(productFolderPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handlePickFile() {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
      });

      if (typeof selected === 'string') {
        setSelectedFilePath(selected);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteLink(id: string) {
    try {
      await deleteFileLink(id);
      setRefreshCounter((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSetPrimary(link: FileLink) {
    try {
      await setPrimaryFileLink(product.id, 'product', link.file_type, link.id);
      setRefreshCounter((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (isLoading) {
    return <div className="text-sm text-text-muted">Dateien werden geladen...</div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <section className="rounded-lg border border-border bg-bg-elevated p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Produktordner</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {basePath
                ? productFolderPath
                : 'Konfiguriere zuerst den OneDrive-Pfad im Dateimanager.'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {!folderExists && basePath ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={isCreatingFolder}
                onClick={() => void handleCreateFolder()}
              >
                <FolderPlus size={14} />
                {isCreatingFolder ? 'Legt an...' : 'Produktordner anlegen'}
              </Button>
            ) : null}
            {folderExists && productFolderPath ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => void handleOpenFolder()}
              >
                <ExternalLink size={14} />
                Im Finder öffnen
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-bg-elevated p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Verknüpfte Dateien</h2>
            <p className="text-sm text-text-secondary">
              Dateien aus dem OneDrive-Ordner, die diesem Produkt zugeordnet sind.
            </p>
          </div>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => void handlePickFile()}>
            <FilePlus2 size={14} />
            Datei verknüpfen
          </Button>
        </div>

        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

        {links.length === 0 ? (
          <div className="rounded-md border border-border-subtle bg-bg-primary p-6 text-sm text-text-muted">
            Noch keine Dateien verknüpft. Verknüpfe Dateien über den Dateimanager oder den Button
            oben.
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedLinks).map(([fileType, fileLinks]) => (
              <div key={fileType}>
                <h3 className="mb-2 text-xs font-semibold uppercase text-text-muted">
                  {FILE_TYPE_LABELS[fileType] ?? fileType}
                </h3>
                <div className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-bg-primary">
                  {fileLinks.map((link) => (
                    <FileLinkRow
                      key={link.id}
                      link={link}
                      basePath={basePath}
                      onError={setError}
                      onDelete={() => void handleDeleteLink(link.id)}
                      onSetPrimary={() => void handleSetPrimary(link)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedFilePath ? (
        <LinkFileDialog
          filePath={selectedFilePath}
          initialProductId={product.id}
          initialProductName={product.name}
          onClose={() => setSelectedFilePath(null)}
          onSuccess={() => {
            setSelectedFilePath(null);
            setRefreshCounter((current) => current + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function FileLinkRow({
  link,
  basePath,
  onDelete,
  onSetPrimary,
  onError,
}: {
  link: FileLink;
  basePath: string | null;
  onDelete: () => void;
  onSetPrimary: () => void;
  onError: (message: string) => void;
}) {
  const canBePrimary = link.file_type === 'stl' || link.file_type === 'image';
  const displayName = link.display_name || getNameFromPath(link.file_path);

  async function handleOpen() {
    if (!basePath) return;
    try {
      await openInExplorer(relativeToAbsolute(link.file_path, basePath));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">{displayName}</span>
          <Badge variant="outline">{link.file_type}</Badge>
          {link.is_primary === 1 ? (
            <Badge className="bg-success-subtle text-success">Hauptdatei</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {formatSize(link.file_size)} · {link.file_path}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleOpen()}>
          Öffnen
        </Button>
        {canBePrimary && link.is_primary !== 1 ? (
          <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={onSetPrimary}>
            <Star size={13} />
            Als Hauptdatei setzen
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={onDelete}>
          <Trash2 size={13} />
          Verknüpfung entfernen
        </Button>
      </div>
    </div>
  );
}

function getNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function formatSize(size: number | null): string {
  if (size === null) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
