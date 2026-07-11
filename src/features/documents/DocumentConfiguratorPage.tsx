/**
 * Dokument-Konfigurator (Addendum 2, Spec 2): zentrale Verwaltung aller
 * wiederverwendbaren Dokument-Inhalte als eigene Ansicht (kein Modal).
 *
 * Drei Abschnitte:
 * - Positionen: CRUD/Duplizieren der Positionsvorlagen (app_settings)
 * - Bausteine: Standard-Bausteine je Dokumenttyp inkl. Default-Flags
 *   pro Baustein und pro Stichpunkt (löst "Als Standard speichern" ab)
 * - Einleitungstexte: Standard-intro/outro je Dokumenttyp (Variablen erlaubt)
 *
 * Änderungen wirken nur auf NEUE Dokumente; bestehende Entwürfe und
 * ausgestellte Dokumente (Snapshot) bleiben unberührt.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  DOCUMENT_TYPE_LABELS,
  type ContentBlock,
  type DocumentPositionTemplate,
  type DocumentType,
} from './schemas';
import {
  getDefaultContentBlocksForType,
  getDefaultDocumentTexts,
  getPositionTemplates,
  saveDefaultContentBlocksForType,
  saveDefaultDocumentTexts,
  savePositionTemplates,
} from './services';
import { ContentBlocksEditor } from './components/ContentBlocksEditor';
import { formatDocumentEUR, formatDocumentQuantity } from './components/print/format';
import type { ConfiguratorSearch, ConfiguratorSection } from './searchParams';

const SECTION_LABELS: Record<ConfiguratorSection, string> = {
  positions: 'Positionen',
  blocks: 'Bausteine',
  texts: 'Einleitungstexte',
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ------------------------------------------------------------
// Abschnitt 1: Positionsvorlagen (Spec 2.2)
// ------------------------------------------------------------
interface TemplateDraft {
  id: string | null;
  name: string;
  title: string;
  description: string;
  unit_price: string;
  default_quantity: string;
}

const EMPTY_TEMPLATE_DRAFT: TemplateDraft = {
  id: null,
  name: '',
  title: '',
  description: '',
  unit_price: '',
  default_quantity: '1',
};

function PositionTemplatesSection() {
  const [templates, setTemplates] = useState<DocumentPositionTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** null = Dialog geschlossen */
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentPositionTemplate | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPositionTemplates()
      .then((loaded) => {
        if (!cancelled) setTemplates(loaded);
      })
      .catch((error: unknown) =>
        toast.error(errorMessage(error, 'Positionsvorlagen konnten nicht geladen werden')),
      )
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(next: DocumentPositionTemplate[]): Promise<boolean> {
    try {
      setTemplates(await savePositionTemplates(next));
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'Speichern fehlgeschlagen'));
      return false;
    }
  }

  function openNew() {
    setDraft(EMPTY_TEMPLATE_DRAFT);
  }

  function openEdit(template: DocumentPositionTemplate) {
    setDraft({
      id: template.id,
      name: template.name,
      title: template.title,
      description: template.description,
      unit_price: String(template.unit_price),
      default_quantity: String(template.default_quantity),
    });
  }

  async function handleDuplicate(template: DocumentPositionTemplate) {
    const copy: DocumentPositionTemplate = {
      ...template,
      id: crypto.randomUUID(),
      name: `${template.name} (Kopie)`,
    };
    if (await persist([...templates, copy])) {
      toast.success(`Vorlage „${template.name}" dupliziert`);
    }
  }

  async function handleDelete(template: DocumentPositionTemplate) {
    if (await persist(templates.filter((entry) => entry.id !== template.id))) {
      toast.success(`Vorlage „${template.name}" gelöscht`);
    }
    setDeleteTarget(null);
  }

  async function handleDraftSave() {
    if (!draft) return;
    const unitPrice = Number(draft.unit_price.replace(',', '.'));
    const quantity = Number(draft.default_quantity.replace(',', '.'));
    if (!draft.name.trim()) {
      toast.error('Bitte einen Namen angeben.');
      return;
    }
    if (!Number.isFinite(unitPrice)) {
      toast.error('Bitte einen gültigen Einzelpreis angeben.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Die Standard-Menge muss größer 0 sein.');
      return;
    }

    const entry: DocumentPositionTemplate = {
      id: draft.id ?? crypto.randomUUID(),
      name: draft.name.trim(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      unit_price: unitPrice,
      default_quantity: quantity,
    };
    const next = draft.id
      ? templates.map((template) => (template.id === draft.id ? entry : template))
      : [...templates, entry];
    if (await persist(next)) {
      toast.success(draft.id ? 'Vorlage aktualisiert' : 'Vorlage angelegt');
      setDraft(null);
    }
  }

  return (
    <section className="space-y-3" data-testid="configurator-positions">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Wiederverwendbare Positionen für Angebote und Rechnungen. Der Titel erscheint im Dokument,
          die Auswahl im Editor übernimmt Titel, Beschreibung, Preis und Menge.
        </p>
        <Button size="sm" className="gap-2" data-testid="position-template-new" onClick={openNew}>
          <Plus className="size-4" />
          Neue Vorlage
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Vorlagen werden geladen...</p>
      ) : templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-secondary">
          Keine Positionsvorlagen vorhanden.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm" data-testid="position-templates-table">
            <thead className="bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Titel im Dokument</th>
                <th className="px-3 py-2 text-right font-medium">Einzelpreis</th>
                <th className="px-3 py-2 text-right font-medium">Standard-Menge</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map((template) => (
                <tr
                  key={template.id}
                  className="bg-bg-elevated"
                  data-testid={`position-template-row-${template.name}`}
                >
                  <td className="px-3 py-2 font-medium">{template.name}</td>
                  <td className="max-w-[320px] truncate px-3 py-2 text-text-secondary">
                    {template.title || '–'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatDocumentEUR(template.unit_price)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatDocumentQuantity(template.default_quantity)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Bearbeiten"
                        data-testid={`position-template-edit-${template.name}`}
                        onClick={() => openEdit(template)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Duplizieren"
                        data-testid={`position-template-duplicate-${template.name}`}
                        onClick={() => void handleDuplicate(template)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Löschen"
                        data-testid={`position-template-delete-${template.name}`}
                        onClick={() => setDeleteTarget(template)}
                      >
                        <Trash2 className="size-3.5 text-danger" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Anlegen/Bearbeiten */}
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Vorlage bearbeiten' : 'Neue Positionsvorlage'}</DialogTitle>
            <DialogDescription>
              Änderungen wirken nur auf künftig eingefügte Positionen, nie auf bestehende Dokumente.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Name (intern) *</span>
                <Input
                  value={draft.name}
                  placeholder='z.B. "Onepager"'
                  data-testid="position-template-name"
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Titel (erscheint im Dokument)</span>
                <Input
                  value={draft.title}
                  placeholder='z.B. "Website-Erstellung Onepager"'
                  data-testid="position-template-title"
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, title: event.target.value } : current,
                    )
                  }
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Beschreibung</span>
                <Textarea
                  rows={4}
                  value={draft.description}
                  data-testid="position-template-description"
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Einzelpreis (EUR) *</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={draft.unit_price}
                    data-testid="position-template-price"
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, unit_price: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Standard-Menge</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.default_quantity}
                    data-testid="position-template-quantity"
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, default_quantity: event.target.value } : current,
                      )
                    }
                  />
                </label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              data-testid="position-template-save"
              onClick={() => void handleDraftSave()}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Löschen bestätigen (Sicherheit by Default) */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vorlage löschen?</DialogTitle>
            <DialogDescription>
              „{deleteTarget?.name}" wird aus den Positionsvorlagen entfernt. Bereits eingefügte
              Positionen in Dokumenten bleiben erhalten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="position-template-delete-confirm"
              onClick={() => {
                if (deleteTarget) void handleDelete(deleteTarget);
              }}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ------------------------------------------------------------
