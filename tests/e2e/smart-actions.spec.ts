/**
 * E2E: Smart Actions (Modul 15, Teil 2).
 * Für jede der 8 Regeln: feuert bei passenden Fixture-Daten, Klick landet in
 * der korrekten, vorgefilterten Zielansicht. Plus Snooze-Mechanik, Sortierung
 * und komplett ausgeblendeter Bereich ohne anstehende Aktionen.
 */
import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';
import type { Page } from '@playwright/test';

const PRODUCT_ID = 'cccccccc-3333-4333-8333-333333333333';

let receiptCounter = 0;

async function bootApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
}

/** Setzt last_backup_at auf jetzt, damit backup_stale in anderen Tests still bleibt. */
function silenceBackupRule(tauri: TauriMock): void {
  tauri.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('last_backup_at', $1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = $2`,
    [JSON.stringify(new Date().toISOString()), new Date().toISOString()],
  );
}

function isoTimestampDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function seedProduct(
  tauri: TauriMock,
  options: { id?: string; name?: string; estimatedMargin?: number | null } = {},
): string {
  const id = options.id ?? PRODUCT_ID;
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO products (id, name, category, status, material_type, estimated_margin, created_at, updated_at)
     VALUES ($1, $2, 'Deko', 'online', 'PLA', $3, $4, $5)`,
    [id, options.name ?? 'Spiral-Vase', options.estimatedMargin ?? null, now, now],
  );
  return id;
}

interface SeedOrderOptions {
  productId?: string | null;
  quantity?: number;
  status?: string;
  paymentStatus?: string;
  shippingStatus?: string | null;
  orderDaysAgo?: number;
  updatedDaysAgo?: number;
}

function seedOrder(tauri: TauriMock, options: SeedOrderOptions = {}): { id: string; receipt: string } {
  const id = crypto.randomUUID();
  receiptCounter += 1;
  const receipt = `2026-${String(2000 + receiptCounter)}`;
  tauri.execute(
    `INSERT INTO orders (
       id, receipt_number, platform, product_id, quantity, sale_price,
       status, payment_status, shipping_status, order_date, tax_locked,
       created_at, updated_at, deleted_at
     ) VALUES ($1, $2, 'etsy', $3, $4, 20, $5, $6, $7, $8, 0, $9, $10, NULL)`,
    [
      id,
      receipt,
      options.productId === undefined ? null : options.productId,
      options.quantity ?? 1,
      options.status ?? 'completed',
      options.paymentStatus ?? 'paid',
      options.shippingStatus ?? 'not_shipped',
      isoDateDaysAgo(options.orderDaysAgo ?? 3),
      isoTimestampDaysAgo(options.updatedDaysAgo ?? 0),
      isoTimestampDaysAgo(options.updatedDaysAgo ?? 0),
    ],
  );
  return { id, receipt };
}

function seedOverdueTask(tauri: TauriMock, title = 'Überfällige Aufgabe'): void {
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO tasks (id, title, priority, status, due_date, created_at, updated_at)
     VALUES ($1, $2, 'medium', 'todo', $3, $4, $5)`,
    [crypto.randomUUID(), title, isoDateDaysAgo(2), now, now],
  );
}

function seedExpenseWithoutReceipt(tauri: TauriMock, vendor = 'Bauhaus'): void {
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO expenses (id, date, amount_gross, vendor, category, receipt_attached, tax_relevant, created_at, updated_at)
     VALUES ($1, $2, 19.99, $3, 'Filament', 0, 1, $4, $5)`,
    [crypto.randomUUID(), isoDateDaysAgo(1), vendor, now, now],
  );
}

