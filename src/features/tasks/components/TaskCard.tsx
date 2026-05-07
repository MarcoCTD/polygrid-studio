import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle2, FileText, Package, ReceiptText, Tag } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Task } from '../schemas';
import { isOverdue, parseISODate } from '../utils/dateHelpers';
import { PriorityBadge } from './PriorityBadge';
import { RecurringBadge } from './RecurringBadge';

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  onToggleTask?: (task: Task) => void;
  onOpenTask?: (task: Task) => void;
}

function formatDisplayDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
}

function isCheckboxEvent(event: MouseEvent<HTMLElement>): boolean {
  return event.target instanceof Element && Boolean(event.target.closest('[data-task-checkbox]'));
}

export function TaskCard({ task, isOverlay = false, onToggleTask, onOpenTask }: TaskCardProps) {
  const done = task.status === 'done';
  const cancelled = task.status === 'cancelled';
  const draggable = !done && !cancelled && !isOverlay;
  const overdue = isOverdue(task.due_date, task.status);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
    data: { task },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'min-h-[60px] rounded-lg border border-border-subtle bg-bg-elevated p-2 text-left shadow-sm transition hover:border-pg-accent/40',
        'overflow-hidden',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'z-50 opacity-80 shadow-lg',
        done && 'opacity-50',
        cancelled && 'opacity-60',
        overdue && 'border-l-[3px] border-l-danger',
        isOverlay && 'w-56 rotate-1 shadow-lg',
      )}
      title={task.title}
      {...attributes}
      {...listeners}
      onClick={(event) => {
        if (isCheckboxEvent(event)) return;
        onOpenTask?.(task);
      }}
    >
      <div className="flex items-start gap-2">
        <span
          data-task-checkbox
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={done}
            disabled={cancelled}
            aria-label={`Aufgabe ${task.title} erledigt umschalten`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onCheckedChange={() => {
              if (!cancelled) {
                onToggleTask?.(task);
              }
            }}
          />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p
            className={cn(
              'line-clamp-2 text-sm font-medium text-text-primary',
              done && 'line-through',
            )}
          >
            {task.title}
          </p>
          <div className="flex max-w-full flex-wrap items-center gap-1.5 overflow-hidden">
            <PriorityBadge priority={task.priority} />
            <EntityIcon task={task} />
            {overdue ? (
              <Badge variant="outline" className="border-danger bg-danger-subtle text-danger">
                Überfällig seit{' '}
                {task.due_date ? formatDisplayDate(parseISODate(task.due_date)) : ''}
              </Badge>
            ) : null}
            {task.recurring_rule ? <RecurringBadge rule={task.recurring_rule} /> : null}
            {done ? <CheckCircle2 className="size-4 text-success" /> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function EntityIcon({ task }: { task: Task }) {
  if (task.product_id) return <Package className="size-3.5 text-text-muted" aria-label="Produkt" />;
  if (task.order_id)
    return <ReceiptText className="size-3.5 text-text-muted" aria-label="Auftrag" />;
  if (task.listing_id) return <Tag className="size-3.5 text-text-muted" aria-label="Listing" />;
  return <FileText className="size-3.5 text-text-muted" aria-label="Keine Verknüpfung" />;
}
