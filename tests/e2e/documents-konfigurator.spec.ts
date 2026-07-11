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
// 1x1 rotes PNG für Logo-Tests
const LOGO_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

test('Editor: Position aus Vorlage übernimmt alle Felder; Bearbeitung wirkt nur im Dokument', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'quote');

  // "Position hinzufügen" öffnet die Auswahl mit Suche (Name und Preis)
  await page.getByTestId('add-line-item').click();
  await expect(page.getByTestId('line-item-template-Komplettpaket')).toContainText('590,00');
  await page.getByTestId('line-item-template-search').fill('one');
  await expect(page.getByTestId('line-item-template-Komplettpaket')).toHaveCount(0);
  await expect(page.getByTestId('line-item-template-Onepager')).toContainText('390,00');

  // Vorlage übernimmt Titel, Beschreibung, Preis und Menge
  await page.getByTestId('line-item-template-Onepager').click();
  const description = page.getByLabel('Position 1: Beschreibung');
  await expect(description).toHaveValue(/^Website-Erstellung Onepager\n/);
  await expect(page.getByLabel('Position 1: Menge')).toHaveValue('1');
  await expect(page.getByLabel('Position 1: Einzelpreis')).toHaveValue('390');
  // polygrid rendert die erste Zeile fett als Positionstitel (EB-03)
  await expect(page.getByTestId('doc-positions')).toContainText('Website-Erstellung Onepager');
  await expect(page.getByTestId('doc-total')).toContainText('390,00');

  // Nachträgliche Bearbeitung wirkt nur im Dokument, nie auf die Vorlage
  await page.getByLabel('Position 1: Einzelpreis').fill('450');
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  const stored = tauri.select(
    "SELECT value FROM app_settings WHERE key = 'document_position_templates'",
  );
  const templates = JSON.parse(String(stored[0].value)) as Array<{
    name: string;
    unit_price: number;
  }>;
  expect(templates.find((template) => template.name === 'Onepager')?.unit_price).toBe(390);

  // "Leere Position" bleibt als zweiter Weg verfügbar
  await page.getByTestId('add-line-item').click();
  await page.getByTestId('add-line-item-empty').click();
  await expect(page.getByLabel('Position 2: Beschreibung')).toHaveValue('');
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

// ------------------------------------------------------------
// Darstellung (Etappe D): Optional-Kasten und Logo
// ------------------------------------------------------------

test('Optional-Baustein erscheint in polygrid als Markenfarben-Kasten, druckfest', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  // Feste Markenfarbe, damit die Kasten-Farben deterministisch sind
  setSetting(tauri, 'invoice_brand_color', '#0070F2');

  await createDraftViaUI(page, 'quote');
  await page.getByTestId('block-toggle-optional_offer').click();

  const box = page.getByTestId('doc-block-optional_offer');
  await expect(box).toBeVisible();
  // Linker Rand 3px in Markenfarbe, abgerundete Ecken, farbiger Hintergrund
  // (Inline-Style statt computed – die Vorschau skaliert per zoom)
  await expect(box).toHaveClass(/pg-polygrid-optional/);
  const borderLeft = await box.evaluate((element) => (element as HTMLElement).style.borderLeft);
  expect(borderLeft).toBe('3px solid rgb(0, 112, 242)');
  const backgroundColor = await box.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  const borderRadius = await box.evaluate((element) => getComputedStyle(element).borderRadius);
  expect(borderRadius).not.toBe('0px');
  // Titel in Markenfarbe
  await expect(box.locator('.pg-doc-block-title')).toHaveCSS('color', 'rgb(0, 112, 242)');
  // Druckfest: print-color-adjust exact direkt am Kasten (macOS druckt
  // Hintergründe sonst weiß)
  const printColorAdjust = await box.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('-webkit-print-color-adjust'),
  );
  expect(printColorAdjust).toBe('exact');

  // Position: standardmäßig letzter Baustein vor validity_signature
  const blockKinds = await page
    .getByTestId('doc-blocks')
    .locator('section')
    .evaluateAll((sections) =>
      sections.map((section) => section.getAttribute('data-testid') ?? ''),
    );
  const optionalIndex = blockKinds.indexOf('doc-block-optional_offer');
  expect(blockKinds[optionalIndex + 1]).toBe('doc-block-validity_signature');

  // Nur polygrid rendert den Kasten – modern zeigt den Block schlicht
  await page.getByTestId('layout-modern').click();
  await expect(page.getByTestId('doc-block-optional_offer')).toBeVisible();
  await expect(page.getByTestId('doc-block-optional_offer')).not.toHaveClass(
    /pg-polygrid-optional/,
  );
});

