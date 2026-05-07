ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id);
--> statement-breakpoint
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
