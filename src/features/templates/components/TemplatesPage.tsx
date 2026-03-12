import { useEffect, useState } from "react";
import { Plus, Search, X, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { CreateTemplateDialog } from "./CreateTemplateDialog";
import { useTemplateStore } from "../store";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  type Template,
  type TemplateCategory,
} from "../types";
import { cn } from "@/lib/utils";
import de from "@/i18n/de.json";

const ALL_VALUE = "__all__";

interface TemplateCardProps {
  template: Template;
  selected: boolean;
  onSelect: () => void;
}

function TemplateCard({ template, selected, onSelect }: TemplateCardProps) {
  return (
    <div
      className={cn(
        "border-b border-[--border] px-6 py-4 transition-colors cursor-pointer",
        "hover:bg-[--muted]",
        selected && "bg-[--accent-primary-subtle]"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <Badge variant="outline">
          {TEMPLATE_CATEGORY_LABELS[template.category as TemplateCategory] ?? template.category}
        </Badge>
        {template.is_legal && (
          <Badge variant="warning" className="gap-1">
            <Scale className="size-3" />
            Rechtstext
          </Badge>
        )}
        <span className="text-[10px] text-[--muted-foreground]">v{template.version}</span>
      </div>
      <h3 className="mt-1.5 text-sm font-medium text-[--foreground]">
        {template.name}
      </h3>
      <p className="mt-1 text-xs text-[--muted-foreground] line-clamp-2 font-mono">
        {template.content}
      </p>
      {template.variables.length > 0 && (
        <div className="mt-2 flex items-center gap-1">
          {template.variables.map((v) => (
            <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
              {`{{${v}}}`}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function TemplatesPage() {
  const { templates, isLoading, error, fetchTemplates, selectTemplate, selectedTemplateId } =
    useTemplateStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filtered = templates.filter((t) => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (globalFilter) {
      const q = globalFilter.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.content.toLowerCase().includes(q);
    }
    return true;
  });

  const hasActiveFilter = categoryFilter || globalFilter;

  function clearFilters() {
    setCategoryFilter("");
    setGlobalFilter("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[--border] px-6 py-4">
        <div>
          <h1 className="text-base font-semibold text-[--foreground]">
            {de.templates.title}
          </h1>
          <p className="text-xs text-[--muted-foreground]">{de.templates.subtitle}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 bg-[--accent-primary] text-white hover:bg-[--accent-primary-hover]"
        >
          <Plus className="size-4" />
          Neue Vorlage
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[--border] px-6 py-3">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[--muted-foreground]" />
          <Input
            placeholder="Suchen..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select
          value={categoryFilter || ALL_VALUE}
          onValueChange={(v) => setCategoryFilter(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder="Alle Kategorien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle Kategorien</SelectItem>
            {TEMPLATE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {TEMPLATE_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-[--muted-foreground] hover:text-[--foreground] transition-colors"
          >
            <X className="size-3.5" />
            Filter zurücksetzen
          </button>
        )}

        <div className="flex-1" />

        {isLoading && (
          <span className="text-xs text-[--muted-foreground]">Laden...</span>
        )}
      </div>

      {/* Legal disclaimer */}
      {templates.some((t) => t.is_legal) && (
        <div className="shrink-0 border-b border-[--accent-warning-subtle] bg-[--accent-warning-subtle] px-6 py-2">
          <p className="text-xs text-[--accent-warning]">
            Rechtstexte sind Vorlagen und ersetzen keine Rechtsberatung.
          </p>
        </div>
      )}

      {/* Main content */}
      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="rounded-lg border border-[--accent-danger-subtle] bg-[--accent-danger-subtle] px-4 py-2 text-sm text-[--accent-danger]">
            Fehler: {error}
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-[--muted-foreground]">Keine Vorlagen gefunden.</p>
            </div>
          ) : (
            filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={selectedTemplateId === template.id}
                onSelect={() =>
                  selectTemplate(selectedTemplateId === template.id ? null : template.id)
                }
              />
            ))
          )}
        </ScrollArea>
      )}

      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
