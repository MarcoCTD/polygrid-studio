import { Globe, Server, ShieldCheck, Wrench, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  WEBSITE_PROJECT_STATUS_LABELS,
  WEBSITE_SERVICE_TYPE_LABELS,
  type WebsiteProjectStatus,
  type WebsiteServiceType,
} from '../schemas';

const statusClasses: Record<WebsiteProjectStatus, string> = {
  inquiry: 'border-slate-300 bg-slate-100 text-slate-700',
  quoted: 'border-blue-300 bg-blue-100 text-blue-700',
  in_progress: 'border-amber-300 bg-amber-100 text-amber-800',
  review: 'border-violet-300 bg-violet-100 text-violet-700',
  live: 'border-emerald-300 bg-emerald-100 text-emerald-700',
  archived: 'border-zinc-300 bg-zinc-100 text-zinc-600',
};

export function ProjectStatusBadge({ status }: { status: WebsiteProjectStatus }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', statusClasses[status])}>
      {WEBSITE_PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

const SERVICE_TYPE_ICONS: Record<WebsiteServiceType, LucideIcon> = {
  hosting: Server,
  domain: Globe,
  wartung: Wrench,
  sonstiges: ShieldCheck,
};

export function ServiceTypeIcon({ type }: { type: WebsiteServiceType }) {
  const Icon = SERVICE_TYPE_ICONS[type];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm text-text-secondary"
      title={WEBSITE_SERVICE_TYPE_LABELS[type]}
    >
      <Icon className="size-4" />
      {WEBSITE_SERVICE_TYPE_LABELS[type]}
    </span>
  );
}
