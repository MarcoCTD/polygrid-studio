import { OrderPlatformEnum, OrderStatusEnum, type OrderPlatform, type OrderStatus } from './types';

/**
 * Search-Params der Aufträge-Route.
 * - view: Ansicht (Tabelle oder Kanban)
 * - status: Komma-getrennte Statusliste als Vorfilter (z.B. "in_production")
 * - platform: Komma-getrennte Plattformliste als Vorfilter (z.B. "website")
 * - order: Auftrags-ID, deren Detail-Panel beim Laden geöffnet wird
 */
export interface OrdersSearch {
  view?: 'table' | 'kanban';
  status?: string;
  platform?: string;
  order?: string;
}

export function parseOrderStatusList(value: string | undefined): OrderStatus[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is OrderStatus => OrderStatusEnum.safeParse(item).success);
}

export function parseOrderPlatformList(value: string | undefined): OrderPlatform[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is OrderPlatform => OrderPlatformEnum.safeParse(item).success);
}

export function validateOrdersSearch(search: Record<string, unknown>): OrdersSearch {
  const result: OrdersSearch = {};

  if (search.view === 'table' || search.view === 'kanban') {
    result.view = search.view;
  }
  if (typeof search.status === 'string' && parseOrderStatusList(search.status).length > 0) {
    result.status = search.status;
  }
  if (typeof search.platform === 'string' && parseOrderPlatformList(search.platform).length > 0) {
    result.platform = search.platform;
  }
  if (typeof search.order === 'string' && search.order.length > 0) {
    result.order = search.order;
  }

  return result;
}
