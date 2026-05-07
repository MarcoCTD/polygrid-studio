import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import type { Task } from '../schemas';
import {
  completeTask,
  getOverdueTasks,
  getTasksByDateRange,
  getUnscheduledTasks,
  updateTask,
} from '../services';
import { formatISODate, isOverdue } from '../utils/dateHelpers';
import { TaskCard } from './TaskCard';
import { WeekColumn } from './WeekColumn';

interface WeekViewProps {
  weekDates: Date[];
  isCurrentWeek: boolean;
}

const UNSCHEDULED_COLUMN_ID = 'tasks-column-unscheduled';

function dayColumnId(date: string): string {
  return `tasks-column-${date}`;
}

function columnDateFromId(id: string): string | null | undefined {
  if (id === UNSCHEDULED_COLUMN_ID) return null;
  if (id.startsWith('tasks-column-')) return id.replace('tasks-column-', '');
  return undefined;
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
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const weekStart = formatISODate(weekDates[0]);
  const weekEnd = formatISODate(weekDates[6]);
  const today = formatISODate(new Date());

  const allVisibleTasks = useMemo(
    () => uniqueTasks([...scheduledTasks, ...unscheduledTasks, ...overdueTasks]),
    [overdueTasks, scheduledTasks, unscheduledTasks],
  );

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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const task = allVisibleTasks.find((item) => item.id === active.id);
    const nextDueDate = columnDateFromId(String(over.id));
    if (!task || nextDueDate === undefined || task.due_date === nextDueDate) return;

    applyLocalDueDate(task.id, nextDueDate);

    try {
      await updateTask(task.id, { due_date: nextDueDate });
      await loadTasks();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Aufgabe konnte nicht verschoben werden',
      );
      await loadTasks();
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated text-sm text-text-muted">
        Aufgaben werden geladen...
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event: DragStartEvent) => {
        setActiveTask(allVisibleTasks.find((task) => task.id === event.active.id) ?? null);
      }}
      onDragCancel={() => setActiveTask(null)}
      onDragEnd={(event) => void handleDragEnd(event)}
    >
      <div className="min-w-[900px] flex-1 overflow-x-auto">
        <div className="grid min-h-full grid-cols-[200px_repeat(7,minmax(120px,1fr))] gap-3">
          <WeekColumn
            id={UNSCHEDULED_COLUMN_ID}
            isUnscheduled
            tasks={unscheduledTasks}
            onCompleteTask={(taskId) => void handleComplete(taskId, loadTasks)}
            onOpenTask={handleOpenTask}
            onTaskCreated={() => void loadTasks()}
          />
          {weekDates.map((date) => {
            const isoDate = formatISODate(date);
            return (
              <WeekColumn
                key={isoDate}
                id={dayColumnId(isoDate)}
                date={date}
                tasks={tasksByDate.get(isoDate) ?? []}
                onCompleteTask={(taskId) => void handleComplete(taskId, loadTasks)}
                onOpenTask={handleOpenTask}
                onTaskCreated={() => void loadTasks()}
              />
            );
          })}
        </div>
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} isOverlay /> : null}</DragOverlay>
    </DndContext>
  );

  function applyLocalDueDate(taskId: string, nextDueDate: string | null) {
    const moved = allVisibleTasks.find((task) => task.id === taskId);
    if (!moved) return;

    setScheduledTasks((current) => [
      ...current.filter((task) => task.id !== taskId).filter((task) => task.due_date !== null),
      ...(nextDueDate !== null ? [{ ...moved, due_date: nextDueDate }] : []),
    ]);
    setUnscheduledTasks((current) => {
      const existing = current.filter((task) => task.id !== taskId);
      return nextDueDate === null && moved
        ? uniqueTasks([...existing, { ...moved, due_date: null }])
        : existing;
    });
    setOverdueTasks((current) =>
      current
        .filter((task) => task.id !== taskId)
        .filter((task) => isOverdue(task.due_date, task.status)),
    );
  }
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

function handleOpenTask(task: Task) {
  toast.info(`Detail-Panel für "${task.title}" folgt in Sub-Session E.`);
}
