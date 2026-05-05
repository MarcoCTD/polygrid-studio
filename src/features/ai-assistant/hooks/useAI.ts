import { useCallback, useState } from 'react';
import { useAIStore } from '../stores/aiStore';

export function useAI<T>() {
  const setLoading = useAIStore((state) => state.setLoading);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const isLoading = useAIStore((state) => state.isLoading);

  const generate = useCallback(
    async (action: string, call: () => Promise<T>): Promise<T> => {
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
        setLoading(false);
      }
    },
    [setLoading],
  );

  return { generate, isLoading, error, result };
}
