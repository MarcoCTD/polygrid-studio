import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Task } from '../schemas';
import {
  completeTask,
  getOverdueTasks,
  getTasksByDateRange,
  getUnscheduledTasks,
} from '../services';
import { formatISODate, isOverdue } from '../utils/dateHelpers';
import { WeekColumn } from './WeekColumn';

interface WeekViewProps {
  weekDates: Date[];
  isCurrentWeek: boolean;
}

function uniqueTasks(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

export function WeekView({ weekDates, isCurrentWeek }: WeekViewProps) {
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const weekStart = formatISODate(weekDates[0]);
  const weekEnd = formatISODate(weekDates[6]);
  const today = formatISODate(new Date());

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const [scheduled, unscheduled, overdue] = await Promise.all([
        getTasksByDateRange(weekStart, weekEnd),
        getUnscheduledTasks(),
        isCurrentWeek ? getOverdueTasks() : Promise.resolve([]),
      ]);

      setScheduledTasks(scheduled);
      setUnscheduledTasks(unscheduled);
      setOverdueTasks(overdue);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aufgaben konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }, [isCurrentWeek, weekEnd, weekStart]);

  useEffect(() => {
    // Loading tasks from SQLite is this component's external synchronization point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTasks();
  }, [loadTasks]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();

    for (const task of scheduledTasks) {
      if (!task.due_date) continue;
      if (isCurrentWeek && task.due_date < today && isOverdue(task.due_date, task.status)) {
        continue;
      }
      map.set(task.due_date, [...(map.get(task.due_date) ?? []), task]);
    }

    if (isCurrentWeek) {
      map.set(today, uniqueTasks([...(map.get(today) ?? []), ...overdueTasks]));
    }

    return map;
  }, [isCurrentWeek, overdueTasks, scheduledTasks, today]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated text-sm text-text-muted">
        Aufgaben werden geladen...
      </div>
    );
  }

  return (
    <div className="min-w-[900px] flex-1 overflow-x-auto">
      <div className="grid min-h-full grid-cols-[200px_repeat(7,minmax(120px,1fr))] gap-3">
        <WeekColumn
          isUnscheduled
          tasks={unscheduledTasks}
          onCompleteTask={(taskId) => void handleComplete(taskId, loadTasks)}
        />
        {weekDates.map((date) => {
          const isoDate = formatISODate(date);
          return (
            <WeekColumn
              key={isoDate}
              date={date}
              tasks={tasksByDate.get(isoDate) ?? []}
              onCompleteTask={(taskId) => void handleComplete(taskId, loadTasks)}
            />
          );
        })}
      </div>
    </div>
  );
}

async function handleComplete(taskId: string, onChanged: () => Promise<void>) {
  try {
    await completeTask(taskId);
    await onChanged();
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Aufgabe konnte nicht abgeschlossen werden',
    );
  }
}
