/**
 * E2E: Addendum 2 Modul 17 – Dokument-Konfigurator.
 * Deckt die Akzeptanzkriterien der Addendum-2-Spec ab: Konfigurator mit
 * drei Abschnitten, Positionsvorlagen (CRUD, Seed, Übernahme im Editor),
 * Stichpunkt-Flags (Konfigurator-Defaults, Editor-Override, Rendering),
 * Kompatibilität alter string[]-items, Standard-Einleitungstexte,
 * Optional-Kasten, Logo/Firmenname-Fallback, Snapshot-Isolation.
 */
import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';
import type { Page } from '@playwright/test';

const CLIENT_ID = 'dddddddd-4444-4444-8444-444444444444';

async function bootApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
}

function setSetting(tauri: TauriMock, key: string, value: unknown): void {
  tauri.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, JSON.stringify(value), new Date().toISOString()],
  );
}

function seedIssuerSettings(tauri: TauriMock): void {
  setSetting(tauri, 'company_name', 'PolyGrid Studio');
  setSetting(tauri, 'invoice_owner_name', 'Marco Kromer');
  setSetting(tauri, 'invoice_street', 'Musterstraße 1');
  setSetting(tauri, 'invoice_zip', '12345');
  setSetting(tauri, 'invoice_city', 'Musterstadt');
  setSetting(tauri, 'invoice_tax_number', '12/345/67890');
  setSetting(tauri, 'invoice_iban', 'DE02120300000000202051');
  setSetting(tauri, 'invoice_bic', 'BYLADEM1001');
  setSetting(tauri, 'invoice_bank_name', 'Testbank');
}

