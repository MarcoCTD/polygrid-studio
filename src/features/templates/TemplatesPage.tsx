import { FileText, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Template } from './schemas';
import { getAllTemplates } from './services';
import { NewTemplateModal, TemplateList } from './components';

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
            <div className="flex min-h-full flex-col rounded-lg border border-dashed border-border-subtle bg-bg-elevated p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Editor
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">
                    {selectedTemplateSnapshot.name}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Version {selectedTemplateSnapshot.version}
                  </p>
                </div>
                <FileText className="size-5 text-text-muted" />
              </div>
              <div className="mt-8 flex flex-1 items-center justify-center rounded-lg border border-border-subtle bg-bg-secondary p-8 text-center">
                <p className="max-w-sm text-sm text-text-secondary">
                  Der Vorlagen-Editor wird in der nächsten Sub-Session umgesetzt. Die Auswahl ist
                  vorbereitet.
                </p>
              </div>
            </div>
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
