import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import type { Product } from '../schema';
import { listTrashedProducts, restoreProduct, hardDeleteProduct } from '../db';

function formatDeletedDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TrashPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hard delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const data = await listTrashedProducts();
        if (!cancelled) setProducts(data);
      } catch (err) {
        if (!cancelled) console.error('Fehler beim Laden gelöschter Produkte:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleRestore = async (id: string) => {
    try {
      await restoreProduct(id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error('Fehler beim Wiederherstellen:', err);
    }
  };

  const handleHardDelete = async () => {
    if (!deleteTarget) return;
    try {
      await hardDeleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirmText('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error('Fehler beim endgültigen Löschen:', err);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/products' })}
          className="gap-1.5"
        >
          <ArrowLeft size={14} />
          Zurück
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Papierkorb</h1>
          <p className="text-sm text-text-secondary">
            {products.length} {products.length === 1 ? 'gelöschtes Produkt' : 'gelöschte Produkte'}
          </p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-text-muted">
          Gelöschte Produkte werden geladen...
        </div>
      ) : products.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-text-muted">
          <Trash2 size={32} className="opacity-50" />
          <p className="text-sm">Der Papierkorb ist leer</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated dark:border-transparent dark:shadow-md">
          {/* Table Header */}
          <div className="flex border-b border-border-subtle bg-bg-secondary dark:border-transparent dark:bg-bg-elevated-1">
            <div className="flex h-9 flex-1 items-center px-3 text-xs font-medium text-text-secondary">
              Name
            </div>
            <div className="flex h-9 w-[140px] shrink-0 items-center px-3 text-xs font-medium text-text-secondary">
              Kategorie
            </div>
            <div className="flex h-9 w-[180px] shrink-0 items-center px-3 text-xs font-medium text-text-secondary">
              Gelöscht am
            </div>
            <div className="flex h-9 w-[200px] shrink-0 items-center justify-end px-3 text-xs font-medium text-text-secondary">
              Aktionen
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border-subtle dark:divide-transparent">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center transition-colors hover:bg-bg-hover"
              >
                <div className="flex flex-1 items-center px-3 py-2.5 text-sm">
                  <span className="truncate font-medium text-text-primary opacity-60">
                    {product.name}
                  </span>
                </div>
                <div className="w-[140px] shrink-0 px-3 py-2.5 text-sm text-text-secondary">
                  {product.category}
                </div>
                <div className="w-[180px] shrink-0 px-3 py-2.5 text-sm text-text-secondary">
                  {product.deleted_at ? formatDeletedDate(product.deleted_at) : '—'}
                </div>
                <div className="flex w-[200px] shrink-0 items-center justify-end gap-1 px-3 py-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(product.id)}
                    className="gap-1 text-xs"
                  >
                    <RotateCcw size={12} />
                    Wiederherstellen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeleteTarget(product);
                      setDeleteConfirmText('');
                    }}
                    className="gap-1 text-xs text-[var(--accent-danger)] hover:text-[var(--accent-danger)]"
                  >
                    <Trash2 size={12} />
                    Löschen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hard Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirmText('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Produkt endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                <strong>{deleteTarget?.name}</strong> wird unwiderruflich gelöscht. Diese Aktion
                kann nicht rückgängig gemacht werden.
              </span>
              <span className="mt-3 block text-sm">
                Gib <strong>LÖSCHEN</strong> ein, um zu bestätigen:
              </span>
              <span className="mt-2 block">
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="LÖSCHEN"
                  className="font-mono"
                />
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirmText('');
              }}
            >
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteConfirmText !== 'LÖSCHEN'}
              onClick={handleHardDelete}
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
