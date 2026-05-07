import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Task } from '../schemas';
import { isToday, isOverdue } from '../utils/dateHelpers';
import { PriorityBadge } from './PriorityBadge';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

interface WeekColumnProps {
  title?: string;
  date?: Date;
  tasks: Task[];
  isUnscheduled?: boolean;
  onCompleteTask: (taskId: string) => void;
}

function formatDisplayDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
}

export function WeekColumn({
  title,
  date,
  tasks,
  isUnscheduled = false,
  onCompleteTask,
}: WeekColumnProps) {
  const today = date ? isToday(date) : false;

  return (
    <section
      className={cn(
        'flex min-h-[calc(100vh-230px)] flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-secondary',
        today && 'border-t-[3px] border-t-pg-accent',
      )}
    >
      <header className="border-b border-border-subtle px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              {isUnscheduled ? 'Ungeplant' : WEEKDAY_LABELS[date?.getDay() ?? 1]}
            </h2>
            <p className="text-xs text-text-muted">
              {isUnscheduled ? 'Ohne Fälligkeit' : date ? formatDisplayDate(date) : title}
            </p>
          </div>
          <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
            {tasks.length}
          </span>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {tasks.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border-subtle px-2 text-center text-xs text-text-muted">
            Keine Aufgaben
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onCompleteTask={onCompleteTask} />
          ))
        )}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  onCompleteTask,
}: {
  task: Task;
  onCompleteTask: (taskId: string) => void;
}) {
  const done = task.status === 'done';
  const overdue = isOverdue(task.due_date, task.status);

  return (
    <article
      className={cn(
        'min-h-[60px] rounded-lg border border-border-subtle bg-bg-elevated p-2 shadow-sm transition hover:border-pg-accent/40',
        done && 'opacity-60',
        overdue && 'border-l-4 border-l-danger',
      )}
      title={task.title}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={done}
          disabled={done || task.status === 'cancelled'}
          aria-label={`Aufgabe ${task.title} erledigen`}
          onCheckedChange={() => {
            if (!done && task.status !== 'cancelled') {
              onCompleteTask(task.id);
            }
          }}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p
            className={cn(
              'line-clamp-2 text-sm font-medium text-text-primary',
              done && 'line-through',
            )}
          >
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={task.priority} />
            {overdue ? (
              <Badge variant="outline" className="border-danger bg-danger-subtle text-danger">
                Überfällig {task.due_date ? formatDisplayDate(parseTaskDate(task.due_date)) : ''}
              </Badge>
            ) : null}
            {task.recurring_rule ? (
              <Badge variant="outline" className="border-border-subtle text-text-muted">
                Wiederkehrend
              </Badge>
            ) : null}
            {done ? <CheckCircle2 className="size-4 text-success" /> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function parseTaskDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}
