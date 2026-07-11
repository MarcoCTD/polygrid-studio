/**
 * Baustein-Abschnitt des Dokument-Editors (Addendum Modul 17, Spec 3.4).
 *
 * Liste aller Bausteine des Dokuments: Checkbox (enabled), Titel,
 * Auf/Ab-Pfeile (Reihenfolge), Aufklappen zum Editieren (Titel, Bullets als
 * dynamische Liste mit Enter-Hinzufügen, Absätze als Textarea mit
 * Variablen-Einfügen-Buttons). Eigene Bausteine sind beliebig oft
 * hinzufügbar und löschbar; Standard-Bausteine werden nur abgewählt.
 */
import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { createCustomContentBlock } from '../contentBlocks';
import type { ContentBlock, ContentBlockItem, DocumentType } from '../schemas';

/** Variablen für die Einfügen-Buttons (Registry-Namen, Modul 07 + Addendum). */
const DOCUMENT_VARIABLES: { name: string; quoteOnly?: boolean }[] = [
  { name: 'kundenname' },
  { name: 'projektname' },
  { name: 'firmenname' },
  { name: 'datum' },
  { name: 'zahlungsziel_tage' },
  { name: 'iban' },
  { name: 'bic' },
  { name: 'kontoinhaber' },
  { name: 'gueltig_bis', quoteOnly: true },
];

interface ContentBlocksEditorProps {
  value: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  documentType: DocumentType;
}

