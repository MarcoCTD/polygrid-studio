import { useEffect, useMemo, useState } from 'react';
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
import { getDatabase } from '@/services/database';
import { getSettingWithDefault } from '@/services/settings';
import type { TemplateVariable } from '../schemas';
import { extractVariables, mergeVariables } from '../utils';
import {
  findStandardVariable,
  orderVariableValue,
  type OrderPickerRow,
  type StandardVariableSource,
} from '../variableRegistry';

interface CopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  variables: TemplateVariable[];
  /**
   * Optionale Vorbefüllung (z.B. Auftragsvariablen aus einem Playbook-Vorschlag).
   * Überschreibt die automatischen Prefills, aber keine bereits getippten Werte.
   */
  initialValues?: Record<string, string>;
}

interface ResolvedVariable {
  name: string;
  label: string;
  description: string;
  source?: StandardVariableSource;
}

interface ProductPickerRow {
  id: string;
  name: string;
}

interface PickerOption {
  id: string;
  label: string;
  sublabel?: string;
}

function replaceTemplateVariables(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, rawName: string) => {
    const name = rawName.trim();
    const value = values[name]?.trim();
    return value ? value : match;
  });
}

/**
 * Loest jede Vorlagen-Variable gegen die Registry auf: Standard-Variablen
 * bekommen Label, Beschreibung und Datenquelle aus der Registry, eigene
 * Variablen bleiben Freitext mit ihrer gespeicherten Beschreibung.
 */
function resolveVariables(content: string, variables: TemplateVariable[]): ResolvedVariable[] {
  return mergeVariables(extractVariables(content), variables).map((variable) => {
    const standard = findStandardVariable(variable.name);
    return {
      name: variable.name,
      label: standard?.label ?? variable.name,
      description: standard?.description ?? variable.description,
      source: standard?.source,
    };
  });
}

/** Eingabefeld mit Suchliste (Dropdown mit Suche ueber Produkte/Auftraege). */
function SearchPicker({
  label,
  placeholder,
  options,
  onSelect,
}: {
  label: string;
  placeholder: string;
  options: PickerOption[];
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = options
    .filter((option) =>
      `${option.label} ${option.sublabel ?? ''}`.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 20);

  return (
    <div className="relative">
      <Input
        value={query}
        placeholder={placeholder}
        aria-label={label}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
      />
      {isOpen ? (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-bg-elevated shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-muted">Keine Treffer</li>
          ) : (
            filtered.map((option) => (
              <li key={option.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-bg-hover"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setQuery(option.label);
                    setIsOpen(false);
                    onSelect(option.id);
                  }}
                >
                  <span className="block text-text-primary">{option.label}</span>
                  {option.sublabel ? (
                    <span className="block text-xs text-text-secondary">{option.sublabel}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function CopyDialog({
  open,
  onOpenChange,
  content,
  variables,
  initialValues,
}: CopyDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<ProductPickerRow[]>([]);
  const [orders, setOrders] = useState<OrderPickerRow[]>([]);

  const resolvedVariables = useMemo(
    () => resolveVariables(content, variables),
    [content, variables],
  );
  const needsProducts = resolvedVariables.some((variable) => variable.source?.type === 'product');
  const needsOrders = resolvedVariables.some((variable) => variable.source?.type === 'order');
  const preview = useMemo(() => replaceTemplateVariables(content, values), [content, values]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      const resolved = resolveVariables(content, variables);
      try {
        // Settings- und Datums-Variablen automatisch vorbefuellen
        const prefills: Record<string, string> = {};
        for (const variable of resolved) {
          if (variable.source?.type === 'setting') {
            const value = await getSettingWithDefault<string>(variable.source.settingKey, '');
            if (value) prefills[variable.name] = String(value);
          }
          if (variable.source?.type === 'today') {
            prefills[variable.name] = new Intl.DateTimeFormat('de-DE').format(new Date());
          }
        }

        const [productRows, orderRows] = await Promise.all([
          resolved.some((variable) => variable.source?.type === 'product')
            ? getDatabase().select<ProductPickerRow[]>(
                'SELECT id, name FROM products WHERE deleted_at IS NULL ORDER BY name',
              )
            : Promise.resolve([]),
          resolved.some((variable) => variable.source?.type === 'order')
            ? getDatabase().select<OrderPickerRow[]>(
                `SELECT id, receipt_number, external_order_id, customer_name, tracking_number, platform
                 FROM orders
                 WHERE deleted_at IS NULL
                 ORDER BY order_date DESC
                 LIMIT 100`,
              )
            : Promise.resolve([]),
        ]);

        if (cancelled) return;
        setProducts(productRows);
        setOrders(orderRows);
        // Bereits eingetippte Werte nicht ueberschreiben
        setValues((current) => ({ ...prefills, ...(initialValues ?? {}), ...current }));
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Variablendaten konnten nicht geladen werden',
          );
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, content, variables, initialValues]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setValues({});
    }
    onOpenChange(nextOpen);
  }

  function handleSelectProduct(id: string) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setValues((current) => {
      const next = { ...current };
      for (const variable of resolvedVariables) {
        if (variable.source?.type === 'product') next[variable.name] = product.name;
      }
      return next;
    });
  }

  function handleSelectOrder(id: string) {
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    setValues((current) => {
      const next = { ...current };
      for (const variable of resolvedVariables) {
        if (variable.source?.type === 'order') {
          next[variable.name] = orderVariableValue(order, variable.source.field);
        }
      }
      return next;
    });
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

        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-3">
            {needsProducts || needsOrders ? (
              <div className="space-y-3 rounded-lg border border-border-subtle bg-bg-secondary p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Daten übernehmen
                </p>
                {needsProducts ? (
                  <div className="space-y-1.5">
                    <Label>Produkt</Label>
                    <SearchPicker
                      label="Produktauswahl"
                      placeholder="Produkt suchen"
                      options={products.map((product) => ({
                        id: product.id,
                        label: product.name,
                      }))}
                      onSelect={handleSelectProduct}
                    />
                  </div>
                ) : null}
                {needsOrders ? (
                  <div className="space-y-1.5">
                    <Label>Auftrag</Label>
                    <SearchPicker
                      label="Auftragsauswahl"
                      placeholder="Auftrag suchen"
                      options={orders.map((order) => ({
                        id: order.id,
                        label: order.external_order_id?.trim() || order.receipt_number || order.id,
                        sublabel: [order.customer_name, order.platform]
                          .filter(Boolean)
                          .join(' · '),
                      }))}
                      onSelect={handleSelectOrder}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {resolvedVariables.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-subtle p-3 text-sm text-text-muted">
                Keine Variablen in dieser Vorlage.
              </div>
            ) : (
              resolvedVariables.map((variable) => (
                <div key={variable.name} className="space-y-1.5">
                  <Label htmlFor={`copy-var-${variable.name}`}>
                    <span>{variable.label}</span>
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
