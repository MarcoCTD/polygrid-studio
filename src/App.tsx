import { useEffect } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { useUIStore } from '@/stores';
import { initDatabase } from '@/services/database';
import { router } from '@/router';
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

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
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

  return <RouterProvider router={router} />;
}

export default App;
