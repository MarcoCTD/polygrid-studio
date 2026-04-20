import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Search, Filter, X, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useProductsUIStore } from '../productsUiStore';
import { statusEnum, platformEnum, licenseRiskEnum } from '../schema';
import type { Status, Platform, LicenseRisk } from '../schema';

// ============================================================
// Label Maps
// ============================================================

const STATUS_LABELS: Record<Status, string> = {
  idea: 'Idee',
  review: 'Review',
  print_ready: 'Druckbereit',
  test_print: 'Testdruck',
  launch_ready: 'Startbereit',
  online: 'Online',
  paused: 'Pausiert',
  discontinued: 'Eingestellt',
};

const PLATFORM_LABELS: Record<Platform, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'Kleinanzeigen',
};

const LICENSE_RISK_LABELS: Record<LicenseRisk, string> = {
  safe: 'Sicher',
  review_needed: 'Prüfung nötig',
  risky: 'Riskant',
};

// ============================================================
// Multi-Select Group
// ============================================================

function MultiSelectGroup<T extends string>({
  label,
  options,
  labels,
  selected,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  const toggle = (value: T) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-text-secondary">{label}</p>
      <div className="flex flex-col gap-1">
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} />
            <span>{labels[opt]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Margin Range Inputs
// ============================================================

function MarginRange() {
  const { filters, setMarginMin, setMarginMax } = useProductsUIStore();

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-text-secondary">Marge (%)</p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="Min"
          value={filters.marginMin ?? ''}
          onChange={(e) => setMarginMin(e.target.value ? Number(e.target.value) : undefined)}
          className="w-20"
        />
        <span className="text-text-muted">–</span>
        <Input
          type="number"
          placeholder="Max"
          value={filters.marginMax ?? ''}
          onChange={(e) => setMarginMax(e.target.value ? Number(e.target.value) : undefined)}
          className="w-20"
        />
      </div>
    </div>
  );
}

// ============================================================
// Active Filter Badges
// ============================================================

function ActiveFilterBadges() {
  const {
    filters,
    setStatus,
    setCategory,
    setPlatforms,
    setLicenseRisk,
    setMarginMin,
    setMarginMax,
  } = useProductsUIStore();

  const badges: { key: string; label: string; onRemove: () => void }[] = [];

  filters.status.forEach((s) => {
    badges.push({
      key: `status-${s}`,
      label: `Status: ${STATUS_LABELS[s]}`,
      onRemove: () => setStatus(filters.status.filter((v) => v !== s)),
    });
  });

  filters.category.forEach((c) => {
    badges.push({
      key: `cat-${c}`,
      label: `Kategorie: ${c}`,
      onRemove: () => setCategory(filters.category.filter((v) => v !== c)),
    });
  });

  filters.platforms.forEach((p) => {
    badges.push({
      key: `plat-${p}`,
      label: `Plattform: ${PLATFORM_LABELS[p]}`,
      onRemove: () => setPlatforms(filters.platforms.filter((v) => v !== p)),
    });
  });

  filters.licenseRisk.forEach((r) => {
    badges.push({
      key: `risk-${r}`,
      label: `Risiko: ${LICENSE_RISK_LABELS[r]}`,
      onRemove: () => setLicenseRisk(filters.licenseRisk.filter((v) => v !== r)),
    });
  });

  if (filters.marginMin !== undefined) {
    badges.push({
      key: 'margin-min',
      label: `Marge ≥ ${filters.marginMin}%`,
      onRemove: () => setMarginMin(undefined),
    });
  }

  if (filters.marginMax !== undefined) {
    badges.push({
      key: 'margin-max',
      label: `Marge ≤ ${filters.marginMax}%`,
      onRemove: () => setMarginMax(undefined),
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges.map((b) => (
        <Badge key={b.key} variant="secondary" className="gap-1 pr-1">
          {b.label}
          <button
            onClick={b.onRemove}
            className="ml-0.5 rounded-full p-0.5 hover:bg-bg-hover"
            aria-label={`Filter entfernen: ${b.label}`}
          >
            <X size={12} />
          </button>
        </Badge>
      ))}
    </div>
  );
}

// ============================================================
// Categories (extracted from data)
// ============================================================

interface ProductsToolbarProps {
  categories: string[];
  totalCount: number;
  onNewProduct: () => void;
}

export function ProductsToolbar({ categories, totalCount, onNewProduct }: ProductsToolbarProps) {
  const navigate = useNavigate();
  const {
    filters,
    setSearch,
    setStatus,
    setCategory,
    setPlatforms,
    setLicenseRisk,
    setIncludeDeleted,
    resetFilters,
    hasActiveFilters,
  } = useProductsUIStore();

  // Debounced search
  const [searchInput, setSearchInput] = useState(filters.search);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setSearch(value);
      }, 300);
    },
    [setSearch],
  );

  useEffect(() => {
    return () => clearTimeout(debounceTimer.current);
  }, []);

  const activeFilterCount =
    filters.status.length +
    filters.category.length +
    filters.platforms.length +
    filters.licenseRisk.length +
    (filters.marginMin !== undefined ? 1 : 0) +
    (filters.marginMax !== undefined ? 1 : 0);

  return (
    <div className="flex flex-col gap-2">
      {/* Main toolbar row */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative w-64">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            placeholder="Produkte suchen..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Filter Popover */}
        <Popover>
          <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-bg-hover">
            <Filter size={14} />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-pg-accent text-[10px] font-medium text-white">
                {activeFilterCount}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <div className="flex flex-col gap-3">
              <MultiSelectGroup
                label="Status"
                options={statusEnum.options}
                labels={STATUS_LABELS}
                selected={filters.status}
                onChange={setStatus}
              />

              <Separator />

              <MultiSelectGroup
                label="Kategorie"
                options={categories as unknown as readonly string[]}
                labels={Object.fromEntries(categories.map((c) => [c, c])) as Record<string, string>}
                selected={filters.category}
                onChange={setCategory}
              />

              <Separator />

              <MultiSelectGroup
                label="Plattformen"
                options={platformEnum.options}
                labels={PLATFORM_LABELS}
                selected={filters.platforms}
                onChange={setPlatforms}
              />

              <Separator />

              <MultiSelectGroup
                label="Lizenz-Risiko"
                options={licenseRiskEnum.options}
                labels={LICENSE_RISK_LABELS}
                selected={filters.licenseRisk}
                onChange={setLicenseRisk}
              />

              <Separator />

              <MarginRange />

              {hasActiveFilters() && (
                <>
                  <Separator />
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="self-start">
                    Alle Filter zurücksetzen
                  </Button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Soft-Delete Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIncludeDeleted(!filters.includeDeleted)}
          className="gap-1.5 text-text-secondary"
        >
          {filters.includeDeleted ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{filters.includeDeleted ? 'Gelöschte ausblenden' : 'Gelöschte anzeigen'}</span>
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {/* Trash */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/products/trash' })}
            className="gap-1.5 text-text-secondary"
          >
            <Trash2 size={14} />
            <span>Papierkorb</span>
          </Button>

          {/* New Product */}
          <Button size="sm" onClick={onNewProduct} className="gap-1.5">
            <Plus size={14} />
            <span>Neues Produkt</span>
          </Button>

          {/* Count */}
          <span className="text-xs text-text-muted">
            {totalCount} {totalCount === 1 ? 'Produkt' : 'Produkte'}
          </span>
        </div>
      </div>

      {/* Active filter badges */}
      <ActiveFilterBadges />
    </div>
  );
}
