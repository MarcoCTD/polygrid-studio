import ExcelJS from 'exceljs';
import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';

/**
 * E2E-Tests für Modul 14 (EÜR-Jahresexport): Vorschau, Warnungen, Excel-Datei
 * mit vier Sheets, Summenkonsistenz zur Ausgaben-Seite und
 * Kleinunternehmergrenzen-Widget. Fixture-Jahr ist 2025, damit das
 * Grenzen-Widget (laufendes Jahr) unabhängig getestet werden kann.
 */

interface SeedOrder {
  id: string;
  receiptNumber: string;
  salePrice: number;
  shippingRevenue?: number | null;
  status?: string;
  paymentStatus?: string;
  paymentReceivedDate?: string | null;
  orderDate: string;
  externalOrderId?: string | null;
}

function seedOrder(tauri: TauriMock, order: SeedOrder): void {
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO orders (
       id, receipt_number, external_order_id, platform, quantity, sale_price,
       shipping_revenue, status, payment_status, payment_received_date,
       order_date, tax_locked, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13)`,
    [
      order.id,
      order.receiptNumber,
      order.externalOrderId ?? null,
      'etsy',
      1,
      order.salePrice,
      order.shippingRevenue ?? null,
      order.status ?? 'completed',
      order.paymentStatus ?? 'paid',
      order.paymentReceivedDate ?? null,
      order.orderDate,
      now,
      now,
    ],
  );
}

interface SeedExpense {
  id: string;
  date: string;
  amount: number;
  category?: string;
  receiptAttached?: boolean;
  taxRelevant?: boolean;
}

function seedExpense(tauri: TauriMock, expense: SeedExpense): void {
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO expenses (
       id, date, amount_gross, vendor, category, receipt_attached, tax_relevant,
       created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      expense.id,
      expense.date,
      expense.amount,
      'Test-Händler',
      expense.category ?? 'filament',
      expense.receiptAttached === false ? 0 : 1,
      expense.taxRelevant === false ? 0 : 1,
      now,
      now,
    ],
  );
}

/**
 * Fixture 2025: Einnahmen 105 + 50 = 155 €, Ausgaben 40 + 20 = 60 €,
 * Überschuss 95 €. Dazu: refunded (nicht summiert), completed+pending
 * (Inkonsistenz-Warnung), Fallback-Datum (Warnung), Jahresgrenzfall
 * 31.12.2025→01.01.2026 (gehört zu 2026), nicht steuerrelevante Ausgabe.
 */
function seedFixture2025(tauri: TauriMock): void {
  seedOrder(tauri, {
    id: 'ord-a',
    receiptNumber: '2025-0001',
    salePrice: 100,
    shippingRevenue: 5,
    paymentReceivedDate: '2025-03-10',
    orderDate: '2025-03-01',
    externalOrderId: 'ETSY-100',
  });
  seedOrder(tauri, {
    id: 'ord-b',
    receiptNumber: '2025-0002',
    salePrice: 50,
    status: 'shipped',
    paymentReceivedDate: null,
    orderDate: '2025-06-20',
  });
  seedOrder(tauri, {
    id: 'ord-c',
    receiptNumber: '2025-0003',
    salePrice: 30,
    paymentStatus: 'refunded',
    paymentReceivedDate: '2025-07-01',
    orderDate: '2025-06-25',
  });
  seedOrder(tauri, {
    id: 'ord-d',
    receiptNumber: '2025-0004',
    salePrice: 77,
    paymentStatus: 'pending',
    paymentReceivedDate: null,
    orderDate: '2025-08-01',
  });
  // Jahresgrenzfall: bestellt 31.12.2025, bezahlt 01.01.2026 -> Steuerjahr 2026
  seedOrder(tauri, {
    id: 'ord-e',
    receiptNumber: '2025-0005',
    salePrice: 999,
    paymentReceivedDate: '2026-01-01',
    orderDate: '2025-12-31',
  });

  seedExpense(tauri, { id: 'exp-1', date: '2025-01-05', amount: 40 });
  seedExpense(tauri, {
    id: 'exp-2',
    date: '2025-02-01',
    amount: 20,
    category: 'werbung',
    receiptAttached: false,
  });
  seedExpense(tauri, {
    id: 'exp-3',
    date: '2025-02-02',
    amount: 15,
    taxRelevant: false,
  });
  seedExpense(tauri, { id: 'exp-4', date: '2026-01-01', amount: 99 });
}

async function openSteuerExportTab(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/analytics');
  await page.getByRole('tab', { name: 'Steuer-Export' }).click();
  await expect(page.getByTestId('euer-vorschau')).toBeVisible();
}

async function selectYear(page: import('@playwright/test').Page, year: string): Promise<void> {
  await page.getByLabel('Jahr wählen').click();
  await page.getByRole('option', { name: year }).click();
}

test('Vorschau zeigt korrekte Summen und alle drei Warnhinweise', async ({ page, tauri }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
  seedFixture2025(tauri);

  await openSteuerExportTab(page);
  await selectYear(page, '2025');

  await expect(page.getByTestId('euer-einnahmen')).toContainText('155,00 €');
  await expect(page.getByTestId('euer-einnahmen')).toContainText('2 Aufträge');
  await expect(page.getByTestId('euer-ausgaben')).toContainText('60,00 €');
  await expect(page.getByTestId('euer-ueberschuss')).toContainText('95,00 €');

  const warnings = page.getByTestId('euer-warnungen');
  await expect(warnings).toContainText('1 Ausgabe(n) ohne Beleg');
  await expect(warnings).toContainText('ohne Zahlungsdatum');
  await expect(warnings).toContainText('Dateninkonsistenz');

  await expect(page.getByTestId('euer-nicht-enthalten')).toContainText(
    '1 refundierte/strittige Aufträge (30,00 €)',
  );
  await expect(page.getByTestId('euer-nicht-enthalten')).toContainText(
    '1 nicht steuerrelevante Ausgaben (15,00 €)',
  );

  // Disclaimer dauerhaft auf der Seite (Spec 1)
  await expect(page.getByText('Ersetzt keine steuerliche Beratung')).toBeVisible();
});

test('Export über Speichern-Dialog erzeugt valide xlsx mit vier Sheets und korrekten Summen', async ({
  page,
  tauri,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
  seedFixture2025(tauri);

  await openSteuerExportTab(page);
  await selectYear(page, '2025');
  await expect(page.getByTestId('euer-einnahmen')).toContainText('155,00 €');

  const targetPath = '/mock/exports/euer_2025_test.xlsx';
  tauri.nextDialogResult = targetPath;
  await page.getByRole('button', { name: 'Excel exportieren' }).click();

  // Toast mit Pfad und Öffnen-Button (Spec 4)
  await expect(page.getByText('EÜR 2025 exportiert')).toBeVisible();
  await expect(page.getByText(targetPath)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Öffnen' })).toBeVisible();

  const base64 = tauri.writtenFiles.get(targetPath);
  expect(base64).toBeTruthy();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(String(base64), 'base64'));
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    'Übersicht',
    'Einnahmen',
    'Ausgaben',
    'Monatsübersicht',
  ]);

  const overview = workbook.getWorksheet('Übersicht');
  const cells = new Map<string, unknown>();
  overview?.eachRow((row) => {
    cells.set(String(row.getCell(1).value ?? ''), row.getCell(2).value);
  });
  expect(cells.get('Einnahmen')).toBe(155);
  expect(cells.get('Ausgaben gesamt (steuerrelevant)')).toBe(60);
  expect(cells.get('Überschuss (Einnahmen − Ausgaben)')).toBe(95);

  // Disclaimer und 800-EUR-Hinweis im Excel (Spec 3/5)
  const overviewText: string[] = [];
  overview?.eachRow((row) =>
    row.eachCell((cell) => overviewText.push(String(cell.value ?? ''))),
  );
  expect(overviewText.join('\n')).toContain('ersetzt keine steuerliche Beratung');
  expect(overviewText.join('\n')).toContain('800 EUR');

  // Einnahmen-Sheet: Datumsquelle gekennzeichnet, refunded ausgewiesen
  const incomeText: string[] = [];
  workbook
    .getWorksheet('Einnahmen')
    ?.eachRow((row) => row.eachCell((cell) => incomeText.push(String(cell.value ?? ''))));
  const incomeJoined = incomeText.join('\n');
  expect(incomeJoined).toContain('Bestelldatum (Fallback)');
  expect(incomeJoined).toContain('Nicht enthalten (refundiert/strittig)');
  expect(incomeJoined).toContain('ETSY-100');

  // Konsistenz zur Ausgaben-Seite: Zwischensummen (steuerrelevant) plus
  // nicht steuerrelevante Beträge müssen der SQL-Semantik der
  // Ausgaben-Seite entsprechen (SUM(amount_gross) je Kategorie, alle Ausgaben).
  const pageTotals = tauri.select(
    `SELECT category, SUM(amount_gross) AS total
     FROM expenses
     WHERE deleted_at IS NULL AND date >= '2025-01-01' AND date <= '2025-12-31'
     GROUP BY category`,
  );
  const expected = new Map(pageTotals.map((row) => [String(row.category), Number(row.total)]));

  const expenseSheet = workbook.getWorksheet('Ausgaben');
  const subtotals = new Map<string, number>();
  let nonTaxSection = false;
  const nonTaxByCategory = new Map<string, number>();
  expenseSheet?.eachRow((row) => {
    const first = String(row.getCell(1).value ?? '');
    if (first.startsWith('Zwischensumme ')) {
      subtotals.set(first.replace('Zwischensumme ', ''), Number(row.getCell(7).value));
    }
    if (first.startsWith('Nicht steuerrelevant')) {
      nonTaxSection = true;
      return;
    }
    if (nonTaxSection && row.getCell(7).value !== null && row.getCell(3).value) {
      const label = String(row.getCell(3).value);
      nonTaxByCategory.set(
        label,
        (nonTaxByCategory.get(label) ?? 0) + Number(row.getCell(7).value),
      );
    }
  });

  // Filament: 40 steuerrelevant + 15 nicht steuerrelevant = 55 (Ausgaben-Seite)
  expect((subtotals.get('Filament') ?? 0) + (nonTaxByCategory.get('Filament') ?? 0)).toBe(
    expected.get('filament'),
  );
  // Werbung: 20 steuerrelevant, keine nicht steuerrelevanten
  expect(subtotals.get('Werbung')).toBe(expected.get('werbung'));

  // Monatsübersicht: Jahreszeile konsistent
  const monthSheet = workbook.getWorksheet('Monatsübersicht');
  const yearCells = new Map<string, unknown[]>();
  monthSheet?.eachRow((row) => {
    yearCells.set(String(row.getCell(1).value ?? ''), [
      row.getCell(2).value,
      row.getCell(3).value,
      row.getCell(4).value,
    ]);
  });
  expect(yearCells.get('Jahr 2025')).toEqual([155, 60, 95]);
  expect(monthSheet?.actualRowCount).toBe(14);
});

test('Export nach OneDrive schreibt nach /01_Finanzen/Exporte/ mit Firmenname-Slug', async ({
  page,
  tauri,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
  seedFixture2025(tauri);
  tauri.execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('onedrive_base_path', '"/mock/onedrive"', $1)
     ON CONFLICT(key) DO UPDATE SET value = '"/mock/onedrive"'`,
    [new Date().toISOString()],
  );

  await openSteuerExportTab(page);
  await selectYear(page, '2025');
  await expect(page.getByTestId('euer-einnahmen')).toContainText('155,00 €');

  await page.getByLabel('Export-Ziel wählen').click();
  await page.getByRole('option', { name: /OneDrive/ }).click();
  await page.getByRole('button', { name: 'Excel exportieren' }).click();

  await expect(page.getByText('EÜR 2025 exportiert')).toBeVisible();

  const expectedPath = '/mock/onedrive/01_Finanzen/Exporte/euer_2025_polygrid-studio.xlsx';
  await expect.poll(() => tauri.writtenFiles.has(expectedPath)).toBe(true);

  // Standard-Ordnerstruktur wurde vor dem Schreiben sichergestellt
  expect(
    tauri.invokeLog.some((entry) => entry.cmd === 'ensure_onedrive_structure'),
  ).toBe(true);
});

