import {
  ArrowRight,
  CheckSquare,
  FileText,
  Globe,
  Package,
  Receipt,
  ReceiptText,
  ShieldAlert,
  ShoppingCart,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SmartAction, SmartActionCategory, SmartActionSeverity } from '../types';

const CATEGORY_ICONS: Record<SmartActionCategory, LucideIcon> = {
  orders: ShoppingCart,
  products: Package,
  listings: FileText,
  expenses: Receipt,
  tasks: CheckSquare,
  websites: Globe,
  documents: ReceiptText,
  system: ShieldAlert,
};

const SEVERITY_CARD_CLASSES: Record<SmartActionSeverity, string> = {
  danger: 'border-danger/40 bg-danger-subtle/40',
  warning: 'border-warning/40 bg-warning-subtle/40',
  info: 'border-info/30 bg-info-subtle/40',
};

const SEVERITY_ICON_CLASSES: Record<SmartActionSeverity, string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};

const SEVERITY_BADGE_CLASSES: Record<SmartActionSeverity, string> = {
  danger: 'bg-danger text-white',
  warning: 'bg-warning text-white',
  info: 'bg-info text-white',
};

interface SmartActionCardProps {
  action: SmartAction;
  onOpen: (action: SmartAction) => void;
  onDismiss: (action: SmartAction) => void;
}

export function SmartActionCard({ action, onOpen, onDismiss }: SmartActionCardProps) {
  const Icon = CATEGORY_ICONS[action.category];

  return (
    <div
      data-testid={`smart-action-${action.ruleId}`}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg border p-3 transition-colors',
        SEVERITY_CARD_CLASSES[action.severity],
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => onOpen(action)}
        title="Zur Ansicht springen"
      >
        <Icon size={18} className={cn('shrink-0', SEVERITY_ICON_CLASSES[action.severity])} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
          {action.message}
        </span>
        <span
          className={cn(
            'flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
            SEVERITY_BADGE_CLASSES[action.severity],
          )}
        >
          {action.count}
        </span>
        <ArrowRight
          size={14}
          className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
        />
      </button>

      <button
        type="button"
        className="shrink-0 rounded-full p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
        aria-label={`Hinweis verwerfen: ${action.message}`}
        title="Für 7 Tage ausblenden"
        onClick={() => onDismiss(action)}
      >
        <X size={14} />
      </button>
    </div>
  );
}
