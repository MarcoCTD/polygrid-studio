import { useCallback, useRef, useState } from 'react';
import { checkBudget } from '../services/costTracker';
import { useAIStore } from '../stores/aiStore';

export function useAI<T>() {
  const setLoading = useAIStore((state) => state.setLoading);
  const activeProvider = useAIStore((state) => state.activeProvider);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const isLoading = useAIStore((state) => state.isLoading);
  const inFlightRef = useRef(false);

  const generate = useCallback(
    async (action: string, call: () => Promise<T>): Promise<T> => {
      if (inFlightRef.current) {
        throw new Error('KI-Anfrage läuft bereits.');
      }
      if (activeProvider && activeProvider !== 'ollama') {
        const budget = await checkBudget();
        if (budget.isBlocked) {
          throw new Error(
            `KI-Budget erschöpft (${budget.spent.toFixed(2)} / ${budget.limit.toFixed(2)} EUR). Limit in Einstellungen anpassen oder nächsten Monat abwarten. Ollama-Calls sind kostenlos.`,
          );
        }
      }
      inFlightRef.current = true;
      setLoading(true, action);
      setError(null);
      try {
        const nextResult = await call();
        setResult(nextResult);
        return nextResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [activeProvider, setLoading],
  );

  return { generate, isLoading, error, result };
}
