import { Copy, Save, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DiffView } from '@/components/shared/DiffView';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAI } from '@/features/ai-assistant/hooks/useAI';
import { useAIStatus } from '@/features/ai-assistant/hooks/useAIStatus';
import { useAIStore } from '@/features/ai-assistant/stores/aiStore';
import type { AIDiffField, AIDiffResult, TemplateAction } from '@/features/ai-assistant/types';
import type {
  Template,
  TemplateCategory,
  TemplatePlatform,
  TemplateUpdate,
  TemplateVariable,
} from '../schemas';
import { templateCategoryEnum } from '../schemas';
import { extractVariables, mergeVariables } from '../utils';
import {
  adaptForPlatform,
  expandText,
  reformulateText,
  shortenText,
  softDeleteTemplate,
  updateTemplate,
} from '../services';
import { HighlightTextarea } from './HighlightTextarea';
import { LegalWarningBanner } from './LegalWarningBanner';
import { VariablesSidebar } from './VariablesSidebar';
import { CopyDialog } from './CopyDialog';

interface TemplateEditorProps {
  template: Template;
  onSaved: (template: Template) => void;
  onDeleted: (templateId: string) => void;
}

interface TemplateDraft {
  name: string;
  category: TemplateCategory;
  content: string;
  platforms: TemplatePlatform[];
  variables: TemplateVariable[];
  is_legal: boolean;
  notes: string;
}

const CATEGORY_OPTIONS: Array<{ value: TemplateCategory; label: string }> =
  templateCategoryEnum.options.map((value) => ({
    value,
    label:
      value === 'faq' ? 'FAQ' : value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' '),
  }));

const PLATFORM_OPTIONS: Array<{ value: TemplatePlatform; label: string }> = [
  { value: 'etsy', label: 'Etsy' },
  { value: 'ebay', label: 'eBay' },
  { value: 'kleinanzeigen', label: 'Kleinanzeigen' },
];

function templateToDraft(template: Template): TemplateDraft {
  return {
    name: template.name,
    category: template.category,
    content: template.content,
    platforms: template.platforms ?? [],
    variables: template.variables ?? [],
    is_legal: template.is_legal,
    notes: template.notes ?? '',
  };
}

function normalizeDraft(draft: TemplateDraft): TemplateUpdate {
  const mergedVariables = mergeVariables(extractVariables(draft.content), draft.variables);
  return {
    name: draft.name.trim(),
    category: draft.category,
    content: draft.content.trim().length > 0 ? draft.content : ' ',
    platforms: draft.platforms,
    variables: mergedVariables,
    is_legal: draft.is_legal,
    notes: draft.notes.trim().length > 0 ? draft.notes : null,
  };
}

