import { create } from "zustand";
import type { Expense, CreateExpenseInput } from "./types";
import {
  listExpenses,
  createExpense,
  updateExpense,
  softDeleteExpense,
} from "@/services/database/queries/expenses";

interface ExpenseState {
  expenses: Expense[];
  isLoading: boolean;
  error: string | null;
  selectedExpenseId: string | null;

  fetchExpenses: () => Promise<void>;
  createExpense: (input: CreateExpenseInput) => Promise<Expense>;
  updateExpense: (id: string, patch: Partial<CreateExpenseInput>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  selectExpense: (id: string | null) => void;
}

export const useExpenseStore = create<ExpenseState>((set) => ({
  expenses: [],
  isLoading: false,
  error: null,
  selectedExpenseId: null,

  fetchExpenses: async () => {
    set({ isLoading: true, error: null });
    try {
      const expenses = await listExpenses();
      set({ expenses, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createExpense: async (input) => {
    const expense = await createExpense(input);
    set((s) => ({ expenses: [expense, ...s.expenses] }));
    return expense;
  },

  updateExpense: async (id, patch) => {
    const updated = await updateExpense(id, patch);
    set((s) => ({
      expenses: s.expenses.map((e) => (e.id === id ? updated : e)),
    }));
  },

  deleteExpense: async (id) => {
    await softDeleteExpense(id);
    set((s) => ({
      expenses: s.expenses.filter((e) => e.id !== id),
      selectedExpenseId: s.selectedExpenseId === id ? null : s.selectedExpenseId,
    }));
  },

  selectExpense: (id) => set({ selectedExpenseId: id }),
}));

export function useSelectedExpense() {
  const { expenses, selectedExpenseId } = useExpenseStore();
  return expenses.find((e) => e.id === selectedExpenseId) ?? null;
}
