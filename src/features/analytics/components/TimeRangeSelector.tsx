import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TimeRange, TimeRangePreset } from '../types';
import { resolveTimeRange } from '../utils';

interface TimeRangeSelectorProps {
  value: TimeRangePreset;
  allTimeStartDate: string | null;
  onChange: (range: TimeRange) => void;
}

const OPTIONS: Array<{ value: TimeRangePreset; label: string }> = [
  { value: 'current_month', label: 'Aktueller Monat' },
  { value: 'last_month', label: 'Letzter Monat' },
  { value: 'last_3_months', label: 'Letzte 3 Monate' },
  { value: 'last_6_months', label: 'Letzte 6 Monate' },
  { value: 'current_year', label: 'Laufendes Jahr' },
  { value: 'all_time', label: 'Gesamtzeitraum' },
];

export function TimeRangeSelector({ value, allTimeStartDate, onChange }: TimeRangeSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) =>
        onChange(resolveTimeRange(nextValue as TimeRangePreset, allTimeStartDate))
      }
    >
      <SelectTrigger className="w-full sm:w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
