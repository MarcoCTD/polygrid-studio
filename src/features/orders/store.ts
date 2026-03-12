import { create } from "zustand";
import type { Order, CreateOrderInput } from "./types";
import {
  listOrders,
  createOrder,
  updateOrder,
  softDeleteOrder,
} from "@/services/database/queries/orders";

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  selectedOrderId: string | null;

  fetchOrders: () => Promise<void>;
  createOrder: (input: CreateOrderInput) => Promise<Order>;
  updateOrder: (id: string, patch: Partial<CreateOrderInput>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  selectOrder: (id: string | null) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  isLoading: false,
  error: null,
  selectedOrderId: null,

  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const orders = await listOrders();
      set({ orders, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createOrder: async (input) => {
    const order = await createOrder(input);
    set((s) => ({ orders: [order, ...s.orders] }));
    return order;
  },

  updateOrder: async (id, patch) => {
    const updated = await updateOrder(id, patch);
    set((s) => ({
      orders: s.orders.map((o) => (o.id === id ? updated : o)),
    }));
  },

  deleteOrder: async (id) => {
    await softDeleteOrder(id);
    set((s) => ({
      orders: s.orders.filter((o) => o.id !== id),
      selectedOrderId: s.selectedOrderId === id ? null : s.selectedOrderId,
    }));
  },

  selectOrder: (id) => set({ selectedOrderId: id }),
}));

export function useSelectedOrder() {
  const { orders, selectedOrderId } = useOrderStore();
  return orders.find((o) => o.id === selectedOrderId) ?? null;
}
