import { z } from "zod";

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  urgent: "Dringend",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Offen",
  in_progress: "In Arbeit",
  done: "Erledigt",
  cancelled: "Abgebrochen",
};

export const TASK_PRIORITY_VARIANTS: Record<TaskPriority, "muted" | "warning" | "accent" | "danger"> = {
  low: "muted",
  medium: "accent",
  high: "warning",
  urgent: "danger",
};

export const TASK_STATUS_VARIANTS: Record<TaskStatus, "muted" | "warning" | "accent" | "success" | "danger"> = {
  todo: "muted",
  in_progress: "accent",
  done: "success",
  cancelled: "danger",
};

// ── Full task type (from DB) ─────────────────────────────────────────────────

export const TaskSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  due_date: z.string().nullable(),
  product_id: z.string().nullable(),
  order_id: z.string().nullable(),
  listing_id: z.string().nullable(),
  recurring_rule: z.string().nullable(),
  completed_at: z.string().nullable(),
});

export type Task = z.infer<typeof TaskSchema>;

// ── Create/Edit form schema ──────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  status: z.enum(TASK_STATUSES).default("todo"),
  due_date: z.string().optional().nullable(),
  product_id: z.string().optional().nullable(),
  order_id: z.string().optional().nullable(),
  listing_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateTaskInput = z.output<typeof CreateTaskSchema>;
