import { beforeEach, describe, expect, it } from 'vitest';
import {
  generateReceiptNumber,
  resetReceiptNumberGeneratorForTests,
  type ReceiptNumberDatabase,
} from './receiptNumber';

interface TestOrder {
  receipt_number: string;
  status?: string;
}

class ReceiptNumberTestDatabase implements ReceiptNumberDatabase {
  private readonly orders: TestOrder[];

  constructor(initialOrders: TestOrder[] = []) {
    this.orders = [...initialOrders];
  }

  async select<T>(_query: string, bindValues?: unknown[]): Promise<T> {
    const yearPrefix = String(bindValues?.[0] ?? '').replace('%', '');
    const maxCounter = this.orders
      .filter((order) => order.receipt_number.startsWith(yearPrefix))
      .map((order) => Number(order.receipt_number.split('-')[1]))
      .filter((counter) => Number.isFinite(counter))
      .reduce((max, counter) => Math.max(max, counter), 0);

    return [{ max_counter: maxCounter === 0 ? null : maxCounter }] as T;
  }

  async execute(_query: string, _bindValues?: unknown[]): Promise<unknown> {
    return { rowsAffected: 0 };
  }

  insertOrder(receiptNumber: string, status = 'ordered'): void {
    this.orders.push({ receipt_number: receiptNumber, status });
  }
}

describe('generateReceiptNumber', () => {
  beforeEach(() => {
    resetReceiptNumberGeneratorForTests();
  });

  it('erzeugt als erste Nummer eines Jahres JAHR-0001', async () => {
    const db = new ReceiptNumberTestDatabase();

    await expect(generateReceiptNumber(db, 2026)).resolves.toBe('2026-0001');
  });

  it('inkrementiert bestehende Belegnummern', async () => {
    const db = new ReceiptNumberTestDatabase([{ receipt_number: '2026-0001' }]);

    await expect(generateReceiptNumber(db, 2026)).resolves.toBe('2026-0002');
  });

  it('setzt beim Jahreswechsel zurück', async () => {
    const db = new ReceiptNumberTestDatabase([{ receipt_number: '2025-9999' }]);

    await expect(generateReceiptNumber(db, 2026)).resolves.toBe('2026-0001');
  });

  it('erweitert ab 10000 automatisch auf fünf Stellen', async () => {
    const db = new ReceiptNumberTestDatabase([{ receipt_number: '2026-9999' }]);

    await expect(generateReceiptNumber(db, 2026)).resolves.toBe('2026-10000');
  });

  it('verwendet Nummern bei Stornierung nicht wieder', async () => {
    const db = new ReceiptNumberTestDatabase();
    const firstReceiptNumber = await generateReceiptNumber(db, 2026);
    db.insertOrder(firstReceiptNumber, 'cancelled');

    await expect(generateReceiptNumber(db, 2026)).resolves.toBe('2026-0002');
  });

  it('erzeugt bei parallelen Aufrufen unterschiedliche Nummern', async () => {
    const db = new ReceiptNumberTestDatabase();

    const receiptNumbers = await Promise.all([
      generateReceiptNumber(db, 2026),
      generateReceiptNumber(db, 2026),
      generateReceiptNumber(db, 2026),
    ]);

    expect(receiptNumbers).toEqual(['2026-0001', '2026-0002', '2026-0003']);
  });
});
