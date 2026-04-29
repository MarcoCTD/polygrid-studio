import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompletenessResult, CompletenessStatus } from '../../listingsService';

interface PreviewDiagnosticsProps {
  completeness: CompletenessResult;
  counters: Array<{ label: string; value: string; isOverLimit?: boolean }>;
}

export function PreviewDiagnostics({ completeness, counters }: PreviewDiagnosticsProps) {
  return (
    <div className="grid gap-4 rounded-lg border border-border-subtle bg-bg-primary p-4 dark:border-transparent md:grid-cols-[220px_1fr_240px]">
      <div className="flex items-center gap-2">
        <Circle className={cn('size-3 fill-current', completenessClass(completeness.status))} />
        <span className="text-sm font-medium text-text-primary">
          Vollständigkeit: {completenessLabel(completeness.status)}
        </span>
      </div>
      <ul className="space-y-1 text-sm text-text-secondary">
        {completeness.hints.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ul>
      <div className="space-y-1 text-sm">
        {counters.map((counter) => (
          <p
            key={counter.label}
            className={counter.isOverLimit ? 'text-danger' : 'text-text-secondary'}
          >
            {counter.label}: {counter.value}
          </p>
        ))}
      </div>
    </div>
  );
}

function completenessClass(status: CompletenessStatus): string {
  if (status === 'green') return 'text-emerald-500';
  if (status === 'yellow') return 'text-amber-500';
  return 'text-red-500';
}

function completenessLabel(status: CompletenessStatus): string {
  if (status === 'green') return 'grün';
  if (status === 'yellow') return 'gelb';
  return 'rot';
}
