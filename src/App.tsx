import { useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useUIStore } from '@/stores';
import { initDatabase } from '@/services/database';
import { processDueRecurringExpenses } from '@/features/expenses/services';
import { useAutoSnapshot } from '@/features/analytics/hooks';
import { useTaskBadge } from '@/features/tasks/hooks';
import { router } from '@/router';
import { Toaster } from '@/components/ui/sonner';
import '@/styles/globals.css';

function DatabaseError({ error }: { error: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-8">
      <div className="max-w-lg rounded-xl border border-danger bg-bg-elevated p-8 shadow-lg">
        <h1 className="mb-4 text-xl font-semibold text-danger">Datenbank-Fehler</h1>
        <p className="mb-4 text-sm text-text-secondary">
          Die Datenbank konnte nicht initialisiert werden. Die App kann ohne funktionierende
          Datenbank nicht starten.
        </p>
        <pre className="mb-4 overflow-auto rounded-lg bg-bg-primary p-4 font-mono text-xs text-text-primary">
          {error}
        </pre>
        <div className="space-y-2 text-xs text-text-muted">
          <p>
            <span className="font-medium text-text-secondary">DB-Pfad:</span>{' '}
            <code className="font-mono">polygrid.db</code> (Tauri App-Datenverzeichnis)
          </p>
          <p>Bitte Screenshot machen und im Repository als Issue melden.</p>
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <p className="text-sm text-text-muted">Datenbank wird geladen...</p>
    </div>
  );
}

function App() {
  const dbReady = useUIStore((s) => s.dbReady);
  const dbError = useUIStore((s) => s.dbError);
  const setDbReady = useUIStore((s) => s.setDbReady);
  const setDbError = useUIStore((s) => s.setDbError);
  useTaskBadge(dbReady);
  useAutoSnapshot(dbReady);

  useEffect(() => {
    initDatabase()
      .then(async () => {
        try {
          const createdCount = await processDueRecurringExpenses();
          setDbReady(true);

          if (createdCount > 0) {
            window.setTimeout(
              () =>
                toast.success(
                  `${createdCount} wiederkehrende ${createdCount === 1 ? 'Ausgabe wurde' : 'Ausgaben wurden'} automatisch erfasst`,
                ),
              0,
            );
          }
        } catch (err) {
          setDbReady(true);
          window.setTimeout(
            () =>
              toast.error(
                err instanceof Error
                  ? err.message
                  : 'Wiederkehrende Ausgaben konnten nicht verarbeitet werden',
              ),
            0,
          );
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setDbError(message);
      });
  }, [setDbReady, setDbError]);

  if (dbError) {
    return <DatabaseError error={dbError} />;
  }

  if (!dbReady) {
    return <Loading />;
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors />
    </>
  );
}

export default App;
