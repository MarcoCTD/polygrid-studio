import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { Task } from '../schemas';
import { formatISODate, isToday } from '../utils/dateHelpers';
import { QuickAddInput } from './QuickAddInput';
import { TaskCard } from './TaskCard';

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

interface WeekColumnProps {
  id: string;
  title?: string;
  date?: Date;
  tasks: Task[];
  isUnscheduled?: boolean;
  onCompleteTask: (taskId: string) => void;
  onOpenTask: (task: Task) => void;
  onTaskCreated: () => void;
}

function formatDisplayDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
}

export function WeekColumn({
  id,
  title,
  date,
  tasks,
  isUnscheduled = false,
  onCompleteTask,
  onOpenTask,
  onTaskCreated,
}: WeekColumnProps) {
  const today = date ? isToday(date) : false;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { dueDate: date ? formatISODate(date) : null },
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex min-h-[calc(100vh-230px)] flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-secondary',
        today && 'border-t-[3px] border-t-pg-accent',
        isOver && 'border-pg-accent bg-pg-accent-subtle/40',
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

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {tasks.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border-subtle px-2 text-center text-xs text-text-muted">
              Keine Aufgaben
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onCompleteTask={onCompleteTask}
                onOpenTask={onOpenTask}
              />
            ))
          )}
        </div>
        <div className="border-t border-border-subtle p-2">
          <QuickAddInput
            dueDate={date ? formatISODate(date) : undefined}
            onCreated={onTaskCreated}
          />
        </div>
      </div>
    </section>
  );
}
