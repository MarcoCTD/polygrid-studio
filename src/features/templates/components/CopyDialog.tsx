import { useMemo, useState } from 'react';
import { ClipboardCopy } from 'lucide-react';
import { toast } from 'sonner';
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
import type { TemplateVariable } from '../schemas';
import { extractVariables, mergeVariables } from '../utils';

interface CopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  variables: TemplateVariable[];
}

function replaceTemplateVariables(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, rawName: string) => {
    const name = rawName.trim();
    const value = values[name]?.trim();
    return value ? value : match;
  });
}

export function CopyDialog({ open, onOpenChange, content, variables }: CopyDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const mergedVariables = useMemo(
    () => mergeVariables(extractVariables(content), variables),
    [content, variables],
  );
  const preview = useMemo(() => replaceTemplateVariables(content, values), [content, values]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setValues({});
    }
    onOpenChange(nextOpen);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(preview);
      toast.success('Kopiert!');
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Text konnte nicht kopiert werden');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vorlage kopieren</DialogTitle>
          <DialogDescription>
            Fülle die Variablen aus. Leere Felder bleiben im Text als Platzhalter erhalten.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            {mergedVariables.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-subtle p-3 text-sm text-text-muted">
                Keine Variablen in dieser Vorlage.
              </div>
            ) : (
              mergedVariables.map((variable) => (
                <div key={variable.name} className="space-y-1.5">
                  <Label htmlFor={`copy-var-${variable.name}`}>
                    {variable.name}
                    {variable.description ? (
                      <span className="ml-1 font-normal text-text-muted">
                        · {variable.description}
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    id={`copy-var-${variable.name}`}
                    value={values[variable.name] ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [variable.name]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))
            )}
          </div>

          <div className="min-h-72 rounded-lg border border-border-subtle bg-bg-secondary p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              Vorschau
            </p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-text-primary">
              {preview}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" className="gap-1.5" onClick={() => void handleCopy()}>
            <ClipboardCopy className="size-4" />
            In Zwischenablage kopieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
