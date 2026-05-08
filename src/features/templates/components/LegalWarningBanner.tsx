import { AlertTriangle } from 'lucide-react';

export function LegalWarningBanner() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2 text-sm text-warning">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>Dies ist ein Rechtstext. Nicht als juristisch geprüft verwenden.</p>
    </div>
  );
}
