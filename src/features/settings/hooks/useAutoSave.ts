import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { saveSetting } from '@/services/settings';

interface SaveOptions {
  aliases?: string[];
  successMessage?: string;
}

interface PendingSave {
  value: unknown;
  aliases: string[];
  successMessage: string;
}

export function useAutoSave(delayMs = 500) {
  const timers = useRef<Map<string, number>>(new Map());
  const pending = useRef<Map<string, PendingSave>>(new Map());

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) {
        window.clearTimeout(timer);
      }
      timers.current.clear();
      pending.current.clear();
    },
    [],
  );

  function scheduleSave(key: string, value: unknown, options: SaveOptions = {}) {
    const currentTimer = timers.current.get(key);
    if (currentTimer !== undefined) {
      window.clearTimeout(currentTimer);
    }

    pending.current.set(key, {
      value,
      aliases: options.aliases ?? [],
      successMessage: options.successMessage ?? 'Gespeichert',
    });

    const timer = window.setTimeout(() => {
      const next = pending.current.get(key);
      if (!next) return;
      pending.current.delete(key);
      timers.current.delete(key);

      void (async () => {
        try {
          await saveSetting(key, next.value);
          await Promise.all(next.aliases.map((alias) => saveSetting(alias, next.value)));
          toast.success(next.successMessage);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : 'Einstellung konnte nicht gespeichert werden',
          );
        }
      })();
    }, delayMs);

    timers.current.set(key, timer);
  }

  return { scheduleSave };
}
