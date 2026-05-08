import { Copy, Save, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type {
  Template,
  TemplateCategory,
  TemplatePlatform,
  TemplateUpdate,
  TemplateVariable,
} from '../schemas';
import { templateCategoryEnum } from '../schemas';
import { extractVariables, mergeVariables } from '../utils';
import { softDeleteTemplate, updateTemplate } from '../services';
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
  const [draft, setDraft] = useState<TemplateDraft>(() => templateToDraft(template));
  const [isSaving, setIsSaving] = useState(false);
  const [showNotes, setShowNotes] = useState(Boolean(template.notes));
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);

  const normalizedDraft = useMemo(() => normalizeDraft(draft), [draft]);
  const isDirty = useMemo(
    () =>
      JSON.stringify(normalizedDraft) !== JSON.stringify(normalizeDraft(templateToDraft(template))),
    [normalizedDraft, template],
  );

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
          {['Text kürzen', 'Text verlängern', 'Umformulieren', 'Für Plattform anpassen'].map(
            (label) => (
              <Button
                key={label}
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled
                title="Kommt in Sub-Session E"
              >
                <Sparkles className="size-4" />
                {label}
              </Button>
            ),
          )}
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
    </div>
  );
}
