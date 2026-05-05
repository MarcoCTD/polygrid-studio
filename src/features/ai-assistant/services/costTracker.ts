import { getDatabase, getSetting } from '@/services/database';
import type { AIJobLogInput } from '../types';

interface SumRow {
  total: number | string | null;
}

function currentMonthPrefix(): string {
  return new Date().toISOString().slice(0, 7);
}

function truncate(value: string | null, maxLength: number): string | null {
  if (value === null) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export async function getMonthlySpent(): Promise<number> {
  const rows = await getDatabase().select<SumRow[]>(
    `SELECT SUM(estimated_cost) AS total
     FROM ai_jobs
     WHERE substr(created_at, 1, 7) = $1
       AND status = 'success'`,
    [currentMonthPrefix()],
  );

  return Number(rows[0]?.total ?? 0);
}

export async function getMonthlyLimit(): Promise<number> {
  try {
    const limit = await getSetting<number>('ai_monthly_limit_eur');
    return typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : 10;
  } catch {
    return 10;
  }
}

export async function checkBudget(): Promise<{
  spent: number;
  limit: number;
  remaining: number;
  isWarning: boolean;
  isBlocked: boolean;
}> {
  const [spent, limit] = await Promise.all([getMonthlySpent(), getMonthlyLimit()]);
  return {
    spent,
    limit,
    remaining: Math.max(limit - spent, 0),
    isWarning: spent >= limit * 0.8,
    isBlocked: spent >= limit,
  };
}

export async function logAIJob(input: AIJobLogInput): Promise<string> {
  const id = crypto.randomUUID();
  await getDatabase().execute(
    `INSERT INTO ai_jobs (
      id, provider, model, agent, action, input, output, tokens_used,
      duration_ms, status, error_message, estimated_cost, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      input.provider,
      input.model,
      input.agent,
      input.action,
      truncate(input.input, 500),
      truncate(input.output, 1000),
      input.tokensUsed,
      input.durationMs,
      input.status,
      input.errorMessage ?? null,
      input.estimatedCost ?? null,
      new Date().toISOString(),
    ],
  );
  return id;
}
