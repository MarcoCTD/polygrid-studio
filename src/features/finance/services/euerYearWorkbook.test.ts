import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildEuerYearReport, type EuerExpenseInput, type EuerOrderInput } from './euerYear';
import { buildEuerYearWorkbook, EUER_AFA_HINWEIS, EUER_DISCLAIMER } from './euerYearWorkbook';

function order(overrides: Partial<EuerOrderInput>): EuerOrderInput {
  return {
    id: crypto.randomUUID(),
    receipt_number: '2026-0001',
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

function expense(overrides: Partial<EuerExpenseInput>): EuerExpenseInput {
  return {
    id: crypto.randomUUID(),
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

const FIXTURE_REPORT = buildEuerYearReport(
  2026,
  [
    order({ sale_price: 100, shipping_revenue: 5, payment_received_date: '2026-01-10' }),
    order({
      sale_price: 50,
      status: 'shipped',
      payment_received_date: null,
      paid_event_date: null,
      order_date: '2026-06-20',
      external_order_id: 'ETSY-999',
    }),
    order({ sale_price: 30, payment_status: 'refunded', payment_received_date: '2026-07-01' }),
  ],
  [
    expense({ amount_gross: 40, date: '2026-01-05' }),
    expense({ amount_gross: 20, category: 'werbung', subcategory: 'etsy_ads', date: '2026-02-01' }),
    expense({ amount_gross: 15, tax_relevant: false, date: '2026-02-02' }),
  ],
);

async function loadWorkbook(): Promise<ExcelJS.Workbook> {
  const buffer = await buildEuerYearWorkbook(FIXTURE_REPORT, {
    companyName: 'PolyGrid Studio',
    createdAt: new Date('2027-01-15T10:00:00'),
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
  return workbook;
}

function sheetText(sheet: ExcelJS.Worksheet): string {
  const parts: string[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      parts.push(String(cell.value ?? ''));
    });
  });
  return parts.join('\n');
}

function findRowValue(sheet: ExcelJS.Worksheet, label: string, column: number): unknown {
  let found: unknown;
  sheet.eachRow((row) => {
    if (String(row.getCell(1).value ?? '') === label) {
      found = row.getCell(column).value;
    }
  });
  return found;
}

describe('buildEuerYearWorkbook', () => {
  it('erzeugt eine valide xlsx mit genau den vier Sheets', async () => {
    const workbook = await loadWorkbook();
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Übersicht',
      'Einnahmen',
      'Ausgaben',
      'Monatsübersicht',
    ]);
  });

  it('Übersicht enthält Firmenname, Summen, Überschuss und Kategorien', async () => {
    const workbook = await loadWorkbook();
    const overview = workbook.getWorksheet('Übersicht');
    if (!overview) throw new Error('Übersicht fehlt');

    const text = sheetText(overview);
    expect(text).toContain('PolyGrid Studio');
    expect(text).toContain('Einnahmen-Überschuss-Rechnung 2026');
    expect(findRowValue(overview, 'Einnahmen', 2)).toBe(155);
    expect(findRowValue(overview, 'Ausgaben gesamt (steuerrelevant)', 2)).toBe(60);
    expect(findRowValue(overview, 'Überschuss (Einnahmen − Ausgaben)', 2)).toBe(95);
    expect(findRowValue(overview, 'Ausgaben – Filament', 2)).toBe(40);
    expect(findRowValue(overview, 'Ausgaben – Werbung', 2)).toBe(20);
  });

  it('Übersicht enthält Disclaimer und 800-EUR-Hinweis', async () => {
    const workbook = await loadWorkbook();
    const overview = workbook.getWorksheet('Übersicht');
    if (!overview) throw new Error('Übersicht fehlt');
    const text = sheetText(overview);
    expect(text).toContain(EUER_DISCLAIMER);
    expect(text).toContain(EUER_AFA_HINWEIS);
    expect(text).toContain('800 EUR');
  });

  it('Einnahmen-Sheet hat Datumsquelle, Summenzeile und Nicht-enthalten-Abschnitt', async () => {
    const workbook = await loadWorkbook();
    const income = workbook.getWorksheet('Einnahmen');
    if (!income) throw new Error('Einnahmen fehlt');

    const text = sheetText(income);
    expect(text).toContain('Datumsquelle');
    expect(text).toContain('Zahlungsdatum');
    expect(text).toContain('Bestelldatum (Fallback)');
    expect(text).toContain('ETSY-999');
    expect(text).toContain('Nicht enthalten (refundiert/strittig)');
    expect(text).toContain('Refundiert');
    expect(findRowValue(income, 'Summe Einnahmen', 7)).toBe(155);
  });

  it('Ausgaben-Sheet hat Zwischensummen pro Kategorie und Gesamtsumme', async () => {
    const workbook = await loadWorkbook();
    const expenses = workbook.getWorksheet('Ausgaben');
    if (!expenses) throw new Error('Ausgaben fehlt');

    expect(findRowValue(expenses, 'Zwischensumme Filament', 7)).toBe(40);
    expect(findRowValue(expenses, 'Zwischensumme Werbung', 7)).toBe(20);
    expect(findRowValue(expenses, 'Gesamtsumme Ausgaben', 7)).toBe(60);
    expect(sheetText(expenses)).toContain('Nicht steuerrelevant – nicht in der Summe');
  });

  it('Monatsübersicht hat 12 Monate plus Jahreszeile mit konsistenten Summen', async () => {
    const workbook = await loadWorkbook();
    const months = workbook.getWorksheet('Monatsübersicht');
    if (!months) throw new Error('Monatsübersicht fehlt');

    // Header + 12 Monate + Jahreszeile
    expect(months.actualRowCount).toBe(14);
    expect(findRowValue(months, 'Januar', 2)).toBe(105);
    expect(findRowValue(months, 'Januar', 3)).toBe(40);
    expect(findRowValue(months, 'Januar', 4)).toBe(65);
    expect(findRowValue(months, 'Juni', 2)).toBe(50);
    expect(findRowValue(months, 'Jahr 2026', 2)).toBe(155);
    expect(findRowValue(months, 'Jahr 2026', 3)).toBe(60);
    expect(findRowValue(months, 'Jahr 2026', 4)).toBe(95);
  });

  it('formatiert Beträge als EUR und Kopfzeilen fett', async () => {
    const workbook = await loadWorkbook();
    const income = workbook.getWorksheet('Einnahmen');
    if (!income) throw new Error('Einnahmen fehlt');

    expect(income.getRow(1).font?.bold).toBe(true);
    expect(income.getRow(2).getCell(7).numFmt).toContain('#,##0.00');
  });
});
