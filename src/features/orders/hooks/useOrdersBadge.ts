import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useUIStore } from '@/stores';
import { getOpenOrdersCount } from '../services';

export function useOrdersBadge(enabled = true): { refreshOrdersBadge: () => Promise<void> } {
  const setOpenOrdersCount = useUIStore((state) => state.setOpenOrdersCount);

  const refreshOrdersBadge = useCallback(async () => {
    try {
      setOpenOrdersCount(await getOpenOrdersCount());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Offene Aufträge konnten nicht gezählt werden',
      );
    }
  }, [setOpenOrdersCount]);

  useEffect(() => {
    if (!enabled) return;
    void refreshOrdersBadge();
  }, [enabled, refreshOrdersBadge]);

  return { refreshOrdersBadge };
}
