import { useState } from 'react';
import { Bookmark, MoreHorizontal, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProductsUIStore, type SavedFilter } from '../productsUiStore';
import { getSetting, setSetting } from '@/services/database';

const SETTINGS_KEY = 'products_saved_filters';

// ============================================================
// Persistence helpers
// ============================================================

export async function loadSavedFilters(): Promise<SavedFilter[]> {
  try {
    const data = await getSetting<SavedFilter[]>(SETTINGS_KEY);
    return data ?? [];
  } catch {
    return [];
  }
}

async function persistFilters(filters: SavedFilter[]): Promise<void> {
  await setSetting(SETTINGS_KEY, filters);
}

// ============================================================
// Filter Context Menu
// ============================================================

function FilterContextMenu({
  onRename,
  onUpdate,
  onDelete,
}: {
  onRename: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className="rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal size={14} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 p-1">
        <button
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-bg-hover"
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
        >
          <Pencil size={12} />
          Umbenennen
        </button>
        <button
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-bg-hover"
          onClick={(e) => {
            e.stopPropagation();
            onUpdate();
          }}
        >
          <RefreshCw size={12} />
          Aktualisieren
        </button>
        <button
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--accent-danger)] hover:bg-bg-hover"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={12} />
          Löschen
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// SavedFilters Component
// ============================================================

export function SavedFilters() {
  const {
    savedFilters,
    filters,
    applyFilterState,
    updateSavedFilter,
    deleteSavedFilter,
    hasActiveFilters,
    addSavedFilter,
    setSavedFilters,
  } = useProductsUIStore();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renamingFilter, setRenamingFilter] = useState<SavedFilter | null>(null);
  const [filterName, setFilterName] = useState('');

  async function handleSave() {
    if (!filterName.trim()) return;
    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name: filterName.trim(),
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };
    addSavedFilter(newFilter);
    await persistFilters([...savedFilters, newFilter]);
    setFilterName('');
    setShowSaveDialog(false);
  }

  async function handleApply(filter: SavedFilter) {
    applyFilterState(filter.filters);
  }

  async function handleRename() {
    if (!renamingFilter || !filterName.trim()) return;
    updateSavedFilter(renamingFilter.id, { name: filterName.trim() });
    const updated = savedFilters.map((f) =>
      f.id === renamingFilter.id ? { ...f, name: filterName.trim() } : f,
    );
    await persistFilters(updated);
    setRenamingFilter(null);
    setFilterName('');
    setShowRenameDialog(false);
  }

  async function handleUpdate(filter: SavedFilter) {
    updateSavedFilter(filter.id, { filters: { ...filters } });
    const updated = savedFilters.map((f) =>
      f.id === filter.id ? { ...f, filters: { ...filters } } : f,
    );
    await persistFilters(updated);
  }

  async function handleDelete(filter: SavedFilter) {
    deleteSavedFilter(filter.id);
    const updated = savedFilters.filter((f) => f.id !== filter.id);
    setSavedFilters(updated);
    await persistFilters(updated);
  }

  return (
    <>
      {/* Saved Filters Dropdown */}
      {savedFilters.length > 0 && (
        <Popover>
          <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-bg-hover">
            <Bookmark size={14} />
            <span>Gespeicherte Filter</span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <p className="mb-2 text-xs font-medium text-text-secondary">Gespeicherte Filter</p>
            <div className="flex flex-col gap-0.5">
              {savedFilters.map((filter) => (
                <div
                  key={filter.id}
                  className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-bg-hover"
                  onClick={() => handleApply(filter)}
                >
                  <span className="truncate">{filter.name}</span>
                  <FilterContextMenu
                    onRename={() => {
                      setRenamingFilter(filter);
                      setFilterName(filter.name);
                      setShowRenameDialog(true);
                    }}
                    onUpdate={() => handleUpdate(filter)}
                    onDelete={() => handleDelete(filter)}
                  />
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Save current filter button */}
      {hasActiveFilters() && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-text-secondary"
          onClick={() => {
            setFilterName('');
            setShowSaveDialog(true);
          }}
        >
          <Bookmark size={14} />
          Als Filter speichern
        </Button>
      )}

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Filter speichern</DialogTitle>
          </DialogHeader>
          <div>
            <Input
              placeholder="Filtername eingeben..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={!filterName.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Filter umbenennen</DialogTitle>
          </DialogHeader>
          <div>
            <Input
              placeholder="Neuer Name..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleRename} disabled={!filterName.trim()}>
              Umbenennen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
