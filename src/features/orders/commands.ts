import { Plus, ShoppingCart } from 'lucide-react';
import type { Command } from '@/stores';

export const ORDER_COMMAND_IDS = ['orders.new', 'orders.open'];

interface CreateOrderCommandsOptions {
  onNewOrder: () => void;
  onNavigateOrders: () => void;
}

export function createOrderCommands({
  onNewOrder,
  onNavigateOrders,
}: CreateOrderCommandsOptions): Command[] {
  return [
    {
      id: 'orders.new',
      label: 'Neuer Auftrag',
      icon: Plus,
      category: 'action',
      action: onNewOrder,
    },
    {
      id: 'orders.open',
      label: 'Zu Aufträge',
      icon: ShoppingCart,
      category: 'navigation',
      action: onNavigateOrders,
    },
  ];
}
