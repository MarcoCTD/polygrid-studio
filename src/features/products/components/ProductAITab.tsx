import { useState } from 'react';
import type { ReactNode } from 'react';
import { Copy, FileText, Loader2, MessageSquareText, Sparkles, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { DiffView } from '@/components/shared/DiffView';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  generateBulletPoints,
  generateDescription,
  generateTags,
  generateTitle,
} from '@/features/ai-assistant/agents/listingAssistant';
import { useAI } from '@/features/ai-assistant/hooks/useAI';
import { useAIStatus } from '@/features/ai-assistant/hooks/useAIStatus';
import { updateAIJobStatus } from '@/features/ai-assistant/services/costTracker';
import type { AIDiffField, AIDiffResult } from '@/features/ai-assistant/types';
import type { Platform, Product } from '../schema';

interface ProductAITabProps {
  product: Product;
}

type ActionKey = 'title' | 'description' | 'tags' | 'bullets';

const PLATFORM_LABELS: Record<Platform, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
};

function fieldsToClipboardText(fields: AIDiffField[]): string {
  return fields
    .map((field) =>
      Array.isArray(field.suggestedValue) ? field.suggestedValue.join('\n') : field.suggestedValue,
    )
    .join('\n\n');
}

export function ProductAITab({ product }: ProductAITabProps) {
  const status = useAIStatus();
  const { generate, isLoading } = useAI<AIDiffResult>();
  const [platform, setPlatform] = useState<Platform>(product.platforms?.[0] ?? 'etsy');
  const [language, setLanguage] = useState<'de' | 'en'>('de');
  const [descriptionStyle, setDescriptionStyle] = useState<'short' | 'long'>('long');
  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [diffResult, setDiffResult] = useState<AIDiffResult | null>(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);

  const disabledReason = !status.activeProvider
    ? 'Kein KI-Provider konfiguriert'
    : status.isLimitReached
      ? 'KI-Budget ist ausgeschöpft'
      : null;

  async function runAction(action: ActionKey, call: () => Promise<AIDiffResult>) {
    if (disabledReason) {
      toast.error(disabledReason);
      return;
    }

    setActiveAction(action);
    try {
      const result = await generate(action, call);
      setDiffResult(result);
      setIsDiffOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'KI-Aktion fehlgeschlagen');
    } finally {
      setActiveAction(null);
    }
  }

  async function acceptDiff(fields: AIDiffField[]) {
    await navigator.clipboard.writeText(fieldsToClipboardText(fields));
    toast.success('KI-Vorschlag in Zwischenablage kopiert');
  }

  async function rejectDiff() {
    if (!diffResult?.jobId) return;
    await updateAIJobStatus(diffResult.jobId, 'cancelled');
  }

  const actionButton = (action: ActionKey, label: string, icon: ReactNode, onClick: () => void) => {
    const loading = isLoading && activeAction === action;
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        disabled={Boolean(disabledReason) || loading}
        title={disabledReason ?? undefined}
        onClick={onClick}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
        {label}
      </Button>
    );
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5 dark:border-transparent">
        <div className="mb-4 flex flex-wrap gap-3">
          <Select value={platform} onValueChange={(value) => setPlatform(value as Platform)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Plattform" />
            </SelectTrigger>
            <SelectContent>
              {(['etsy', 'ebay', 'kleinanzeigen'] as Platform[]).map((item) => (
                <SelectItem key={item} value={item}>
                  {PLATFORM_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border border-input p-1">
            {(['de', 'en'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLanguage(item)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  language === item ? 'bg-bg-secondary text-text-primary' : 'text-text-secondary'
                }`}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {actionButton(
            'title',
            'Titel-Vorschläge generieren',
            <Sparkles size={15} />,
            () => void runAction('title', () => generateTitle(product, platform, language)),
          )}

          <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
            <Select
              value={descriptionStyle}
              onValueChange={(value) => setDescriptionStyle(value === 'short' ? 'short' : 'long')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Länge" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Kurz</SelectItem>
                <SelectItem value="long">Lang</SelectItem>
              </SelectContent>
            </Select>
            {actionButton(
              'description',
              'Beschreibung generieren',
              <FileText size={15} />,
              () =>
                void runAction('description', () =>
                  generateDescription(product, platform, descriptionStyle, language),
                ),
            )}
          </div>

          {actionButton(
            'tags',
            'Tags vorschlagen',
            <Tags size={15} />,
            () => void runAction('tags', () => generateTags(product, platform, language)),
          )}

          {actionButton(
            'bullets',
            'Bullet Points generieren',
            <MessageSquareText size={15} />,
            () => void runAction('bullets', () => generateBulletPoints(product, language)),
          )}
        </div>

        <p className="mt-4 rounded-lg bg-info-subtle p-3 text-xs text-text-secondary">
          Vorschläge basieren auf den Produktdaten. Für plattformspezifische Anpassungen den
          Listing-Editor nutzen.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Copy size={13} />
        Beim Annehmen wird der Vorschlag in die Zwischenablage kopiert.
      </div>

      <DiffView
        title="KI-Vorschlag"
        agent="Listing Assistant"
        provider={`${diffResult?.provider ?? status.activeProvider ?? 'kein Provider'}${diffResult?.model ? ` (${diffResult.model})` : ''}`}
        fields={diffResult?.fields ?? []}
        onAccept={(fields) => void acceptDiff(fields)}
        onReject={() => void rejectDiff()}
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
      />
    </div>
  );
}
