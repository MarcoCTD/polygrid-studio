import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useUIStore } from '@/stores';
import { getOverdueCount } from '../services';

export function useTaskBadge(enabled = true): { refreshTaskBadge: () => Promise<void> } {
  const setOverdueTasksCount = useUIStore((state) => state.setOverdueTasksCount);

  const refreshTaskBadge = useCallback(async () => {
    try {
      setOverdueTasksCount(await getOverdueCount());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Überfällige Aufgaben konnten nicht gezählt werden',
      );
    }
  }, [setOverdueTasksCount]);

  useEffect(() => {
    if (!enabled) return;
    void refreshTaskBadge();
  }, [enabled, refreshTaskBadge]);

  return { refreshTaskBadge };
}
