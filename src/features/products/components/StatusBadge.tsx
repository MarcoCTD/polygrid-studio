import { cn } from '@/lib/utils';
import type { Status } from '../schema';

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  idea: {
    label: 'Idee',
    className: 'bg-info-subtle text-[var(--accent-info)]',
  },
  review: {
    label: 'Review',
    className: 'bg-warning-subtle text-[var(--accent-warning)]',
  },
  print_ready: {
    label: 'Druckbereit',
    className: 'bg-info-subtle text-[var(--accent-info)]',
  },
  test_print: {
    label: 'Testdruck',
    className: 'bg-warning-subtle text-[var(--accent-warning)]',
  },
  launch_ready: {
    label: 'Startbereit',
    className: 'bg-success-subtle text-[var(--accent-success)]',
  },
  online: {
    label: 'Online',
    className: 'bg-success-subtle text-[var(--accent-success)]',
  },
  paused: {
    label: 'Pausiert',
    className: 'bg-[var(--bg-hover)] text-text-secondary',
  },
  discontinued: {
    label: 'Eingestellt',
    className: 'bg-danger-subtle text-[var(--accent-danger)]',
  },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
