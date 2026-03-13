import { getDb, now } from "../db";

export interface AiJob {
  id: string;
  provider: string;
  model: string;
  agent: string;
  action: string;
  input_data: string | null;
  output_data: string | null;
  status: string;
  tokens_used: number | null;
  cost_estimate: number | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export async function listAiJobs(limit = 50): Promise<AiJob[]> {
  const db = await getDb();
  return db.select<AiJob[]>(
    `SELECT id, provider, model, agent, action, input_data, output_data,
            status, tokens_used, cost_estimate, duration_ms, error_message,
            created_at, updated_at
     FROM ai_jobs
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getAiJobStats(): Promise<{
  total: number;
  completed: number;
  failed: number;
  totalTokens: number;
  avgDuration: number | null;
}> {
  const db = await getDb();

  const [row] = await db.select<
    [{ total: number; completed: number; failed: number; total_tokens: number | null; avg_duration: number | null }]
  >(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
       COALESCE(SUM(tokens_used), 0) as total_tokens,
       AVG(CASE WHEN status = 'completed' THEN duration_ms ELSE NULL END) as avg_duration
     FROM ai_jobs WHERE deleted_at IS NULL`
  );

  return {
    total: row?.total ?? 0,
    completed: row?.completed ?? 0,
    failed: row?.failed ?? 0,
    totalTokens: row?.total_tokens ?? 0,
    avgDuration: row?.avg_duration ?? null,
  };
}

export async function createAiJob(data: {
  provider: string;
  model: string;
  agent: string;
  action: string;
  input_data?: string;
}): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const ts = now();

  await db.execute(
    `INSERT INTO ai_jobs (id, provider, model, agent, action, input_data, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [id, data.provider, data.model, data.agent, data.action, data.input_data ?? null, ts, ts]
  );

  return id;
}

export async function updateAiJob(
  id: string,
  data: {
    status?: string;
    output_data?: string;
    tokens_used?: number;
    cost_estimate?: number;
    duration_ms?: number;
    error_message?: string;
  }
): Promise<void> {
  const db = await getDb();
  const fields: string[] = ["updated_at = ?"];
  const values: unknown[] = [now()];

  if (data.status !== undefined) {
    fields.push("status = ?");
    values.push(data.status);
  }
  if (data.output_data !== undefined) {
    fields.push("output_data = ?");
    values.push(data.output_data);
  }
  if (data.tokens_used !== undefined) {
    fields.push("tokens_used = ?");
    values.push(data.tokens_used);
  }
  if (data.cost_estimate !== undefined) {
    fields.push("cost_estimate = ?");
    values.push(data.cost_estimate);
  }
  if (data.duration_ms !== undefined) {
    fields.push("duration_ms = ?");
    values.push(data.duration_ms);
  }
  if (data.error_message !== undefined) {
    fields.push("error_message = ?");
    values.push(data.error_message);
  }

  values.push(id);

  await db.execute(
    `UPDATE ai_jobs SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
}
