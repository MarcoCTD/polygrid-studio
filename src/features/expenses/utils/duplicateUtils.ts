import { detectDuplicate } from '@/features/ai-assistant/agents/expenseAssistant';
import { useAIStore } from '@/features/ai-assistant/stores/aiStore';
import type { Expense } from '../schemas';
import { getExpenses } from '../services';

interface DuplicateWarning {
  isDuplicate: boolean;
  reason: string;
}

interface DuplicateCandidate {
  date: string;
  amount_gross: number;
  vendor: string;
}

function dateDistanceDays(left: string, right: string): number {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(leftTime - rightTime) / 86_400_000;
}

function normalizeVendor(value: string): string {
  return value.trim().toLowerCase();
}

export async function findDuplicateWarning(
  expense: DuplicateCandidate,
): Promise<DuplicateWarning | null> {
  const recentExpenses = await getExpenses({
    limit: 50,
    sort_by: 'date',
    sort_direction: 'desc',
    include_deleted: false,
  });
  const vendor = normalizeVendor(expense.vendor);
  const localDuplicate = recentExpenses.find((existing) => {
    const sameAmount = Math.abs(existing.amount_gross - expense.amount_gross) < 0.01;
    const sameVendor = normalizeVendor(existing.vendor) === vendor;
    const closeDate = dateDistanceDays(existing.date, expense.date) <= 3;
    return sameAmount && sameVendor && closeDate;
  });

  if (localDuplicate) {
    return {
      isDuplicate: true,
      reason: `${localDuplicate.vendor}, ${localDuplicate.amount_gross.toFixed(2)} EUR am ${localDuplicate.date}`,
    };
  }

  const { activeProvider } = useAIStore.getState();
  if (!activeProvider) return null;

  try {
    const aiResult = await detectDuplicate(
      expense.vendor,
      expense.amount_gross,
      expense.date,
      recentExpenses.map((existing: Expense) => ({
        id: existing.id,
        vendor: existing.vendor,
        amount: existing.amount_gross,
        date: existing.date,
      })),
    );

    if (aiResult.isDuplicate) {
      return {
        isDuplicate: true,
        reason: aiResult.reason ?? 'KI erkennt eine ähnliche bestehende Ausgabe.',
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function confirmDuplicateIfNeeded(expense: DuplicateCandidate): Promise<boolean> {
  const warning = await findDuplicateWarning(expense);
  if (!warning) return true;

  return window.confirm(`Mögliches Duplikat: ${warning.reason}. Trotzdem speichern?`);
}
