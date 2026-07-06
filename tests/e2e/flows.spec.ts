import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';

const SEED_PRODUCT_ID = '3f0a1b2c-4d5e-4f60-8a9b-0c1d2e3f4a5b';

function seedProduct(tauri: TauriMock, id = SEED_PRODUCT_ID, name = 'Spiral-Vase'): void {
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO products (id, name, category, status, material_type, target_price, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, name, 'Deko', 'online', 'PLA', 19.99, now, now],
  );
}

test('Produkt bearbeiten: Änderung wird auto-gespeichert und überlebt Reload', async ({
  page,
  tauri,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
  seedProduct(tauri);

  await page.goto(`/products/${SEED_PRODUCT_ID}`);
  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput).toHaveValue('Spiral-Vase');

  await nameInput.fill('Spiral-Vase XL');
  // Auto-Save (800ms Debounce) abwarten
  await expect.poll(
    () => tauri.select('SELECT name FROM products WHERE id = $1', [SEED_PRODUCT_ID])[0]?.name,
    { timeout: 5000 },
  ).toBe('Spiral-Vase XL');

  await page.reload();
  await expect(page.locator('input[name="name"]')).toHaveValue('Spiral-Vase XL');
});

test('Ausgabe über Schnellerfassung anlegen: erscheint in der Tabelle', async ({ page, tauri }) => {
  await page.goto('/expenses');

  await page.getByLabel('Betrag brutto').fill('12.34');
  await page.getByLabel('Händler').fill('Bauhaus');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();

  await expect(page.getByText('Ausgabe hinzugefügt')).toBeVisible();
  await expect(page.getByText('Bauhaus')).toBeVisible();

  const rows = tauri.select('SELECT * FROM expenses WHERE deleted_at IS NULL');
  expect(rows).toHaveLength(1);
  expect(rows[0].vendor).toBe('Bauhaus');
  expect(rows[0].amount_gross).toBe(12.34);
});

test('Auftrag anlegen und im Kanban per Drag-and-Drop Status ändern', async ({ page, tauri }) => {
  await page.goto('/orders');

  // Auftrag über das Modal anlegen
  await page.getByRole('button', { name: 'Neuer Auftrag' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="sale_price"]').fill('25');
  await dialog.locator('input[name="customer_name"]').fill('Max Mustermann');
  await dialog.getByRole('button', { name: 'Auftrag erstellen' }).click();
  await expect(dialog).toBeHidden();

  const orders = tauri.select('SELECT id, status, receipt_number FROM orders');
  expect(orders).toHaveLength(1);
  const initialStatus = String(orders[0].status);

  // In den Kanban-Modus wechseln
  await page.getByRole('button', { name: 'Kanban' }).click();
  const card = page.getByText(String(orders[0].receipt_number)).first();
  await expect(card).toBeVisible();

  // Drag von der aktuellen Spalte nach "In Produktion"
  const targetColumn = page
    .locator('section', { has: page.getByRole('heading', { name: 'In Produktion' }) })
    .first();
  await expect(targetColumn).toBeVisible();

  const cardBox = await card.boundingBox();
  const targetBox = await targetColumn.boundingBox();
  if (!cardBox || !targetBox) throw new Error('BoundingBox nicht verfügbar');

  // dnd-kit PointerSensor (activation distance 6px): manuelle Maus-Geste
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + cardBox.width / 2 + 20, cardBox.y + cardBox.height / 2, {
    steps: 5,
  });
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 15 },
  );
  await page.mouse.up();

  await expect
    .poll(() => tauri.select('SELECT status FROM orders')[0]?.status, { timeout: 5000 })
    .toBe('in_production');
  expect(initialStatus).not.toBe('in_production');
});

test('Aufgabe anlegen und als erledigt markieren', async ({ page, tauri }) => {
  await page.goto('/tasks');

  // Wochenansicht hat pro Tages-Spalte ein QuickAdd-Feld – erstes nehmen
  const quickAdd = page.getByPlaceholder('Aufgabe hinzufügen...').first();
  await quickAdd.fill('Filament nachbestellen');
  await quickAdd.press('Enter');

  await expect(page.getByText('Filament nachbestellen').first()).toBeVisible();
  await expect
    .poll(() => tauri.select('SELECT status FROM tasks WHERE title = $1', ['Filament nachbestellen'])[0]?.status)
    .toBe('todo');

  await page
    .getByLabel('Aufgabe Filament nachbestellen erledigt umschalten')
    .first()
    .click();

  await expect
    .poll(() => tauri.select('SELECT status FROM tasks WHERE title = $1', ['Filament nachbestellen'])[0]?.status, {
      timeout: 5000,
    })
    .toBe('done');
});

test('Listing anlegen: Zeichenzähler und Tag-Limit funktionieren', async ({ page, tauri }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
  seedProduct(tauri);

  await page.getByRole('button', { name: 'Listings' }).click();
  await page.getByRole('button', { name: 'Neues Listing' }).first().click();

  const dialog = page.getByRole('dialog');
  // Erstes Produkt ohne Listing ist vorausgewählt und wird mit Namen angezeigt
  await expect(dialog.getByText('Spiral-Vase')).toBeVisible();
  await dialog.getByRole('button', { name: /Listing erstellen|Erstellen/ }).click();
  await expect(page.getByText('Listing erstellt')).toBeVisible();

  // Editor öffnet sich (Navigation zu /listings/$id)
  await expect(page).toHaveURL(/\/listings\/.+/);

  // Zeichenzähler: Titel ändern und Zähler prüfen
  const titleInput = page.locator('input[name="master_title"]');
  await expect(titleInput).toHaveValue('Spiral-Vase');
  await titleInput.fill('Mein neuer Titel');
  await expect(page.getByText('16 / 140 Etsy')).toBeVisible();

  // Tag-Limit: 21 Tags eingeben, es dürfen nur 20 übernommen werden
  const tagInput = page.getByPlaceholder(/Tag/i).first();
  const manyTags = Array.from({ length: 21 }, (_, i) => `tag${i + 1}`).join(', ');
  await tagInput.fill(manyTags);
  await tagInput.press('Enter');
  await expect(page.getByText('20 / 20 Tags')).toBeVisible();

  const listing = tauri.select('SELECT id FROM listings')[0];
  expect(listing).toBeTruthy();
});

test('Modul-Rundreise: keine Panels oder Dialoge bleiben zwischen Modulen stehen', async ({
  page,
  tauri,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
  seedProduct(tauri);

  const modules = [
    'Produkte',
    'Ausgaben',
    'Aufträge',
    'Listings',
    'Vorlagen',
    'Dateien',
    'Aufgaben',
    'Analysen',
    'Finanzen',
    'KI-Assistent',
    'Einstellungen',
    'Dashboard',
  ];

  for (const moduleName of modules) {
    await page.getByRole('button', { name: moduleName }).click();
    // Kein Detail-Panel und kein offener Dialog aus dem Vormodul
    await expect(page.getByText('Details', { exact: true })).toBeHidden();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
});
