import { useMemo, useState, type ReactNode } from 'react';
import { FileText, Loader2, MessageSquareText, Sparkles, Tags, WandSparkles } from 'lucide-react';
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
import type { Product } from '@/features/products/schema';
import type { Listing, Platform } from '@/features/listings/schemas';
import {
  generateBulletPoints,
  generateDescription,
  generateTags,
  generateTitle,
  rewriteForPlatform,
} from '../agents/listingAssistant';
import { useAI } from '../hooks/useAI';
import { useAIStatus } from '../hooks/useAIStatus';
import { updateAIJobStatus } from '../services/costTracker';
import type { AIDiffField, AIDiffResult } from '../types';

interface AIToolbarProps {
  product: Product;
  listing?: Listing;
  platform: Platform;
  language: 'de' | 'en';
  onApplyDiff: (fields: AIDiffField[]) => void;
}

type AIActionKey =
  | 'generate_title'
  | 'generate_short_description'
  | 'generate_long_description'
  | 'generate_tags'
  | 'generate_bullet_points'
  | 'rewrite_for_platform';

const PLATFORM_LABELS: Record<Platform, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
};

const TARGET_PLATFORMS: Platform[] = ['etsy', 'ebay', 'kleinanzeigen'];

export function AIToolbar({ product, listing, platform, language, onApplyDiff }: AIToolbarProps) {
  const status = useAIStatus();
  const { generate, isLoading } = useAI<AIDiffResult>();
  const [activeAction, setActiveAction] = useState<AIActionKey | null>(null);
  const [descriptionStyle, setDescriptionStyle] = useState<'short' | 'long'>('long');
  const [targetPlatform, setTargetPlatform] = useState<Platform>(
    platform === 'etsy' ? 'ebay' : 'etsy',
  );
  const [diffResult, setDiffResult] = useState<AIDiffResult | null>(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);

  const providerLabel = status.activeProvider ?? 'kein Provider';
  const disabledReason = useMemo(() => {
    if (!status.activeProvider) return 'Kein KI-Provider konfiguriert';
    if (status.isLimitReached) return 'KI-Budget ist ausgeschöpft';
    return null;
  }, [status.activeProvider, status.isLimitReached]);

  const isDisabled = Boolean(disabledReason);

  async function runAction(action: AIActionKey, call: () => Promise<AIDiffResult>) {
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

  async function handleReject() {
    if (diffResult?.jobId) {
      try {
        await updateAIJobStatus(diffResult.jobId, 'cancelled');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'KI-Job konnte nicht aktualisiert werden',
        );
      }
    }
  }

  function handleAccept(fields: AIDiffField[]) {
    onApplyDiff(fields);
    toast.success('KI-Vorschlag übernommen');
  }

  const renderButton = (
    action: AIActionKey,
    label: string,
    icon: ReactNode,
    onClick: () => void,
  ) => {
    const loading = isLoading && activeAction === action;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isDisabled || loading}
        title={disabledReason ?? `Provider: ${providerLabel}`}
        className="justify-start gap-1.5"
        onClick={onClick}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
        <span>{label}</span>
      </Button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {renderButton(
          'generate_title',
          'Titel generieren',
          <Sparkles size={14} />,
          () =>
            void runAction('generate_title', () =>
              generateTitle(product, platform, language, listing),
            ),
        )}

        <div className="flex gap-2">
          <Select
            value={descriptionStyle}
            onValueChange={(value) => setDescriptionStyle(value === 'short' ? 'short' : 'long')}
          >
            <SelectTrigger className="h-7 w-24">
              <SelectValue placeholder="Länge" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Kurz</SelectItem>
              <SelectItem value="long">Lang</SelectItem>
            </SelectContent>
          </Select>
          {renderButton(
            descriptionStyle === 'short'
              ? 'generate_short_description'
              : 'generate_long_description',
            'Beschreibung',
            <FileText size={14} />,
            () =>
              void runAction(
                descriptionStyle === 'short'
                  ? 'generate_short_description'
                  : 'generate_long_description',
                () => generateDescription(product, platform, descriptionStyle, language, listing),
              ),
          )}
        </div>

        {renderButton(
          'generate_tags',
          'Tags generieren',
          <Tags size={14} />,
          () =>
            void runAction('generate_tags', () =>
              generateTags(product, platform, language, listing),
            ),
        )}

        {renderButton(
          'generate_bullet_points',
          'Bullet Points',
          <MessageSquareText size={14} />,
          () =>
            void runAction('generate_bullet_points', () =>
              generateBulletPoints(product, language, listing),
            ),
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={targetPlatform}
          onValueChange={(value) => setTargetPlatform(value as Platform)}
        >
          <SelectTrigger className="h-7 w-40">
            <SelectValue placeholder="Zielplattform" />
          </SelectTrigger>
          <SelectContent>
            {TARGET_PLATFORMS.filter((item) => item !== platform).map((item) => (
              <SelectItem key={item} value={item}>
                {PLATFORM_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {renderButton('rewrite_for_platform', 'Umschreiben', <WandSparkles size={14} />, () => {
          const sourceText =
            listing?.master_long_description ??
            listing?.master_short_description ??
            listing?.master_title ??
            product.description_internal ??
            product.name;

          void runAction('rewrite_for_platform', () =>
            rewriteForPlatform(sourceText, platform, targetPlatform, language),
          );
        })}
      </div>

      {status.monthlyLimit > 0 && (
        <p className="text-xs text-text-muted">
          KI-Budget: {status.monthlySpent.toFixed(2)} / {status.monthlyLimit.toFixed(2)} EUR ·{' '}
          {providerLabel}
        </p>
      )}

      <DiffView
        title="KI-Vorschlag"
        agent="Listing Assistant"
        provider={`${diffResult?.provider ?? providerLabel}${diffResult?.model ? ` (${diffResult.model})` : ''}`}
        fields={diffResult?.fields ?? []}
        onAccept={handleAccept}
        onReject={() => void handleReject()}
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
      />
    </div>
  );
}
