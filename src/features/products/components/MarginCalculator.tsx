import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Product, Platform } from '../schema';
import type { ProductSettings } from '../defaults';
import { calculateMargin, getMarginColor, getMarginLabel, type MarginResult } from '../margin';
import { getProductSettings } from '../settings';
import { formatEUR } from '../utils';

interface MarginCalculatorProps {
  product: Product;
}

type PlatformToggle = 'all' | Platform;

const PLATFORM_OPTIONS: { value: PlatformToggle; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'etsy', label: 'Etsy' },
  { value: 'ebay', label: 'eBay' },
  { value: 'kleinanzeigen', label: 'Kleinanzeigen' },
];

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="tabular-nums">{formatEUR(value)}</span>
    </div>
  );
}

function MarginDisplay({ result }: { result: MarginResult }) {
  const color = getMarginColor(result.marginPercent);
  const label = getMarginLabel(result.marginPercent);

  const colorMap: Record<typeof color, string> = {
    success: 'text-[var(--accent-success)]',
    warning: 'text-[var(--accent-warning)]',
    danger: 'text-[var(--accent-danger)]',
  };

  const bgMap: Record<typeof color, string> = {
    success: 'bg-success-subtle',
    warning: 'bg-warning-subtle',
    danger: 'bg-danger-subtle',
  };

  return (
    <div className={cn('flex items-center justify-between rounded-lg p-4', bgMap[color])}>
      <div>
        <p className="text-sm font-medium text-text-primary">Marge</p>
        <p className={cn('text-2xl font-bold tabular-nums', colorMap[color])}>
          {result.marginPercent.toFixed(1)}%
        </p>
        <p className={cn('text-xs font-medium', colorMap[color])}>{label}</p>
      </div>
      <div className="text-right">
        <p className="text-sm text-text-secondary">Rohgewinn</p>
        <p className={cn('text-lg font-semibold tabular-nums', colorMap[color])}>
          {formatEUR(result.profit)}
        </p>
      </div>
    </div>
  );
}

export function MarginCalculator({ product }: MarginCalculatorProps) {
  const [settings, setSettings] = useState<ProductSettings | null>(null);
  const [activePlatform, setActivePlatform] = useState<PlatformToggle>('all');

  useEffect(() => {
    getProductSettings().then(setSettings).catch(console.error);
  }, []);

  const result = useMemo<MarginResult | null>(() => {
    if (!settings) return null;
    const platform = activePlatform === 'all' ? null : activePlatform;
    return calculateMargin(product, settings, platform);
  }, [product, settings, activePlatform]);

  if (!settings || !result) {
    return (
      <div className="flex h-32 items-center justify-center text-text-muted">
        Einstellungen werden geladen...
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Platform Toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-bg-secondary p-1 dark:bg-bg-elevated-1">
        {PLATFORM_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActivePlatform(opt.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activePlatform === opt.value
                ? 'bg-bg-elevated text-text-primary shadow-sm dark:bg-bg-elevated-2'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Margin Display */}
      <MarginDisplay result={result} />

      {/* Cost Breakdown */}
      <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4 dark:border-transparent dark:shadow-md">
        <h3 className="mb-3 text-sm font-medium text-text-primary">Kostenaufstellung</h3>

        <div className="divide-y divide-border-subtle dark:divide-transparent">
          <CostRow label="Verkaufspreis" value={result.sellingPrice} />
          <div className="py-2">
            <CostRow label="Materialkosten" value={result.materialCost} />
            <CostRow label="Stromkosten" value={result.electricityCost} />
            <CostRow label="Verpackung" value={result.packagingCost} />
            <CostRow label="Versand" value={result.shippingCost} />
            <CostRow label="Plattformgebühr" value={result.platformFee} />
          </div>
          <div className="flex items-center justify-between py-2 text-sm font-medium">
            <span>Gesamtkosten</span>
            <span className="tabular-nums">{formatEUR(result.totalCost)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
