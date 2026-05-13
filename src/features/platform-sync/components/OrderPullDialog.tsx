import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { syncService } from '../services/sync-service';
import type { Platform, PullOrdersResult } from '../providers/types';

interface OrderPullDialogProps {
  open: boolean;
  platform?: Platform;
  onOpenChange: (open: boolean) => void;
}

function defaultSince(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

export function OrderPullDialog({ open, platform, onOpenChange }: OrderPullDialogProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(platform ?? 'etsy');
  const [since, setSince] = useState(defaultSince);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PullOrdersResult | null>(null);

  async function pullOrders() {
    setIsLoading(true);
    try {
      const data = await syncService.pullOrders(selectedPlatform, new Date(since));
      setResult(data);
      toast.success(`${data.imported} Bestellungen importiert`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bestellimport fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isLoading && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bestellungen importieren</DialogTitle>
          <DialogDescription>
            Bereits importierte Bestellungen werden anhand der externen ID übersprungen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-text-secondary">Plattform</span>
            <select
              value={selectedPlatform}
              onChange={(event) => setSelectedPlatform(event.target.value as Platform)}
              className="h-9 w-full rounded-lg border border-input bg-bg-elevated px-3"
            >
              <option value="etsy">Etsy</option>
              <option value="ebay">eBay</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-text-secondary">Seit</span>
            <input
              type="date"
              value={since}
              onChange={(event) => setSince(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-bg-elevated px-3"
            />
          </label>
        </div>

        {result && (
          <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3 text-sm">
            {result.imported} importiert, {result.skipped} übersprungen, {result.errors.length}{' '}
            Fehler
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Schließen
          </Button>
          <Button onClick={() => void pullOrders()} disabled={isLoading}>
            {isLoading ? 'Import läuft...' : 'Import starten'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
