import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  KLEINUNTERNEHMER_GRENZE_LAUFEND_EUR,
  type KleinunternehmerStatus,
} from '../services/euerYear';
import { getKleinunternehmerStatusCurrentYear } from '../services/euerYearService';

const AMPEL_BAR_CLASSES: Record<KleinunternehmerStatus['ampel'], string> = {
  gruen: 'bg-emerald-500',
  gelb: 'bg-amber-500',
  rot: 'bg-red-500',
};

const AMPEL_TEXT_CLASSES: Record<KleinunternehmerStatus['ampel'], string> = {
  gruen: 'text-emerald-600 dark:text-emerald-400',
  gelb: 'text-amber-600 dark:text-amber-400',
  rot: 'text-red-600 dark:text-red-400',
};

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

/**
 * Kleinunternehmergrenzen-Widget (Spec 2.4): laufender Jahresumsatz gegen die
 * 25.000-EUR-Vorjahresgrenze, Ampel grün/gelb/rot. Wird auf der
 * Steuer-Export-Seite und als Dashboard-Karte eingebunden.
 */
export function KleinunternehmerGrenzeCard() {
  const [status, setStatus] = useState<KleinunternehmerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      getKleinunternehmerStatusCurrentYear()
        .then((result) => {
          if (!cancelled) setStatus(result);
        })
        .catch((error) => {
          if (!cancelled) {
            toast.error(
              error instanceof Error
                ? error.message
                : 'Kleinunternehmergrenze konnte nicht geladen werden',
            );
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  const year = new Date().getFullYear();
  const barWidth = status ? Math.min(status.percent, 100) : 0;

  return (
    <section
      data-testid="kleinunternehmer-widget"
      data-ampel={status?.ampel ?? 'unbekannt'}
      className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent dark:shadow-md"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text-primary">Kleinunternehmergrenze {year}</h2>
        {status ? (
          <span className={`text-sm font-semibold ${AMPEL_TEXT_CLASSES[status.ampel]}`}>
            {status.percent.toLocaleString('de-DE')} %
          </span>
        ) : null}
      </header>

      {isLoading || !status ? (
        <p className="text-sm text-text-secondary">Wird geladen …</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{formatEUR(status.revenue)}</span> von{' '}
            {formatEUR(status.limit)} Jahresumsatz
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
            <div
              className={`h-full rounded-full transition-all ${AMPEL_BAR_CLASSES[status.ampel]}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          {status.ampel === 'rot' ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Grenze überschritten – Steuerberater kontaktieren, Regelbesteuerung droht ab
              Folgejahr.
            </p>
          ) : (
            <p className="text-xs text-text-tertiary">
              §19 UStG, Stand 2025: {formatEUR(status.limit)} Vorjahresgrenze,{' '}
              {formatEUR(KLEINUNTERNEHMER_GRENZE_LAUFEND_EUR)} laufende Grenze.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
