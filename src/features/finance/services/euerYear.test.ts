import { describe, expect, it } from 'vitest';
import {
  buildEuerYearReport,
  companyNameSlug,
  effectiveIncomeDate,
  euerExportFilename,
  kleinunternehmerStatus,
  orderIncomeAmount,
  type EuerExpenseInput,
  type EuerOrderInput,
} from './euerYear';

let orderCounter = 0;

function makeOrder(overrides: Partial<EuerOrderInput> = {}): EuerOrderInput {
  orderCounter += 1;
  return {
    id: `order-${orderCounter}`,
    receipt_number: `2026-${String(orderCounter).padStart(4, '0')}`,
    external_order_id: null,
    platform: 'etsy',
    product_name: 'Spiral-Vase',
    variant: null,
    quantity: 1,
    sale_price: 20,
    shipping_revenue: null,
    status: 'completed',
    payment_status: 'paid',
    payment_received_date: '2026-05-10',
    paid_event_date: null,
    order_date: '2026-05-01',
    deleted_at: null,
    ...overrides,
  };
}

let expenseCounter = 0;

function makeExpense(overrides: Partial<EuerExpenseInput> = {}): EuerExpenseInput {
  expenseCounter += 1;
  return {
    id: `expense-${expenseCounter}`,
    date: '2026-03-15',
    amount_gross: 10,
    vendor: 'Filament-Shop',
    category: 'filament',
    subcategory: 'pla',
    purpose: 'PLA schwarz',
    receipt_attached: true,
    tax_relevant: true,
    deleted_at: null,
    ...overrides,
  };
}

describe('effectiveIncomeDate', () => {
  it('bevorzugt payment_received_date als Zahlungsdatum', () => {
    const result = effectiveIncomeDate({
      payment_received_date: '2026-02-03',
      paid_event_date: '2026-02-05T10:00:00.000Z',
      order_date: '2026-01-30',
    });
    expect(result).toEqual({ date: '2026-02-03', source: 'zahlungsdatum' });
  });

  it('normalisiert deutsches Datumsformat DD.MM.YYYY', () => {
    const result = effectiveIncomeDate({
      payment_received_date: '03.02.2026',
      paid_event_date: null,
      order_date: '2026-01-30',
    });
    expect(result).toEqual({ date: '2026-02-03', source: 'zahlungsdatum' });
  });

  it('nutzt das Timeline-Event, wenn kein Zahlungsdatum existiert', () => {
    const result = effectiveIncomeDate({
      payment_received_date: null,
      paid_event_date: '2026-02-05T10:00:00.000Z',
      order_date: '2026-01-30',
    });
    expect(result).toEqual({ date: '2026-02-05', source: 'timeline' });
  });

  it('fällt auf das Bestelldatum zurück (Altdaten)', () => {
    const result = effectiveIncomeDate({
      payment_received_date: null,
      paid_event_date: null,
      order_date: '2026-01-30',
    });
    expect(result).toEqual({ date: '2026-01-30', source: 'bestelldatum' });
  });
});

describe('orderIncomeAmount', () => {
  it('addiert Käufer-Versand, multipliziert NICHT mit quantity (Entscheidung 1)', () => {
    expect(orderIncomeAmount({ sale_price: 24.9, shipping_revenue: 4.99 })).toBe(29.89);
    expect(orderIncomeAmount({ sale_price: 24.9, shipping_revenue: null })).toBe(24.9);
  });
});

