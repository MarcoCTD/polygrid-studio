/**
 * E2E-Tests fuer das Platzhaltervariablen-System der Vorlagenbibliothek
 * (Auftrag: zentrale Variablen-Registry mit Datenquellen).
 *
 * - Registry liefert Label + Beschreibung fuer Standard-Variablen
 * - Settings-Variablen ({{firmenname}}) werden automatisch vorbefuellt
 * - Produkt-/Auftragsvariablen bieten eine Suchauswahl statt Freitext
 * - Unbekannte Variablen bleiben Freitext (kein Schema-Bruch)
 */
import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';
import type { Page } from '@playwright/test';

const TEMPLATE_ID = '5f0e8d3c-4b2a-4c1d-9e6f-7a8b9c0d1e2f';
const PRODUCT_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ORDER_ID = '9d8c7b6a-5f4e-4d3c-a2b1-0f9e8d7c6b5a';

const TEMPLATE_CONTENT =
  'Hallo {{kundenname}}, danke für deine Bestellung {{bestellnummer}} bei {{firmenname}}. ' +
  'Dein Produkt {{produktname}} ist unterwegs. {{eigene_notiz}}';

function seedAll(tauri: TauriMock) {
  const now = new Date().toISOString();

  tauri.execute(
    `INSERT INTO templates (id, name, category, content, platforms, variables, version, is_legal, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NULL, $5, 1, 0, NULL, $6, $7)`,
    [
      TEMPLATE_ID,
      'Versandbestätigung',
      'versand',
      TEMPLATE_CONTENT,
      JSON.stringify([{ name: 'eigene_notiz', description: 'Interne Notiz' }]),
      now,
      now,
    ],
  );

  tauri.execute(
    `INSERT INTO products (id, name, category, status, material_type, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [PRODUCT_ID, 'Spiral-Vase', 'Deko', 'online', 'PLA', now, now],
  );

  tauri.execute(
    `INSERT INTO orders (id, receipt_number, external_order_id, customer_name, platform, quantity,
                         sale_price, status, payment_status, tracking_number, order_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 1, 19.99, 'paid', 'paid', $6, $7, $8, $9)`,
    [ORDER_ID, '2026-0042', 'ETSY-12345', 'Max Mustermann', 'etsy', 'DHL-777', now, now, now],
  );

  tauri.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    ['company_name', JSON.stringify('Mein 3D-Shop'), now],
  );
}

async function openTemplate(page: Page, tauri: TauriMock) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vorlagen' })).toBeVisible();
  seedAll(tauri);
  await page.getByRole('button', { name: 'Vorlagen' }).click();
  await page.getByText('Versandbestätigung').click();
  await expect(page.getByRole('button', { name: 'Kopieren' })).toBeVisible();
}

async function openCopyDialog(page: Page, tauri: TauriMock) {
  await openTemplate(page, tauri);
  await page.getByRole('button', { name: 'Kopieren' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('CopyDialog: Registry-Variablen zeigen Label und Beschreibung statt Rohname', async ({
  page,
  tauri,
}) => {
  await openCopyDialog(page, tauri);

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Kundenname', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Bestellnummer', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Produktname', { exact: true })).toBeVisible();

  // Unbekannte Variable bleibt Freitext mit Rohname + gespeicherter Beschreibung
  await expect(dialog.getByText('eigene_notiz', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Interne Notiz')).toBeVisible();
});

test('CopyDialog: Settings-Variable {{firmenname}} wird automatisch vorbefüllt', async ({
  page,
  tauri,
}) => {
  await openCopyDialog(page, tauri);

  await expect(page.locator('#copy-var-firmenname')).toHaveValue('Mein 3D-Shop');
  // Vorschau enthaelt den ersetzten Wert, nicht mehr den Platzhalter
  const preview = page.getByRole('dialog').locator('pre');
  await expect(preview).toContainText('bei Mein 3D-Shop');
  await expect(preview).not.toContainText('{{firmenname}}');
});

test('CopyDialog: Auftragsauswahl befüllt alle Auftragsvariablen', async ({ page, tauri }) => {
  await openCopyDialog(page, tauri);

  const orderSearch = page.getByPlaceholder('Auftrag suchen');
  await orderSearch.click();
  await orderSearch.fill('Max');
  await page.getByRole('option', { name: /ETSY-12345/ }).click();

  await expect(page.locator('#copy-var-kundenname')).toHaveValue('Max Mustermann');
  await expect(page.locator('#copy-var-bestellnummer')).toHaveValue('ETSY-12345');

  const preview = page.getByRole('dialog').locator('pre');
  await expect(preview).toContainText('Hallo Max Mustermann');
  await expect(preview).toContainText('Bestellung ETSY-12345');
});

test('CopyDialog: Produktauswahl befüllt {{produktname}}', async ({ page, tauri }) => {
  await openCopyDialog(page, tauri);

  const productSearch = page.getByPlaceholder('Produkt suchen');
  await productSearch.click();
  await productSearch.fill('Spiral');
  await page.getByRole('option', { name: /Spiral-Vase/ }).click();

  await expect(page.locator('#copy-var-produktname')).toHaveValue('Spiral-Vase');
  await expect(page.getByRole('dialog').locator('pre')).toContainText(
    'Dein Produkt Spiral-Vase',
  );
});

test('CopyDialog: Variablen ohne Datenquelle bleiben Freitext', async ({ page, tauri }) => {
  await openCopyDialog(page, tauri);

  const noteInput = page.locator('#copy-var-eigene_notiz');
  await noteInput.fill('Bitte klingeln.');
  await expect(page.getByRole('dialog').locator('pre')).toContainText('Bitte klingeln.');
});

test('Editor-Sidebar: zeigt Registry-Variablen mit Beschreibungen und fügt sie ein', async ({
  page,
  tauri,
}) => {
  await openTemplate(page, tauri);

  // Standard-Variablen aus der Registry sind mit Beschreibung gelistet
  await expect(page.getByRole('heading', { name: 'Standard-Variablen' })).toBeVisible();
  await expect(page.getByText('Lieferzeit', { exact: true })).toBeVisible();
  await expect(page.getByText(/Voraussichtliche Lieferzeit/)).toBeVisible();

  // Einfuegen-Button ergaenzt den Platzhalter im Text
  await page.getByRole('button', { name: 'lieferzeit einfügen' }).click();
  await expect(page.locator('textarea').first()).toHaveValue(/\{\{lieferzeit\}\}/);
});
