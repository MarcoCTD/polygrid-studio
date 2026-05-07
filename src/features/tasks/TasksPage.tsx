import { useState } from 'react';
import {
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ListChecks,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores';
import type { Task } from './schemas';
import { useTaskBadge, useWeekNavigation } from './hooks';
import { ListView, NewTaskModal, TaskDetailPanel, WeekView } from './components';

type TaskViewMode = 'week' | 'list';

export function TasksPage() {
  const openDetailPanel = useUIStore((state) => state.openDetailPanel);
  const closeDetailPanel = useUIStore((state) => state.closeDetailPanel);
  const [viewMode, setViewMode] = useState<TaskViewMode>('week');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [showDoneInWeek, setShowDoneInWeek] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { refreshTaskBadge } = useTaskBadge();
  const { weekDates, weekNumber, isCurrentWeek, goToPreviousWeek, goToNextWeek, goToToday } =
    useWeekNavigation();

  function refreshTasks() {
    setRefreshKey((value) => value + 1);
    void refreshTaskBadge();
  }

  function openTask(task: Task) {
    openDetailPanel(
      <TaskDetailPanel
        task={task}
        onSaved={() => refreshTasks()}
        onDeleted={() => {
          refreshTasks();
          closeDetailPanel();
        }}
      />,
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-primary">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Aufgaben</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Wochenplanung, Prioritäten und verknüpfte Arbeitsschritte im Blick behalten.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border-subtle bg-bg-secondary p-1">
            <Button
              type="button"
              variant={viewMode === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setViewMode('week')}
            >
              <CalendarDays className="size-4" />
              Woche
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setViewMode('list')}
            >
              <ListChecks className="size-4" />
              Liste
            </Button>
          </div>

          {viewMode === 'week' ? (
            <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-secondary p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Vorherige Kalenderwoche"
                onClick={goToPreviousWeek}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-16 text-center text-sm font-medium text-text-primary">
                KW {weekNumber}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Nächste Kalenderwoche"
                onClick={goToNextWeek}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant={isCurrentWeek ? 'secondary' : 'outline'}
                size="sm"
                onClick={goToToday}
              >
                Heute
              </Button>
            </div>
          ) : null}

          {viewMode === 'week' ? (
            <Button
              type="button"
              variant={showDoneInWeek ? 'secondary' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => setShowDoneInWeek((value) => !value)}
            >
              {showDoneInWeek ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              Erledigte {showDoneInWeek ? 'ausblenden' : 'einblenden'}
            </Button>
          ) : null}

          <Button type="button" size="sm" className="gap-1.5" onClick={() => setNewTaskOpen(true)}>
            <Plus className="size-4" />
            Neue Aufgabe
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled
            title="Folgt in Sub-Session H"
          >
            <Bot className="size-4" />
            Aufgaben aus Text
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
        {viewMode === 'week' ? (
          <WeekView
            weekDates={weekDates}
            isCurrentWeek={isCurrentWeek}
            refreshKey={refreshKey}
            showDone={showDoneInWeek}
            onOpenTask={openTask}
            onChanged={refreshTasks}
          />
        ) : (
          <ListView refreshKey={refreshKey} onOpenTask={openTask} onChanged={refreshTasks} />
        )}
      </main>

      <NewTaskModal open={newTaskOpen} onOpenChange={setNewTaskOpen} onCreated={refreshTasks} />
    </div>
  );
}
