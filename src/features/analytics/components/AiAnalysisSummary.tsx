import { useCallback, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAI } from '@/features/ai-assistant/hooks/useAI';
import { useAIStatus } from '@/features/ai-assistant/hooks/useAIStatus';
import { useAIStore } from '@/features/ai-assistant/stores/aiStore';
import { useUIStore } from '@/stores';
import { generateDashboardAnalysis } from '../services';
import type { DashboardAnalysisInput } from '../types';

interface AiAnalysisSummaryProps {
  input: DashboardAnalysisInput;
  summary: string | null;
  onSummaryChange: (summary: string | null) => void;
}

export function AiAnalysisSummary({ input, summary, onSummaryChange }: AiAnalysisSummaryProps) {
  const initializeAI = useAIStore((state) => state.initialize);
  const registerCommands = useUIStore((state) => state.registerCommands);
  const unregisterCommands = useUIStore((state) => state.unregisterCommands);
  const status = useAIStatus();
  const { generate, isLoading } = useAI<string>();
  const disabledReason = !status.activeProvider ? 'Kein KI-Provider verfügbar' : null;

  useEffect(() => {
    void initializeAI();
  }, [initializeAI]);

  const handleGenerate = useCallback(async () => {
    if (disabledReason) {
      toast.error(disabledReason);
      return;
    }

    try {
      const result = await generate('dashboard_analysis', () => generateDashboardAnalysis(input));
      onSummaryChange(result);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'KI-Analyse konnte nicht erstellt werden',
      );
    }
  }, [disabledReason, generate, input, onSummaryChange]);

  useEffect(() => {
    registerCommands([
      {
        id: 'analytics:ai-analysis',
        label: 'KI-Analyse erstellen',
        icon: Sparkles,
        category: 'ai',
        action: () => void handleGenerate(),
      },
    ]);

    return () => unregisterCommands(['analytics:ai-analysis']);
  }, [handleGenerate, registerCommands, unregisterCommands]);

  return (
    <section className="rounded-lg border border-info/30 bg-info-subtle p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">KI-Zusammenfassung</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Kurze Einordnung der aktuellen Analysewerte.
          </p>
        </div>
        <Button
          type="button"
          className="gap-2"
          disabled={Boolean(disabledReason) || isLoading}
          title={disabledReason ?? 'KI-Analyse erstellen'}
          onClick={() => void handleGenerate()}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {isLoading ? 'Analysiert...' : 'KI-Analyse erstellen'}
        </Button>
      </div>

      {summary ? (
        <div className="mt-4 whitespace-pre-wrap rounded-md border border-info/30 bg-bg-elevated p-3 text-sm leading-6 text-text-primary">
          {summary}
        </div>
      ) : null}
    </section>
  );
}
