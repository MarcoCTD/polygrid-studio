import { create } from 'zustand';
import { getSetting } from '@/services/database';
import { aiTestConnection, apiKeyGet, keychainGet } from '../services/aiService';
import { getMonthlyLimit, getMonthlySpent } from '../services/costTracker';
import type { AIProviderName } from '../types';

const PROVIDERS: AIProviderName[] = ['claude', 'openai', 'gemini', 'ollama'];
const CLOUD_PROVIDERS: AIProviderName[] = ['claude', 'openai', 'gemini'];

interface AIState {
  activeProvider: AIProviderName | null;
  availableProviders: AIProviderName[];
  monthlySpent: number;
  monthlyLimit: number;
  isLoading: boolean;
  currentAction: string | null;
  error: string | null;
  initialize: () => Promise<void>;
  setActiveProvider: (provider: AIProviderName) => void;
  refreshBudget: () => Promise<void>;
  setLoading: (loading: boolean, action?: string) => void;
  markProviderUnavailable: (provider: AIProviderName) => void;
}

async function preferredProvider(): Promise<AIProviderName | null> {
  try {
    const provider = await getSetting<AIProviderName>('ai_preferred_provider');
    return provider && PROVIDERS.includes(provider) ? provider : null;
  } catch {
    return null;
  }
}

async function providerAvailable(provider: AIProviderName): Promise<boolean> {
  try {
    if (provider === 'claude') {
      const key = await keychainGet('claude_api_key');
      if (!key) return false;
    }
    if (provider === 'openai') {
      const key = await keychainGet('openai_api_key');
      if (!key) return false;
    }
    if (provider === 'gemini') {
      const key = await apiKeyGet('gemini');
      if (!key) return false;
    }
    await aiTestConnection(provider);
    return true;
  } catch {
    return false;
  }
}

export const useAIStore = create<AIState>((set, get) => ({
  activeProvider: null,
  availableProviders: [],
  monthlySpent: 0,
  monthlyLimit: 10,
  isLoading: false,
  currentAction: null,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const [preferred, availability, monthlySpent, monthlyLimit] = await Promise.all([
        preferredProvider(),
        Promise.all(
          PROVIDERS.map(async (provider) => ({ provider, ok: await providerAvailable(provider) })),
        ),
        getMonthlySpent(),
        getMonthlyLimit(),
      ]);
      const availableProviders = availability
        .filter((item) => item.ok)
        .map((item) => item.provider);
      const activeProvider =
        preferred && availableProviders.includes(preferred)
          ? preferred
          : (availableProviders[0] ?? null);

      set({
        activeProvider,
        availableProviders,
        monthlySpent,
        monthlyLimit,
        isLoading: false,
        currentAction: null,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        currentAction: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  setActiveProvider: (provider) => set({ activeProvider: provider }),

  refreshBudget: async () => {
    const [monthlySpent, monthlyLimit] = await Promise.all([getMonthlySpent(), getMonthlyLimit()]);
    set({ monthlySpent, monthlyLimit });
  },

  setLoading: (loading, action) =>
    set({
      isLoading: loading,
      currentAction: loading ? (action ?? null) : null,
      error: loading ? null : get().error,
    }),

  markProviderUnavailable: (provider) =>
    set((state) => {
      const availableProviders = state.availableProviders.filter((item) => item !== provider);
      return {
        availableProviders,
        activeProvider:
          state.activeProvider === provider
            ? (availableProviders[0] ?? null)
            : state.activeProvider,
      };
    }),
}));

export function getAIProviderFallbackChain(preferOllama = false): AIProviderName[] {
  const { activeProvider, availableProviders } = useAIStore.getState();
  const chain: AIProviderName[] = [];

  if (preferOllama && availableProviders.includes('ollama')) chain.push('ollama');
  if (activeProvider && availableProviders.includes(activeProvider)) chain.push(activeProvider);

  for (const provider of CLOUD_PROVIDERS) {
    if (availableProviders.includes(provider)) {
      chain.push(provider);
    }
  }

  if (!preferOllama && availableProviders.includes('ollama')) chain.push('ollama');
  return Array.from(new Set(chain));
}
