import { Badge } from "@/components/ui/badge";
import type { ProductStatus } from "../types";

const STATUS_CONFIG: Record<
  ProductStatus,
  { label: string; variant: "muted" | "warning" | "accent" | "success" | "danger" }
> = {
  idea:          { label: "Idee",           variant: "muted" },
  review:        { label: "Review",         variant: "warning" },
  print_ready:   { label: "Druckbereit",    variant: "accent" },
  test_print:    { label: "Testdruck",      variant: "accent" },
  launch_ready:  { label: "Launch-bereit",  variant: "accent" },
  online:        { label: "Online",         variant: "success" },
  paused:        { label: "Pausiert",       variant: "warning" },
  discontinued:  { label: "Eingestellt",    variant: "danger" },
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export const STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])
) as Record<ProductStatus, string>;
