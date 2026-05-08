import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Template, TemplatePlatform } from '../schemas';

interface TemplateListItemProps {
  template: Template;
  active: boolean;
  onSelect: () => void;
}

const PLATFORM_LABELS: Record<TemplatePlatform, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
};

function relativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unbekannt';

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays <= 0) return 'Heute';
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `Vor ${diffDays} Tagen`;
  if (diffDays < 30) return `Vor ${Math.floor(diffDays / 7)} Wochen`;
  if (diffDays < 365) return `Vor ${Math.floor(diffDays / 30)} Monaten`;
  return `Vor ${Math.floor(diffDays / 365)} Jahren`;
}

export function TemplateListItem({ template, active, onSelect }: TemplateListItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors',
        active
          ? 'border-pg-accent bg-pg-accent-subtle'
          : 'border-border-subtle bg-bg-elevated hover:border-pg-accent/40 hover:bg-bg-hover',
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
          {template.name}
        </h3>
        <span className="shrink-0 text-xs font-medium text-text-muted">v{template.version}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {template.platforms?.map((platform) => (
          <Badge key={platform} variant="outline" className="text-xs">
            {PLATFORM_LABELS[platform]}
          </Badge>
        ))}
        {template.is_legal ? (
          <Badge variant="outline" className="border-danger bg-danger-subtle text-danger">
            Rechtstext
          </Badge>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-text-muted">{relativeDate(template.updated_at)}</p>
    </button>
  );
}
