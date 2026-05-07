import { useMemo } from 'react';
import { useAIStore } from '../stores/aiStore';
import type { AIStatus } from '../types';

export function useAIStatus(): AIStatus {
  const activeProvider = useAIStore((state) => state.activeProvider);
  const availableProviders = useAIStore((state) => state.availableProviders);
  const monthlySpent = useAIStore((state) => state.monthlySpent);
  const monthlyLimit = useAIStore((state) => state.monthlyLimit);
  const isLoading = useAIStore((state) => state.isLoading);
  const error = useAIStore((state) => state.error);

  return useMemo(
    () => ({
      activeProvider,
      availableProviders,
      monthlySpent,
      monthlyLimit,
      isLimitReached: monthlySpent >= monthlyLimit,
      isLoading,
      error,
    }),
    [activeProvider, availableProviders, error, isLoading, monthlyLimit, monthlySpent],
  );
}
