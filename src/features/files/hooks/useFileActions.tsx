import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  copyFile,
  createDirectory,
  deleteToArchive,
  moveFile,
  openInExplorer,
  renameFile,
  undoLastOperation,
} from '@/services/filesystem';
import { useFilesStore } from '../store';
import { MoveDialog } from '../components/MoveDialog';
import { NewFolderDialog } from '../components/NewFolderDialog';
import { RenameDialog } from '../components/RenameDialog';

interface UseFileActionsOptions {
  rootPath: string;
}

interface PendingPath {
  path: string;
}

export function useFileActions({ rootPath }: UseFileActionsOptions) {
  const selectedPath = useFilesStore((state) => state.selectedPath);
  const setError = useFilesStore((state) => state.setError);
  const clearError = useFilesStore((state) => state.clearError);
  const refreshCurrentFolder = useFilesStore((state) => state.refreshCurrentFolder);
  const [renameTarget, setRenameTarget] = useState<PendingPath | null>(null);
  const [newFolderParent, setNewFolderParent] = useState<PendingPath | null>(null);
  const [moveTarget, setMoveTarget] = useState<PendingPath | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PendingPath | null>(null);

  async function runAction(action: () => Promise<void>) {
    try {
      await action();
      clearError();
      refreshCurrentFolder();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleRename(path: string) {
    setRenameTarget({ path });
  }

  function handleMove(path: string) {
    setMoveTarget({ path });
  }

  function handleArchive(path: string) {
    setArchiveTarget({ path });
  }

  function handleNewFolder(parentPath?: string | null) {
    setNewFolderParent({ path: parentPath ?? selectedPath ?? rootPath });
  }

  async function handleCopy(path: string) {
    await runAction(async () => {
      await copyFile(path, copyTargetPath(path));
    });
  }

  async function handleOpenInExplorer(path: string) {
    await runAction(async () => {
      await openInExplorer(path);
    });
  }

  async function handleUndo() {
    await runAction(async () => {
      await undoLastOperation();
    });
  }

  async function confirmRename(newName: string) {
    if (!renameTarget) return;
    await runAction(async () => {
      await renameFile(renameTarget.path, siblingPath(renameTarget.path, newName));
    });
  }

  async function confirmNewFolder(name: string) {
    if (!newFolderParent) return;
    await runAction(async () => {
      await createDirectory(joinPath(newFolderParent.path, name));
    });
  }

  async function confirmMove(targetFolder: string) {
    if (!moveTarget) return;
    await runAction(async () => {
      await moveFile(moveTarget.path, joinPath(targetFolder, baseName(moveTarget.path)));
    });
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    await runAction(async () => {
      await deleteToArchive(archiveTarget.path);
    });
    setArchiveTarget(null);
  }

  const dialogs = (
    <>
      <RenameDialog
        open={renameTarget !== null}
        path={renameTarget?.path ?? null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        onConfirm={confirmRename}
      />
      <NewFolderDialog
        open={newFolderParent !== null}
        parentPath={newFolderParent?.path ?? null}
        onOpenChange={(open) => {
          if (!open) setNewFolderParent(null);
        }}
        onConfirm={confirmNewFolder}
      />
      <MoveDialog
        open={moveTarget !== null}
        rootPath={rootPath}
        currentParentPath={moveTarget ? parentPath(moveTarget.path) : null}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
        onConfirm={confirmMove}
      />
      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <AlertDialogContent className="bg-bg-elevated text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Archivieren</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              '{archiveTarget ? baseName(archiveTarget.path) : ''}' wird nach /09_Archiv verschoben.
              Diese Aktion kann rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="bg-bg-elevated">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmArchive()}>
              Archivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return {
    dialogs,
    handleRename,
    handleMove,
    handleCopy,
    handleArchive,
    handleOpenInExplorer,
    handleNewFolder,
    handleUndo,
  };
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function parentPath(path: string): string {
  const separator = path.includes('\\') ? '\\' : '/';
  const parts = path.split(/[\\/]/).filter(Boolean);
  parts.pop();
  const prefix = path.startsWith(separator) ? separator : '';
  return `${prefix}${parts.join(separator)}`;
}

function siblingPath(path: string, name: string): string {
  return joinPath(parentPath(path), name);
}

function joinPath(parent: string, name: string): string {
  const separator = parent.includes('\\') ? '\\' : '/';
  return `${parent.replace(/[\\/]+$/, '')}${separator}${name}`;
}

function copyTargetPath(path: string): string {
  const name = baseName(path);
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) {
    return siblingPath(path, `${name} Kopie`);
  }

  return siblingPath(path, `${name.slice(0, dotIndex)} Kopie${name.slice(dotIndex)}`);
}
