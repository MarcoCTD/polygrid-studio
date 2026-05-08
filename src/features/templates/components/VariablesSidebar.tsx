import { Plus, TextCursorInput } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TemplateVariable } from '../schemas';
import { extractVariables, mergeVariables } from '../utils';

interface VariablesSidebarProps {
  content: string;
  variables: TemplateVariable[];
  onVariablesChange: (variables: TemplateVariable[]) => void;
  onInsertVariable: (name: string) => void;
}

export function VariablesSidebar({
  content,
  variables,
  onVariablesChange,
  onInsertVariable,
}: VariablesSidebarProps) {
  const [newVariableName, setNewVariableName] = useState('');
  const mergedVariables = useMemo(
    () => mergeVariables(extractVariables(content), variables),
    [content, variables],
  );

  function updateDescription(name: string, description: string) {
    onVariablesChange(
      mergedVariables.map((variable) =>
        variable.name === name ? { ...variable, description } : variable,
      ),
    );
  }

  function addVariable() {
    const name = newVariableName.trim();
    if (!name || mergedVariables.some((variable) => variable.name === name)) return;
    onVariablesChange([...mergedVariables, { name, description: '' }]);
    setNewVariableName('');
  }

  return (
    <aside className="flex min-h-0 flex-col rounded-lg border border-border-subtle bg-bg-secondary">
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">Variablen</h3>
        <p className="mt-1 text-xs text-text-muted">
          Automatisch erkannte und manuell gepflegte Platzhalter.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {mergedVariables.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-subtle p-3 text-sm text-text-muted">
            Noch keine Variablen gefunden.
          </p>
        ) : (
          mergedVariables.map((variable) => (
            <div
              key={variable.name}
              className="space-y-2 rounded-lg border border-border-subtle bg-bg-elevated p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <code className="truncate rounded bg-pg-accent-subtle px-1.5 py-0.5 text-xs font-medium text-pg-accent">
                  {`{{${variable.name}}}`}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${variable.name} einfügen`}
                  onClick={() => onInsertVariable(variable.name)}
                >
                  <TextCursorInput className="size-4" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Beschreibung</Label>
                <Input
                  value={variable.description}
                  placeholder="Beschreibung"
                  onChange={(event) => updateDescription(variable.name, event.target.value)}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border-subtle p-4">
        <div className="flex gap-2">
          <Input
            value={newVariableName}
            placeholder="variable"
            onChange={(event) => setNewVariableName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addVariable();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" onClick={addVariable}>
            <Plus className="size-4" />
            <span className="sr-only">Variable hinzufügen</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
