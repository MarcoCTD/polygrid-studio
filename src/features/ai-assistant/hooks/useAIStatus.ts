import { useAIStore } from '../stores/aiStore';
import type { AIStatus } from '../types';

export function useAIStatus(): AIStatus {
  return useAIStore((state) => ({
    activeProvider: state.activeProvider,
    availableProviders: state.availableProviders,
    monthlySpent: state.monthlySpent,
    monthlyLimit: state.monthlyLimit,
    isLimitReached: state.monthlySpent >= state.monthlyLimit,
    isLoading: state.isLoading,
    error: state.error,
  }));
}
