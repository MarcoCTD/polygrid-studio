import { useEffect, useMemo, useState } from 'react';
import { File, FileText, Folder, Image, Package } from 'lucide-react';
import { listDirectory, openInExplorer, type FileEntry } from '@/services/filesystem';
import { useFilesStore } from '../store';

type SortKey = 'name' | 'size' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';

interface FileListProps {
  selectedPath: string;
}

export function FileList({ selectedPath }: FileListProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const setSelectedPath = useFilesStore((state) => state.setSelectedPath);
  const setError = useFilesStore((state) => state.setError);
  const clearError = useFilesStore((state) => state.clearError);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      setIsLoading(true);

      listDirectory(selectedPath)
        .then((data) => {
          if (cancelled) return;
          setEntries(data);
          clearError();
        })
        .catch((err) => {
          if (cancelled) return;
          setEntries([]);
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [clearError, selectedPath, setError]);

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }

      const result = compareEntry(a, b, sortKey);
      return sortDirection === 'asc' ? result : -result;
    });
    return sorted;
  }, [entries, sortDirection, sortKey]);

  function updateSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextKey);
    setSortDirection('asc');
  }

  async function handleDoubleClick(entry: FileEntry) {
    if (entry.isDirectory) {
      setSelectedPath(entry.path);
      return;
    }

    try {
      await openInExplorer(entry.path);
      clearError();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
        Ordnerinhalt wird geladen...
      </div>
    );
  }

  if (sortedEntries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
        Dieser Ordner ist leer
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="text-xs font-medium text-text-secondary">
          <tr className="h-9 border-b border-border-subtle">
            <SortableHeader
              label="Name"
              active={sortKey === 'name'}
              onClick={() => updateSort('name')}
            />
            <SortableHeader
              label="Größe"
              active={sortKey === 'size'}
              onClick={() => updateSort('size')}
              className="w-28 text-right"
            />
            <SortableHeader
              label="Geändert am"
              active={sortKey === 'modifiedAt'}
              onClick={() => updateSort('modifiedAt')}
              className="w-44"
            />
            <th className="w-32 px-3 text-left">Verknüpfung</th>
          </tr>
        </thead>
        <tbody>
          {sortedEntries.map((entry) => (
            <tr
              key={entry.path}
              className="h-11 cursor-default border-b border-border-subtle text-text-primary hover:bg-bg-hover"
              onDoubleClick={() => void handleDoubleClick(entry)}
            >
              <td className="min-w-0 px-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileIcon entry={entry} />
                  <span className="truncate">{entry.name}</span>
                </div>
              </td>
              <td className="px-3 text-right text-text-secondary">{formatSize(entry)}</td>
              <td className="px-3 text-text-secondary">{formatDate(entry.modifiedAt)}</td>
              <td className="px-3 text-text-muted">-</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  onClick,
  className = '',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-3 text-left ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="h-8 text-xs font-medium text-text-secondary hover:text-text-primary"
      >
        {label}
        {active ? ' *' : ''}
      </button>
    </th>
  );
}

function FileIcon({ entry }: { entry: FileEntry }) {
  const className = 'shrink-0 text-text-secondary';

  if (entry.isDirectory) {
    return <Folder size={16} className={className} />;
  }

  const extension = entry.extension?.toLowerCase();
  if (extension && ['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
    return <Image size={16} className={className} />;
  }

  if (extension === 'stl') {
    return <Package size={16} className={className} />;
  }

  if (extension && ['txt', 'md', 'pdf', 'doc', 'docx'].includes(extension)) {
    return <FileText size={16} className={className} />;
  }

  return <File size={16} className={className} />;
}

function compareEntry(a: FileEntry, b: FileEntry, sortKey: SortKey): number {
  if (sortKey === 'size') {
    return (a.size ?? -1) - (b.size ?? -1);
  }

  if (sortKey === 'modifiedAt') {
    return (a.modifiedAt ?? 0) - (b.modifiedAt ?? 0);
  }

  return a.name.localeCompare(b.name, 'de');
}

function formatSize(entry: FileEntry): string {
  if (entry.isDirectory || entry.size === null) {
    return '-';
  }

  if (entry.size < 1024) {
    return `${entry.size} B`;
  }

  if (entry.size < 1024 * 1024) {
    return `${(entry.size / 1024).toFixed(1)} KB`;
  }

  return `${(entry.size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) {
    return '-';
  }

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000));
}
