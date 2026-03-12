import { create } from "zustand";
import type { Task, CreateTaskInput } from "./types";
import {
  listTasks,
  createTask,
  updateTask,
  softDeleteTask,
} from "@/services/database/queries/tasks";

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  selectedTaskId: string | null;

  fetchTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, patch: Partial<CreateTaskInput> & { completed_at?: string | null }) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  selectTask: (id: string | null) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  isLoading: false,
  error: null,
  selectedTaskId: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await listTasks();
      set({ tasks, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createTask: async (input) => {
    const task = await createTask(input);
    set((s) => ({ tasks: [task, ...s.tasks] }));
    return task;
  },

  updateTask: async (id, patch) => {
    const updated = await updateTask(id, patch);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
    }));
  },

  deleteTask: async (id) => {
    await softDeleteTask(id);
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      selectedTaskId: s.selectedTaskId === id ? null : s.selectedTaskId,
    }));
  },

  selectTask: (id) => set({ selectedTaskId: id }),
}));

export function useSelectedTask() {
  const { tasks, selectedTaskId } = useTaskStore();
  return tasks.find((t) => t.id === selectedTaskId) ?? null;
}
