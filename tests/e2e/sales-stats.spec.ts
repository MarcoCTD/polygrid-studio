/**
 * E2E: Verkaufszahlen pro Produkt (Modul 15, Teil 1).
 * - Verkäufe-Tab im Produkt-Detail (Kennzahlen, letzte Aufträge, Klick zum Auftrag)
 * - Spalte "Verkauft" in der Produktliste (Aggregat, sortierbar)
 * - Top-Seller-Widget auf dem Dashboard (letzte 90 Tage)
 */
import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';
import type { Page } from '@playwright/test';

const PRODUCT_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const PRODUCT_B = 'bbbbbbbb-2222-4222-8222-222222222222';

let receiptCounter = 0;

async function bootApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
}

function seedProduct(
  tauri: TauriMock,
  id: string,
  name: string,
  extras: { estimated_margin?: number | null; status?: string } = {},
): void {
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO products (id, name, category, status, material_type, estimated_margin, created_at, updated_at)
     VALUES ($1, $2, 'Deko', $3, 'PLA', $4, $5, $6)`,
    [id, name, extras.status ?? 'online', extras.estimated_margin ?? null, now, now],
  );
}

interface SeedOrderOptions {
  productId?: string | null;
  quantity?: number;
  salePrice?: number;
  status?: string;
  paymentStatus?: string;
  daysAgo?: number;
  deleted?: boolean;
}

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function seedOrder(tauri: TauriMock, options: SeedOrderOptions = {}): { id: string; receipt: string } {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  receiptCounter += 1;
  const receipt = `2026-${String(1000 + receiptCounter)}`;
  tauri.execute(
    `INSERT INTO orders (
       id, receipt_number, platform, product_id, quantity, sale_price,
       status, payment_status, order_date, tax_locked, created_at, updated_at, deleted_at
     ) VALUES ($1, $2, 'etsy', $3, $4, $5, $6, $7, $8, 0, $9, $10, $11)`,
    [
      id,
      receipt,
      options.productId === undefined ? PRODUCT_A : options.productId,
      options.quantity ?? 1,
      options.salePrice ?? 20,
      options.status ?? 'completed',
      options.paymentStatus ?? 'paid',
      isoDateDaysAgo(options.daysAgo ?? 3),
      now,
      now,
      options.deleted ? now : null,
    ],
  );
  return { id, receipt };
}

test('Verkäufe-Tab: Kennzahlen korrekt, refunded/cancelled/gelöscht ausgeschlossen', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedProduct(tauri, PRODUCT_A, 'Spiral-Vase');

  // Zählt: 2 + 1 Einheiten (40 EUR gesamt), davon 2 in den letzten 30 Tagen
  seedOrder(tauri, { quantity: 2, salePrice: 10, daysAgo: 3 });
  seedOrder(tauri, { quantity: 1, salePrice: 20, daysAgo: 60 });
  // Zählt NICHT:
  seedOrder(tauri, { paymentStatus: 'refunded', daysAgo: 2 });
  seedOrder(tauri, { status: 'cancelled', daysAgo: 2 });
  seedOrder(tauri, { deleted: true, daysAgo: 2 });

  await page.goto(`/products/${PRODUCT_A}?tab=sales`);

  await expect(page.getByTestId('sales-tab')).toBeVisible();
  await expect(page.getByTestId('sales-kpi-total-units')).toContainText('3');
  await expect(page.getByTestId('sales-kpi-total-revenue')).toContainText('40,00');
  await expect(page.getByTestId('sales-kpi-last30')).toContainText('2');
});

test('Verkäufe-Tab: letzte Aufträge sichtbar, Klick öffnet den Auftrag', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedProduct(tauri, PRODUCT_A, 'Spiral-Vase');
  const { receipt } = seedOrder(tauri, { quantity: 1, salePrice: 25, daysAgo: 1 });

  await page.goto(`/products/${PRODUCT_A}?tab=sales`);
  const orderButton = page.getByRole('button', { name: new RegExp(receipt) });
  await expect(orderButton).toBeVisible();
  await orderButton.click();

  await expect(page).toHaveURL(/\/orders\?/);
  // Detail-Panel des Auftrags ist geöffnet
  await expect(page.getByText(receipt).first()).toBeVisible();
});

test('Produktliste: Spalte "Verkauft" zeigt Aggregat und ist sortierbar', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedProduct(tauri, PRODUCT_A, 'Vase Alpha');
  seedProduct(tauri, PRODUCT_B, 'Halter Beta');
  seedOrder(tauri, { productId: PRODUCT_A, quantity: 5, daysAgo: 2 });
  seedOrder(tauri, { productId: PRODUCT_B, quantity: 2, daysAgo: 2 });

  await page.goto('/products');
  await expect(page.getByText('Verkauft')).toBeVisible();

  const rowFor = (name: string) =>
    page.locator('div[class*="absolute left-0 top-0"]', { hasText: name });
  await expect(rowFor('Vase Alpha')).toContainText('5');
  await expect(rowFor('Halter Beta')).toContainText('2');

  // Numerische Spalte: erster Klick sortiert absteigend (Vase Alpha mit 5 zuerst) …
  const header = page.locator('div.sticky').getByText('Verkauft');
  const firstRow = page.locator('div[class*="absolute left-0 top-0"]').first();
  await header.click();
  await expect(firstRow).toContainText('Vase Alpha');
  // … zweiter Klick aufsteigend (Halter Beta mit 2 zuerst)
  await header.click();
  await expect(firstRow).toContainText('Halter Beta');
});

test('Dashboard: Top-Seller-Widget zeigt Top-Produkte der letzten 90 Tage', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedProduct(tauri, PRODUCT_A, 'Vase Alpha');
  seedProduct(tauri, PRODUCT_B, 'Halter Beta');
  seedOrder(tauri, { productId: PRODUCT_A, quantity: 5, salePrice: 10, daysAgo: 10 });
  seedOrder(tauri, { productId: PRODUCT_B, quantity: 2, salePrice: 30, daysAgo: 10 });
  // Außerhalb des 90-Tage-Fensters – darf nicht gezählt werden
  seedOrder(tauri, { productId: PRODUCT_B, quantity: 50, daysAgo: 120 });

  await page.reload();
  const widget = page.getByTestId('top-sellers-widget');
  await expect(widget).toBeVisible();

  const items = widget.locator('li');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Vase Alpha');
  await expect(items.nth(0)).toContainText('5 Verkäufe');
  await expect(items.nth(0)).toContainText('50,00');
  await expect(items.nth(1)).toContainText('Halter Beta');

  // Klick öffnet das Produkt
  await items.nth(0).getByRole('button').click();
  await expect(page).toHaveURL(new RegExp(`/products/${PRODUCT_A}`));
});
