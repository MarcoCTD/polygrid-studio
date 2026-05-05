import { Badge } from '@/components/ui/badge';
import { useAIStatus } from '../hooks/useAIStatus';

const PROVIDER_LABELS: Record<string, string> = {
  claude: 'Claude',
  openai: 'OpenAI',
  ollama: 'Ollama',
};

export function AIStatusBadge() {
  const status = useAIStatus();
  const hasLimit = status.monthlyLimit > 0;
  const spentRatio = hasLimit ? status.monthlySpent / status.monthlyLimit : 0;

  if (status.isLimitReached) {
    return (
      <Badge variant="outline" className="border-danger/40 bg-danger-subtle text-danger">
        Budget erschöpft
      </Badge>
    );
  }

  if (spentRatio >= 0.8) {
    return (
      <Badge variant="outline" className="border-warning/40 bg-warning-subtle text-warning">
        Budget 80%
      </Badge>
    );
  }

  if (status.activeProvider) {
    return (
      <Badge variant="outline" className="border-success/40 bg-success-subtle text-success">
        {PROVIDER_LABELS[status.activeProvider] ?? status.activeProvider}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-border bg-bg-secondary text-text-secondary">
      Kein Provider
    </Badge>
  );
}
