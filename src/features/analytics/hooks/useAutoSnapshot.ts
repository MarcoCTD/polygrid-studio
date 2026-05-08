import { useEffect, useRef } from 'react';
import { getSetting } from '@/services/database';
import { createOrUpdateSnapshot, snapshotExists } from '../services';

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousMonthRange(today: Date): { start: string; end: string } {
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function previousIsoWeekRange(today: Date): { start: string; end: string } {
  const currentWeekStart = new Date(today);
  const day = currentWeekStart.getDay() === 0 ? 7 : currentWeekStart.getDay();
  currentWeekStart.setDate(currentWeekStart.getDate() - day + 1);

  const start = new Date(currentWeekStart);
  start.setDate(start.getDate() - 7);

  const end = new Date(currentWeekStart);
  end.setDate(end.getDate() - 1);

  return { start: toDateKey(start), end: toDateKey(end) };
}

export function useAutoSnapshot(dbReady: boolean) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!dbReady || hasRun.current) return;
    hasRun.current = true;

    async function runAutoSnapshot() {
      try {
        const enabled = (await getSetting<boolean>('dashboard_kpi_snapshot_auto')) ?? true;
        if (!enabled) return;

        const today = new Date();
        const previousMonth = previousMonthRange(today);
        const previousWeek = previousIsoWeekRange(today);

        const [hasPreviousMonth, hasPreviousWeek] = await Promise.all([
          snapshotExists('month', previousMonth.start),
          snapshotExists('week', previousWeek.start),
        ]);

        const jobs: Promise<unknown>[] = [];
        if (!hasPreviousMonth) {
          jobs.push(createOrUpdateSnapshot('month', previousMonth.start, previousMonth.end));
        }
        if (!hasPreviousWeek) {
          jobs.push(createOrUpdateSnapshot('week', previousWeek.start, previousWeek.end));
        }

        if (jobs.length > 0) {
          await Promise.all(jobs);
          console.info('KPI Auto-Snapshots aktualisiert');
        }
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : 'KPI Auto-Snapshots konnten nicht laufen',
        );
      }
    }

    void runAutoSnapshot();
  }, [dbReady]);
}