test('Logo: konfigurierte Data-URL erscheint oben links und wird in den Snapshot eingefroren', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  setSetting(tauri, 'invoice_logo', LOGO_DATA_URL);

  await createDraftViaUI(page, 'quote');
  await page.getByTestId('add-line-item').click();
  await page.getByTestId('add-line-item-empty').click();
  await page.getByLabel('Position 1: Beschreibung').fill('Website');
  await page.getByLabel('Position 1: Einzelpreis').fill('590');

  // Vorschau: img mit Data-URL, kein Firmennamen-Fallback
  const logo = page.getByTestId('document-sheet').locator('img[alt="Logo"]');
  await expect(logo).toBeVisible();
  expect(await logo.getAttribute('src')).toBe(LOGO_DATA_URL);
  await expect(page.getByTestId('doc-logo-fallback')).toHaveCount(0);

  // Ausstellen friert das Logo in den Snapshot ein (E17-04); ein späterer
  // Logo-Wechsel verändert das ausgestellte Dokument nicht
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  await page.getByTestId('document-issue').click();
  await expect(page.getByText(/ausgestellt/)).toBeVisible();
  const rows = tauri.select('SELECT snapshot FROM documents');
  const snapshot = JSON.parse(String(rows[0].snapshot)) as { logo: string | null };
  expect(snapshot.logo).toBe(LOGO_DATA_URL);

  setSetting(tauri, 'invoice_logo', '');
  await page.reload();
  await expect(page.getByTestId('document-sheet').locator('img[alt="Logo"]')).toBeVisible();
});

test('Logo: ohne Konfiguration erscheint der Firmenname in Markenfarbe, nie eine Lücke', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  setSetting(tauri, 'invoice_brand_color', '#0070F2');

  await createDraftViaUI(page, 'quote');
  const sheet = page.getByTestId('document-sheet');
  await expect(sheet.locator('img[alt="Logo"]')).toHaveCount(0);
  const fallback = page.getByTestId('doc-logo-fallback');
  await expect(fallback).toHaveText('PolyGrid Studio');
  await expect(fallback).toHaveCSS('font-weight', '700');
  await expect(fallback).toHaveCSS('color', 'rgb(0, 112, 242)');
});

// ------------------------------------------------------------
// Stichpunkte: Editor überschreibt Defaults pro Dokument
// ------------------------------------------------------------

test('Stichpunkt-Checkboxen im Editor: Override pro Dokument, deaktivierte Punkte bleiben erhalten', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'quote');

  // Nutzer-Beispiel (Spec 2.3): "Professionelles Fotoshooting" abschalten
  await page.getByTestId('block-expand-excluded').click();
  await expect(page.getByTestId('block-item-excluded-1')).toHaveValue(
    'Professionelles Fotoshooting',
  );
  const excludedPreview = page.getByTestId('doc-block-excluded');
  await expect(excludedPreview).toContainText('Professionelles Fotoshooting');
  await page.getByTestId('block-item-toggle-excluded-1').click();

  // Live-Vorschau: Punkt verschwindet, die übrigen bleiben
  await expect(excludedPreview).not.toContainText('Professionelles Fotoshooting');
  await expect(excludedPreview).toContainText('Logo-Design / Branding');

  // Speichern: der Punkt bleibt am Dokument gespeichert (enabled false)
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  const rows = tauri.select('SELECT content_blocks FROM documents');
  const blocks = JSON.parse(String(rows[0].content_blocks)) as Array<{
    kind: string;
    items: { text: string; enabled: boolean }[];
  }>;
  const excluded = blocks.find((block) => block.kind === 'excluded');
  expect(excluded?.items.find((item) => item.text === 'Professionelles Fotoshooting')).toEqual({
    text: 'Professionelles Fotoshooting',
    enabled: false,
  });

  // Nach Reload: Checkbox aus, Text erhalten, wieder aktivierbar
  await page.reload();
  await page.getByTestId('block-expand-excluded').click();
  await expect(page.getByTestId('block-item-excluded-1')).toHaveValue(
    'Professionelles Fotoshooting',
  );
  await expect(page.getByTestId('block-item-toggle-excluded-1')).not.toBeChecked();
  await page.getByTestId('block-item-toggle-excluded-1').click();
  await expect(page.getByTestId('doc-block-excluded')).toContainText(
    'Professionelles Fotoshooting',
  );
});

// ------------------------------------------------------------
// Abwärtskompatibilität: alte Dokumente und Snapshots (string[]-items)
// ------------------------------------------------------------

