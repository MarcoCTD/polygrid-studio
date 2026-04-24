import { useCallback, useEffect, useState } from 'react';
import { Grid2X2, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkPathExists, getOneDriveBasePath } from '@/services/filesystem';
import { useFilesStore } from './store';
import { FileBreadcrumb, FileList, FolderTree, OneDriveSetupDialog } from './components';

function shortenMiddle(path: string, maxLength = 50): string {
  if (path.length <= maxLength) {
    return path;
  }

  const segmentLength = Math.floor((maxLength - 3) / 2);
  return `${path.slice(0, segmentLength)}...${path.slice(-segmentLength)}`;
}

export function FilesPage() {
  const [oneDrivePath, setOneDrivePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pathReachable, setPathReachable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedPath = useFilesStore((state) => state.selectedPath);
  const setSelectedPath = useFilesStore((state) => state.setSelectedPath);
  const storeError = useFilesStore((state) => state.error);
  const clearStoreError = useFilesStore((state) => state.clearError);

  const loadOneDrivePath = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const path = await getOneDriveBasePath();
      setOneDrivePath(path);
      clearStoreError();

      if (!path) {
        setPathReachable(false);
        setSelectedPath(null);
        return;
      }

      const exists = await checkPathExists(path);
      setPathReachable(exists);
      setSelectedPath(exists ? path : null);
      if (!exists) {
        setError('Der konfigurierte OneDrive-Ordner ist nicht erreichbar.');
      }
    } catch (err) {
      setPathReachable(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [clearStoreError, setSelectedPath]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOneDrivePath();
    });
  }, [loadOneDrivePath]);

  if (isLoading) {
    return (
      <div className="flex min-h-[560px] items-center justify-center bg-bg-primary text-sm text-text-muted">
        Dateimanager wird geladen...
      </div>
    );
  }

  if (!oneDrivePath) {
    return <OneDriveSetupDialog onConfigured={(path) => void handleConfigured(path)} />;
  }

  if (!pathReachable) {
    return (
      <div className="flex min-h-[560px] items-center justify-center bg-bg-primary p-6">
        <section className="w-full max-w-xl rounded-lg border border-border bg-bg-elevated p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-text-primary">OneDrive nicht erreichbar</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {error ?? 'Der konfigurierte Pfad konnte nicht geöffnet werden.'}
          </p>
          <Button className="mt-5" onClick={() => void handleReconfigure()}>
            Pfad neu konfigurieren
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] min-h-[620px] flex-col overflow-hidden bg-bg-primary">
      <header className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled className="gap-1.5">
            <FolderPlus size={14} />
            Neuer Ordner
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled
            className="gap-1.5"
            title="Grid-Ansicht kommt später"
          >
            <Grid2X2 size={14} />
            Ansicht
          </Button>
        </div>
        <p
          className="max-w-[360px] truncate text-xs text-text-muted"
          title={selectedPath ?? oneDrivePath}
        >
          {shortenMiddle(selectedPath ?? oneDrivePath)}
        </p>
      </header>

      {storeError ? (
        <div className="mt-3 rounded-lg border border-danger bg-danger-subtle px-3 py-2 text-sm text-danger">
          {storeError}
        </div>
      ) : null}

      <div className="mt-3 flex flex-1 overflow-hidden rounded-lg border border-border bg-bg-elevated">
        <aside className="w-60 shrink-0 border-r border-border-subtle bg-bg-secondary p-3">
          <FolderTree rootPath={oneDrivePath} />
        </aside>
        <section className="flex min-w-0 flex-1 flex-col bg-bg-primary p-4">
          {selectedPath ? (
            <>
              <FileBreadcrumb
                rootPath={oneDrivePath}
                selectedPath={selectedPath}
                onNavigate={setSelectedPath}
              />
              <FileList selectedPath={selectedPath} />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
              Kein Ordner ausgewählt
            </div>
          )}
        </section>
      </div>
    </div>
  );

  async function handleConfigured(path: string) {
    setOneDrivePath(path);
    setSelectedPath(path);
    await loadOneDrivePath();
  }

  async function handleReconfigure() {
    setOneDrivePath(null);
    setPathReachable(false);
    setSelectedPath(null);
    clearStoreError();
  }
}