describe('buildEuerYearReport – Einnahmen', () => {
  it('zählt completed und shipped mit payment_status paid', () => {
    const report = buildEuerYearReport(
      2026,
      [
        makeOrder({ status: 'completed', sale_price: 10 }),
        makeOrder({ status: 'shipped', sale_price: 20 }),
        makeOrder({ status: 'paid', sale_price: 40 }), // Status paid zählt NICHT (Spec 2.1)
        makeOrder({ status: 'in_production', sale_price: 80 }),
        makeOrder({ status: 'cancelled', sale_price: 160 }),
      ],
      [],
    );
    expect(report.incomeLines).toHaveLength(2);
    expect(report.incomeTotal).toBe(30);
  });

  it('weist refunded/disputed aus, summiert sie aber nicht', () => {
    const report = buildEuerYearReport(
      2026,
      [
        makeOrder({ sale_price: 50 }),
        makeOrder({ payment_status: 'refunded', sale_price: 30 }),
        makeOrder({ payment_status: 'disputed', sale_price: 20 }),
      ],
      [],
    );
    expect(report.incomeTotal).toBe(50);
    expect(report.excludedIncome).toHaveLength(2);
    expect(report.excludedIncomeTotal).toBe(50);
    expect(report.excludedIncome.map((line) => line.paymentStatus).sort()).toEqual([
      'disputed',
      'refunded',
    ]);
  });

  it('ordnet Jahresgrenzfälle nach Zufluss zu: Bestellung 31.12., Zahlung 01.01.', () => {
    const acrossYears = makeOrder({
      order_date: '2025-12-31',
      payment_received_date: '2026-01-01',
    });
    const inOldYear = makeOrder({
      order_date: '2025-12-30',
      payment_received_date: '2025-12-31',
    });

    const report2026 = buildEuerYearReport(2026, [acrossYears, inOldYear], []);
    expect(report2026.incomeLines).toHaveLength(1);
    expect(report2026.incomeLines[0].date).toBe('2026-01-01');
    expect(report2026.months[0].income).toBe(20);

    const report2025 = buildEuerYearReport(2025, [acrossYears, inOldYear], []);
    expect(report2025.incomeLines).toHaveLength(1);
    expect(report2025.incomeLines[0].date).toBe('2025-12-31');
  });

  it('kennzeichnet Fallback-Datum und zählt es als Warnung', () => {
    const report = buildEuerYearReport(
      2026,
      [
        makeOrder({ payment_received_date: null, paid_event_date: null, order_date: '2026-04-04' }),
        makeOrder({}),
      ],
      [],
    );
    const fallback = report.incomeLines.find((line) => line.dateSource === 'bestelldatum');
    expect(fallback?.date).toBe('2026-04-04');
    expect(report.warnings.ordersWithFallbackDate).toBe(1);
  });

  it('nutzt external_order_id mit Fallback auf die interne Belegnummer', () => {
    const report = buildEuerYearReport(
      2026,
      [
        makeOrder({ external_order_id: 'ETSY-4711' }),
        makeOrder({ external_order_id: null, receipt_number: '2026-0042' }),
        makeOrder({ external_order_id: '   ', receipt_number: '2026-0043' }),
      ],
      [],
    );
    const numbers = report.incomeLines.map((line) => line.orderNumber);
    expect(numbers).toContain('ETSY-4711');
    expect(numbers).toContain('2026-0042');
    expect(numbers).toContain('2026-0043');
  });

  it('meldet completed-Aufträge ohne paid als Dateninkonsistenz', () => {
    const report = buildEuerYearReport(
      2026,
      [
        makeOrder({ status: 'completed', payment_status: 'pending' }),
        makeOrder({ status: 'shipped', payment_status: 'pending' }),
      ],
      [],
    );
    expect(report.incomeLines).toHaveLength(0);
    expect(report.warnings.completedNotPaid).toBe(1);
  });

  it('ignoriert soft-gelöschte Aufträge', () => {
    const report = buildEuerYearReport(
      2026,
      [makeOrder({ deleted_at: '2026-06-01T00:00:00.000Z' })],
      [],
    );
    expect(report.incomeLines).toHaveLength(0);
    expect(report.incomeTotal).toBe(0);
  });
});

