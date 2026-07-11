/**
 * Dokument-Editor (Modul 17): Split-View wie der Listing-Editor –
 * links Formular (nur Drafts), rechts Live-Vorschau des gewählten Layouts.
 *
 * Harte Regel (Spec 2.2): Ausgestellte Dokumente rendern AUSSCHLIESSLICH
 * aus ihrem Snapshot; das Formular ist dann gesperrt bzw. ausgeblendet.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ArrowLeft, CloudUpload, FolderOpen, Printer, TriangleAlert } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getClients, getWebsiteProjects } from '@/features/websites/services';
import type { ClientListItem, WebsiteProjectListItem } from '@/features/websites/schemas';
import {
  DOCUMENT_LAYOUT_LABELS,
  DOCUMENT_TYPE_LABELS,
  type BusinessDocument,
  type DocumentLayout,
  type DocumentSnapshot,
  type LineItem,
} from './schemas';
import {
  buildDocumentVariableValues,
  composeDocumentSnapshot,
  confirmOneDrivePdfSaved,
  findUnresolvedDocumentVariables,
  getDocumentById,
  getMissingIssueRequirements,
  loadInvoiceSettings,
  openOneDriveExportFolder,
  prepareOneDriveExportTarget,
  resolveDocumentAccentColor,
  updateDocument,
  DOCUMENT_NUMBER_PREFIXES,
  type InvoiceSettings,
  type OneDriveExportTarget,
} from './services';
import { addDaysISO, formatGermanDateFromISO, toISODate } from './utils/dates';
import { DocumentStatusBadge, DocumentTypeBadge } from './components/DocumentBadges';
import { DocumentSheet } from './components/print/DocumentSheet';
import { DocumentPrintPortal } from './components/print/DocumentPrintPortal';
import { LineItemsEditor } from './components/LineItemsEditor';
import type { DocumentFormValues } from './components/documentFormTypes';
import { DocumentActions } from './components/DocumentActions';

const NO_PROJECT = 'none';

function toFormValues(document: BusinessDocument): DocumentFormValues {
  return {
    client_id: document.client_id,
    project_id: document.project_id ?? NO_PROJECT,
    service_date: document.service_date ?? '',
    intro_text: document.intro_text ?? '',
    outro_text: document.outro_text ?? '',
    layout: document.layout,
    line_items: document.line_items.map((item) => ({ ...item })),
  };
}

/** useWatch liefert DeepPartial-Zeilen – alle Felder können fehlen. */
interface PartialLineItemRow {
  description?: string;
  quantity?: number;
  unit_price?: number;
}

/** Formularzeilen → valide LineItems (leere Zeilen ohne Beschreibung fallen weg). */
function sanitizeLineItems(rows: readonly PartialLineItemRow[] | undefined): LineItem[] {
  return (rows ?? [])
    .map((row) => ({
      description: (row.description ?? '').trim(),
      quantity: Number.isFinite(row.quantity) ? Number(row.quantity) : 0,
      unit_price: Number.isFinite(row.unit_price) ? Number(row.unit_price) : 0,
    }))
    .filter((row) => row.description.length > 0);
}

/** Für die Vorschau: unvollständige Zeilen bleiben sichtbar statt zu verschwinden. */
function previewLineItems(rows: readonly PartialLineItemRow[] | undefined): LineItem[] {
  return (rows ?? []).map((row) => ({
    description: (row.description ?? '').trim() || '(Beschreibung)',
    quantity: Number.isFinite(row.quantity) && Number(row.quantity) > 0 ? Number(row.quantity) : 1,
    unit_price: Number.isFinite(row.unit_price) ? Number(row.unit_price) : 0,
  }));
}

