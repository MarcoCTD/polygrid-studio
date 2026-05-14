import {
  BadgeEuro,
  CloudDownload,
  CircleDollarSign,
  Landmark,
  Lock,
  PackageCheck,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderPlatform, OrderStatus, PaymentStatus } from '../types';

const STATUS_LABELS: Record<OrderStatus, string> = {
  inquiry: 'Anfrage',
  ordered: 'Bestellt',
  paid: 'Bezahlt',
  in_production: 'Produktion',
  shipped: 'Versendet',
  completed: 'Abgeschlossen',
  issue: 'Problem',
  cancelled: 'Storniert',
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: 'Offen',
  paid: 'Bezahlt',
  refunded: 'Erstattet',
  disputed: 'Klärung',
};

const PLATFORM_LABELS: Record<OrderPlatform, string> = {
  etsy: 'Etsy',
  ebay: 'eBay',
  kleinanzeigen: 'KA',
  direkt: 'Direkt',
};

const statusClasses: Record<OrderStatus, string> = {
  inquiry: 'border-slate-300 bg-slate-100 text-slate-700',
  ordered: 'border-blue-300 bg-blue-100 text-blue-700',
  paid: 'border-emerald-300 bg-emerald-100 text-emerald-700',
  in_production: 'border-amber-300 bg-amber-100 text-amber-800',
  shipped: 'border-cyan-300 bg-cyan-100 text-cyan-700',
  completed: 'border-green-300 bg-green-100 text-green-700',
  issue: 'border-red-300 bg-red-100 text-red-700',
  cancelled: 'border-zinc-300 bg-zinc-100 text-zinc-600',
};

const paymentClasses: Record<PaymentStatus, string> = {
  pending: 'border-amber-300 bg-amber-100 text-amber-800',
  paid: 'border-emerald-300 bg-emerald-100 text-emerald-700',
  refunded: 'border-blue-300 bg-blue-100 text-blue-700',
  disputed: 'border-red-300 bg-red-100 text-red-700',
};

const platformClasses: Record<OrderPlatform, string> = {
  etsy: 'border-orange-300 bg-orange-100 text-orange-700',
  ebay: 'border-indigo-300 bg-indigo-100 text-indigo-700',
  kleinanzeigen: 'border-teal-300 bg-teal-100 text-teal-700',
  direkt: 'border-slate-300 bg-slate-100 text-slate-700',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', statusClasses[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', paymentClasses[status])}>
      {PAYMENT_LABELS[status]}
    </Badge>
  );
}

export function OrderPlatformIcon({ platform }: { platform: OrderPlatform }) {
  const Icon =
    platform === 'etsy'
      ? ShoppingBag
      : platform === 'ebay'
        ? BadgeEuro
        : platform === 'kleinanzeigen'
          ? Store
          : Landmark;

  return (
    <Badge
      variant="outline"
      className={cn('inline-flex items-center gap-1 whitespace-nowrap', platformClasses[platform])}
    >
      <Icon className="size-3.5" />
      {PLATFORM_LABELS[platform]}
    </Badge>
  );
}

export function TaxLockedIcon({ locked }: { locked: boolean }) {
  if (!locked) return <span className="text-muted-foreground">-</span>;
  return <Lock className="size-4 text-amber-600" aria-label="Steuerlich gesperrt" />;
}

export function ExternalSyncedBadge() {
  return (
    <Badge
      variant="outline"
      className="inline-flex items-center gap-1 whitespace-nowrap border-sky-300 bg-sky-100 text-sky-700"
    >
      <CloudDownload className="size-3.5" />
      Extern importiert
    </Badge>
  );
}

export function ShippingStatusIcon({ shipped }: { shipped: boolean }) {
  return shipped ? (
    <PackageCheck className="size-4 text-emerald-600" />
  ) : (
    <CircleDollarSign className="size-4 text-muted-foreground" />
  );
}
