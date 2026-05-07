import { Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RecurringRule } from '../schemas';

const WEEKDAY_SHORT_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function recurringRuleLabel(rule: RecurringRule): string {
  if (rule.interval === 'daily') return 'Täglich';
  if (rule.interval === 'weekly') {
    return `Wöchentlich${rule.day !== undefined ? ` (${WEEKDAY_SHORT_LABELS[rule.day] ?? rule.day})` : ''}`;
  }
  return `Monatlich${rule.day ? ` (${rule.day}.)` : ''}`;
}

export function RecurringBadge({ rule }: { rule: RecurringRule }) {
  const label = recurringRuleLabel(rule);

  return (
    <Badge
      variant="outline"
      className="gap-1 border-pg-accent/40 bg-pg-accent-subtle text-pg-accent"
      title={`Wiederkehrend: ${label}`}
    >
      <Repeat className="size-3" />
      {label}
    </Badge>
  );
}
