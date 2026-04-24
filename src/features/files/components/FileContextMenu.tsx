import { useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Archive,
  Copy,
  Edit3,
  ExternalLink,
  FilePlus2,
  FolderPlus,
  MoveRight,
  Play,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type FileAction =
  | { type: 'rename' }
  | { type: 'move' }
  | { type: 'copy' }
  | { type: 'archive' }
  | { type: 'open_in_explorer' }
  | { type: 'new_subfolder' }
  | { type: 'link_file' };

interface FileContextMenuProps {
  type: 'file' | 'folder';
  path: string;
  onAction: (path: string, action: FileAction) => void;
  children: ReactNode;
}

export function FileContextMenu({ type, path, onAction, children }: FileContextMenuProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const allowNextClickRef = useRef(false);

  function handleContextMenu(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    allowNextClickRef.current = true;
    triggerRef.current?.click();
  }

  function handleClick(event: React.MouseEvent) {
    if (allowNextClickRef.current) {
      allowNextClickRef.current = false;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function run(action: FileAction) {
    onAction(path, action);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <span
          ref={triggerRef}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          className="block"
        >
          {children}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 bg-bg-elevated text-text-primary">
        {type === 'folder' ? (
          <>
            <DropdownMenuItem onClick={() => run({ type: 'new_subfolder' })}>
              <FolderPlus size={14} />
              Neuer Unterordner
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run({ type: 'rename' })}>
              <Edit3 size={14} />
              Umbenennen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run({ type: 'open_in_explorer' })}>
              <ExternalLink size={14} />
              Im Finder öffnen
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => run({ type: 'open_in_explorer' })}>
              <Play size={14} />
              Öffnen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run({ type: 'rename' })}>
              <Edit3 size={14} />
              Umbenennen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run({ type: 'move' })}>
              <MoveRight size={14} />
              Verschieben
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run({ type: 'copy' })}>
              <Copy size={14} />
              Kopieren
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run({ type: 'link_file' })}>
              <FilePlus2 size={14} />
              Verknüpfen mit...
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="text-danger focus:text-danger"
          onClick={() => run({ type: 'archive' })}
        >
          <Archive size={14} />
          Archivieren
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
