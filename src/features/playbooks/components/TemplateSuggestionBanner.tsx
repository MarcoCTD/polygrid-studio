import { useEffect, useMemo, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { OrderListItem } from '@/features/orders/types';
import { CopyDialog } from '@/features/templates/components';
import type { Template } from '@/features/templates/schemas';
import { getTemplateById } from '@/features/templates/services/templateService';
import {
  orderVariableValue,
  type OrderPickerRow,
} from '@/features/templates/variableRegistry';
import {
  dismissTemplateSuggestion,
  getOpenTemplateSuggestions,
  type TemplateSuggestion,
} from '../services/playbookService';

/**
 * Banner „Vorlage … bereit" im Auftrags-Detail-Panel (suggest_template).
 * Öffnet den Kopieren-Dialog vorbefüllt mit den Auftragsvariablen und ist
 * verwerfbar (dismissed-Flag im Run-Result).
 */
export function TemplateSuggestionBanner({ order }: { order: OrderListItem }) {
  const [suggestions, setSuggestions] = useState<TemplateSuggestion[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOpenTemplateSuggestions(order.id)
      .then((items) => {
        if (!cancelled) setSuggestions(items);
      })
      .catch((error: unknown) => {
        // Ein defekter Vorschlag darf das Detail-Panel nicht stören.
        console.error('[Playbooks] Vorschläge konnten nicht geladen werden', error);
      });
    return () => {
      cancelled = true;
    };
    // status/updated_at: nach einer Statusänderung sofort neu laden
  }, [order.id, order.status, order.updated_at]);

  const initialValues = useMemo(() => {
    const pickerRow: OrderPickerRow = {
      id: order.id,
      receipt_number: order.receipt_number,
      external_order_id: order.external_order_id,
      customer_name: order.customer_name,
      tracking_number: order.tracking_number,
      platform: order.platform,
    };
    return {
      produktname: order.product_name ?? '',
      bestellnummer: orderVariableValue(pickerRow, 'order_number'),
      kundenname: orderVariableValue(pickerRow, 'customer_name'),
      trackingnummer: orderVariableValue(pickerRow, 'tracking_number'),
      plattform: orderVariableValue(pickerRow, 'platform'),
    };
  }, [order]);

  async function handleOpen(suggestion: TemplateSuggestion) {
    try {
      const template = await getTemplateById(suggestion.template_id);
      if (!template) {
        toast.error('Vorlage wurde inzwischen gelöscht.');
        return;
      }
      setActiveTemplate(template);
      setCopyOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vorlage konnte nicht geladen werden');
    }
  }

  async function handleDismiss(suggestion: TemplateSuggestion) {
    try {
      await dismissTemplateSuggestion(suggestion.run_id, suggestion.result_index);
      setSuggestions((current) =>
        current.filter(
          (entry) =>
            !(entry.run_id === suggestion.run_id && entry.result_index === suggestion.result_index),
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vorschlag konnte nicht verworfen werden');
    }
  }

  if (suggestions.length === 0) return null;

  return (
    <>
      <div className="space-y-2 px-4 pt-3" data-testid="template-suggestion-banner">
        {suggestions.map((suggestion) => (
          <div
            key={`${suggestion.run_id}-${suggestion.result_index}`}
            className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"
          >
            <FileText className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Vorlage „{suggestion.template_name}“ bereit
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
              onClick={() => void handleOpen(suggestion)}
            >
              Öffnen
            </Button>
            <button
              type="button"
              aria-label={`Vorschlag ${suggestion.template_name} verwerfen`}
              className="rounded p-1 text-blue-700 transition-colors hover:bg-blue-100"
              onClick={() => void handleDismiss(suggestion)}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {activeTemplate ? (
        <CopyDialog
          open={copyOpen}
          onOpenChange={(open) => {
            setCopyOpen(open);
            if (!open) setActiveTemplate(null);
          }}
          content={activeTemplate.content}
          variables={activeTemplate.variables ?? []}
          initialValues={initialValues}
        />
      ) : null}
    </>
  );
}
