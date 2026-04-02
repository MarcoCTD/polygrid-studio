import { useEffect, useState } from "react";
import { Plus, Search, X, Circle, CheckCircle2, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { useTaskStore } from "../store";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_VARIANTS,
  TASK_STATUS_LABELS,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "../types";
import { cn } from "@/lib/utils";
import de from "@/i18n/de.json";

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  todo: <Circle className="size-4 text-[--muted-foreground]" />,
  in_progress: <Clock className="size-4 text-[--accent-primary]" />,
  done: <CheckCircle2 className="size-4 text-[--accent-success]" />,
  cancelled: <Ban className="size-4 text-[--accent-danger]" />,
};

function formatDueDate(iso: string): { text: string; overdue: boolean } {
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = due.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

  if (diff < 0) return { text: `${formatted} (überfällig)`, overdue: true };
  if (diff === 0) return { text: "Heute", overdue: false };
  if (diff === 1) return { text: "Morgen", overdue: false };
  return { text: formatted, overdue: false };
}

interface TaskItemProps {
  task: Task;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

function TaskItem({ task, selected, disabled = false, onSelect, onToggle }: TaskItemProps) {
  const dueInfo = task.due_date ? formatDueDate(task.due_date) : null;
  const isDone = task.status === "done" || task.status === "cancelled";

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-[--border] px-6 py-3 transition-colors cursor-pointer",
        "hover:bg-[--muted]",
        selected && "bg-[--accent-primary-subtle]"
      )}
      onClick={onSelect}
    >
      <button
        className="mt-0.5 shrink-0"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {STATUS_ICONS[task.status]}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-medium", isDone && "line-through text-[--muted-foreground]")}>
          {task.title}
        </div>
        {task.description && (
          <p className="mt-0.5 text-xs text-[--muted-foreground] truncate">{task.description}</p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <Badge variant={TASK_PRIORITY_VARIANTS[task.priority as TaskPriority]} className="text-[10px] px-1.5 py-0">
            {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
          </Badge>
          {dueInfo && (
            <span className={cn("text-xs", dueInfo.overdue ? "text-[--accent-danger] font-medium" : "text-[--muted-foreground]")}>
              {dueInfo.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

type FilterTab = "all" | "todo" | "in_progress" | "done";

export function TasksPage() {
  const { tasks, isLoading, error, fetchTasks, updateTask, selectTask, selectedTaskId } =
    useTaskStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered = tasks.filter((t) => {
    if (tab === "todo") return t.status === "todo";
    if (tab === "in_progress") return t.status === "in_progress";
    if (tab === "done") return t.status === "done" || t.status === "cancelled";
    return true;
  }).filter((t) => {
    if (!globalFilter) return true;
    const q = globalFilter.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false);
  });

  async function handleToggle(task: Task) {
    if (pendingTaskId === task.id) return;

    setActionError(null);
    setPendingTaskId(task.id);

    try {
      if (task.status === "done") {
        await updateTask(task.id, { status: "todo", completed_at: null });
      } else {
        await updateTask(task.id, { status: "done" });
      }
    } catch (err) {
      console.error("Failed to toggle task:", err);
      setActionError(
        err instanceof Error ? err.message : "Aufgabenstatus konnte nicht aktualisiert werden."
      );
    } finally {
      setPendingTaskId(null);
    }
  }

  const counts = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done" || t.status === "cancelled").length,
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: `Alle (${counts.all})` },
    { key: "todo", label: `Offen (${counts.todo})` },
    { key: "in_progress", label: `In Arbeit (${counts.in_progress})` },
    { key: "done", label: `Erledigt (${counts.done})` },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[--border] px-6 py-4">
        <div>
          <h1 className="text-base font-semibold text-[--foreground]">
            {de.tasks.title}
          </h1>
          <p className="text-xs text-[--muted-foreground]">{de.tasks.subtitle}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 bg-[--accent-primary] text-white hover:bg-[--accent-primary-hover]"
        >
          <Plus className="size-4" />
          Neue Aufgabe
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[--border] px-6 py-3">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[--muted-foreground]" />
          <Input
            placeholder="Suchen..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {globalFilter && (
          <button
            onClick={() => setGlobalFilter("")}
            className="flex items-center gap-1 text-xs text-[--muted-foreground] hover:text-[--foreground] transition-colors"
          >
            <X className="size-3.5" />
            Filter zurücksetzen
          </button>
        )}

        <div className="flex-1" />

        {isLoading && (
          <span className="text-xs text-[--muted-foreground]">Laden...</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-0 border-b border-[--border]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-xs font-medium transition-colors",
              tab === t.key
                ? "border-b-2 border-[--accent-primary] text-[--accent-primary]"
                : "text-[--muted-foreground] hover:text-[--foreground]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="rounded-lg border border-[--accent-danger-subtle] bg-[--accent-danger-subtle] px-4 py-2 text-sm text-[--accent-danger]">
            Fehler: {error}
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {actionError && (
            <div className="px-6 pt-4">
              <p className="rounded-lg border border-[--accent-danger-subtle] bg-[--accent-danger-subtle] px-4 py-2 text-sm text-[--accent-danger]">
                Fehler: {actionError}
              </p>
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-[--muted-foreground]">
                {tab === "all" ? "Keine Aufgaben vorhanden." : `Keine ${TASK_STATUS_LABELS[tab as TaskStatus] ?? ""} Aufgaben.`}
              </p>
            </div>
          ) : (
            filtered.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                selected={selectedTaskId === task.id}
                disabled={pendingTaskId === task.id}
                onSelect={() => selectTask(selectedTaskId === task.id ? null : task.id)}
                onToggle={() => handleToggle(task)}
              />
            ))
          )}
        </ScrollArea>
      )}

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