test('Kleinunternehmergrenzen-Widget: grün bei niedrigem Jahresumsatz, identisch auf Dashboard und Export-Seite', async ({
  page,
  tauri,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();

  const currentYear = new Date().getFullYear();
  seedOrder(tauri, {
    id: 'ord-kur-1',
    receiptNumber: `${currentYear}-0001`,
    salePrice: 1000,
    paymentReceivedDate: `${currentYear}-02-01`,
    orderDate: `${currentYear}-02-01`,
  });

  await page.reload();
  const dashboardWidget = page.getByTestId('kleinunternehmer-widget');
  await expect(dashboardWidget).toHaveAttribute('data-ampel', 'gruen');
  await expect(dashboardWidget).toContainText('1.000,00 €');

  await openSteuerExportTab(page);
  const exportWidget = page.getByTestId('kleinunternehmer-widget');
  await expect(exportWidget).toHaveAttribute('data-ampel', 'gruen');
  await expect(exportWidget).toContainText('1.000,00 €');
});

test('Kleinunternehmergrenzen-Widget: gelb ab 80 %, rot über 100 % mit Hinweis', async ({
  page,
  tauri,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();

  const currentYear = new Date().getFullYear();
  seedOrder(tauri, {
    id: 'ord-kur-2',
    receiptNumber: `${currentYear}-0002`,
    salePrice: 21_000,
    paymentReceivedDate: `${currentYear}-03-01`,
    orderDate: `${currentYear}-03-01`,
  });

  await page.reload();
  const widget = page.getByTestId('kleinunternehmer-widget');
  await expect(widget).toHaveAttribute('data-ampel', 'gelb');

  seedOrder(tauri, {
    id: 'ord-kur-3',
    receiptNumber: `${currentYear}-0003`,
    salePrice: 5_000,
    paymentReceivedDate: `${currentYear}-04-01`,
    orderDate: `${currentYear}-04-01`,
  });

  await page.reload();
  await expect(widget).toHaveAttribute('data-ampel', 'rot');
  await expect(widget).toContainText('Grenze überschritten');
  await expect(widget).toContainText('Steuerberater');
});

test('Refundierte Aufträge und nicht steuerrelevante Ausgaben verändern die Summen nicht', async ({
  page,
  tauri,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();

  // Nur ein sauberer Auftrag plus refunded/nicht-steuerrelevant
  seedOrder(tauri, {
    id: 'ord-clean',
    receiptNumber: '2025-0100',
    salePrice: 200,
    paymentReceivedDate: '2025-05-01',
    orderDate: '2025-05-01',
  });
  seedOrder(tauri, {
    id: 'ord-ref',
    receiptNumber: '2025-0101',
    salePrice: 500,
    paymentStatus: 'refunded',
    paymentReceivedDate: '2025-05-02',
    orderDate: '2025-05-02',
  });
  seedExpense(tauri, { id: 'exp-tax', date: '2025-05-03', amount: 50 });
  seedExpense(tauri, { id: 'exp-notax', date: '2025-05-04', amount: 500, taxRelevant: false });

  await openSteuerExportTab(page);
  await selectYear(page, '2025');

  await expect(page.getByTestId('euer-einnahmen')).toContainText('200,00 €');
  await expect(page.getByTestId('euer-ausgaben')).toContainText('50,00 €');
  await expect(page.getByTestId('euer-ueberschuss')).toContainText('150,00 €');
});
