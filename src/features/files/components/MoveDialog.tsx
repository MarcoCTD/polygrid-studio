import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { listDirectory, type FileEntry } from '@/services/filesystem';
import { formatUnknownError, isHiddenFile } from '../utils';

interface MoveDialogProps {
  open: boolean;
  rootPath: string;
  currentParentPath: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (targetFolder: string) => Promise<void>;
}

export function MoveDialog({
  open,
  rootPath,
  currentParentPath,
  onOpenChange,
  onConfirm,
}: MoveDialogProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setSelectedTarget(null);
      setExpandedFolders(new Set([rootPath]));
      setError(null);
    });
  }, [open, rootPath]);

  async function handleSubmit() {
    if (!selectedTarget) {
      setError('Wähle einen Zielordner aus.');
      return;
    }

    if (selectedTarget === currentParentPath) {
      setError('Der aktuelle Ordner kann nicht als Ziel gewählt werden.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onConfirm(selectedTarget);
      onOpenChange(false);
    } catch (err) {
      setError(formatUnknownError(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-elevated text-text-primary sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verschieben</DialogTitle>
          <DialogDescription className="text-text-secondary">
            Wähle den Zielordner für die Datei oder den Ordner aus.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-auto rounded-lg border border-border bg-bg-primary p-2">
          <MoveFolderNode
            path={rootPath}
            name="PolyGrid Studio"
            level={0}
            currentParentPath={currentParentPath}
            selectedTarget={selectedTarget}
            expandedFolders={expandedFolders}
            setSelectedTarget={setSelectedTarget}
            setExpandedFolders={setExpandedFolders}
          />
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <DialogFooter className="bg-bg-elevated">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" disabled={isSaving} onClick={() => void handleSubmit()}>
            {isSaving ? 'Verschiebt...' : 'Bestätigen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MoveFolderNodeProps {
  path: string;
  name: string;
  level: number;
  currentParentPath: string | null;
  selectedTarget: string | null;
  expandedFolders: Set<string>;
  setSelectedTarget: (path: string) => void;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
}

function MoveFolderNode({
  path,
  name,
  level,
  currentParentPath,
  selectedTarget,
  expandedFolders,
  setSelectedTarget,
  setExpandedFolders,
}: MoveFolderNodeProps) {
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isExpanded = expandedFolders.has(path);
  const isSelected = selectedTarget === path;
  const isCurrentParent = currentParentPath === path;
  const FolderIcon = isExpanded ? FolderOpen : Folder;

  useEffect(() => {
    if (!isExpanded) return;

    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);
      listDirectory(path)
        .then((entries) => {
          if (cancelled) return;
          setChildren(entries.filter((entry) => entry.isDirectory && !isHiddenFile(entry.name)));
        })
        .catch(() => {
          if (cancelled) return;
          setChildren([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [isExpanded, path]);

  function toggleExpanded() {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={isCurrentParent}
        onClick={() => setSelectedTarget(path)}
        className="flex h-9 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:text-text-disabled"
        style={{
          paddingLeft: `${level * 16}px`,
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
            toggleExpanded();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              toggleExpanded();
            }
          }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <FolderIcon size={16} className="shrink-0" />
        <span className="min-w-0 truncate">{name}</span>
      </button>

      {isExpanded ? (
        <div>
          {isLoading ? (
            <div
              className="h-8 px-2 py-2 text-xs text-text-muted"
              style={{ paddingLeft: `${level * 16}px` }}
            >
              Lädt...
            </div>
          ) : (
            children.map((child) => (
              <MoveFolderNode
                key={child.path}
                path={child.path}
                name={child.name}
                level={level + 1}
                currentParentPath={currentParentPath}
                selectedTarget={selectedTarget}
                expandedFolders={expandedFolders}
                setSelectedTarget={setSelectedTarget}
                setExpandedFolders={setExpandedFolders}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
