import { Badge } from '@/components/ui/badge';
import type { TaskPriority } from '../schemas';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  urgent: 'border-danger bg-danger text-white',
  high: 'border-warning bg-warning text-white',
  medium: 'border-pg-accent text-pg-accent',
  low: 'border-border-subtle text-text-muted',
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant="outline" className={PRIORITY_CLASSES[priority]}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
