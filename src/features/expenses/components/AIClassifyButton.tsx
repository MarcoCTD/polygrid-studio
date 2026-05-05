import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { classifyExpense } from '@/features/ai-assistant/agents/expenseAssistant';
import { useAIStatus } from '@/features/ai-assistant/hooks/useAIStatus';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SUBCATEGORIES,
  EXPENSE_SUBCATEGORY_LABELS,
  type ExpenseCategory,
  type ExpenseSubcategory,
} from '../constants';

interface AIClassifyButtonProps {
  vendor: string;
  amount: number;
  purpose?: string | null;
  onApply: (category: ExpenseCategory, subcategory: ExpenseSubcategory | null) => void;
}

interface ClassificationSuggestion {
  category: ExpenseCategory;
  subcategory: ExpenseSubcategory | null;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function resolveCategory(value: string): ExpenseCategory {
  const normalizedValue = normalize(value);
  return (
    EXPENSE_CATEGORIES.find(
      (category) =>
        normalize(category) === normalizedValue ||
        normalize(EXPENSE_CATEGORY_LABELS[category]) === normalizedValue,
    ) ?? 'sonstiges'
  );
}

function resolveSubcategory(category: ExpenseCategory, value: string): ExpenseSubcategory | null {
  const normalizedValue = normalize(value);
  const options = EXPENSE_SUBCATEGORIES[category];
  return (
    options.find(
      (subcategory) =>
        normalize(subcategory) === normalizedValue ||
        normalize(EXPENSE_SUBCATEGORY_LABELS[subcategory]) === normalizedValue,
    ) ?? null
  );
}

export function AIClassifyButton({ vendor, amount, purpose, onApply }: AIClassifyButtonProps) {
  const status = useAIStatus();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<ClassificationSuggestion | null>(null);
  const disabledReason = !status.activeProvider
    ? 'Kein KI-Provider konfiguriert'
    : status.isLimitReached
      ? 'KI-Budget ist ausgeschöpft'
      : !vendor.trim()
        ? 'Händler eingeben'
        : null;

  async function handleSuggest() {
    if (disabledReason) {
      toast.error(disabledReason);
      return;
    }

    setIsLoading(true);
    try {
      const result = await classifyExpense(vendor, amount, purpose ?? undefined);
      const categoryField = result.fields.find((field) => field.fieldName === 'category');
      const subcategoryField = result.fields.find((field) => field.fieldName === 'subcategory');
      const category = resolveCategory(String(categoryField?.suggestedValue ?? 'sonstiges'));
      const subcategory = resolveSubcategory(
        category,
        String(subcategoryField?.suggestedValue ?? ''),
      );
      setSuggestion({ category, subcategory });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'KI-Vorschlag fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        disabled={Boolean(disabledReason) || isLoading}
        title={disabledReason ?? 'Kategorie per KI vorschlagen'}
        onClick={() => void handleSuggest()}
      >
        <Sparkles size={14} />
        KI-Vorschlag
      </Button>

      {suggestion ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="border-pg-accent-border bg-pg-accent-subtle text-pg-accent"
          >
            {EXPENSE_CATEGORY_LABELS[suggestion.category]}
            {suggestion.subcategory
              ? ` · ${EXPENSE_SUBCATEGORY_LABELS[suggestion.subcategory]}`
              : ''}
          </Badge>
          <Button
            type="button"
            size="xs"
            onClick={() => onApply(suggestion.category, suggestion.subcategory)}
          >
            Übernehmen
          </Button>
          <Button type="button" size="icon-xs" variant="ghost" onClick={() => setSuggestion(null)}>
            <X size={12} />
            <span className="sr-only">Vorschlag verwerfen</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
