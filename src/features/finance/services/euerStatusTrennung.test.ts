import { describe, expect, it } from 'vitest';
import { orderCountsAsEuerIncome } from './euerIncome';
import { buildEuerYearReport, type EuerOrderInput } from './euerYear';

/**
 * Harte Regel Modul 08 (Status/Payment-Trennung): Die EÜR-Einnahmen dürfen sich
 * durch die Umstellung fachlich NICHT verschlechtern. Dieser Test fixiert die
 * Invariante über Migration 0017 hinweg – einmal für den Auftrags-Export
 * (euerExportService, Predicate in euerIncome.ts) und einmal für den
 * Jahres-Report (buildEuerYearReport).
 */

interface MigratableOrder {
  id: string;
  status: string;
  payment_status: string;
  payment_received_date: string | null;
  order_date: string;
  sale_price: number;
  shipping_revenue: number | null;
}

/** Einnahmen-Erkennung VOR der Trennung: status IN (paid, shipped, completed). */
function countedBeforeTrennung(status: string): boolean {
  return status === 'paid' || status === 'shipped' || status === 'completed';
}

/** Reiner TS-Spiegel von Migration 0017 (drizzle/0017_modul_08_status_trennung.sql). */
function applyMigration0017<T extends MigratableOrder>(order: T): T {
  if (order.status !== 'paid') return order;
  const payment_received_date =
    order.payment_received_date && order.payment_received_date !== ''
      ? order.payment_received_date
      : order.order_date;
  return { ...order, status: 'confirmed', payment_status: 'paid', payment_received_date };
}

function incomeAmount(order: MigratableOrder): number {
  return order.sale_price + (order.shipping_revenue ?? 0);
}

const DATASET: MigratableOrder[] = [
  // Bug-Fall: Auftrag "paid" gesetzt, Zahlung aber auf pending stehen geblieben.
  {
    id: 'a',
    status: 'paid',
    payment_status: 'pending',
    payment_received_date: null,
    order_date: '2026-03-01',
    sale_price: 100,
    shipping_revenue: 5,
  },
  // Sauberer paid-Auftrag mit Zahlungsdatum.
  {
    id: 'b',
    status: 'paid',
    payment_status: 'paid',
    payment_received_date: '2026-03-10',
    order_date: '2026-03-05',
    sale_price: 50,
    shipping_revenue: null,
  },
  // Versendet, Zahlung offen – zählte immer schon (statusbasiert).
  {
    id: 'c',
    status: 'shipped',
    payment_status: 'pending',
    payment_received_date: null,
    order_date: '2026-04-01',
    sale_price: 30,
    shipping_revenue: 2,
  },
  // Abgeschlossen und bezahlt.
  {
    id: 'd',
    status: 'completed',
    payment_status: 'paid',
    payment_received_date: '2026-04-15',
    order_date: '2026-04-10',
    sale_price: 40,
    shipping_revenue: null,
  },
  // Bezahlt, aber erst bestellt: darf WEDER vorher NOCH nachher zählen
  // (Schutz gegen versehentliche Verbreiterung durch payment_status='paid').
  {
    id: 'e',
    status: 'ordered',
    payment_status: 'paid',
    payment_received_date: '2026-05-01',
    order_date: '2026-05-01',
    sale_price: 999,
    shipping_revenue: null,
  },
  {
    id: 'f',
    status: 'inquiry',
    payment_status: 'pending',
    payment_received_date: null,
    order_date: '2026-05-02',
    sale_price: 12,
    shipping_revenue: null,
  },
  {
    id: 'g',
    status: 'cancelled',
    payment_status: 'paid',
    payment_received_date: '2026-05-03',
    order_date: '2026-05-03',
    sale_price: 77,
    shipping_revenue: null,
  },
];

