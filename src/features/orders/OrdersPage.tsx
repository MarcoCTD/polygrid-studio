import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { KanbanSquare, Plus, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores';
import { createOrderCommands, ORDER_COMMAND_IDS } from './commands';
import {
  KanbanBoard,
  NewOrderModal,
  OrderDetailPlaceholder,
  OrdersTable,
  OrdersToolbar,
  type OrdersFilterState,
} from './components';
import { getOpenOrdersCount, getOrders } from './services';
import type { OrderFilters, OrderListItem, OrderStatus } from './types';

const DEFAULT_STATUSES: OrderStatus[] = [
  'inquiry',
  'ordered',
  'paid',
  'in_production',
  'shipped',
  'completed',
  'issue',
];

function currentYearRange(): { dateFrom: string; dateTo: string } {
  const year = new Date().getFullYear();
  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
}

function monthRange(month: string): { dateFrom: string; dateTo: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return {
    dateFrom: `${year}-${String(monthIndex).padStart(2, '0')}-01`,
    dateTo: `${year}-${String(monthIndex).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function filtersToService(filters: OrdersFilterState, viewMode: 'table' | 'kanban'): OrderFilters {
  const range = filters.month ? monthRange(filters.month) : currentYearRange();
  return {
    status: filters.statuses.length > 0 ? filters.statuses : undefined,
    platform: filters.platforms.length > 0 ? filters.platforms : undefined,
    showDeleted: viewMode === 'table' ? filters.showDeleted : false,
    ...range,
  };
}

export function OrdersPage() {
  const router = useRouter();
  const registerCommands = useUIStore((state) => state.registerCommands);
  const unregisterCommands = useUIStore((state) => state.unregisterCommands);
  const openDetailPanel = useUIStore((state) => state.openDetailPanel);
  const closeDetailPanel = useUIStore((state) => state.closeDetailPanel);
  const setOpenOrdersCount = useUIStore((state) => state.setOpenOrdersCount);
  const ordersViewMode = useUIStore((state) => state.ordersViewMode);
  const setOrdersViewMode = useUIStore((state) => state.setOrdersViewMode);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [filters, setFilters] = useState<OrdersFilterState>({
    statuses: DEFAULT_STATUSES,
    platforms: [],
    month: '',
    showDeleted: false,
  });

  const serviceFilters = useMemo(
    () => filtersToService(filters, ordersViewMode),
    [filters, ordersViewMode],
  );

  const refreshOpenOrdersCount = useCallback(async () => {
    try {
      setOpenOrdersCount(await getOpenOrdersCount());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Offene Aufträge konnten nicht gezählt werden',
      );
    }
  }, [setOpenOrdersCount]);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      setOrders(await getOrders(serviceFilters));
      await refreshOpenOrdersCount();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aufträge konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }, [refreshOpenOrdersCount, serviceFilters]);

  useEffect(() => {
    // Loading data from the local SQLite service is the page's external synchronization point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const commands = createOrderCommands({
      onNewOrder: () => setNewOrderOpen(true),
      onNavigateOrders: () => void router.navigate({ to: '/orders' }),
    });
    registerCommands(commands);
    return () => unregisterCommands(ORDER_COMMAND_IDS);
  }, [registerCommands, router, unregisterCommands]);

  function openOrder(order: OrderListItem) {
    openDetailPanel(<OrderDetailPlaceholder order={order} onClose={closeDetailPanel} />);
  }

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <header className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Aufträge</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Auftragsstatus per Kanban steuern oder in der Tabelle filtern und bearbeiten.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={ordersViewMode === 'table' ? 'secondary' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setOrdersViewMode('table')}
          >
            <Table2 className="size-4" />
            Tabelle
          </Button>
          <Button
            variant={ordersViewMode === 'kanban' ? 'secondary' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setOrdersViewMode('kanban')}
          >
            <KanbanSquare className="size-4" />
            Kanban
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setNewOrderOpen(true)}>
            <Plus className="size-4" />
            Neuer Auftrag
          </Button>
        </div>
      </header>

      <OrdersToolbar filters={filters} onFiltersChange={setFilters} />
      {ordersViewMode === 'kanban' ? (
        <KanbanBoard
          orders={orders}
          isLoading={isLoading}
          onOpenOrder={openOrder}
          onChanged={() => void loadOrders()}
        />
      ) : (
        <OrdersTable
          orders={orders}
          isLoading={isLoading}
          onOpenOrder={openOrder}
          onChanged={() => void loadOrders()}
        />
      )}

      <NewOrderModal
        open={newOrderOpen}
        onOpenChange={setNewOrderOpen}
        onCreated={() => void loadOrders()}
      />
    </div>
  );
}
