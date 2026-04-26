import { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFilesStore } from '../store';

export function ErrorBanner() {
  const error = useFilesStore((state) => state.error);
  const clearError = useFilesStore((state) => state.clearError);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(clearError, 5000);
    return () => window.clearTimeout(timeout);
  }, [clearError, error]);

  if (!error) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger bg-danger-subtle px-3 py-2 text-sm text-danger">
      <AlertCircle size={16} className="shrink-0" />
      <p className="min-w-0 flex-1">{error}</p>
      <Button variant="ghost" size="icon-sm" onClick={clearError} className="text-danger">
        <X size={14} />
      </Button>
    </div>
  );
}