describe('EÜR-Export-Einnahmen über Migration 0017', () => {
  it('zählt exakt dieselben Aufträge vor und nach der Trennung (Summe identisch)', () => {
    const before = DATASET.filter((o) => countedBeforeTrennung(o.status));
    const after = DATASET.map(applyMigration0017).filter((o) =>
      orderCountsAsEuerIncome(o.status, o.payment_status),
    );

    const sumBefore = before.reduce((s, o) => s + incomeAmount(o), 0);
    const sumAfter = after.reduce((s, o) => s + incomeAmount(o), 0);

    expect(sumBefore).toBe(227);
    expect(sumAfter).toBe(sumBefore);
    expect(after.map((o) => o.id).sort()).toEqual(before.map((o) => o.id).sort());
  });

  it('verliert keinen einzigen zuvor gezählten Auftrag (keine Verschlechterung)', () => {
    for (const order of DATASET) {
      const countedBefore = countedBeforeTrennung(order.status);
      const migrated = applyMigration0017(order);
      const countedAfter = orderCountsAsEuerIncome(migrated.status, migrated.payment_status);
      if (countedBefore) {
        expect(countedAfter, `Auftrag ${order.id} fällt aus der EÜR heraus`).toBe(true);
      }
    }
  });

  it('sichert bei der Migration Zahlungsstatus und -datum jedes ehemaligen paid-Auftrags', () => {
    for (const order of DATASET.filter((o) => o.status === 'paid')) {
      const migrated = applyMigration0017(order);
      expect(migrated.status).toBe('confirmed');
      expect(migrated.payment_status).toBe('paid');
      expect(migrated.payment_received_date).toBe(order.payment_received_date ?? order.order_date);
    }
  });
});

describe('EÜR-Jahresreport über Migration 0017', () => {
  function euerOrder(
    partial: Partial<EuerOrderInput> & Pick<EuerOrderInput, 'id'>,
  ): EuerOrderInput {
    return {
      receipt_number: `2026-${partial.id}`,
      external_order_id: null,
      platform: 'direkt',
      product_name: 'Vase',
      variant: null,
      quantity: 1,
      sale_price: 0,
      shipping_revenue: null,
      status: 'completed',
      payment_status: 'paid',
      payment_received_date: null,
      paid_event_date: null,
      order_date: '2026-01-01',
      deleted_at: null,
      ...partial,
    };
  }

  const orders: EuerOrderInput[] = [
    euerOrder({
      id: 'c1',
      status: 'completed',
      payment_status: 'paid',
      payment_received_date: '2026-03-01',
      sale_price: 40,
    }),
    euerOrder({
      id: 's1',
      status: 'shipped',
      payment_status: 'paid',
      payment_received_date: '2026-04-01',
      sale_price: 30,
    }),
    euerOrder({
      id: 's2',
      status: 'shipped',
      payment_status: 'pending',
      payment_received_date: '2026-04-02',
      sale_price: 500,
    }),
    // ehemalige paid-Aufträge – im Jahresreport nie Einnahme (kein income-Status),
    // weder vor noch nach der Migration.
    euerOrder({
      id: 'p1',
      status: 'paid',
      payment_status: 'pending',
      payment_received_date: null,
      order_date: '2026-05-01',
      sale_price: 100,
    }),
    euerOrder({
      id: 'p2',
      status: 'paid',
      payment_status: 'paid',
      payment_received_date: '2026-06-01',
      sale_price: 200,
    }),
  ];

  it('liefert identische Einnahmen-Summe vor und nach der Migration', () => {
    const before = buildEuerYearReport(2026, orders, []);
    const migrated = orders.map((order) => {
      const m = applyMigration0017({
        id: order.id,
        status: order.status,
        payment_status: order.payment_status,
        payment_received_date: order.payment_received_date,
        order_date: order.order_date,
        sale_price: order.sale_price,
        shipping_revenue: order.shipping_revenue,
      });
      return {
        ...order,
        status: m.status,
        payment_status: m.payment_status,
        payment_received_date: m.payment_received_date,
      };
    });
    const after = buildEuerYearReport(2026, migrated, []);

    expect(before.incomeTotal).toBe(70);
    expect(after.incomeTotal).toBe(before.incomeTotal);
  });
});