export function DocumentEditorPage() {
  const { documentId } = useParams({ strict: false }) as { documentId: string };
  const navigate = useNavigate();
  const [document, setDocument] = useState<BusinessDocument | null>(null);
  const [relatedNumber, setRelatedNumber] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [projects, setProjects] = useState<WebsiteProjectListItem[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState<DocumentSnapshot | null>(null);
  const [oneDriveTarget, setOneDriveTarget] = useState<OneDriveExportTarget | null>(null);

  const form = useForm<DocumentFormValues>({
    defaultValues: {
      client_id: '',
      project_id: NO_PROJECT,
      service_date: '',
      intro_text: '',
      outro_text: '',
      layout: 'modern',
      line_items: [],
    },
  });
  const watched = useWatch({ control: form.control });

  const loadDocument = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loaded, clientList, projectList, invoiceSettings] = await Promise.all([
        getDocumentById(documentId),
        getClients(),
        getWebsiteProjects(),
        loadInvoiceSettings(),
      ]);
      if (!loaded) {
        setNotFound(true);
        return;
      }
      setDocument(loaded);
      setClients(clientList);
      setProjects(projectList);
      setSettings(invoiceSettings);
      setNotFound(false);
      form.reset(toFormValues(loaded));
      setRelatedNumber(
        loaded.related_document_id
          ? ((await getDocumentById(loaded.related_document_id))?.number ?? null)
          : null,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dokument konnte nicht geladen werden');
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [documentId, form]);

  useEffect(() => {
    // Laden aus der lokalen SQLite ist der externe Synchronisationspunkt der Seite.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocument();
  }, [loadDocument]);

  const isDraft = document?.status === 'draft';
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === watched.client_id) ?? null,
    [clients, watched.client_id],
  );
  const clientProjects = useMemo(
    () => projects.filter((project) => project.client_id === watched.client_id),
    [projects, watched.client_id],
  );

  /** Gleiche Wertetabelle wie das Ausstellen (buildDocumentVariableValues). */
  const variableValues = useMemo(() => {
    if (!settings) return null;
    const project = clientProjects.find((candidate) => candidate.id === watched.project_id) ?? null;
    return buildDocumentVariableValues({
      issuer: settings.issuer,
      clientName: selectedClient?.name ?? null,
      projectName: project?.name ?? null,
      issueDateFormatted: formatGermanDateFromISO(toISODate(new Date())),
    });
  }, [settings, clientProjects, watched.project_id, selectedClient]);

  /** Live-Vorschau eines Drafts – gleicher Kompositionsweg wie das Ausstellen. */
  const previewSnapshot = useMemo(() => {
    if (!document || !settings || !isDraft || !variableValues) return null;
    const issueDate = toISODate(new Date());
    try {
      return composeDocumentSnapshot({
        type: document.type,
        number: `${DOCUMENT_NUMBER_PREFIXES[document.type]}-${issueDate.slice(0, 4)}-…`,
        issuer: settings.issuer,
        recipient: selectedClient
          ? {
              name: selectedClient.name,
              contact_person: selectedClient.contact_person,
              address: selectedClient.address,
            }
          : { name: '(Kunde wählen)', contact_person: null, address: null },
        line_items: previewLineItems(watched.line_items),
        issue_date: issueDate,
        due_date:
          document.type === 'invoice' ? addDaysISO(issueDate, settings.payment_terms_days) : null,
        valid_until:
          document.type === 'quote' ? addDaysISO(issueDate, settings.quote_validity_days) : null,
        service_date: watched.service_date?.trim() || null,
        intro_text: watched.intro_text?.trim() || null,
        outro_text: watched.outro_text?.trim() || null,
        layout: (watched.layout as DocumentLayout | undefined) ?? 'modern',
        accent_color: resolveDocumentAccentColor(settings),
        logo: settings.logo || null,
        related_document_number: relatedNumber,
        variable_values: variableValues,
      });
    } catch (error) {
      console.error('[Documents] Vorschau konnte nicht erzeugt werden', error);
      return null;
    }
  }, [document, settings, isDraft, watched, selectedClient, relatedNumber, variableValues]);

  /** Variablen, die mangels Wert wörtlich stehen bleiben würden (Auftrag 1b). */
  const unresolvedVariables = useMemo(() => {
    if (!isDraft || !variableValues) return [];
    return findUnresolvedDocumentVariables(
      [watched.intro_text, watched.outro_text],
      variableValues,
    );
  }, [isDraft, variableValues, watched.intro_text, watched.outro_text]);

  /** Fehlende Pflichtangaben live (gleiche Logik wie das Ausstellen-Gate). */
  const missingRequirements = useMemo(() => {
    if (!document || !settings || !isDraft) return [];
    return getMissingIssueRequirements(
      {
        type: document.type,
        line_items: sanitizeLineItems(watched.line_items ?? []),
        service_date: watched.service_date?.trim() || null,
      },
      settings.issuer,
      selectedClient ? { name: selectedClient.name, address: selectedClient.address } : null,
    );
  }, [document, settings, isDraft, watched.line_items, watched.service_date, selectedClient]);

  /** Gate fürs Ausstellen: Pflichtangaben plus unaufgelöste Variablen. */
  const issueBlockers = useMemo(() => {
    if (unresolvedVariables.length === 0) return missingRequirements;
    return [...missingRequirements, `Variablen ohne Wert: ${unresolvedVariables.join(', ')}`];
  }, [missingRequirements, unresolvedVariables]);

  async function handleSave(values: DocumentFormValues): Promise<BusinessDocument | null> {
    if (!document) return null;
    setIsSaving(true);
    try {
      const updated = await updateDocument(document.id, {
        client_id: values.client_id,
        project_id: values.project_id === NO_PROJECT ? null : values.project_id,
        service_date: values.service_date.trim() || null,
        intro_text: values.intro_text.trim() || null,
        outro_text: values.outro_text.trim() || null,
        layout: values.layout,
        line_items: sanitizeLineItems(values.line_items),
      });
      setDocument(updated);
      form.reset(toFormValues(updated));
      toast.success('Entwurf gespeichert');
      return updated;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Speichern fehlgeschlagen');
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  function handlePrint() {
    if (!document?.snapshot) {
      toast.error('Nur ausgestellte Dokumente können gedruckt werden.');
      return;
    }
    setPrintSnapshot(document.snapshot);
  }

  async function handleOneDriveExport() {
    if (!document?.snapshot) {
      toast.error('Nur ausgestellte Dokumente können abgelegt werden.');
      return;
    }
    try {
      const target = await prepareOneDriveExportTarget(document.snapshot);
      setOneDriveTarget(target);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'OneDrive-Ablage nicht möglich');
    }
  }

  async function handleConfirmOneDriveSaved() {
    if (!document || !oneDriveTarget) return;
    try {
      const found = await confirmOneDrivePdfSaved(document.id, oneDriveTarget, {
        hadPdfPath: document.pdf_path !== null,
      });
      if (found) {
        toast.success(`PDF abgelegt: ${oneDriveTarget.filename}`);
        setOneDriveTarget(null);
        await loadDocument();
      } else {
        toast.warning(
          `Keine Datei unter ${oneDriveTarget.filename} gefunden – bitte im Druckdialog "Als PDF sichern" wählen und im Zielordner speichern.`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Prüfung fehlgeschlagen');
    }
  }

  function goBack() {
    void navigate({ to: '/websites', search: { tab: 'documents' } });
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-secondary">
        Dokument wird geladen...
      </div>
    );
  }

  if (notFound || !document) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-text-secondary">Dokument nicht gefunden.</p>
        <Button variant="outline" onClick={goBack}>
          Zurück zu den Dokumenten
        </Button>
      </div>
    );
  }

  const title = `${DOCUMENT_TYPE_LABELS[document.type]} ${document.number ?? '(Entwurf)'}`;
  const sheetSnapshot = isDraft ? previewSnapshot : document.snapshot;

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" title="Zurück" onClick={goBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1
            className="truncate text-lg font-semibold text-text-primary"
            data-testid="document-editor-title"
          >
            {title}
          </h1>
          <DocumentTypeBadge type={document.type} />
          <DocumentStatusBadge status={document.status} />
        </div>
        <div className="flex items-center gap-2">
          {!isDraft ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                data-testid="document-print"
                onClick={handlePrint}
              >
                <Printer className="size-4" />
                Drucken / PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                data-testid="document-onedrive"
                onClick={() => void handleOneDriveExport()}
              >
                <CloudUpload className="size-4" />
                In OneDrive ablegen
              </Button>
            </>
          ) : null}
          <DocumentActions
            document={document}
            missingRequirements={issueBlockers}
            onBeforeIssue={async () => {
              // Ausstellen arbeitet auf dem gespeicherten Stand.
              const values = form.getValues();
              return handleSave(values);
            }}
            onChanged={() => void loadDocument()}
            onDeleted={goBack}
          />
          {isDraft ? (
            <Button
              size="sm"
              disabled={isSaving}
              data-testid="document-save"
              onClick={() => void form.handleSubmit((values) => void handleSave(values))()}
            >
              Speichern
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {isDraft ? (
          <div className="w-[420px] shrink-0 space-y-4 overflow-y-auto border-r border-border-subtle p-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Kunde</span>
              <Controller
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" data-testid="document-client-select">
                      <SelectValue>
                        {clients.find((client) => client.id === field.value)?.name ??
                          'Kunde wählen'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </label>

            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Projekt (optional)</span>
              <Controller
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" data-testid="document-project-select">
                      <SelectValue>
                        {clientProjects.find((project) => project.id === field.value)?.name ??
                          'Kein Projekt'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>Kein Projekt</SelectItem>
                      {clientProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </label>

            {document.type === 'invoice' ? (
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Leistungsdatum / -zeitraum *</span>
                <Input
                  placeholder='z.B. "01.07.2026" oder "Juli 2026"'
                  data-testid="document-service-date"
                  {...form.register('service_date')}
                />
              </label>
            ) : null}

            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Einleitungstext</span>
              <Textarea
                rows={3}
                placeholder="z.B. Sehr geehrte Damen und Herren, … ({{kundenname}}, {{projektname}} möglich)"
                data-testid="document-intro"
                {...form.register('intro_text')}
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Positionen</span>
              <LineItemsEditor control={form.control} register={form.register} />
            </div>

            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Schlusstext</span>
              <Textarea
                rows={3}
                placeholder="z.B. Vielen Dank für Ihren Auftrag!"
                data-testid="document-outro"
                {...form.register('outro_text')}
              />
            </label>

            <div className="space-y-1.5 text-sm">
              <span className="font-medium">Layout</span>
              <Controller
                control={form.control}
                name="layout"
                render={({ field }) => (
                  <Tabs value={field.value} onValueChange={field.onChange}>
                    <TabsList>
                      <TabsTrigger value="modern" data-testid="layout-modern">
                        {DOCUMENT_LAYOUT_LABELS.modern}
                      </TabsTrigger>
                      <TabsTrigger value="classic" data-testid="layout-classic">
                        {DOCUMENT_LAYOUT_LABELS.classic}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              />
            </div>

            {unresolvedVariables.length > 0 ? (
              <div
                className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                data-testid="document-unresolved-variables"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <p>
                  Variablen ohne Wert: <strong>{unresolvedVariables.join(', ')}</strong> – in den
                  Einstellungen vervollständigen. Ohne Wert bleibt das Ausstellen gesperrt.
                </p>
              </div>
            ) : null}

            {missingRequirements.length > 0 ? (
              <div
                className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                data-testid="document-missing-requirements"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Zum Ausstellen fehlt noch:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {missingRequirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Vorschau: Drafts live, ausgestellte Dokumente NUR aus dem Snapshot */}
        <div className="flex-1 overflow-auto bg-bg-secondary p-6">
          {sheetSnapshot ? (
            <div style={{ zoom: 0.78 }}>
              <DocumentSheet snapshot={sheetSnapshot} className="mx-auto" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-secondary">
              Keine Vorschau verfügbar.
            </div>
          )}
        </div>
      </div>

      {printSnapshot ? (
        <DocumentPrintPortal snapshot={printSnapshot} onDone={() => setPrintSnapshot(null)} />
      ) : null}

      {/* OneDrive-Ablage: Fallback über den Systemdruck (E17-10) */}
      <Dialog
        open={oneDriveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setOneDriveTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>In OneDrive ablegen</DialogTitle>
            <DialogDescription>
              Tauri bietet ohne Zusatz-Plugin kein direktes PDF-Schreiben. Öffne den Druckdialog,
              wähle dort <strong>„Als PDF sichern"</strong> und speichere die Datei im Zielordner.
            </DialogDescription>
          </DialogHeader>
          {oneDriveTarget ? (
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border border-border bg-bg-secondary p-3">
                <p className="text-xs text-text-secondary">Dateiname</p>
                <p className="font-mono text-sm" data-testid="onedrive-filename">
                  {oneDriveTarget.filename}
                </p>
                <p className="mt-2 text-xs text-text-secondary">Zielordner</p>
                <p className="break-all font-mono text-xs">{oneDriveTarget.directory}</p>
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (oneDriveTarget) {
                  void openOneDriveExportFolder(oneDriveTarget).catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : 'Ordner nicht gefunden'),
                  );
                }
              }}
            >
              <FolderOpen className="size-4" />
              Ordner öffnen
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (document.snapshot) setPrintSnapshot(document.snapshot);
              }}
            >
              <Printer className="size-4" />
              Druckdialog öffnen
            </Button>
            <Button
              type="button"
              data-testid="onedrive-confirm"
              onClick={() => void handleConfirmOneDriveSaved()}
            >
              Gespeichert – prüfen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
