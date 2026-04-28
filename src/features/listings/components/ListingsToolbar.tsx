import { CopyPlus, Eye, EyeOff, Filter, Plus, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { LISTING_STATUS_LABELS } from '../constants';
import type { ListingsFilterState } from '../listingsStore';
import type { CompletenessStatus, PlatformStatusFilter } from '../listingsService';
import type { InventoryMode, ListingStatus } from '../schemas';

const STATUS_OPTIONS: ListingStatus[] = ['draft', 'ready', 'online', 'paused', 'archived'];
const INVENTORY_OPTIONS: InventoryMode[] = ['made_to_order', 'stock'];
const LANGUAGE_OPTIONS: Array<'de' | 'en'> = ['de', 'en'];
const COMPLETENESS_OPTIONS: CompletenessStatus[] = ['green', 'yellow', 'red'];
const PLATFORM_STATUS_OPTIONS = [
  'etsy:synced',
  'etsy:pending',
  'etsy:error',
  'etsy:online',
  'etsy:draft',
  'ebay:synced',
  'ebay:pending',
  'ebay:error',
  'ebay:online',
  'ebay:draft',
  'kleinanzeigen:manual',
  'kleinanzeigen:online',
  'kleinanzeigen:draft',
  'kleinanzeigen:error',
] as const satisfies readonly PlatformStatusFilter[];
type PlatformStatusOption = (typeof PLATFORM_STATUS_OPTIONS)[number];

const INVENTORY_LABELS: Record<InventoryMode, string> = {
  made_to_order: 'Auf Bestellung',
  stock: 'Lagerbestand',
};

const COMPLETENESS_LABELS: Record<CompletenessStatus, string> = {
  green: 'Vollständig',
  yellow: 'Unvollständig',
  red: 'Fehlerhaft',
};

const PLATFORM_STATUS_LABELS: Record<PlatformStatusOption, string> = {
  'etsy:synced': 'Etsy synchronisiert',
  'etsy:pending': 'Etsy ausstehend',
  'etsy:error': 'Etsy Fehler',
  'etsy:online': 'Etsy online',
  'etsy:draft': 'Etsy Entwurf',
  'ebay:synced': 'eBay synchronisiert',
  'ebay:pending': 'eBay ausstehend',
  'ebay:error': 'eBay Fehler',
  'ebay:online': 'eBay online',
  'ebay:draft': 'eBay Entwurf',
  'kleinanzeigen:manual': 'KA manuell',
  'kleinanzeigen:online': 'KA online',
  'kleinanzeigen:draft': 'KA Entwurf',
  'kleinanzeigen:error': 'KA Fehler',
};

function platformStatusLabel(status: PlatformStatusFilter): string {
  return Object.prototype.hasOwnProperty.call(PLATFORM_STATUS_LABELS, status)
    ? PLATFORM_STATUS_LABELS[status as PlatformStatusOption]
    : status;
}

interface ListingsToolbarProps {
  filters: ListingsFilterState;
  totalCount: number;
  onSetFilter: <K extends keyof ListingsFilterState>(key: K, value: ListingsFilterState[K]) => void;
}

interface ActiveBadge {
  key: string;
  label: string;
  onRemove: () => void;
}

function toggleItem<T extends string>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}

