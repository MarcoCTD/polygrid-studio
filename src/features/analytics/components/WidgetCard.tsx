import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface WidgetCardProps {
  title: string;
  viewAllTo?: string;
  children: ReactNode;
  isEmpty?: boolean;
  emptyMessage: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export function WidgetCard({
  title,
  viewAllTo,
  children,
  isEmpty = false,
  emptyMessage,
  ctaLabel,
  onCtaClick,
}: WidgetCardProps) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent dark:shadow-md">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {viewAllTo ? (
          <Link to={viewAllTo} className="text-xs font-medium text-pg-accent hover:underline">
            Alle anzeigen →
          </Link>
        ) : null}
      </header>

      {isEmpty ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-subtle bg-bg-secondary px-4 py-6 text-center">
          <p className="text-sm text-text-secondary">{emptyMessage}</p>
          {ctaLabel && onCtaClick ? (
            <Button type="button" variant="outline" size="sm" onClick={onCtaClick}>
              {ctaLabel}
            </Button>
          ) : null}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
