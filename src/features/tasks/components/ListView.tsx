import { ListChecks } from 'lucide-react';

export function ListView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-subtle bg-bg-elevated p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-bg-secondary text-text-muted">
        <ListChecks className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">
          Listenansicht folgt in Sub-Session D.
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Die Wochenansicht ist in dieser Sub-Session die aktive Arbeitsansicht.
        </p>
      </div>
    </div>
  );
}
