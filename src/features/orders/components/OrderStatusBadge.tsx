import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_VARIANTS, type OrderStatus } from "../types";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={ORDER_STATUS_VARIANTS[status]}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
