import { useEffect, useState } from "react";
import {
  FolderOpen,
  FileIcon,
  Trash2,
  Link2,
  Package,
  Receipt,
  ShoppingCart,
  FileText,
  FileStack,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFileLinksStore } from "../store";
import {
  ENTITY_TYPE_LABELS,
  FILE_TYPE_LABELS,
  ENTITY_TYPES,
  type EntityType,
  type FileLink,
} from "../types";
import { cn } from "@/lib/utils";
import de from "@/i18n/de.json";

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

const ENTITY_ICONS: Record<EntityType, React.ElementType> = {
  product: Package,
  expense: Receipt,
  order: ShoppingCart,
  listing: FileText,
  template: FileStack,
};

// ── File type extension icon mapping ─────────────────────────────────────────

function FileTypeIcon({ fileType, className }: { fileType: string; className?: string }) {
  const colorMap: Record<string, string> = {
    stl: "text-[--accent-primary]",
    slicer: "text-[--accent-primary]",
    image: "text-[--accent-success]",
    mockup: "text-[--accent-success]",
    receipt: "text-[--accent-warning]",
    license: "text-[--accent-danger]",
  };

  return (
    <FileIcon
      className={cn("size-4", colorMap[fileType] ?? "text-[--muted-foreground]", className)}
    />
  );
}

// ── File Link Row ────────────────────────────────────────────────────────────

function FileLinkRow({
  fileLink,
  onDelete,
}: {
  fileLink: FileLink;
  onDelete: (id: string) => void;
}) {
  const EntityIcon = ENTITY_ICONS[fileLink.entity_type] ?? Link2;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[--border] bg-[--card] px-4 py-3 transition-colors hover:bg-[--muted]/50">
      <FileTypeIcon fileType={fileLink.file_type} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[--foreground]">
            {fileLink.file_name}
          </span>
          {fileLink.file_size_bytes != null && (
            <span className="shrink-0 text-[10px] tabular-nums text-[--muted-foreground]">
              {formatBytes(fileLink.file_size_bytes)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-[--muted-foreground]">
          <span className="truncate font-mono text-[10px]">{fileLink.file_path}</span>
        </div>
      </div>

      <Badge variant="outline" className="gap-1 text-[10px]">
        <EntityIcon className="size-3" />
        {ENTITY_TYPE_LABELS[fileLink.entity_type]}
      </Badge>

      <Badge variant="secondary" className="text-[10px]">
        {FILE_TYPE_LABELS[fileLink.file_type]}
      </Badge>

      <span className="shrink-0 text-[10px] tabular-nums text-[--muted-foreground]">
        {formatDate(fileLink.created_at)}
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="size-7 p-0 text-[--muted-foreground] hover:text-[--accent-danger]"
        onClick={() => onDelete(fileLink.id)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

// ── Files Page ───────────────────────────────────────────────────────────────

export function FilesPage() {
  const { fileLinks, isLoading, loadFileLinks, removeFileLink } = useFileLinksStore();
  const [entityFilter, setEntityFilter] = useState<EntityType | "all">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadFileLinks();
  }, [loadFileLinks]);

  const filtered =
    entityFilter === "all"
      ? fileLinks
      : fileLinks.filter((f) => f.entity_type === entityFilter);

  const entityTypeCounts = ENTITY_TYPES.reduce<Record<string, number>>((acc, type) => {
    acc[type] = fileLinks.filter((f) => f.entity_type === type).length;
    return acc;
  }, {});

  function handleDelete(id: string) {
    if (deleteConfirm === id) {
      removeFileLink(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[--border] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-[--foreground]">{de.files.title}</h1>
            <p className="text-xs text-[--muted-foreground]">{de.files.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-[--muted-foreground]">
              {fileLinks.length} Dateien
            </span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[--border] px-6 py-2">
        <button
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            entityFilter === "all"
              ? "bg-[--accent-primary-subtle] text-[--accent-primary]"
              : "text-[--muted-foreground] hover:bg-[--muted]"
          )}
          onClick={() => setEntityFilter("all")}
        >
          Alle ({fileLinks.length})
        </button>
        {ENTITY_TYPES.map((type) => {
          const count = entityTypeCounts[type] ?? 0;
          if (count === 0) return null;
          const Icon = ENTITY_ICONS[type];
          return (
            <button
              key={type}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                entityFilter === type
                  ? "bg-[--accent-primary-subtle] text-[--accent-primary]"
                  : "text-[--muted-foreground] hover:bg-[--muted]"
              )}
              onClick={() => setEntityFilter(type)}
            >
              <Icon className="size-3" />
              {ENTITY_TYPE_LABELS[type]} ({count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <span className="text-sm text-[--muted-foreground]">Laden...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <FolderOpen className="size-10 text-[--muted-foreground]/40" />
              <div className="text-center">
                <p className="text-sm font-medium text-[--foreground]">Keine Dateien vorhanden</p>
                <p className="mt-1 text-xs text-[--muted-foreground]">
                  Dateien werden automatisch verknüpft, wenn du sie in Produkten, Ausgaben oder
                  Aufträgen hinzufügst.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((fileLink) => (
                <FileLinkRow
                  key={fileLink.id}
                  fileLink={fileLink}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
