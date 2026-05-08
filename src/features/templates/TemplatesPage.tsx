import { FileText, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores';
import type { Template } from './schemas';
import { getAllTemplates } from './services';
import { NewTemplateModal, TemplateEditor, TemplateList } from './components';

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const registerCommands = useUIStore((state) => state.registerCommands);
  const unregisterCommands = useUIStore((state) => state.unregisterCommands);

  async function loadTemplates() {
    setIsLoading(true);
    try {
      const rows = await getAllTemplates();
      setTemplates(rows);
      setSelectedTemplate((current) =>
        current ? (rows.find((template) => template.id === current.id) ?? null) : null,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Vorlagen konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Loading templates from SQLite is this page's external synchronization point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTemplates();
  }, []);

  useEffect(() => {
    const commandIds = ['templates:new'];

    registerCommands([
      {
        id: 'templates:new',
        label: 'Neue Vorlage',
        icon: Plus,
        category: 'action',
        action: () => setNewTemplateOpen(true),
      },
    ]);

    return () => unregisterCommands(commandIds);
  }, [registerCommands, unregisterCommands]);

  const selectedTemplateId = selectedTemplate?.id ?? null;
  const selectedTemplateSnapshot = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? selectedTemplate,
    [selectedTemplate, selectedTemplateId, templates],
  );

  function handleCreated(template: Template) {
    setTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
    setSelectedTemplate(template);
    setNewTemplateOpen(false);
    void loadTemplates();
  }

  function handleSaved(template: Template) {
    setTemplates((current) => current.map((item) => (item.id === template.id ? template : item)));
    setSelectedTemplate(template);
    void loadTemplates();
  }

  function handleDeleted(templateId: string) {
    const index = templates.findIndex((template) => template.id === templateId);
    const nextTemplates = templates.filter((template) => template.id !== templateId);
    setTemplates(nextTemplates);
    setSelectedTemplate(nextTemplates[index] ?? nextTemplates[index - 1] ?? null);
    void loadTemplates();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-primary">
      <header className="flex items-center justify-between gap-4 border-b border-border-subtle px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Vorlagen</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Textbausteine, Rechtstexte und Kundenantworten zentral verwalten.
          </p>
        </div>
        <Button type="button" className="gap-1.5" onClick={() => setNewTemplateOpen(true)}>
          <Plus className="size-4" />
          Neue Vorlage
        </Button>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[350px_minmax(0,1fr)] overflow-hidden">
        <aside className="min-h-0 border-r border-border-subtle bg-bg-secondary">
          <TemplateList
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            isLoading={isLoading}
            onSelectTemplate={setSelectedTemplate}
          />
        </aside>

        <section className="min-h-0 overflow-auto p-6">
          {selectedTemplateSnapshot ? (
            <TemplateEditor
              key={selectedTemplateSnapshot.id}
              template={selectedTemplateSnapshot}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ) : (
            <div className="flex min-h-full items-center justify-center rounded-lg border border-dashed border-border-subtle bg-bg-elevated p-8 text-center">
              <div>
                <FileText className="mx-auto size-8 text-text-muted" />
                <h2 className="mt-4 text-lg font-semibold text-text-primary">
                  Vorlage auswählen oder neu erstellen
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Wähle links eine Vorlage aus oder lege oben eine neue Vorlage an.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      <NewTemplateModal
        open={newTemplateOpen}
        onOpenChange={setNewTemplateOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
