import { useCallback, useEffect, useState } from 'react';
import { Grid2X2, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkPathExists, getOneDriveBasePath } from '@/services/filesystem';
import { useFilesStore } from './store';
import {
  ErrorBanner,
  FileBreadcrumb,
  FileList,
  FolderTree,
  ImagePreview,
  OneDriveSetupDialog,
  type FileAction,
} from './components';
import { useFileActions } from './hooks';

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
  const [selectedImage, setSelectedImage] = useState<{ path: string; name: string } | null>(null);
  const selectedPath = useFilesStore((state) => state.selectedPath);
  const setSelectedPath = useFilesStore((state) => state.setSelectedPath);
  const storeError = useFilesStore((state) => state.error);
  const clearStoreError = useFilesStore((state) => state.clearError);
  const fileActions = useFileActions({ rootPath: oneDrivePath ?? '' });

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
        setSelectedImage(null);
        return;
      }

      const exists = await checkPathExists(path);
      setPathReachable(exists);
      setSelectedPath(exists ? path : null);
      setSelectedImage(null);
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        void fileActions.handleUndo();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileActions]);

  useEffect(() => {
    queueMicrotask(() => setSelectedImage(null));
  }, [selectedPath]);

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
          <Button
            variant="secondary"
            size="sm"
            disabled={!selectedPath}
            className="gap-1.5"
            onClick={() => fileActions.handleNewFolder(selectedPath)}
          >
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

      {storeError ? <ErrorBanner /> : null}

      <div className="mt-3 flex flex-1 overflow-hidden rounded-lg border border-border bg-bg-elevated">
        <aside className="w-60 shrink-0 border-r border-border-subtle bg-bg-secondary p-3">
          <FolderTree rootPath={oneDrivePath} onAction={handleFileAction} />
        </aside>
        <section className="flex min-w-0 flex-1 flex-col bg-bg-primary p-4">
          {selectedPath ? (
            <>
              <FileBreadcrumb
                rootPath={oneDrivePath}
                selectedPath={selectedPath}
                onNavigate={setSelectedPath}
              />
              <FileList
                selectedPath={selectedPath}
                oneDriveBasePath={oneDrivePath}
                onAction={handleFileAction}
                onImageSelect={setSelectedImage}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
              Kein Ordner ausgewählt
            </div>
          )}
        </section>
        {selectedImage ? (
          <ImagePreview
            filePath={selectedImage.path}
            fileName={selectedImage.name}
            onClose={() => setSelectedImage(null)}
          />
        ) : null}
      </div>
      {fileActions.dialogs}
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
    setSelectedImage(null);
    clearStoreError();
  }

  function handleFileAction(path: string, action: FileAction) {
    if (action.type === 'rename') fileActions.handleRename(path);
    if (action.type === 'move') fileActions.handleMove(path);
    if (action.type === 'copy') void fileActions.handleCopy(path);
    if (action.type === 'archive') fileActions.handleArchive(path);
    if (action.type === 'open_in_explorer') void fileActions.handleOpenInExplorer(path);
    if (action.type === 'new_subfolder') fileActions.handleNewFolder(path);
    if (action.type === 'link_file') fileActions.handleLinkFile(path);
  }
}