describe('buildEuerYearReport – Ausgaben', () => {
  it('summiert nur tax_relevant, weist den Rest separat aus', () => {
    const report = buildEuerYearReport(
      2026,
      [],
      [makeExpense({ amount_gross: 100 }), makeExpense({ amount_gross: 50, tax_relevant: false })],
    );
    expect(report.expenseTotal).toBe(100);
    expect(report.nonTaxRelevantLines).toHaveLength(1);
    expect(report.nonTaxRelevantTotal).toBe(50);
    expect(report.surplus).toBe(-100);
  });

  it('bildet Kategorie-Zwischensummen mit Detailzeilen', () => {
    const report = buildEuerYearReport(
      2026,
      [],
      [
        makeExpense({ category: 'filament', amount_gross: 30 }),
        makeExpense({ category: 'filament', amount_gross: 20, subcategory: 'petg' }),
        makeExpense({ category: 'werbung', amount_gross: 80, subcategory: 'etsy_ads' }),
      ],
    );
    expect(report.expenseGroups).toHaveLength(2);
    // Größte Kategorie zuerst (konsistent zur Ausgaben-Seite)
    expect(report.expenseGroups[0].category).toBe('werbung');
    expect(report.expenseGroups[0].subtotal).toBe(80);
    expect(report.expenseGroups[1].subtotal).toBe(50);
    expect(report.expenseGroups[1].lines).toHaveLength(2);
    expect(report.expenseTotal).toBe(130);
  });

  it('zählt fehlende Belege nur bei steuerrelevanten Ausgaben', () => {
    const report = buildEuerYearReport(
      2026,
      [],
      [
        makeExpense({ receipt_attached: false }),
        makeExpense({ receipt_attached: false, tax_relevant: false }),
        makeExpense({ receipt_attached: true }),
      ],
    );
    expect(report.warnings.expensesWithoutReceipt).toBe(1);
  });

  it('filtert auf das Jahr und ignoriert soft-gelöschte Ausgaben', () => {
    const report = buildEuerYearReport(
      2026,
      [],
      [
        makeExpense({ date: '2025-12-31', amount_gross: 11 }),
        makeExpense({ date: '2026-01-01', amount_gross: 22 }),
        makeExpense({ date: '2026-12-31', amount_gross: 33 }),
        makeExpense({ date: '2027-01-01', amount_gross: 44 }),
        makeExpense({ amount_gross: 55, deleted_at: '2026-06-01T00:00:00.000Z' }),
      ],
    );
    expect(report.expenseTotal).toBe(55);
    expect(report.months[0].expenses).toBe(22);
    expect(report.months[11].expenses).toBe(33);
  });
});

describe('buildEuerYearReport – Monatsübersicht und Überschuss', () => {
  it('verteilt auf 12 Monate und berechnet Saldi', () => {
    const report = buildEuerYearReport(
      2026,
      [
        makeOrder({ payment_received_date: '2026-01-15', sale_price: 100 }),
        makeOrder({ payment_received_date: '2026-01-20', sale_price: 50, shipping_revenue: 5 }),
        makeOrder({ payment_received_date: '2026-12-01', sale_price: 200 }),
      ],
      [
        makeExpense({ date: '2026-01-10', amount_gross: 40 }),
        makeExpense({ date: '2026-06-10', amount_gross: 10 }),
      ],
    );
    expect(report.months).toHaveLength(12);
    expect(report.months[0]).toEqual({ month: 1, income: 155, expenses: 40, balance: 115 });
    expect(report.months[5]).toEqual({ month: 6, income: 0, expenses: 10, balance: -10 });
    expect(report.months[11]).toEqual({ month: 12, income: 200, expenses: 0, balance: 200 });
    expect(report.incomeTotal).toBe(355);
    expect(report.expenseTotal).toBe(50);
    expect(report.surplus).toBe(305);
    const monthlyIncomeSum = report.months.reduce((sum, row) => sum + row.income, 0);
    expect(monthlyIncomeSum).toBeCloseTo(report.incomeTotal, 2);
  });

  it('rundet Fließkomma-Summen auf Cent', () => {
    const report = buildEuerYearReport(
      2026,
      [makeOrder({ sale_price: 0.1 }), makeOrder({ sale_price: 0.2 })],
      [],
    );
    expect(report.incomeTotal).toBe(0.3);
  });
});

describe('kleinunternehmerStatus', () => {
  it('grün unter 80 % der 25.000-EUR-Grenze', () => {
    const status = kleinunternehmerStatus(19_999);
    expect(status.ampel).toBe('gruen');
    expect(status.limit).toBe(25_000);
  });

  it('gelb ab 80 % bis einschließlich 100 %', () => {
    expect(kleinunternehmerStatus(20_000).ampel).toBe('gelb');
    expect(kleinunternehmerStatus(25_000).ampel).toBe('gelb');
    expect(kleinunternehmerStatus(25_000).percent).toBe(100);
  });

  it('rot über 100 %', () => {
    const status = kleinunternehmerStatus(25_000.01);
    expect(status.ampel).toBe('rot');
  });
});

describe('Dateiname', () => {
  it('bildet euer_{jahr}_{firmenname-slug}.xlsx', () => {
    expect(euerExportFilename(2026, 'PolyGrid Studio')).toBe('euer_2026_polygrid-studio.xlsx');
  });

  it('transliteriert Umlaute und entfernt Sonderzeichen', () => {
    expect(companyNameSlug('Müllers 3D-Druck & Söhne')).toBe('muellers-3d-druck-soehne');
    expect(companyNameSlug('___')).toBe('export');
  });
});