test('Alte Dokumente und Snapshots mit string[]-items laden und rendern fehlerfrei', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  const now = new Date().toISOString();
  const legacyBlocks = [
    {
      id: 'legacy-included',
      kind: 'included',
      enabled: true,
      title: 'Im Festpreis enthalten',
      body_type: 'bullets',
      items: ['Konzeption und Umsetzung', 'Mobile Optimierung'],
      text: '',
    },
  ];

  // Alt-DRAFT (vor Addendum 2): items als string[]
  const draftId = crypto.randomUUID();
  tauri.execute(
    `INSERT INTO documents (
       id, type, number, status, client_id, line_items, total,
       layout, content_blocks, created_at, updated_at
     ) VALUES ($1, 'quote', NULL, 'draft', $2, $3, 590, 'polygrid', $4, $5, $6)`,
    [
      draftId,
      CLIENT_ID,
      JSON.stringify([{ description: 'Website-Erstellung', quantity: 1, unit_price: 590 }]),
      JSON.stringify(legacyBlocks),
      now,
      now,
    ],
  );

  await page.goto(`/documents/${draftId}`);
  await expect(page.getByTestId('document-editor-title')).toContainText('Angebot (Entwurf)');
  // Editor zeigt die Punkte als aktivierte Checkboxen, Vorschau rendert sie
  await page.getByTestId('block-expand-included').click();
  await expect(page.getByTestId('block-item-toggle-included-0')).toBeChecked();
  await expect(page.getByTestId('doc-block-included')).toContainText('Konzeption und Umsetzung');
  await expect(page.getByTestId('doc-block-included')).toContainText('Mobile Optimierung');

  // Alt-AUSGESTELLT: Snapshot mit string[]-items rendert unverändert aus dem Snapshot
  const issuedId = crypto.randomUUID();
  const legacySnapshot = {
    type: 'quote',
    number: 'A-2026-001',
    issuer: {
      company_name: 'PolyGrid Studio',
      owner_name: 'Marco Kromer',
      street: 'Musterstraße 1',
      zip: '12345',
      city: 'Musterstadt',
      tax_number: '12/345/67890',
      vat_id: '',
      iban: 'DE02120300000000202051',
      bic: 'BYLADEM1001',
      bank_name: 'Testbank',
    },
    recipient: { name: 'Malerbetrieb Weber', contact_person: null, address: 'Wandweg 3' },
    line_items: [{ description: 'Website-Erstellung', quantity: 1, unit_price: 590 }],
    total: 590,
    issue_date: '2026-06-01',
    due_date: null,
    valid_until: '2026-07-01',
    service_date: null,
    intro_text: null,
    outro_text: null,
    layout: 'polygrid',
    accent_color: '#0070F2',
    logo: null,
    kleinunternehmer_hinweis: 'Gemäß §19 UStG wird keine Umsatzsteuer berechnet.',
    related_document_number: null,
    content_blocks: legacyBlocks,
  };
  tauri.execute(
    `INSERT INTO documents (
       id, type, number, status, client_id, line_items, total,
       issue_date, valid_until, layout, content_blocks, snapshot, created_at, updated_at
     ) VALUES ($1, 'quote', 'A-2026-001', 'issued', $2, $3, 590, '2026-06-01', '2026-07-01',
       'polygrid', $4, $5, $6, $7)`,
    [
      issuedId,
      CLIENT_ID,
      JSON.stringify([{ description: 'Website-Erstellung', quantity: 1, unit_price: 590 }]),
      JSON.stringify(legacyBlocks),
      JSON.stringify(legacySnapshot),
      now,
      now,
    ],
  );

  await page.goto(`/documents/${issuedId}`);
  await expect(page.getByTestId('document-editor-title')).toContainText('Angebot A-2026-001');
  await expect(page.getByTestId('doc-block-included')).toContainText('Konzeption und Umsetzung');
  await expect(page.getByTestId('doc-block-included')).toContainText('Mobile Optimierung');

  // Harte Regel: Lesen/Rendern schreibt den alten Snapshot NICHT um
  const raw = tauri.select('SELECT snapshot FROM documents WHERE id = $1', [issuedId]);
  expect(String(raw[0].snapshot)).toBe(JSON.stringify(legacySnapshot));
});

// ------------------------------------------------------------
// Migration der alten "Als Standard speichern"-Keys
// ------------------------------------------------------------

