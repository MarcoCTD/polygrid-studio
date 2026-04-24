import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { listDirectory, type FileEntry } from '@/services/filesystem';
import { useFilesStore } from '../store';
import { FileContextMenu, type FileAction } from './FileContextMenu';

interface FolderTreeProps {
  rootPath: string;
  onAction: (path: string, action: FileAction) => void;
}

interface FolderNodeProps {
  path: string;
  name: string;
  level: number;
  onAction: (path: string, action: FileAction) => void;
}

export function FolderTree({ rootPath, onAction }: FolderTreeProps) {
  const selectedPath = useFilesStore((state) => state.selectedPath);
  const setSelectedPath = useFilesStore((state) => state.setSelectedPath);
  const expandedFolders = useFilesStore((state) => state.expandedFolders);

  useEffect(() => {
    if (!selectedPath) {
      setSelectedPath(rootPath);
    }
  }, [rootPath, selectedPath, setSelectedPath]);

  return (
    <nav className="h-full overflow-auto text-sm text-text-secondary">
      <FolderNode path={rootPath} name="PolyGrid Studio" level={0} onAction={onAction} />
      {expandedFolders.has(rootPath) ? null : <AutoExpandRoot rootPath={rootPath} />}
    </nav>
  );
}

function AutoExpandRoot({ rootPath }: { rootPath: string }) {
  const toggleFolder = useFilesStore((state) => state.toggleFolder);

  useEffect(() => {
    toggleFolder(rootPath);
  }, [rootPath, toggleFolder]);

  return null;
}

function FolderNode({ path, name, level, onAction }: FolderNodeProps) {
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const selectedPath = useFilesStore((state) => state.selectedPath);
  const setSelectedPath = useFilesStore((state) => state.setSelectedPath);
  const expandedFolders = useFilesStore((state) => state.expandedFolders);
  const toggleFolder = useFilesStore((state) => state.toggleFolder);
  const refreshCounter = useFilesStore((state) => state.refreshCounter);
  const isExpanded = expandedFolders.has(path);
  const isSelected = selectedPath === path;

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      setHasError(false);

      listDirectory(path)
        .then((entries) => {
          if (cancelled) return;
          setChildren(entries.filter((entry) => entry.isDirectory));
        })
        .catch(() => {
          if (cancelled) return;
          setHasError(true);
          setChildren([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [isExpanded, path, refreshCounter]);

  const paddingLeft = useMemo(() => `${level * 16}px`, [level]);
  const FolderIcon = isExpanded ? FolderOpen : Folder;

  return (
    <div>
      <FileContextMenu type="folder" path={path} onAction={onAction}>
        <button
          type="button"
          onClick={() => setSelectedPath(path)}
          className="flex h-9 w-full items-center gap-1.5 rounded-md px-2 text-left hover:bg-bg-hover"
          style={{
            paddingLeft,
            backgroundColor: isSelected ? 'var(--accent-primary-subtle)' : undefined,
            color: isSelected ? 'var(--text-primary)' : undefined,
          }}
        >
          <span
            role="button"
            tabIndex={0}
            className="flex h-5 w-5 shrink-0 items-center justify-center"
            onClick={(event) => {
              event.stopPropagation();
              toggleFolder(path);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                toggleFolder(path);
              }
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <FolderIcon size={16} className="shrink-0 text-text-secondary" />
          <span className="min-w-0 truncate">{name}</span>
          {hasError ? <AlertCircle size={14} className="ml-auto shrink-0 text-danger" /> : null}
        </button>
      </FileContextMenu>

      {isExpanded ? (
        <div>
          {isLoading ? (
            <div className="h-8 px-2 py-2 text-xs text-text-muted" style={{ paddingLeft }}>
              Lädt...
            </div>
          ) : (
            children.map((child) => (
              <FolderNode
                key={child.path}
                path={child.path}
                name={child.name}
                level={level + 1}
                onAction={onAction}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
