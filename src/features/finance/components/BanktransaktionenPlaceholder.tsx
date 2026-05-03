import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BanktransaktionenPlaceholder() {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-border-subtle bg-bg-secondary p-8 text-center">
      <div>
        <p className="text-base font-semibold text-text-primary">
          N26-Bankimport wird in Sub-Session 8.6 implementiert.
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          Der Import, das Auto-Matching und die Match-Workbench folgen in der nächsten Session.
        </p>
        <Button className="mt-4 gap-2" disabled title="Kommt in Sub-Session 8.6">
          <Upload className="size-4" />
          CSV importieren
        </Button>
      </div>
    </div>
  );
}
