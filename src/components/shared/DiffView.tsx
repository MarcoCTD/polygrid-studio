import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { AIDiffField } from '@/features/ai-assistant/types';

interface DiffViewProps {
  title: string;
  agent: string;
  provider: string;
  fields: AIDiffField[];
  onAccept: (fields: AIDiffField[]) => void;
  onReject: () => void;
  isOpen: boolean;
  onClose: () => void;
}

function cloneFields(fields: AIDiffField[]): AIDiffField[] {
  return fields.map((field) => ({
    ...field,
    currentValue: Array.isArray(field.currentValue) ? [...field.currentValue] : field.currentValue,
    suggestedValue: Array.isArray(field.suggestedValue)
      ? [...field.suggestedValue]
      : field.suggestedValue,
  }));
}

function isEmptyValue(value: string | string[] | null): boolean {
  return value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function ValueView({
  value,
  compareWith,
  mode,
}: {
  value: string | string[] | null;
  compareWith?: string | string[] | null;
  mode: 'current' | 'suggested';
}) {
  const comparison = Array.isArray(compareWith) ? compareWith : [];

  if (isEmptyValue(value)) {
    return <span className="text-text-muted">(leer)</span>;
  }

  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((item) => {
          const changed =
            mode === 'suggested'
              ? !comparison.includes(item)
              : comparison.length > 0 && !comparison.includes(item);
          return (
            <Badge
              key={item}
              variant="outline"
              className={cn(
                changed &&
                  mode === 'suggested' &&
                  'border-success/40 bg-success-subtle text-success',
                changed && mode === 'current' && 'border-danger/40 bg-danger-subtle text-danger',
              )}
            >
              {item}
            </Badge>
          );
        })}
      </div>
    );
  }

  return <span className="whitespace-pre-wrap text-text-primary">{value}</span>;
}

function EditableSuggestion({
  field,
  onChange,
}: {
  field: AIDiffField;
  onChange: (value: string | string[]) => void;
}) {
  const [draftTag, setDraftTag] = useState('');

  if (Array.isArray(field.suggestedValue)) {
    const suggestedTags = field.suggestedValue;
    const addTag = (rawValue: string) => {
      const nextTags = rawValue
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (nextTags.length === 0) return;
      onChange(Array.from(new Set([...suggestedTags, ...nextTags])));
      setDraftTag('');
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter' && event.key !== ',') return;
      event.preventDefault();
      addTag(draftTag);
    };

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {suggestedTags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="gap-1 border-pg-accent-border bg-pg-accent-subtle text-pg-accent"
            >
              {tag}
              <button
                type="button"
                className="rounded-full text-pg-accent hover:text-text-primary"
                onClick={() => onChange(suggestedTags.filter((item) => item !== tag))}
                aria-label={`${tag} entfernen`}
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
        <Input
          value={draftTag}
          onChange={(event) => setDraftTag(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(draftTag)}
          placeholder="Tag hinzufügen"
        />
      </div>
    );
  }

  const useTextarea = field.suggestedValue.length > 80 || field.suggestedValue.includes('\n');

  if (useTextarea) {
    return (
      <Textarea
        value={field.suggestedValue}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24"
      />
    );
  }

  return <Input value={field.suggestedValue} onChange={(event) => onChange(event.target.value)} />;
}

export function DiffView({
  title,
  agent,
  provider,
  fields,
  onAccept,
  onReject,
  isOpen,
  onClose,
}: DiffViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editableFields, setEditableFields] = useState<AIDiffField[]>(() => cloneFields(fields));

  useEffect(() => {
    if (!isOpen) return;
    const timeoutId = window.setTimeout(() => {
      setEditableFields(cloneFields(fields));
      setIsEditing(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fields, isOpen]);

  const hasFields = useMemo(() => editableFields.length > 0, [editableFields.length]);

  const updateSuggestedValue = (fieldName: string, value: string | string[]) => {
    setEditableFields((currentFields) =>
      currentFields.map((field) =>
        field.fieldName === fieldName ? { ...field, suggestedValue: value } : field,
      ),
    );
  };

  const handleReject = () => {
    onReject();
    onClose();
  };

  const handleAccept = () => {
    onAccept(editableFields);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] min-w-[min(500px,calc(100vw-2rem))] overflow-hidden p-0 sm:max-w-[700px]">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="text-lg text-text-primary">{title}</DialogTitle>
          <DialogDescription>
            {agent} · {provider}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="max-h-[58vh] overflow-auto px-5">
          {!hasFields ? (
            <div className="rounded-lg border border-border bg-bg-secondary p-6 text-sm text-text-secondary">
              Keine Vorschlagsfelder vorhanden.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[1fr_1.3fr_1.3fr] bg-bg-secondary text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <div className="border-r border-border px-3 py-2">Feldname</div>
                <div className="border-r border-border px-3 py-2">Aktuell</div>
                <div className="px-3 py-2">Vorschlag</div>
              </div>
              {editableFields.map((field) => (
                <div
                  key={field.fieldName}
                  className="grid grid-cols-[1fr_1.3fr_1.3fr] border-t border-border bg-bg-elevated text-sm"
                >
                  <div className="border-r border-border px-3 py-3 font-medium text-text-primary">
                    {field.fieldLabel}
                  </div>
                  <div className="border-r border-border px-3 py-3 text-text-secondary">
                    <ValueView
                      value={field.currentValue}
                      compareWith={field.suggestedValue}
                      mode="current"
                    />
                  </div>
                  <div className="px-3 py-3">
                    {isEditing ? (
                      <EditableSuggestion
                        field={field}
                        onChange={(value) => updateSuggestedValue(field.fieldName, value)}
                      />
                    ) : (
                      <ValueView
                        value={field.suggestedValue}
                        compareWith={field.currentValue}
                        mode="suggested"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="items-center justify-between sm:justify-between">
          <Button variant="outline" onClick={handleReject}>
            Ablehnen
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing((current) => !current)}>
              {isEditing ? 'Übernehmen' : 'Bearbeiten'}
            </Button>
            <Button onClick={handleAccept} disabled={!hasFields}>
              Annehmen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