export function ContentBlocksEditor({ value, onChange, documentType }: ContentBlocksEditorProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  /** Bullet-Input, der nach Enter-Hinzufügen den Fokus erhalten soll. */
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const textareaRefs = useRef(new Map<string, HTMLTextAreaElement>());

  const variables = DOCUMENT_VARIABLES.filter(
    (variable) => !variable.quoteOnly || documentType === 'quote',
  );

  function updateBlock(id: string, patch: Partial<ContentBlock>) {
    onChange(value.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function addCustomBlock() {
    const block = createCustomContentBlock();
    onChange([...value, block]);
    setExpandedIds((current) => new Set(current).add(block.id));
  }

  function removeBlock(id: string) {
    onChange(value.filter((block) => block.id !== id));
  }

  function updateItem(block: ContentBlock, index: number, patch: Partial<ContentBlockItem>) {
    const items = [...block.items];
    items[index] = { ...items[index], ...patch };
    updateBlock(block.id, { items });
  }

  /** Enter fügt einen neuen Punkt direkt darunter ein und fokussiert ihn. */
  function insertItemAfter(block: ContentBlock, index: number) {
    const items = [...block.items];
    items.splice(index + 1, 0, { text: '', enabled: true });
    updateBlock(block.id, { items });
    setPendingFocus(`${block.id}:${index + 1}`);
  }

  function removeItem(block: ContentBlock, index: number) {
    updateBlock(block.id, { items: block.items.filter((_, i) => i !== index) });
  }

  /** Variable an der Cursorposition der Absatz-Textarea einfügen (Muster Modul 07). */
  function insertVariable(block: ContentBlock, name: string) {
    const token = `{{${name}}}`;
    const textarea = textareaRefs.current.get(block.id);
    const start = textarea?.selectionStart ?? block.text.length;
    const end = textarea?.selectionEnd ?? block.text.length;
    updateBlock(block.id, {
      text: `${block.text.slice(0, start)}${token}${block.text.slice(end)}`,
    });
    window.setTimeout(() => {
      textarea?.focus();
      const cursor = start + token.length;
      textarea?.setSelectionRange(cursor, cursor);
    }, 0);
  }

  return (
    <div className="space-y-2" data-testid="content-blocks-editor">
      {value.map((block, index) => {
        const isExpanded = expandedIds.has(block.id);
        return (
          <div
            key={block.id}
            className="rounded-lg border border-border-subtle"
            data-testid={`block-row-${block.kind}`}
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Checkbox
                checked={block.enabled}
                aria-label={`${block.title} aktivieren`}
                data-testid={`block-toggle-${block.kind}`}
                onCheckedChange={(checked) => updateBlock(block.id, { enabled: checked === true })}
              />
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm"
                data-testid={`block-expand-${block.kind}`}
                onClick={() => toggleExpanded(block.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="size-3.5 shrink-0 text-text-secondary" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-text-secondary" />
                )}
                <span
                  className={
                    block.enabled ? 'truncate' : 'truncate text-text-secondary line-through'
                  }
                >
                  {block.title || '(ohne Titel)'}
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Nach oben"
                disabled={index === 0}
                data-testid={`block-up-${block.kind}`}
                onClick={() => moveBlock(index, -1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Nach unten"
                disabled={index === value.length - 1}
                data-testid={`block-down-${block.kind}`}
                onClick={() => moveBlock(index, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              {block.kind === 'custom' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Baustein löschen"
                  data-testid={`block-remove-${block.id}`}
                  onClick={() => removeBlock(block.id)}
                >
                  <Trash2 className="size-3.5 text-danger" />
                </Button>
              ) : null}
            </div>

            {isExpanded ? (
              <div className="space-y-2 border-t border-border-subtle p-2">
                <Input
                  value={block.title}
                  aria-label="Baustein-Titel"
                  data-testid={`block-title-${block.kind}`}
                  onChange={(event) => updateBlock(block.id, { title: event.target.value })}
                />

                {block.kind === 'custom' ? (
                  <Tabs
                    value={block.body_type}
                    onValueChange={(bodyType) =>
                      updateBlock(block.id, {
                        body_type: bodyType === 'bullets' ? 'bullets' : 'paragraph',
                      })
                    }
                  >
                    <TabsList>
                      <TabsTrigger value="paragraph">Absatz</TabsTrigger>
                      <TabsTrigger value="bullets">Bullet-Liste</TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : null}

                {block.body_type === 'bullets' ? (
                  <div className="space-y-1.5">
                    {block.items.map((item, itemIndex) => {
                      const focusKey = `${block.id}:${itemIndex}`;
                      return (
                        <div key={itemIndex} className="flex items-center gap-1.5">
                          {/* Checkbox pro Stichpunkt (Addendum 2, Spec 2.3):
                              abschalten ohne zu löschen */}
                          <Checkbox
                            checked={item.enabled}
                            aria-label={`${block.title}: Punkt ${itemIndex + 1} aktivieren`}
                            data-testid={`block-item-toggle-${block.kind}-${itemIndex}`}
                            onCheckedChange={(checked) =>
                              updateItem(block, itemIndex, { enabled: checked === true })
                            }
                          />
                          <Input
                            value={item.text}
                            autoFocus={pendingFocus === focusKey}
                            className={
                              item.enabled ? undefined : 'text-text-secondary line-through'
                            }
                            aria-label={`${block.title}: Punkt ${itemIndex + 1}`}
                            data-testid={`block-item-${block.kind}-${itemIndex}`}
                            onFocus={() => {
                              if (pendingFocus === focusKey) setPendingFocus(null);
                            }}
                            onChange={(event) =>
                              updateItem(block, itemIndex, { text: event.target.value })
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                insertItemAfter(block, itemIndex);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Punkt entfernen"
                            onClick={() => removeItem(block, itemIndex)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      data-testid={`block-add-item-${block.kind}`}
                      onClick={() => insertItemAfter(block, block.items.length - 1)}
                    >
                      <Plus className="size-3.5" />
                      Punkt hinzufügen
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Textarea
                      rows={4}
                      value={block.text}
                      aria-label={`${block.title}: Text`}
                      data-testid={`block-text-${block.kind}`}
                      ref={(element) => {
                        if (element) {
                          textareaRefs.current.set(block.id, element);
                        } else {
                          textareaRefs.current.delete(block.id);
                        }
                      }}
                      onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                    />
                    <div className="flex flex-wrap gap-1">
                      {variables.map((variable) => (
                        <Button
                          key={variable.name}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 font-mono text-[11px]"
                          title={`{{${variable.name}}} einfügen`}
                          onClick={() => insertVariable(block, variable.name)}
                        >
                          {`{{${variable.name}}}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        data-testid="block-add-custom"
        onClick={addCustomBlock}
      >
        <Plus className="size-4" />
        Eigener Baustein
      </Button>
    </div>
  );
}
