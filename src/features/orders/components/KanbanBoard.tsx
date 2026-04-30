import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { updateOrder } from '../services';
import type { OrderListItem, OrderStatus } from '../types';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
  orders: OrderListItem[];
  isLoading: boolean;
  onOpenOrder: (order: OrderListItem) => void;
  onChanged: () => void;
}

interface KanbanColumnDefinition {
  id: string;
  label: string;
  statuses: OrderStatus[];
  dropStatus: OrderStatus;
}

const KANBAN_COLUMNS: KanbanColumnDefinition[] = [
  { id: 'inquiry', label: 'Anfrage', statuses: ['inquiry'], dropStatus: 'inquiry' },
  { id: 'ordered', label: 'Bestellt', statuses: ['ordered'], dropStatus: 'ordered' },
  { id: 'paid', label: 'Bezahlt', statuses: ['paid'], dropStatus: 'paid' },
  {
    id: 'in_production',
    label: 'In Produktion',
    statuses: ['in_production'],
    dropStatus: 'in_production',
  },
  { id: 'shipped', label: 'Versendet', statuses: ['shipped'], dropStatus: 'shipped' },
  { id: 'completed', label: 'Abgeschlossen', statuses: ['completed'], dropStatus: 'completed' },
  { id: 'problem', label: 'Problem', statuses: ['issue', 'cancelled'], dropStatus: 'issue' },
];

function findColumnById(id: string): KanbanColumnDefinition | undefined {
  return KANBAN_COLUMNS.find((column) => column.id === id);
}

export function KanbanBoard({ orders, isLoading, onOpenOrder, onChanged }: KanbanBoardProps) {
  const [localOrders, setLocalOrders] = useState<OrderListItem[]>(orders);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    queueMicrotask(() => setLocalOrders(orders.filter((order) => order.deleted_at === null)));
  }, [orders]);

  const groupedOrders = useMemo(() => {
    return KANBAN_COLUMNS.map((column) => ({
      column,
      orders: localOrders.filter((order) => column.statuses.includes(order.status)),
    }));
  }, [localOrders]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const order = localOrders.find((item) => item.id === active.id);
    const targetColumn = findColumnById(String(over.id));
    if (!order || !targetColumn) return;
    if (order.tax_locked) return;

    const nextStatus = targetColumn.dropStatus;
    if (
      order.status === nextStatus ||
      (targetColumn.id === 'problem' && order.status === 'cancelled')
    ) {
      return;
    }

    const previousOrders = localOrders;
    setLocalOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, status: nextStatus } : item)),
    );

    try {
      await updateOrder(order.id, { status: nextStatus });
      onChanged();
    } catch (error) {
      setLocalOrders(previousOrders);
      toast.error(
        error instanceof Error ? error.message : 'Auftragsstatus konnte nicht geändert werden',
      );
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-text-secondary">Kanban wird geladen...</div>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {groupedOrders.map(({ column, orders: columnOrders }) => (
          <KanbanColumn
            key={column.id}
            column={column}
            orders={columnOrders}
            onOpenOrder={onOpenOrder}
          />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({
  column,
  orders,
  onOpenOrder,
}: {
  column: KanbanColumnDefinition;
  orders: OrderListItem[];
  onOpenOrder: (order: OrderListItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex h-[calc(100vh-242px)] w-72 shrink-0 flex-col rounded-lg border border-border-subtle bg-bg-secondary',
        isOver && 'border-pg-accent bg-pg-accent-subtle/40',
      )}
    >
      <header className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <h2 className="text-sm font-semibold text-text-primary">{column.label}</h2>
        <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
          {orders.length}
        </span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {orders.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border-subtle text-xs text-text-muted">
            Keine Aufträge
          </div>
        ) : (
          orders.map((order) => <KanbanCard key={order.id} order={order} onOpen={onOpenOrder} />)
        )}
      </div>
    </section>
  );
}