// Abschnitt 2: Baustein-Standards je Dokumenttyp (Spec 2.3)
// ------------------------------------------------------------
function BlockDefaultsSection({ initialType }: { initialType: DocumentType }) {
  const [type, setType] = useState<DocumentType>(initialType);
  const [blocksByType, setBlocksByType] = useState<Record<DocumentType, ContentBlock[] | null>>({
    quote: null,
    invoice: null,
  });
  const [isSaving, setIsSaving] = useState(false);

  const loadType = useCallback(async (target: DocumentType) => {
    try {
      const blocks = await getDefaultContentBlocksForType(target);
      setBlocksByType((current) => ({ ...current, [target]: blocks }));
    } catch (error) {
      toast.error(errorMessage(error, 'Standard-Bausteine konnten nicht geladen werden'));
    }
  }, []);

  useEffect(() => {
    // Beide Typen laden, damit der Tab-Wechsel keinen Zustand verliert.
    // Laden aus der lokalen SQLite ist der externe Synchronisationspunkt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadType('quote');
    void loadType('invoice');
  }, [loadType]);

  const blocks = blocksByType[type];

  async function handleSave() {
    if (!blocks) return;
    setIsSaving(true);
    try {
      const cleaned = blocks.map((block) => ({
        ...block,
        title: block.title.trim(),
        items: block.items
          .map((item) => ({ ...item, text: item.text.trim() }))
          .filter((item) => item.text.length > 0),
        text: block.text.trim(),
      }));
      await saveDefaultContentBlocksForType(type, cleaned);
      setBlocksByType((current) => ({ ...current, [type]: cleaned }));
      toast.success(
        `Baustein-Standards für ${DOCUMENT_TYPE_LABELS[type]}e gespeichert – neue Dokumente starten damit`,
      );
    } catch (error) {
      toast.error(errorMessage(error, 'Speichern fehlgeschlagen'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-3" data-testid="configurator-blocks">
      <p className="text-sm text-text-secondary">
        Standard-Bausteine für neue Dokumente: Reihenfolge, Titel, Texte, und pro Baustein sowie pro
        Stichpunkt, ob er standardmäßig aktiviert ist. Im Editor bleibt alles pro Dokument
        übersteuerbar.
      </p>
      <div className="flex items-center justify-between gap-3">
        <Tabs
          value={type}
          onValueChange={(value) => setType(value === 'invoice' ? 'invoice' : 'quote')}
        >
          <TabsList>
            <TabsTrigger value="quote" data-testid="configurator-type-quote">
              Angebote
            </TabsTrigger>
            <TabsTrigger value="invoice" data-testid="configurator-type-invoice">
              Rechnungen
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          size="sm"
          disabled={isSaving || !blocks}
          data-testid="configurator-blocks-save"
          onClick={() => void handleSave()}
        >
          Speichern
        </Button>
      </div>

      {blocks ? (
        <ContentBlocksEditor
          value={blocks}
          documentType={type}
          onChange={(next) => setBlocksByType((current) => ({ ...current, [type]: next }))}
        />
      ) : (
        <p className="text-sm text-text-secondary">Bausteine werden geladen...</p>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Abschnitt 3: Standard-Einleitungstexte (Spec 2.4)
// ------------------------------------------------------------
interface TextsState {
  intro: string;
  outro: string;
}

function IntroTextsSection() {
  const [texts, setTexts] = useState<Record<DocumentType, TextsState>>({
    quote: { intro: '', outro: '' },
    invoice: { intro: '', outro: '' },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [savingType, setSavingType] = useState<DocumentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDefaultDocumentTexts('quote'), getDefaultDocumentTexts('invoice')])
      .then(([quote, invoice]) => {
        if (cancelled) return;
        setTexts({
          quote: { intro: quote.intro_text ?? '', outro: quote.outro_text ?? '' },
          invoice: { intro: invoice.intro_text ?? '', outro: invoice.outro_text ?? '' },
        });
      })
      .catch((error: unknown) =>
        toast.error(errorMessage(error, 'Einleitungstexte konnten nicht geladen werden')),
      )
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateText(type: DocumentType, field: keyof TextsState, value: string) {
    setTexts((current) => ({ ...current, [type]: { ...current[type], [field]: value } }));
  }

  async function handleSave(type: DocumentType) {
    setSavingType(type);
    try {
      await saveDefaultDocumentTexts(type, {
        intro_text: texts[type].intro.trim(),
        outro_text: texts[type].outro.trim(),
      });
      toast.success(`Einleitungstexte für ${DOCUMENT_TYPE_LABELS[type]}e gespeichert`);
    } catch (error) {
      toast.error(errorMessage(error, 'Speichern fehlgeschlagen'));
    } finally {
      setSavingType(null);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-text-secondary">Einleitungstexte werden geladen...</p>;
  }

  return (
    <section className="space-y-4" data-testid="configurator-texts">
      <p className="text-sm text-text-secondary">
        Neue Dokumente werden mit diesen Texten vorbelegt und bleiben im Editor frei änderbar.
        Variablen wie {'{{kundenname}}'}, {'{{projektname}}'}, {'{{firmenname}}'} und {'{{datum}}'}{' '}
        werden beim Ausstellen ersetzt.
      </p>
      {(['quote', 'invoice'] as const).map((type) => (
        <div key={type} className="space-y-3 rounded-lg border border-border bg-bg-elevated p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {DOCUMENT_TYPE_LABELS[type]}e
            </h3>
            <Button
              size="sm"
              variant="outline"
              disabled={savingType === type}
              data-testid={`configurator-texts-save-${type}`}
              onClick={() => void handleSave(type)}
            >
              Speichern
            </Button>
          </div>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Einleitungstext</span>
            <Textarea
              rows={3}
              value={texts[type].intro}
              placeholder='z.B. "Sehr geehrte/r {{kundenname}}, vielen Dank für Ihr Vertrauen..."'
              data-testid={`configurator-intro-${type}`}
              onChange={(event) => updateText(type, 'intro', event.target.value)}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Schlusstext</span>
            <Textarea
              rows={3}
              value={texts[type].outro}
              placeholder='z.B. "Ich freue mich auf die Zusammenarbeit."'
              data-testid={`configurator-outro-${type}`}
              onChange={(event) => updateText(type, 'outro', event.target.value)}
            />
          </label>
        </div>
      ))}
    </section>
  );
}

// ------------------------------------------------------------
// Seite
// ------------------------------------------------------------
export function DocumentConfiguratorPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ConfiguratorSearch;
  const section: ConfiguratorSection = search.section ?? 'positions';

  function switchSection(next: ConfiguratorSection) {
    void navigate({
      to: '/documents/templates',
      search: { section: next, ...(search.type ? { type: search.type } : {}) },
    });
  }

  function goBack() {
    void navigate({ to: '/websites', search: { tab: 'documents' } });
  }

  return (
    <div className="flex h-full flex-col bg-bg-primary" data-testid="document-configurator">
      <header className="border-b border-border-subtle px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" title="Zurück zu den Dokumenten" onClick={goBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Vorlagen verwalten</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Positionsvorlagen, Baustein-Standards und Einleitungstexte für Angebote und
              Rechnungen.
            </p>
          </div>
        </div>
      </header>

      <div className="border-b border-border-subtle bg-bg-secondary px-6 py-2">
        <Tabs
          value={section}
          onValueChange={(value) => switchSection(value as ConfiguratorSection)}
        >
          <TabsList>
            {(Object.keys(SECTION_LABELS) as ConfiguratorSection[]).map((key) => (
              <TabsTrigger key={key} value={key} data-testid={`configurator-section-${key}`}>
                {SECTION_LABELS[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl">
          {section === 'positions' ? <PositionTemplatesSection /> : null}
          {section === 'blocks' ? (
            <BlockDefaultsSection initialType={search.type ?? 'quote'} />
          ) : null}
          {section === 'texts' ? <IntroTextsSection /> : null}
        </div>
      </div>
    </div>
  );
}
