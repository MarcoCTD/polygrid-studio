import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';
import { Download, Info, Plus, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useUIStore } from '@/stores';
import { listProducts, type Product } from '@/features/products';
import { ExpenseDetailPanel } from './components/ExpenseDetailPanel';
import { ExpensesBulkToolbar } from './components/ExpensesBulkToolbar';
import { ExpensesHeader } from './components/ExpensesHeader';
import { ExpensesTable } from './components/ExpensesTable';
import { ExpensesToolbar, type ExpensesFilterState } from './components/ExpensesToolbar';
import { QuickExpenseForm } from './components/QuickExpenseForm';
import { getExpenses, getMonthlySum, getPreviousMonthSum } from './services';
import type { Expense, ExpenseFilter } from './schemas';
import { getPeriodDateRange, monthInputValue, parseMonthValue } from './utils';

const INITIAL_FILTERS: ExpensesFilterState = {
  search: '',
  categories: [],
  taxRelevant: 'all',
  period: 'current_month',
  customFrom: '',
  customTo: '',
  includeDeleted: false,
};

export function ExpensesPage() {
  const { registerCommands, unregisterCommands, openDetailPanel } = useUIStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null | 'new'>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ExpensesFilterState>(INITIAL_FILTERS);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedMonth, setSelectedMonth] = useState(monthInputValue(new Date()));
  const [monthlySum, setMonthlySum] = useState(0);
  const [previousMonthSum, setPreviousMonthSum] = useState(0);
  const [isHeaderLoading, setIsHeaderLoading] = useState(true);

  const serviceFilters = useMemo<ExpenseFilter>(() => {
    const dateRange = getPeriodDateRange(filters.period, filters.customFrom, filters.customTo);
    return {
      search: filters.search.trim() || undefined,
      category: filters.categories.length > 0 ? filters.categories : undefined,
      tax_relevant:
        filters.taxRelevant === 'all' ? undefined : filters.taxRelevant === 'yes' ? true : false,
      include_deleted: filters.includeDeleted,
      sort_by: 'date',
      sort_direction: 'desc',
      ...dateRange,
    };
  }, [filters]);

  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const productNamesById = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );

  const reloadExpenses = useCallback(() => {
    setIsLoading(true);
    getExpenses(serviceFilters)
      .then(setExpenses)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Ausgaben konnten nicht geladen werden');
      })
      .finally(() => setIsLoading(false));
  }, [serviceFilters]);

  const reloadHeader = useCallback(() => {
    const { year, month } = parseMonthValue(selectedMonth);
    setIsHeaderLoading(true);

    Promise.all([getMonthlySum(year, month), getPreviousMonthSum(year, month)])
      .then(([current, previous]) => {
        setMonthlySum(current);
        setPreviousMonthSum(previous);
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Monatswerte konnten nicht geladen werden',
        );
      })
      .finally(() => setIsHeaderLoading(false));
  }, [selectedMonth]);

  const reloadAll = useCallback(() => {
    reloadExpenses();
    reloadHeader();
  }, [reloadExpenses, reloadHeader]);

  const openExpenseDetail = useCallback(
    (expense: Expense | 'new') => {
      setSelectedExpense(expense);
      openDetailPanel(
        <ExpenseDetailPanel
          expense={expense}
          onSaved={() => {
            reloadAll();
            setSelectedExpense(null);
          }}
          onDeleted={() => {
            reloadAll();
            setSelectedExpense(null);
          }}
          onRestored={() => {
            reloadAll();
            setSelectedExpense(null);
          }}
        />,
      );
    },
    [openDetailPanel, reloadAll],
  );

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      listProducts({ includeDeleted: false })
        .then((items) => {
          if (!cancelled) setProducts(items);
        })
        .catch((err) => {
          if (!cancelled) {
            toast.error(
              err instanceof Error ? err.message : 'Produktliste konnte nicht geladen werden',
            );
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(reloadExpenses, 0);
    return () => window.clearTimeout(timeout);
  }, [reloadExpenses]);

  useEffect(() => {
    const timeout = window.setTimeout(reloadHeader, 0);
    return () => window.clearTimeout(timeout);
  }, [reloadHeader]);

  useEffect(() => {
    const commandIds = ['expenses:new', 'expenses:csv-export'];

    registerCommands([
      {
        id: 'expenses:new',
        label: 'Neue Ausgabe',
        icon: Plus,
        category: 'action',
        action: () => openExpenseDetail('new'),
      },
      {
        id: 'expenses:csv-export',
        label: 'Ausgaben exportieren',
        icon: Download,
        category: 'action',
        action: () => toast.info('CSV-Export kommt in Sub-Session D.'),
      },
    ]);

    return () => unregisterCommands(commandIds);
  }, [openExpenseDetail, registerCommands, unregisterCommands]);

  return (
    <div
      data-detail-selection={selectedExpense === 'new' ? 'new' : selectedExpense ? 'edit' : 'none'}
      className="flex h-full flex-col gap-4 overflow-hidden p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Ausgaben</h1>
          <p className="text-sm text-text-secondary">
            Geschäftsausgaben erfassen, filtern und für den Steuerexport vorbereiten
          </p>
        </div>
        <Receipt size={24} className="text-text-muted" />
      </div>

      <ExpensesHeader
        selectedMonth={selectedMonth}
        monthlySum={monthlySum}
        previousMonthSum={previousMonthSum}
        isLoading={isHeaderLoading}
        onSelectedMonthChange={setSelectedMonth}
      />

      <QuickExpenseForm onCreated={reloadAll} onMore={() => openExpenseDetail('new')} />

      {selectedIds.length > 0 ? (
        <ExpensesBulkToolbar
          selectedIds={selectedIds}
          onClearSelection={() => setRowSelection({})}
          onActionComplete={reloadAll}
        />
      ) : (
        <ExpensesToolbar
          filters={filters}
          totalCount={expenses.length}
          onFiltersChange={(nextFilters) => {
            setFilters(nextFilters);
            setRowSelection({});
          }}
        />
      )}

      <ExpensesTable
        expenses={expenses}
        isLoading={isLoading}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        onEditExpense={openExpenseDetail}
        onDataChanged={reloadAll}
        productNamesById={productNamesById}
      />

      <div className="flex shrink-0 items-start gap-2 rounded-lg border border-info/20 bg-info-subtle px-3 py-2 text-xs text-text-secondary">
        <Info size={14} className="mt-0.5 shrink-0 text-info" />
        <p>
          Dieses Modul unterstützt die Erfassung und Organisation von Ausgaben. Es ersetzt keine
          steuerliche Buchführung. Bitte konsultiere deinen Steuerberater.
        </p>
      </div>
    </div>
  );
}