export function ListingsToolbar({ filters, totalCount, onSetFilter }: ListingsToolbarProps) {
  const badges = buildBadges(filters, onSetFilter);
  const activeFilterCount = badges.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={filters.search}
            onChange={(event) => onSetFilter('search', event.target.value)}
            placeholder="Listings suchen..."
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
              <FilterGroup title="Status">
                {STATUS_OPTIONS.map((status) => (
                  <CheckboxOption
                    key={status}
                    label={LISTING_STATUS_LABELS[status]}
                    checked={filters.status.includes(status)}
                    onChange={() => onSetFilter('status', toggleItem(filters.status, status))}
                  />
                ))}
              </FilterGroup>

              <Separator />

              <FilterGroup title="Plattform-Status">
                {PLATFORM_STATUS_OPTIONS.map((status) => (
                  <CheckboxOption
                    key={status}
                    label={PLATFORM_STATUS_LABELS[status]}
                    checked={filters.platform_status.includes(status)}
                    onChange={() =>
                      onSetFilter('platform_status', toggleItem(filters.platform_status, status))
                    }
                  />
                ))}
              </FilterGroup>

              <Separator />

              <FilterGroup title="Inventory">
                {INVENTORY_OPTIONS.map((mode) => (
                  <CheckboxOption
                    key={mode}
                    label={INVENTORY_LABELS[mode]}
                    checked={filters.inventory_mode.includes(mode)}
                    onChange={() =>
                      onSetFilter('inventory_mode', toggleItem(filters.inventory_mode, mode))
                    }
                  />
                ))}
              </FilterGroup>

              <Separator />

              <FilterGroup title="Vollständigkeit">
                {COMPLETENESS_OPTIONS.map((completeness) => (
                  <CheckboxOption
                    key={completeness}
                    label={COMPLETENESS_LABELS[completeness]}
                    checked={filters.completeness.includes(completeness)}
                    onChange={() =>
                      onSetFilter('completeness', toggleItem(filters.completeness, completeness))
                    }
                  />
                ))}
              </FilterGroup>

              <Separator />

              <FilterGroup title="Sprache">
                {LANGUAGE_OPTIONS.map((language) => (
                  <CheckboxOption
                    key={language}
                    label={language.toUpperCase()}
                    checked={filters.language.includes(language)}
                    onChange={() => onSetFilter('language', toggleItem(filters.language, language))}
                  />
                ))}
              </FilterGroup>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSetFilter('showDeleted', !filters.showDeleted)}
          className="gap-1.5 text-text-secondary"
        >
          {filters.showDeleted ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{filters.showDeleted ? 'Gelöschte ausblenden' : 'Gelöschte anzeigen'}</span>
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled
            title="Kommt in Sub-Session 5.9"
            className="gap-1.5 text-text-secondary"
          >
            <Plus size={14} />
            <span>Neues Listing</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled
            title="Kommt in Sub-Session 5.9"
            className="gap-1.5 text-text-secondary"
          >
            <CopyPlus size={14} />
            <span>Aus Vorlage</span>
          </Button>
          <span className="text-xs text-text-muted">
            {totalCount} {totalCount === 1 ? 'Listing' : 'Listings'}
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

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-text-secondary">{title}</p>
      <div className="grid grid-cols-2 gap-1">{children}</div>
    </div>
  );
}

function CheckboxOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function buildBadges(
  filters: ListingsFilterState,
  setFilter: <K extends keyof ListingsFilterState>(key: K, value: ListingsFilterState[K]) => void,
): ActiveBadge[] {
  const badges: ActiveBadge[] = [];

  if (filters.search.trim()) {
    badges.push({
      key: 'search',
      label: `Suche: ${filters.search}`,
      onRemove: () => setFilter('search', ''),
    });
  }

  filters.status.forEach((status) => {
    badges.push({
      key: `status:${status}`,
      label: LISTING_STATUS_LABELS[status],
      onRemove: () =>
        setFilter(
          'status',
          filters.status.filter((item) => item !== status),
        ),
    });
  });

  filters.platform_status.forEach((status) => {
    badges.push({
      key: `platform:${status}`,
      label: platformStatusLabel(status),
      onRemove: () =>
        setFilter(
          'platform_status',
          filters.platform_status.filter((item) => item !== status),
        ),
    });
  });

  filters.inventory_mode.forEach((mode) => {
    badges.push({
      key: `inventory:${mode}`,
      label: INVENTORY_LABELS[mode],
      onRemove: () =>
        setFilter(
          'inventory_mode',
          filters.inventory_mode.filter((item) => item !== mode),
        ),
    });
  });

  filters.completeness.forEach((completeness) => {
    badges.push({
      key: `completeness:${completeness}`,
      label: COMPLETENESS_LABELS[completeness],
      onRemove: () =>
        setFilter(
          'completeness',
          filters.completeness.filter((item) => item !== completeness),
        ),
    });
  });

  filters.language.forEach((language) => {
    badges.push({
      key: `language:${language}`,
      label: language.toUpperCase(),
      onRemove: () =>
        setFilter(
          'language',
          filters.language.filter((item) => item !== language),
        ),
    });
  });

  if (filters.showDeleted) {
    badges.push({
      key: 'deleted',
      label: 'Gelöschte anzeigen',
      onRemove: () => setFilter('showDeleted', false),
    });
  }

  return badges;
}