function seedListingWithoutTags(tauri: TauriMock, productId: string, title = 'Listing ohne Tags'): void {
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO listings (id, product_id, master_title, master_tags, base_price, inventory_mode, language, status, created_at, updated_at)
     VALUES ($1, $2, $3, '[]', 12.5, 'made_to_order', 'de', 'draft', $4, $5)`,
    [crypto.randomUUID(), productId, title, now, now],
  );
}

function smartActionCard(page: Page, ruleId: string) {
  return page.getByTestId(`smart-action-${ruleId}`);
}

async function clickSmartAction(page: Page, ruleId: string): Promise<void> {
  await smartActionCard(page, ruleId).locator('button[title="Zur Ansicht springen"]').click();
}

test('Bereich "Empfohlene Aktionen" ist ohne anstehende Aktionen komplett ausgeblendet', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  // Widgets sind geladen, aber kein Smart-Action-Bereich und kein Platzhalter
  await expect(page.getByTestId('top-sellers-widget').or(page.getByText('Noch keine Verkäufe in den letzten 90 Tagen.'))).toBeVisible();
  await expect(page.getByTestId('smart-actions-section')).toHaveCount(0);
});

test('backup_stale: feuert ohne Backup, Klick öffnet Settings-Tab Daten & Sicherheit', async ({
  page,
}) => {
  await bootApp(page);

  const card = smartActionCard(page, 'backup_stale');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Noch kein Backup erstellt');

  await clickSmartAction(page, 'backup_stale');
  await expect(page).toHaveURL(/\/settings\/data/);
  await expect(page.getByText('Daten & Sicherheit').first()).toBeVisible();
});

test('orders_stuck: Aufträge >5 Tage in Produktion, Klick öffnet gefiltertes Kanban', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  const { receipt } = seedOrder(tauri, {
    status: 'in_production',
    paymentStatus: 'pending',
    updatedDaysAgo: 6,
    orderDaysAgo: 6,
  });
  await page.reload();

  const card = smartActionCard(page, 'orders_stuck');
  await expect(card).toBeVisible();
  await expect(card).toContainText('länger als 5 Tage in Produktion');

  await clickSmartAction(page, 'orders_stuck');
  await expect(page).toHaveURL(/\/orders\?.*status=in_production/);
  await expect(page).toHaveURL(/view=kanban/);

  const column = page.locator('section', {
    has: page.getByRole('heading', { name: 'In Produktion' }),
  });
  await expect(column.getByText(receipt)).toBeVisible();
});

test('orders_unshipped: bezahlt und >2 Tage nicht versendet, Klick öffnet Kanban (Bezahlt)', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  const { receipt } = seedOrder(tauri, {
    status: 'paid',
    paymentStatus: 'paid',
    shippingStatus: 'not_shipped',
    updatedDaysAgo: 3,
    orderDaysAgo: 3,
  });
  await page.reload();

  const card = smartActionCard(page, 'orders_unshipped');
  await expect(card).toBeVisible();
  await expect(card).toContainText('nicht versendet');

  await clickSmartAction(page, 'orders_unshipped');
  await expect(page).toHaveURL(/\/orders\?.*status=paid/);

  const column = page.locator('section', { has: page.getByRole('heading', { name: 'Bezahlt' }) });
  await expect(column.getByText(receipt)).toBeVisible();
});

test('product_no_listing: 3+ Verkäufe ohne aktives Listing, Klick öffnet Produkt-Tab Listings', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedProduct(tauri, { name: 'Bestseller ohne Listing' });
  seedOrder(tauri, { productId: PRODUCT_ID, quantity: 3, status: 'completed' });
  await page.reload();

  const card = smartActionCard(page, 'product_no_listing');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Bestseller ohne Listing');

  await clickSmartAction(page, 'product_no_listing');
  await expect(page).toHaveURL(new RegExp(`/products/${PRODUCT_ID}\\?.*tab=listings`));
  await expect(page.getByRole('tab', { name: 'Listings' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('expenses_no_receipt: steuerrelevant ohne Beleg, Klick öffnet gefilterte Ausgabenliste', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedExpenseWithoutReceipt(tauri, 'Conrad');
  await page.reload();

  const card = smartActionCard(page, 'expenses_no_receipt');
  await expect(card).toBeVisible();
  await expect(card).toContainText('ohne Beleg');

  await clickSmartAction(page, 'expenses_no_receipt');
  await expect(page).toHaveURL(/\/expenses\?.*receipt=missing/);
  await expect(page.getByText('Beleg fehlt').first()).toBeVisible();
  await expect(page.getByText('Conrad')).toBeVisible();
});

test('tasks_overdue: überfällige Aufgaben, Klick öffnet Listenansicht mit Überfällig-Filter', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedOverdueTask(tauri, 'Etikett drucken');
  await page.reload();

  const card = smartActionCard(page, 'tasks_overdue');
  await expect(card).toBeVisible();
  await expect(card).toContainText('überfällig');

  await clickSmartAction(page, 'tasks_overdue');
  await expect(page).toHaveURL(/\/tasks\?.*overdue/);
  // Überfällig-Filter ist aktiv (Filter-Badge sichtbar) und die Aufgabe gelistet
  await expect(page.getByLabel('Überfällig entfernen')).toBeVisible();
  await expect(page.getByText('Etikett drucken')).toBeVisible();
});

test('listings_incomplete: rote Ampel, Klick öffnet gefilterte Listing-Liste', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedProduct(tauri, { name: 'Produkt mit Listing' });
  seedListingWithoutTags(tauri, PRODUCT_ID, 'Unvollständiges Listing');
  await page.reload();

  const card = smartActionCard(page, 'listings_incomplete');
  await expect(card).toBeVisible();
  await expect(card).toContainText('rote Ampel');

  await clickSmartAction(page, 'listings_incomplete');
  await expect(page).toHaveURL(/\/listings\?.*completeness=red/);
  await expect(page.getByText('Fehlerhaft').first()).toBeVisible();
  await expect(page.getByText('Unvollständiges Listing')).toBeVisible();
});

test('margin_low_seller: Verkäufe mit Marge unter 15%, Klick öffnet Produkt-Tab Kosten', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedProduct(tauri, { name: 'Margenschwaches Produkt', estimatedMargin: 8 });
  seedOrder(tauri, { productId: PRODUCT_ID, status: 'completed', orderDaysAgo: 5 });
  await page.reload();

  const card = smartActionCard(page, 'margin_low_seller');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Margenschwaches Produkt');
  await expect(card).toContainText('8% Marge');

  await clickSmartAction(page, 'margin_low_seller');
  await expect(page).toHaveURL(new RegExp(`/products/${PRODUCT_ID}\\?.*tab=costs`));
  await expect(page.getByRole('tab', { name: 'Kosten' })).toHaveAttribute('aria-selected', 'true');
});

test('Snooze: Verwerfen blendet 7 Tage aus, gestiegener Count holt die Karte zurück', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedOverdueTask(tauri, 'Aufgabe 1');
  await page.reload();

  const card = smartActionCard(page, 'tasks_overdue');
  await expect(card).toBeVisible();

  // Verwerfen → Karte verschwindet sofort, Bereich wird leer und damit ausgeblendet
  await card.getByRole('button', { name: /Hinweis verwerfen/ }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByTestId('smart-actions-section')).toHaveCount(0);

  // Snooze ist persistiert: Reload zeigt die Karte weiterhin nicht
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(smartActionCard(page, 'tasks_overdue')).toHaveCount(0);

  const snoozes = tauri.select(
    `SELECT value FROM app_settings WHERE key = 'smart_action_snoozes'`,
  );
  expect(String(snoozes[0]?.value)).toContain('tasks_overdue');

  // Verschärfung: zweite überfällige Aufgabe → Count steigt → Karte kommt zurück
  seedOverdueTask(tauri, 'Aufgabe 2');
  await page.reload();
  const returnedCard = smartActionCard(page, 'tasks_overdue');
  await expect(returnedCard).toBeVisible();
  await expect(returnedCard).toContainText('2');
});

test('Snooze: nach Ablauf der 7 Tage erscheint die Karte wieder', async ({ page, tauri }) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedOverdueTask(tauri);

  // Abgelaufene Snooze mit hohem Count direkt persistieren
  const expired = {
    tasks_overdue: { until: isoTimestampDaysAgo(1), count: 99 },
  };
  tauri.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('smart_action_snoozes', $1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = $2`,
    [JSON.stringify(expired), new Date().toISOString()],
  );

  await page.reload();
  await expect(smartActionCard(page, 'tasks_overdue')).toBeVisible();
});

test('Sortierung: danger-Karten stehen vor info-Karten', async ({ page, tauri }) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedExpenseWithoutReceipt(tauri); // info
  seedOverdueTask(tauri); // danger
  await page.reload();

  const section = page.getByTestId('smart-actions-section');
  await expect(section).toBeVisible();
  const cards = section.locator('[data-testid^="smart-action-"]');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveAttribute('data-testid', 'smart-action-tasks_overdue');
  await expect(cards.nth(1)).toHaveAttribute('data-testid', 'smart-action-expenses_no_receipt');
});
