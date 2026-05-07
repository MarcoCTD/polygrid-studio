import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createTask } from '../services';
import {
  extractTasks,
  isTaskExtractorAvailable,
  TASK_EXTRACTOR_PRIORITY_OPTIONS,
  type TaskSuggestion,
} from '../services/taskExtractorAgent';
import type { TaskPriority } from '../schemas';

interface TaskExtractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTasksCreated: () => void;
}

interface EditableSuggestion extends TaskSuggestion {
  id: string;
}

function createEditableSuggestion(suggestion: TaskSuggestion): EditableSuggestion {
  return {
    id: crypto.randomUUID(),
    title: suggestion.title,
    priority: suggestion.priority,
    due_date: suggestion.due_date,
    description: suggestion.description,
  };
}

function priorityLabel(priority: TaskPriority): string {
  return (
    TASK_EXTRACTOR_PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? priority
  );
}

function textOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function TaskExtractorDialog({
  open,
  onOpenChange,
  onTasksCreated,
}: TaskExtractorDialogProps) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<EditableSuggestion[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    isTaskExtractorAvailable()
      .then((available) => {
        if (!cancelled) setIsAvailable(available);
      })
      .catch(() => {
        if (!cancelled) setIsAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const canExtract = useMemo(
    () => isAvailable && text.trim().length > 0 && !isExtracting && !isCreating,
    [isAvailable, isCreating, isExtracting, text],
  );

  function resetDialogState() {
    setText('');
    setSuggestions([]);
    setIsExtracting(false);
    setIsCreating(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDialogState();
    }
    onOpenChange(nextOpen);
  }

  async function handleExtract() {
    if (!canExtract) return;
    setIsExtracting(true);
    try {
      const extracted = await extractTasks(text);
      setSuggestions(extracted.map(createEditableSuggestion));
      toast.success(`${extracted.length} Aufgaben-Vorschläge extrahiert`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Aufgaben konnten nicht extrahiert werden',
      );
    } finally {
      setIsExtracting(false);
    }
  }

  function updateSuggestion(id: string, patch: Partial<EditableSuggestion>) {
    setSuggestions((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function rejectSuggestion(id: string) {
    setSuggestions((items) => items.filter((item) => item.id !== id));
  }

  async function acceptSuggestion(suggestion: EditableSuggestion) {
    setIsCreating(true);
    try {
      await createTask({
        title: suggestion.title.trim(),
        description: textOrNull(suggestion.description),
        priority: suggestion.priority,
        status: 'todo',
        due_date: suggestion.due_date || null,
        product_id: null,
        order_id: null,
        listing_id: null,
        recurring_rule: null,
        parent_task_id: null,
      });
      rejectSuggestion(suggestion.id);
      onTasksCreated();
      toast.success('Aufgabe erstellt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aufgabe konnte nicht erstellt werden');
    } finally {
      setIsCreating(false);
    }
  }

  async function acceptAll() {
    if (suggestions.length === 0) return;
    setIsCreating(true);
    let created = 0;
    try {
      for (const suggestion of suggestions) {
        await createTask({
          title: suggestion.title.trim(),
          description: textOrNull(suggestion.description),
          priority: suggestion.priority,
          status: 'todo',
          due_date: suggestion.due_date || null,
          product_id: null,
          order_id: null,
          listing_id: null,
          recurring_rule: null,
          parent_task_id: null,
        });
        created += 1;
      }
      setSuggestions([]);
      onTasksCreated();
      toast.success(`${created} Aufgaben erstellt`);
      handleOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Aufgaben konnten nicht erstellt werden',
      );
      setSuggestions((items) => items.slice(created));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Aufgaben aus Text</DialogTitle>
          <DialogDescription>
            KI extrahiert konkrete Aufgaben aus Notizen, Kundenmails oder Projekttexten.
          </DialogDescription>
        </DialogHeader>

        {!isAvailable ? (
          <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3 text-sm text-text-secondary">
            Kein KI-Provider konfiguriert. Richte zuerst einen Provider in den Einstellungen ein.
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="task-extractor-text">Freitext</Label>
          <Textarea
            id="task-extractor-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={7}
            placeholder="Text einfügen, z.B. Notizen aus Kundengespräch oder Projektplanung..."
            disabled={isExtracting || isCreating}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-text-secondary">
            {suggestions.length > 0 ? (
              <span>{suggestions.length} Vorschläge bereit</span>
            ) : (
              <span>Extrahierte Aufgaben erscheinen hier zur Prüfung.</span>
            )}
          </div>
          <Button type="button" onClick={() => void handleExtract()} disabled={!canExtract}>
            {isExtracting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            Extrahieren
          </Button>
        </div>

        {suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-lg border border-border-subtle bg-bg-elevated p-3 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge variant="outline">{priorityLabel(suggestion.priority)}</Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Vorschlag ablehnen"
                      onClick={() => rejectSuggestion(suggestion.id)}
                      disabled={isCreating}
                    >
                      <X className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void acceptSuggestion(suggestion)}
                      disabled={isCreating || suggestion.title.trim().length === 0}
                    >
                      <Check className="size-4" />
                      Annehmen
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_150px_150px]">
                  <div className="space-y-1.5">
                    <Label>Titel</Label>
                    <Input
                      value={suggestion.title}
                      maxLength={100}
                      onChange={(event) =>
                        updateSuggestion(suggestion.id, { title: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priorität</Label>
                    <Select
                      value={suggestion.priority}
                      onValueChange={(value) =>
                        updateSuggestion(suggestion.id, { priority: value as TaskPriority })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{priorityLabel(suggestion.priority)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_EXTRACTOR_PRIORITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fällig</Label>
                    <Input
                      type="date"
                      value={suggestion.due_date ?? ''}
                      onChange={(event) =>
                        updateSuggestion(suggestion.id, {
                          due_date: event.target.value || undefined,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <Label>Beschreibung</Label>
                  <Textarea
                    rows={2}
                    value={suggestion.description ?? ''}
                    onChange={(event) =>
                      updateSuggestion(suggestion.id, {
                        description: event.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Schließen
          </Button>
          <Button
            type="button"
            onClick={() => void acceptAll()}
            disabled={suggestions.length === 0 || isCreating}
          >
            {isCreating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Alle annehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
