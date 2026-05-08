import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Template, TemplateCategory } from '../schemas';
import { TemplateListItem } from './TemplateListItem';

type CategoryTabValue = 'all' | TemplateCategory | 'kundenservice_group';

interface TemplateListProps {
  templates: Template[];
  selectedTemplateId: string | null;
  isLoading: boolean;
  onSelectTemplate: (template: Template) => void;
}

const CATEGORY_TABS: Array<{
  value: CategoryTabValue;
  label: string;
  categories?: TemplateCategory[];
}> = [
  { value: 'all', label: 'Alle' },
  { value: 'impressum', label: 'Impressum', categories: ['impressum'] },
  { value: 'widerruf', label: 'Widerruf', categories: ['widerruf'] },
  { value: 'versand', label: 'Versand', categories: ['versand'] },
  { value: 'faq', label: 'FAQ', categories: ['faq'] },
  {
    value: 'kundenservice_group',
    label: 'Kundenservice',
    categories: ['kundenservice', 'antwort'],
  },
  { value: 'beilage', label: 'Beilagen', categories: ['beilage'] },
  { value: 'reklamation', label: 'Reklamation', categories: ['reklamation'] },
  { value: 'sonstiges', label: 'Sonstiges', categories: ['sonstiges'] },
];

export function TemplateList({
  templates,
  selectedTemplateId,
  isLoading,
  onSelectTemplate,
}: TemplateListProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryTabValue>('all');

  const activeTabLabel = CATEGORY_TABS.find((item) => item.value === activeTab)?.label ?? 'Alle';
  const filteredTemplates = useMemo(() => {
    const tab = CATEGORY_TABS.find((item) => item.value === activeTab);
    const categories = tab?.categories;
    const query = search.trim().toLowerCase();

    return templates.filter((template) => {
      if (categories && !categories.includes(template.category)) return false;
      if (!query) return true;
      return (
        template.name.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query)
      );
    });
  }, [activeTab, search, templates]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-border-subtle p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-text-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Vorlagen suchen..."
            className="pl-8"
          />
        </div>

        <div role="tablist" aria-label="Vorlagen-Kategorien" className="flex flex-wrap gap-1.5">
          {CATEGORY_TABS.map((tab) => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-pg-accent-subtle text-pg-accent'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-text-muted">
            Vorlagen werden geladen...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-subtle p-4 text-sm text-text-muted">
            {search.trim()
              ? 'Keine Vorlagen für diese Suche.'
              : activeTab === 'all'
                ? 'Noch keine Vorlagen angelegt.'
                : `Keine Vorlagen in dieser Kategorie: ${activeTabLabel}.`}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <TemplateListItem
                key={template.id}
                template={template}
                active={template.id === selectedTemplateId}
                onSelect={() => onSelectTemplate(template)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
