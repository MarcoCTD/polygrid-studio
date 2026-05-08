import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createOrUpdateSnapshot } from '../services';

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay() === 0 ? 7 : next.getDay();
  next.setDate(next.getDate() - day + 1);
  return next;
}

function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(date);
}

export function SnapshotRefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const weekStart = getWeekStart(today);
      const todayKey = toDateKey(today);

      await Promise.all([
        createOrUpdateSnapshot('month', toDateKey(monthStart), todayKey),
        createOrUpdateSnapshot('week', toDateKey(weekStart), todayKey),
      ]);

      toast.success(`Snapshot für ${formatMonth(today)} aktualisiert`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Snapshots konnten nicht aktualisiert werden',
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      disabled={isRefreshing}
      onClick={() => void handleRefresh()}
    >
      {isRefreshing ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      Snapshots aktualisieren
    </Button>
  );
}
