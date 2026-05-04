import { useCallback } from 'react';
import { Download, Eye, EyeOff, Filter, Search, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '../constants';
import type { ExpensePeriod } from '../utils';

export interface ExpensesFilterState {
  search: string;
  categories: ExpenseCategory[];
  taxRelevant: 'all' | 'yes' | 'no';
  period: ExpensePeriod;
  customFrom: string;
  customTo: string;
  includeDeleted: boolean;
}

const TAX_RELEVANT_LABELS: Record<ExpensesFilterState['taxRelevant'], string> = {
  all: 'Alle',
  yes: 'Ja',
  no: 'Nein',
};

const PERIOD_LABELS: Record<ExpensePeriod, string> = {
  current_month: 'Dieser Monat',
  previous_month: 'Letzter Monat',
  current_year: 'Dieses Jahr',
  custom: 'Benutzerdefiniert',
};

interface ExpensesToolbarProps {
  filters: ExpensesFilterState;
  totalCount: number;
  isExporting: boolean;
  onFiltersChange: (filters: ExpensesFilterState) => void;
  onExport: () => void;
  onImport: () => void;
}

interface ActiveBadge {
  key: string;
  label: string;
  onRemove: () => void;
}

export function ExpensesToolbar({
  filters,
  totalCount,
  isExporting,
  onFiltersChange,
  onExport,
  onImport,
}: ExpensesToolbarProps) {
  const patchFilters = useCallback(
    (patch: Partial<ExpensesFilterState>) => {
      onFiltersChange({ ...filters, ...patch });
    },
    [filters, onFiltersChange],
  );

  function toggleCategory(category: ExpenseCategory) {
    patchFilters({
      categories: filters.categories.includes(category)
        ? filters.categories.filter((item) => item !== category)
        : [...filters.categories, category],
    });
  }

  const badges = buildBadges(filters, patchFilters);
  const activeFilterCount =
    filters.categories.length +
    (filters.taxRelevant !== 'all' ? 1 : 0) +
    (filters.period !== 'current_month' ? 1 : 0) +
    (filters.includeDeleted ? 1 : 0) +
    (filters.search.trim() ? 1 : 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            placeholder="Ausgaben suchen..."
            value={filters.search}
            onChange={(event) => patchFilters({ search: event.target.value })}
            className="pl-8"
          />
        </div>

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
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-secondary">Kategorie</p>
                <div className="grid grid-cols-2 gap-1">
                  {EXPENSE_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={filters.categories.includes(category)}
                        onCheckedChange={() => toggleCategory(category)}
                      />
                      <span>{EXPENSE_CATEGORY_LABELS[category]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-1.5 text-xs font-medium text-text-secondary">Steuerrelevant</p>
                <Select
                  value={filters.taxRelevant}
                  onValueChange={(value) => {
                    if (value) {
                      patchFilters({ taxRelevant: value as ExpensesFilterState['taxRelevant'] });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{TAX_RELEVANT_LABELS[filters.taxRelevant]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="yes">Ja</SelectItem>
                    <SelectItem value="no">Nein</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <p className="mb-1.5 text-xs font-medium text-text-secondary">Zeitraum</p>
                <Select
                  value={filters.period}
                  onValueChange={(value) => {
                    if (value) {
                      patchFilters({ period: value as ExpensePeriod });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{PERIOD_LABELS[filters.period]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_month">Dieser Monat</SelectItem>
                    <SelectItem value="previous_month">Letzter Monat</SelectItem>
                    <SelectItem value="current_year">Dieses Jahr</SelectItem>
                    <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                  </SelectContent>
                </Select>

                {filters.period === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={filters.customFrom}
                      onChange={(event) => patchFilters({ customFrom: event.target.value })}
                      aria-label="Zeitraum von"
                    />
                    <Input
                      type="date"
                      value={filters.customTo}
                      onChange={(event) => patchFilters({ customTo: event.target.value })}
                      aria-label="Zeitraum bis"
                    />
                  </div>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => patchFilters({ includeDeleted: !filters.includeDeleted })}
          className="gap-1.5 text-text-secondary"
        >
          {filters.includeDeleted ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{filters.includeDeleted ? 'Gelöschte ausblenden' : 'Gelöschte anzeigen'}</span>
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onImport}
            className="gap-1.5 text-text-secondary"
          >
            <Upload size={14} />
            <span>Ausgaben importieren</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isExporting}
            onClick={onExport}
            className="gap-1.5 text-text-secondary"
          >
            <Download size={14} />
            <span>{isExporting ? 'Export läuft...' : 'Ausgaben exportieren'}</span>
          </Button>
          <span className="text-xs text-text-muted">
            {totalCount} {totalCount === 1 ? 'Ausgabe' : 'Ausgaben'}
          </span>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {badges.map((badge) => (
            <Badge key={badge.key} variant="secondary" className="gap-1 pr-1">
              {badge.label}
              <button
                type="button"
                onClick={badge.onRemove}
                className="ml-0.5 rounded-full p-0.5 hover:bg-bg-hover"
                aria-label={`Filter entfernen: ${badge.label}`}
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function buildBadges(
  filters: ExpensesFilterState,
  patchFilters: (patch: Partial<ExpensesFilterState>) => void,
): ActiveBadge[] {
  const badges: ActiveBadge[] = [];

  if (filters.search.trim()) {
    badges.push({
      key: 'search',
      label: `Suche: ${filters.search}`,
      onRemove: () => patchFilters({ search: '' }),
    });
  }

  filters.categories.forEach((category) => {
    badges.push({
      key: `category-${category}`,
      label: `Kategorie: ${EXPENSE_CATEGORY_LABELS[category]}`,
      onRemove: () =>
        patchFilters({ categories: filters.categories.filter((item) => item !== category) }),
    });
  });

  if (filters.taxRelevant !== 'all') {
    badges.push({
      key: 'taxRelevant',
      label: `Steuerrelevant: ${filters.taxRelevant === 'yes' ? 'Ja' : 'Nein'}`,
      onRemove: () => patchFilters({ taxRelevant: 'all' }),
    });
  }

  if (filters.period !== 'current_month') {
    const labels: Record<ExpensePeriod, string> = {
      current_month: 'Dieser Monat',
      previous_month: 'Letzter Monat',
      current_year: 'Dieses Jahr',
      custom: 'Benutzerdefiniert',
    };
    badges.push({
      key: 'period',
      label: `Zeitraum: ${labels[filters.period]}`,
      onRemove: () => patchFilters({ period: 'current_month', customFrom: '', customTo: '' }),
    });
  }

  if (filters.includeDeleted) {
    badges.push({
      key: 'deleted',
      label: 'Gelöschte anzeigen',
      onRemove: () => patchFilters({ includeDeleted: false }),
    });
  }

  return badges;
}