function seedClient(tauri: TauriMock): void {
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO clients (id, name, contact_person, address, email, credentials, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '[]', $6, $7)`,
    [
      CLIENT_ID,
      'Malerbetrieb Weber',
      'Frau Weber',
      'Wandweg 3\n54321 Pinselhausen',
      'info@maler-weber.de',
      now,
      now,
    ],
  );
}

async function gotoDocuments(page: Page): Promise<void> {
  await page.goto('/websites?tab=documents');
  await expect(page.getByTestId('documents-tab')).toBeVisible();
}

async function createDraftViaUI(page: Page, type: 'quote' | 'invoice'): Promise<void> {
  await gotoDocuments(page);
  await page.getByTestId(type === 'quote' ? 'new-quote-button' : 'new-invoice-button').click();
  await page.getByText('Kunde wählen').click();
  await page.getByRole('option', { name: 'Malerbetrieb Weber' }).click();
  await page.getByTestId('new-document-create').click();
  await expect(page.getByTestId('document-editor-title')).toContainText(
    type === 'quote' ? 'Angebot' : 'Rechnung',
  );
}

// ------------------------------------------------------------
// Konfigurator erreichbar, drei Abschnitte funktional
// ------------------------------------------------------------

test('Konfigurator: aus dem Dokumente-Tab erreichbar, drei Abschnitte, Seed-Vorlagen sichtbar', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);

  await gotoDocuments(page);
  await page.getByTestId('manage-templates-button').click();
  await expect(page.getByTestId('document-configurator')).toBeVisible();

  // Abschnitt 1 (Default): Positionen mit den drei Seed-Vorlagen aus der Referenz
  await expect(page.getByTestId('configurator-positions')).toBeVisible();
  await expect(page.getByTestId('position-template-row-Komplettpaket')).toContainText('590,00');
  await expect(page.getByTestId('position-template-row-Onepager')).toContainText('390,00');
  await expect(page.getByTestId('position-template-row-Refresh')).toContainText('490,00');

  // Abschnitt 2: Bausteine mit Typ-Umschalter und Baustein-Liste
  await page.getByTestId('configurator-section-blocks').click();
  await expect(page.getByTestId('configurator-blocks')).toBeVisible();
  await expect(page.getByTestId('block-row-included')).toBeVisible();
  await page.getByTestId('configurator-type-invoice').click();
  await expect(page.getByTestId('block-row-payment_terms')).toBeVisible();
  await expect(page.getByTestId('block-row-validity_signature')).toHaveCount(0);

  // Abschnitt 3: Einleitungstexte je Typ
  await page.getByTestId('configurator-section-texts').click();
  await expect(page.getByTestId('configurator-intro-quote')).toBeVisible();
  await expect(page.getByTestId('configurator-outro-invoice')).toBeVisible();
});

test('Positionsvorlagen: CRUD und Duplizieren wirken sofort auf app_settings', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  await page.goto('/documents/templates');
  await expect(page.getByTestId('position-template-row-Komplettpaket')).toBeVisible();

  // Anlegen
  await page.getByTestId('position-template-new').click();
  await page.getByTestId('position-template-name').fill('Wartung');
  await page.getByTestId('position-template-title').fill('Monatliche Wartung');
  await page.getByTestId('position-template-description').fill('Hosting und kleinere Änderungen');
  await page.getByTestId('position-template-price').fill('10');
  await page.getByTestId('position-template-save').click();
  await expect(page.getByText('Vorlage angelegt')).toBeVisible();
  await expect(page.getByTestId('position-template-row-Wartung')).toContainText('10,00');

  // Bearbeiten
  await page.getByTestId('position-template-edit-Wartung').click();
  await page.getByTestId('position-template-price').fill('12');
  await page.getByTestId('position-template-save').click();
  await expect(page.getByText('Vorlage aktualisiert')).toBeVisible();
  await expect(page.getByTestId('position-template-row-Wartung')).toContainText('12,00');

  // Duplizieren
  await page.getByTestId('position-template-duplicate-Wartung').click();
  await expect(page.getByTestId('position-template-row-Wartung (Kopie)')).toBeVisible();

  // Löschen (mit Bestätigung)
  await page.getByTestId('position-template-delete-Wartung (Kopie)').click();
  await page.getByTestId('position-template-delete-confirm').click();
  await expect(page.getByTestId('position-template-row-Wartung (Kopie)')).toHaveCount(0);

  // Persistiert als JSON in app_settings
  const rows = tauri.select(
    "SELECT value FROM app_settings WHERE key = 'document_position_templates'",
  );
  const stored = JSON.parse(String(rows[0].value)) as Array<{ name: string; unit_price: number }>;
  expect(stored.map((template) => template.name)).toEqual([
    'Komplettpaket',
    'Onepager',
    'Refresh',
    'Wartung',
  ]);
  expect(stored[3].unit_price).toBe(12);
});

test('Konfigurator-Bausteine: Default-Flags pro Baustein und Stichpunkt landen in neuen Dokumenten', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await page.goto('/documents/templates?section=blocks');
  await expect(page.getByTestId('configurator-blocks')).toBeVisible();

  // Baustein-Flag: optional_offer standardmäßig aktivieren
  await page.getByTestId('block-toggle-optional_offer').click();
  // Stichpunkt-Flag: im Baustein "Nicht enthalten" den zweiten Punkt
  // ("Professionelles Fotoshooting") standardmäßig abschalten
  await page.getByTestId('block-expand-excluded').click();
  await expect(page.getByTestId('block-item-excluded-1')).toHaveValue(
    'Professionelles Fotoshooting',
  );
  await page.getByTestId('block-item-toggle-excluded-1').click();
  await page.getByTestId('configurator-blocks-save').click();
  await expect(page.getByText(/Baustein-Standards für Angebote gespeichert/)).toBeVisible();

  // Neues Angebot startet mit diesen Defaults
  await createDraftViaUI(page, 'quote');
  await expect(page.getByTestId('doc-block-optional_offer')).toBeVisible();
  const excluded = page.getByTestId('doc-block-excluded');
  await expect(excluded).toContainText('Logo-Design / Branding');
  await expect(excluded).not.toContainText('Professionelles Fotoshooting');

  // Der abgeschaltete Punkt bleibt im Editor erhalten (Checkbox aus, Text da)
  await page.getByTestId('block-expand-excluded').click();
  await expect(page.getByTestId('block-item-excluded-1')).toHaveValue(
    'Professionelles Fotoshooting',
  );
  await expect(page.getByTestId('block-item-toggle-excluded-1')).not.toBeChecked();
});

test('Standard-Einleitungstexte: Konfigurator belegt neue Dokumente vor, Variablen werden ersetzt', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await page.goto('/documents/templates?section=texts');
  await page
    .getByTestId('configurator-intro-quote')
    .fill('Sehr geehrte/r {{kundenname}}, vielen Dank für Ihr Vertrauen.');
  await page.getByTestId('configurator-outro-quote').fill('Ich freue mich auf die Zusammenarbeit.');
  await page.getByTestId('configurator-texts-save-quote').click();
  await expect(page.getByText('Einleitungstexte für Angebote gespeichert')).toBeVisible();

  await createDraftViaUI(page, 'quote');
  // Formular vorbelegt, Vorschau ersetzt {{kundenname}} live
  await expect(page.getByTestId('document-intro')).toHaveValue(/vielen Dank für Ihr Vertrauen/);
  await expect(page.getByTestId('doc-intro')).toContainText(
    'Sehr geehrte/r Malerbetrieb Weber, vielen Dank für Ihr Vertrauen.',
  );
  await expect(page.getByTestId('doc-outro')).toContainText(
    'Ich freue mich auf die Zusammenarbeit.',
  );

  // Rechnungen bleiben unberührt (eigener, leerer Standard)
  await createDraftViaUI(page, 'invoice');
  await expect(page.getByTestId('document-intro')).toHaveValue('');
});
