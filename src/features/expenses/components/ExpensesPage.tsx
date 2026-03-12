import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ExpenseTable } from "./ExpenseTable";
import { ExpenseDetailPanel } from "./ExpenseDetailPanel";
import { CreateExpenseDialog } from "./CreateExpenseDialog";
import { useExpenseStore, useSelectedExpense } from "../store";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "../types";
import de from "@/i18n/de.json";

const ALL_VALUE = "__all__";

export function ExpensesPage() {
  const { expenses, isLoading, error, fetchExpenses, selectExpense, selectedExpenseId } =
    useExpenseStore();
  const selectedExpense = useSelectedExpense();

  const [createOpen, setCreateOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const hasActiveFilter = categoryFilter || globalFilter;

  function clearFilters() {
    setCategoryFilter("");
    setGlobalFilter("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[--border] px-6 py-4">
        <div>
          <h1 className="text-base font-semibold text-[--foreground]">
            {de.expenses.title}
          </h1>
          <p className="text-xs text-[--muted-foreground]">{de.expenses.subtitle}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 bg-[--accent-primary] text-white hover:bg-[--accent-primary-hover]"
        >
          <Plus className="size-4" />
          Neue Ausgabe
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

        <Select
          value={categoryFilter || ALL_VALUE}
          onValueChange={(v) => setCategoryFilter(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Alle Kategorien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Alle Kategorien</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilter && (
          <button
            onClick={clearFilters}
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

      {/* Main content */}
      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="rounded-lg border border-[--accent-danger-subtle] bg-[--accent-danger-subtle] px-4 py-2 text-sm text-[--accent-danger]">
            Fehler: {error}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ExpenseTable
              expenses={expenses}
              selectedId={selectedExpenseId}
              categoryFilter={categoryFilter}
              globalFilter={globalFilter}
              onRowClick={(e) =>
                selectExpense(selectedExpenseId === e.id ? null : e.id)
              }
            />
          </div>

          {selectedExpense && (
            <ExpenseDetailPanel expense={selectedExpense} />
          )}
        </div>
      )}

      <CreateExpenseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