test('Alte Standard-Keys erscheinen ohne Datenverlust im Konfigurator und wirken auf neue Dokumente', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  // "Als Standard speichern"-Wert aus der Zeit vor dem Konfigurator (string[]-items)
  setSetting(tauri, 'document_default_blocks_quote', [
    {
      id: 'old-1',
      kind: 'included',
      enabled: true,
      title: 'Mein alter Leistungsumfang',
      body_type: 'bullets',
      items: ['Alter Punkt A', 'Alter Punkt B'],
      text: '',
    },
    {
      id: 'old-2',
      kind: 'payment_terms',
      enabled: true,
      title: 'Zahlungsbedingungen',
      body_type: 'paragraph',
      items: [],
      text: 'Zahlbar innerhalb von {{zahlungsziel_tage}} Tagen.',
    },
  ]);

  // Konfigurator zeigt die alten Werte (Migration-on-read, kein Datenverlust)
  await page.goto('/documents/templates?section=blocks');
  await expect(page.getByTestId('block-row-included')).toContainText('Mein alter Leistungsumfang');
  await page.getByTestId('block-expand-included').click();
  await expect(page.getByTestId('block-item-included-0')).toHaveValue('Alter Punkt A');
  await expect(page.getByTestId('block-item-toggle-included-0')).toBeChecked();

  // Speichern über den Konfigurator schreibt das neue Format
  await page.getByTestId('configurator-blocks-save').click();
  await expect(page.getByText(/Baustein-Standards für Angebote gespeichert/)).toBeVisible();
  const stored = tauri.select(
    "SELECT value FROM app_settings WHERE key = 'document_default_blocks_quote'",
  );
  const migrated = JSON.parse(String(stored[0].value)) as Array<{
    items: { text: string; enabled: boolean }[];
  }>;
  expect(migrated[0].items).toEqual([
    { text: 'Alter Punkt A', enabled: true },
    { text: 'Alter Punkt B', enabled: true },
  ]);

  // Neue Dokumente nutzen die migrierten Standards
  await createDraftViaUI(page, 'quote');
  await expect(page.getByTestId('doc-block-included')).toContainText('Alter Punkt A');
  await expect(page.getByTestId('block-row-included')).toContainText('Mein alter Leistungsumfang');
});

// ------------------------------------------------------------
// Snapshot-Isolation gegen Konfigurator-Änderungen
// ------------------------------------------------------------

test('Ausgestellte Dokumente bleiben bei Konfigurator-Änderungen unverändert (Snapshot-Isolation)', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  // Angebot aus Vorlage mit Einleitungstext-Vorbelegung ausstellen
  await page.goto('/documents/templates?section=texts');
  await page.getByTestId('configurator-intro-quote').fill('Vielen Dank für Ihr Vertrauen.');
  await page.getByTestId('configurator-texts-save-quote').click();
  await expect(page.getByText('Einleitungstexte für Angebote gespeichert')).toBeVisible();

  await createDraftViaUI(page, 'quote');
  await page.getByTestId('add-line-item').click();
  await page.getByTestId('line-item-template-Komplettpaket').click();
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  await page.getByTestId('document-issue').click();
  await expect(page.getByText(/ausgestellt/)).toBeVisible();
  await expect(page.getByTestId('doc-intro')).toContainText('Vielen Dank für Ihr Vertrauen.');
  await expect(page.getByTestId('doc-positions')).toContainText(
    'Website-Erstellung (Komplettpaket)',
  );

  const snapshotBefore = String(tauri.select('SELECT snapshot FROM documents')[0].snapshot);

  // ALLE Konfigurator-Inhalte nachträglich umkrempeln
  await page.goto('/documents/templates');
  await page.getByTestId('position-template-edit-Komplettpaket').click();
  await page.getByTestId('position-template-title').fill('GEÄNDERTER TITEL');
  await page.getByTestId('position-template-price').fill('999');
  await page.getByTestId('position-template-save').click();
  await expect(page.getByText('Vorlage aktualisiert')).toBeVisible();
  await page.getByTestId('configurator-section-blocks').click();
  await page.getByTestId('block-expand-included').click();
  await page.getByTestId('block-title-included').fill('GEÄNDERTER BAUSTEIN');
  await page.getByTestId('configurator-blocks-save').click();
  await expect(page.getByText(/Baustein-Standards für Angebote gespeichert/)).toBeVisible();
  await page.getByTestId('configurator-section-texts').click();
  await page.getByTestId('configurator-intro-quote').fill('GEÄNDERTE EINLEITUNG');
  await page.getByTestId('configurator-texts-save-quote').click();
  await expect(page.getByText('Einleitungstexte für Angebote gespeichert')).toBeVisible();

  // Das ausgestellte Dokument rendert unverändert aus seinem Snapshot
  const documentId = String(tauri.select('SELECT id FROM documents')[0].id);
  await page.goto(`/documents/${documentId}`);
  await expect(page.getByTestId('doc-intro')).toContainText('Vielen Dank für Ihr Vertrauen.');
  await expect(page.getByTestId('doc-positions')).toContainText(
    'Website-Erstellung (Komplettpaket)',
  );
  await expect(page.getByTestId('doc-total')).toContainText('590,00');
  await expect(page.getByTestId('document-sheet')).not.toContainText('GEÄNDERT');

  const snapshotAfter = String(
    tauri.select('SELECT snapshot FROM documents WHERE id = $1', [documentId])[0].snapshot,
  );
  expect(snapshotAfter).toBe(snapshotBefore);
});