export function TemplateEditor({ template, onSaved, onDeleted }: TemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initializeAI = useAIStore((state) => state.initialize);
  const aiStatus = useAIStatus();
  const { generate, isLoading: isAILoading } = useAI<AIDiffResult>();
  const [draft, setDraft] = useState<TemplateDraft>(() => templateToDraft(template));
  const [isSaving, setIsSaving] = useState(false);
  const [showNotes, setShowNotes] = useState(Boolean(template.notes));
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [diffResult, setDiffResult] = useState<AIDiffResult | null>(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [targetPlatformOpen, setTargetPlatformOpen] = useState(false);
  const [targetPlatform, setTargetPlatform] = useState<TemplatePlatform>('etsy');
  const [activeAIAction, setActiveAIAction] = useState<TemplateAction | null>(null);

  const normalizedDraft = useMemo(() => normalizeDraft(draft), [draft]);
  const isDirty = useMemo(
    () =>
      JSON.stringify(normalizedDraft) !== JSON.stringify(normalizeDraft(templateToDraft(template))),
    [normalizedDraft, template],
  );
  const aiDisabledReason = useMemo(() => {
    if (aiStatus.isLoading && !aiStatus.activeProvider) return 'KI-Provider werden geprüft...';
    if (!aiStatus.activeProvider) return 'Kein KI-Provider konfiguriert';
    if (aiStatus.isLimitReached && aiStatus.activeProvider !== 'ollama') {
      return 'KI-Budget ist ausgeschöpft. Ollama bleibt kostenlos nutzbar.';
    }
    return null;
  }, [aiStatus.activeProvider, aiStatus.isLimitReached, aiStatus.isLoading]);

  useEffect(() => {
    void initializeAI();
  }, [initializeAI]);

  function updateDraft(patch: Partial<TemplateDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function togglePlatform(platform: TemplatePlatform, checked: boolean) {
    updateDraft({
      platforms: checked
        ? Array.from(new Set([...draft.platforms, platform]))
        : draft.platforms.filter((item) => item !== platform),
    });
  }

  function insertVariable(name: string) {
    const textarea = textareaRef.current;
    const token = `{{${name}}}`;
    const start = textarea?.selectionStart ?? draft.content.length;
    const end = textarea?.selectionEnd ?? draft.content.length;
    const nextContent = `${draft.content.slice(0, start)}${token}${draft.content.slice(end)}`;
    updateDraft({ content: nextContent });

    window.setTimeout(() => {
      textarea?.focus();
      const cursor = start + token.length;
      textarea?.setSelectionRange(cursor, cursor);
    }, 0);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const updated = await updateTemplate(template.id, normalizedDraft);
      toast.success('Vorlage gespeichert');
      onSaved(updated);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Vorlage konnte nicht gespeichert werden',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Vorlage in den Papierkorb verschieben?')) return;

    try {
      await softDeleteTemplate(template.id);
      toast.success('Vorlage gelöscht');
      onDeleted(template.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vorlage konnte nicht gelöscht werden');
    }
  }

  async function runAIAction(
    action: TemplateAction,
    label: string,
    call: () => Promise<AIDiffResult>,
  ) {
    setActiveAIAction(action);
    try {
      const result = await generate(label, call);
      setDiffResult(result);
      setIsDiffOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'KI-Aktion fehlgeschlagen');
    } finally {
      setActiveAIAction(null);
    }
  }

  function handleAcceptDiff(fields: AIDiffField[]) {
    const contentField = fields.find((field) => field.fieldName === 'content');
    if (typeof contentField?.suggestedValue !== 'string') return;
    updateDraft({ content: contentField.suggestedValue });
    toast.success('KI-Vorschlag übernommen');
  }

  const aiActions: Array<{
    action: TemplateAction;
    label: string;
    onClick: () => void;
  }> = [
    {
      action: 'shorten_text',
      label: 'Text kürzen',
      onClick: () =>
        void runAIAction('shorten_text', 'Text kürzen', () => shortenText(draft.content)),
    },
    {
      action: 'expand_text',
      label: 'Text verlängern',
      onClick: () =>
        void runAIAction('expand_text', 'Text verlängern', () => expandText(draft.content)),
    },
    {
      action: 'reformulate_text',
      label: 'Umformulieren',
      onClick: () =>
        void runAIAction('reformulate_text', 'Umformulieren', () => reformulateText(draft.content)),
    },
    {
      action: 'adapt_for_platform',
      label: 'Für Plattform anpassen',
      onClick: () => setTargetPlatformOpen(true),
    },
  ];

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isDirty ? (
                <span
                  className="size-2 rounded-full bg-pg-accent"
                  title="Ungespeicherte Änderungen"
                />
              ) : null}
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Version {template.version}
              </span>
            </div>
            <Input
              value={draft.name}
              className="mt-2 h-auto border-0 bg-transparent px-0 text-2xl font-semibold text-text-primary shadow-none focus-visible:ring-0"
              aria-label="Vorlagenname"
              onChange={(event) => updateDraft({ name: event.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => void handleDelete()}
            >
              <Trash2 className="size-4" />
              Löschen
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              disabled={isSaving || !isDirty}
              onClick={() => void handleSave()}
            >
              <Save className="size-4" />
              {isSaving ? 'Speichert...' : 'Speichern'}
            </Button>
          </div>
        </div>
      </div>

      {draft.is_legal ? <LegalWarningBanner /> : null}

      <div className="grid min-h-[520px] flex-1 grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] gap-4">
        <HighlightTextarea
          ref={textareaRef}
          value={draft.content}
          placeholder="Vorlagentext mit {{variablen}} eingeben..."
          onChange={(content) => updateDraft({ content })}
        />
        <VariablesSidebar
          content={draft.content}
          variables={draft.variables}
          onVariablesChange={(variables) => updateDraft({ variables })}
          onInsertVariable={insertVariable}
        />
      </div>

      <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button type="button" className="gap-1.5" onClick={() => setCopyDialogOpen(true)}>
            <Copy className="size-4" />
            Kopieren
          </Button>
          {aiActions.map(({ action, label, onClick }) => {
            const isActionLoading = isAILoading && activeAIAction === action;
            return (
              <Button
                key={action}
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={Boolean(aiDisabledReason) || isAILoading}
                title={aiDisabledReason ?? label}
                onClick={onClick}
              >
                <Sparkles className="size-4" />
                {isActionLoading ? 'Arbeitet...' : label}
              </Button>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_220px_160px]">
          <div className="space-y-2">
            <Label>Plattformen</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary"
                >
                  <Checkbox
                    checked={draft.platforms.includes(option.value)}
                    onCheckedChange={(checked) => togglePlatform(option.value, Boolean(checked))}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kategorie</Label>
            <Select
              value={draft.category}
              onValueChange={(value) => updateDraft({ category: value as TemplateCategory })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Rechtstext</Label>
            <label className="flex h-8 items-center gap-2 rounded-lg border border-border-subtle px-3 text-sm text-text-secondary">
              <Checkbox
                checked={draft.is_legal}
                onCheckedChange={(checked) => updateDraft({ is_legal: Boolean(checked) })}
              />
              Aktiv
            </label>
          </div>
        </div>

        <div className="mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-0"
            onClick={() => setShowNotes((value) => !value)}
          >
            {showNotes ? 'Notizen ausblenden' : 'Notizen anzeigen'}
          </Button>
          {showNotes ? (
            <Textarea
              value={draft.notes}
              className="mt-2 min-h-24"
              placeholder="Interne Notizen"
              onChange={(event) => updateDraft({ notes: event.target.value })}
            />
          ) : null}
        </div>
      </div>

      <CopyDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        content={draft.content}
        variables={mergeVariables(extractVariables(draft.content), draft.variables)}
      />

      <Dialog open={targetPlatformOpen} onOpenChange={setTargetPlatformOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ziel-Plattform auswählen</DialogTitle>
            <DialogDescription>
              Der aktuelle Vorlagentext wird für die gewählte Plattform angepasst.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Ziel-Plattform</Label>
            <Select
              value={targetPlatform}
              onValueChange={(value) => setTargetPlatform(value as TemplatePlatform)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTargetPlatformOpen(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={Boolean(aiDisabledReason) || isAILoading}
              onClick={() => {
                setTargetPlatformOpen(false);
                void runAIAction('adapt_for_platform', 'Für Plattform anpassen', () =>
                  adaptForPlatform(draft.content, targetPlatform),
                );
              }}
            >
              Anpassen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DiffView
        title="KI-Vorschlag"
        agent="Template Assistant"
        provider={
          diffResult
            ? `${diffResult.provider} (${diffResult.model})`
            : (aiStatus.activeProvider ?? 'kein Provider')
        }
        fields={diffResult?.fields ?? []}
        onAccept={handleAcceptDiff}
        onReject={() => undefined}
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
      />
    </div>
  );
}
