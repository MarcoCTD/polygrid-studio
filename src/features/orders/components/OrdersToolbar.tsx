import { CalendarDays, ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OrderPlatform, OrderStatus } from '../types';

export interface OrdersFilterState {
  statuses: OrderStatus[];
  platforms: OrderPlatform[];
  month: string;
  showDeleted: boolean;
}

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'inquiry', label: 'Anfrage' },
  { value: 'ordered', label: 'Bestellt' },
  { value: 'paid', label: 'Bezahlt' },
  { value: 'in_production', label: 'Produktion' },
  { value: 'shipped', label: 'Versendet' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'issue', label: 'Problem' },
  { value: 'cancelled', label: 'Storniert' },
];

const PLATFORM_OPTIONS: { value: OrderPlatform; label: string }[] = [
  { value: 'etsy', label: 'Etsy' },
  { value: 'ebay', label: 'eBay' },
  { value: 'kleinanzeigen', label: 'Kleinanzeigen' },
  { value: 'direkt', label: 'Direkt' },
];

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

interface MultiFilterProps<T extends string> {
  label: string;
  values: T[];
  options: { value: T; label: string }[];
  onChange: (values: T[]) => void;
}

function MultiFilter<T extends string>({ label, values, options, onChange }: MultiFilterProps<T>) {
  const selectedLabel =
    values.length === 0
      ? 'Alle'
      : values.length === 1
        ? options.find((option) => option.value === values[0])?.label
        : `${values.length} ausgewählt`;

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        {label}: {selectedLabel}
        <ChevronDown className="ml-2 size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.includes(option.value)}
                onCheckedChange={() => onChange(toggleValue(values, option.value))}
              />
              {option.label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface OrdersToolbarProps {
  filters: OrdersFilterState;
  onFiltersChange: (filters: OrdersFilterState) => void;
}

export function OrdersToolbar({ filters, onFiltersChange }: OrdersToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-bg-secondary p-3">
      <MultiFilter
        label="Status"
        values={filters.statuses}
        options={STATUS_OPTIONS}
        onChange={(statuses) => onFiltersChange({ ...filters, statuses })}
      />
      <MultiFilter
        label="Plattform"
        values={filters.platforms}
        options={PLATFORM_OPTIONS}
        onChange={(platforms) => onFiltersChange({ ...filters, platforms })}
      />

      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-text-tertiary" />
        <input
          type="month"
          value={filters.month}
          onChange={(event) => onFiltersChange({ ...filters, month: event.target.value })}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          aria-label="Monat"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          title="Laufendes Jahr"
          onClick={() => onFiltersChange({ ...filters, month: '' })}
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>

      <Select
        value={filters.showDeleted ? 'deleted' : 'active'}
        onValueChange={(value) => onFiltersChange({ ...filters, showDeleted: value === 'deleted' })}
      >
        <SelectTrigger size="sm" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Aktive Aufträge</SelectItem>
          <SelectItem value="deleted">Gelöschte anzeigen</SelectItem>
        </SelectContent>
      </Select>

      <label className="ml-auto flex items-center gap-2 text-sm text-text-secondary">
        <Checkbox
          checked={filters.showDeleted}
          onCheckedChange={(checked) => onFiltersChange({ ...filters, showDeleted: checked })}
        />
        Gelöschte
      </label>
    </div>
  );
}
