/**
 * E2E: Addendum Modul 17 – PolyGrid-Layout und Text-Bausteine.
 * Deckt die Akzeptanzkriterien der Addendum-Spec ab: polygrid-Aufbau
 * (Kopf, VON/AN, dunkle Kopfzeile, Summenzeile, §19 kursiv, Fußzeile),
 * Rechnungs-Metazeilen, Bausteine an-/abwählbar/editierbar/umsortierbar
 * mit Live-Vorschau, payment_terms-Variablen, validity_signature nur bei
 * Angeboten, Nutzer-Standards pro Typ, Snapshot-Einfrieren, bedingte
 * Mengenspalte und Seitenumbruch-CSS.
 */
import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';
import type { Page } from '@playwright/test';

const CLIENT_ID = 'dddddddd-4444-4444-8444-444444444444';
const CURRENT_YEAR = new Date().getFullYear();

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

/** Vollständige Aussteller-Stammdaten inkl. Kontakt (VON-Block/Fußzeile). */
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
  setSetting(tauri, 'invoice_email', 'marco@polygrid-studio.de');
  setSetting(tauri, 'invoice_phone', '+49 152 04289901');
  setSetting(tauri, 'invoice_website', 'www.polygrid-studio.de');
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

/** Legt über die UI einen Draft an (Default-Layout polygrid) und landet im Editor. */
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

async function addLineItem(page: Page, description: string, price: string): Promise<void> {
  // Seit Addendum 2 öffnet "Position hinzufügen" die Vorlagen-Auswahl
  await page.getByTestId('add-line-item').click();
  await page.getByTestId('add-line-item-empty').click();
  await page.getByLabel('Position 1: Beschreibung').fill(description);
  await page.getByLabel('Position 1: Einzelpreis').fill(price);
}

// ------------------------------------------------------------
// Layout polygrid: Aufbau gemäß Referenz
// ------------------------------------------------------------

test('polygrid (Angebot): Kopf, VON/AN, dunkle Kopfzeile, Festpreis-Summenzeile, §19 kursiv, Fußzeile', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'quote');
  await addLineItem(
    page,
    'Website-Erstellung (Komplettpaket)\nMobil optimiert, SEO-Grundlagen',
    '590',
  );

  // Kopf: Dokumenttyp groß, Versalien (text-transform), Metazeile mit Datum
  const title = page.getByTestId('doc-title');
  await expect(title).toHaveText('Angebot');
  await expect(title).toHaveCSS('text-transform', 'uppercase');
  await expect(page.getByTestId('doc-meta')).toContainText('Datum:');

  // VON/AN-Spalten mit Aussteller-Kontakt und Empfänger inkl. E-Mail
  const issuerBlock = page.getByTestId('doc-issuer');
  await expect(issuerBlock).toContainText('VON');
  await expect(issuerBlock).toContainText('PolyGrid Studio – Marco Kromer');
  await expect(issuerBlock).toContainText('Musterstraße 1');
  await expect(issuerBlock).toContainText('marco@polygrid-studio.de');
  await expect(issuerBlock).toContainText('+49 152 04289901');
  const recipientBlock = page.getByTestId('doc-recipient');
  await expect(recipientBlock).toContainText('AN');
  await expect(recipientBlock).toContainText('Malerbetrieb Weber');
  await expect(recipientBlock).toContainText('Frau Weber');
  await expect(recipientBlock).toContainText('Wandweg 3');
  await expect(recipientBlock).toContainText('info@maler-weber.de');

  // Dunkle Tabellenkopfzeile (fast schwarz) mit weißen Versalien
  const headCell = page.getByTestId('doc-positions').locator('thead th').first();
  await expect(headCell).toHaveText('POS.');
  await expect(headCell).toHaveCSS('background-color', 'rgb(22, 22, 22)');
  await expect(headCell).toHaveCSS('color', 'rgb(255, 255, 255)');

  // Positionstitel fett (erste Zeile), Detailtext darunter
  const positions = page.getByTestId('doc-positions');
  await expect(positions).toContainText('Website-Erstellung (Komplettpaket)');
  await expect(positions).toContainText('Mobil optimiert, SEO-Grundlagen');

  // Summenzeile: Angebot = "Gesamtbetrag (Festpreis)"
  await expect(page.getByTestId('doc-total')).toContainText('Gesamtbetrag (Festpreis)');
  await expect(page.getByTestId('doc-total')).toContainText('590,00');

  // §19-Satz direkt darunter, kursiv – auch auf Angeboten (EA-05)
  const hinweis = page.getByTestId('doc-kleinunternehmer');
  await expect(hinweis).toContainText('Gemäß §19 UStG wird keine Umsatzsteuer berechnet.');
  await expect(hinweis).toHaveCSS('font-style', 'italic');

  // Fußzeile: Firmenname · Inhaber · E-Mail · Website
  await expect(page.getByTestId('doc-footer')).toHaveText(
    'PolyGrid Studio · Marco Kromer · marco@polygrid-studio.de · www.polygrid-studio.de',
  );
});

test('polygrid (Rechnung): Metazeilen Rechnungsnr./Rechnungsdatum/Leistungsdatum/Fällig bis, Summen ohne Festpreis', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'invoice');
  await page.getByTestId('document-service-date').fill('Juli 2026');
  await addLineItem(page, 'Website-Erstellung', '1200');
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  await page.getByTestId('document-issue').click();
  await expect(page.getByText(/ausgestellt/)).toBeVisible();

  await expect(page.getByTestId('doc-title')).toHaveText('Rechnung');
  const meta = page.getByTestId('doc-meta');
  await expect(meta).toContainText(`Rechnungsnr.:R-${CURRENT_YEAR}-001`);
  await expect(meta).toContainText('Rechnungsdatum:');
  await expect(meta).toContainText('Leistungsdatum/-zeitraum:Juli 2026');
  await expect(meta).toContainText('Fällig bis:');

  const total = page.getByTestId('doc-total');
  await expect(total).toContainText('Gesamtbetrag');
  await expect(total).not.toContainText('(Festpreis)');
});

// ------------------------------------------------------------
// Bausteine: an-/abwählbar, editierbar, umsortierbar, Vorschau live
// ------------------------------------------------------------

test('Bausteine: alle 8 Typen an-/abwählbar, editierbar, umsortierbar – Vorschau aktualisiert live', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'quote');

  // Editor listet die 7 Standard-Bausteine (custom kommt über den Button = 8 Typen)
  for (const kind of [
    'included',
    'excluded',
    'cooperation',
    'process',
    'payment_terms',
    'optional_offer',
    'validity_signature',
  ]) {
    await expect(page.getByTestId(`block-row-${kind}`)).toBeVisible();
  }

  // Defaults in der Vorschau: aktivierte Blöcke sichtbar, optional_offer aus
  await expect(page.getByTestId('doc-block-included')).toBeVisible();
  await expect(page.getByTestId('doc-block-excluded')).toBeVisible();
  await expect(page.getByTestId('doc-block-optional_offer')).toHaveCount(0);

  // Abwählen entfernt live aus der Vorschau
  await page.getByTestId('block-toggle-excluded').click();
  await expect(page.getByTestId('doc-block-excluded')).toHaveCount(0);

  // Anwählen fügt live hinzu
  await page.getByTestId('block-toggle-optional_offer').click();
  await expect(page.getByTestId('doc-block-optional_offer')).toBeVisible();

  // Editieren: Titel ändern → Vorschau folgt
  await page.getByTestId('block-expand-included').click();
  await page.getByTestId('block-title-included').fill('Leistungsumfang');
  await expect(page.getByTestId('doc-block-included')).toContainText('Leistungsumfang');

  // Bullets: Enter fügt neuen Punkt darunter ein, Vorschau zeigt ihn
  await page.getByTestId('block-item-included-0').press('Enter');
  await page.getByTestId('block-item-included-1').fill('Ein ganz neuer Punkt');
  await expect(page.getByTestId('doc-block-included')).toContainText('Ein ganz neuer Punkt');

  // Umsortieren: included nach unten → excluded wäre erster, ist aber abgewählt;
  // sichtbare Reihenfolge in der Vorschau beginnt dann mit cooperation
  await page.getByTestId('block-down-included').click();
  await page.getByTestId('block-down-included').click();
  const firstBlockTitle = page.getByTestId('doc-blocks').locator('.pg-doc-block-title').first();
  await expect(firstBlockTitle).toHaveText('Ihre Mitwirkung');

  // Eigener Baustein (8. Typ): hinzufügen, befüllen, live sichtbar, löschbar
  await page.getByTestId('block-add-custom').click();
  await page.getByTestId('block-title-custom').fill('Garantie');
  await page.getByTestId('block-text-custom').fill('12 Monate auf alle Arbeiten.');
  await expect(page.getByTestId('doc-block-custom')).toContainText('Garantie');
  await expect(page.getByTestId('doc-block-custom')).toContainText('12 Monate auf alle Arbeiten.');

  // Speichern persistiert die Konfiguration am Dokument
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  const rows = tauri.select('SELECT content_blocks FROM documents');
  const blocks = JSON.parse(String(rows[0].content_blocks)) as Array<{
    kind: string;
    title: string;
    enabled: boolean;
  }>;
  expect(blocks.find((block) => block.kind === 'included')?.title).toBe('Leistungsumfang');
  expect(blocks.find((block) => block.kind === 'excluded')?.enabled).toBe(false);
  expect(blocks.find((block) => block.kind === 'custom')?.title).toBe('Garantie');
});

test('payment_terms rendert Zahlungsziel/IBAN/BIC/Kontoinhaber aus den Settings über Variablen', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  setSetting(tauri, 'invoice_payment_terms_days', 21);

  await createDraftViaUI(page, 'quote');
  await addLineItem(page, 'Website-Erstellung', '590');

  const payment = page.getByTestId('doc-block-payment_terms');
  await expect(payment).toContainText('innerhalb von 21 Tagen');
  await expect(payment).toContainText('Kontoinhaber: Marco Kromer');
  await expect(payment).toContainText('IBAN: DE02120300000000202051');
  await expect(payment).toContainText('BIC: BYLADEM1001');
  await expect(payment).not.toContainText('{{');
});

test('validity_signature: nur bei Angeboten, mit Unterschriftslinien und Gültig-bis-Datum', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  // Angebot: Block vorhanden, Unterschriftslinien mit Kundennamen
  await createDraftViaUI(page, 'quote');
  await addLineItem(page, 'Website-Erstellung', '590');
  const validity = page.getByTestId('doc-block-validity_signature');
  await expect(validity).toContainText(/bis zum \d{2}\.\d{2}\.\d{4} gültig/);
  const signature = page.getByTestId('doc-signature');
  await expect(signature).toContainText('Ort, Datum');
  await expect(signature).toContainText('Unterschrift Malerbetrieb Weber');

  // Rechnung: Baustein existiert weder im Editor noch in der Vorschau
  await createDraftViaUI(page, 'invoice');
  await expect(page.getByTestId('content-blocks-editor')).toBeVisible();
  await expect(page.getByTestId('block-row-validity_signature')).toHaveCount(0);
  await expect(page.getByTestId('doc-block-validity_signature')).toHaveCount(0);
  // Rechnung: payment_terms als einziger Default-Baustein sichtbar
  await expect(page.getByTestId('doc-block-payment_terms')).toBeVisible();
  await expect(page.getByTestId('doc-block-included')).toHaveCount(0);
});

// ------------------------------------------------------------
// Nutzer-Standards pro Typ (seit Addendum 2 über den Konfigurator)
// ------------------------------------------------------------

test('Nutzer-Standards wirken pro Dokumenttyp; der Editor verweist auf den Konfigurator', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  // Editor: "Standards verwalten" öffnet den Konfigurator im Bausteine-Abschnitt
  await createDraftViaUI(page, 'quote');
  await page.getByTestId('blocks-manage-defaults').click();
  await expect(page.getByTestId('document-configurator')).toBeVisible();
  await expect(page.getByTestId('configurator-blocks')).toBeVisible();
  await expect(page).toHaveURL(/section=blocks/);
  await expect(page).toHaveURL(/type=quote/);

  // Angebots-Standard im Konfigurator anpassen und speichern
  await page.getByTestId('block-toggle-included').click();
  await page.getByTestId('block-expand-process').click();
  await page.getByTestId('block-title-process').fill('Projektablauf');
  await page.getByTestId('configurator-blocks-save').click();
  await expect(page.getByText(/Baustein-Standards für Angebote gespeichert/)).toBeVisible();

  const stored = tauri.select(
    "SELECT value FROM app_settings WHERE key = 'document_default_blocks_quote'",
  );
  expect(stored).toHaveLength(1);
  expect(String(stored[0].value)).toContain('Projektablauf');

  // Neues Angebot erhält den Nutzer-Standard
  await createDraftViaUI(page, 'quote');
  await expect(page.getByTestId('block-row-process')).toContainText('Projektablauf');
  await expect(page.getByTestId('doc-block-included')).toHaveCount(0);

  // Rechnungen bleiben unberührt: eigener Typ-Standard (Konstanten)
  await createDraftViaUI(page, 'invoice');
  await expect(page.getByTestId('block-row-process')).not.toContainText('Projektablauf');
  await expect(page.getByTestId('doc-block-payment_terms')).toBeVisible();
});

// ------------------------------------------------------------
// Snapshot friert Bausteine ein
// ------------------------------------------------------------

test('Snapshot: nachträgliche Änderung von Standards und Settings verändert ausgestellte Dokumente nicht', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'quote');
  await addLineItem(page, 'Website-Erstellung', '590');
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  await page.getByTestId('document-issue').click();
  await expect(page.getByText(/ausgestellt/)).toBeVisible();
  await expect(page.getByTestId('doc-block-payment_terms')).toContainText(
    'IBAN: DE02120300000000202051',
  );

  // Standards UND Variablenquellen nachträglich ändern
  setSetting(tauri, 'invoice_iban', 'DE99999999999999999999');
  setSetting(tauri, 'invoice_payment_terms_days', 99);
  setSetting(tauri, 'document_default_blocks_quote', [
    {
      id: 'x',
      kind: 'custom',
      enabled: true,
      title: 'GEÄNDERT',
      body_type: 'paragraph',
      items: [],
      text: 'GEÄNDERT',
    },
  ]);

  await page.reload();
  await expect(page.getByTestId('doc-block-payment_terms')).toContainText(
    'IBAN: DE02120300000000202051',
  );
  await expect(page.getByTestId('doc-block-payment_terms')).not.toContainText('DE9999');
  await expect(page.getByTestId('doc-blocks')).not.toContainText('GEÄNDERT');

  // Neue Dokumente nutzen dagegen den geänderten Standard
  await createDraftViaUI(page, 'quote');
  await expect(page.getByTestId('doc-blocks')).toContainText('GEÄNDERT');
});

// ------------------------------------------------------------
// Bedingte Mengenspalte
// ------------------------------------------------------------

test('Mengenspalte erscheint nur, wenn mindestens eine Position Menge > 1 hat', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'invoice');
  await addLineItem(page, 'Website-Erstellung', '1200');

  // Alle Mengen = 1 → keine Mengenspalte (POS. / BESCHREIBUNG / BETRAG)
  await expect(page.getByTestId('doc-positions')).toBeVisible();
  await expect(page.getByTestId('col-menge')).toHaveCount(0);
  await expect(page.getByTestId('doc-positions').locator('thead th')).toHaveCount(3);

  // Menge 2 → Spalten MENGE und EINZELPREIS erscheinen
  await page.getByLabel('Position 1: Menge').fill('2');
  await expect(page.getByTestId('col-menge')).toBeVisible();
  await expect(page.getByTestId('doc-positions').locator('thead th')).toHaveCount(5);
  await expect(page.getByTestId('doc-total')).toContainText('2.400,00');
});

// ------------------------------------------------------------
// Seitenumbruch-Regeln (Print-CSS)
// ------------------------------------------------------------

test('Seitenumbruch: Bausteine tragen break-inside/break-after-Regeln, Fußzeile liegt im tfoot', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'quote');
  await addLineItem(page, 'Website-Erstellung', '590');
  await expect(page.getByTestId('doc-block-included')).toBeVisible();

  // Kein Baustein-Titel verwaist: Block avoid, Titel break-after avoid
  const block = page.getByTestId('doc-block-included');
  await expect(block).toHaveCSS('break-inside', 'avoid');
  const blockTitle = block.locator('.pg-doc-block-title');
  await expect(blockTitle).toHaveCSS('break-after', 'avoid');

  // Fußzeile jeder Seite: über tfoot des Rahmen-Table realisiert
  const footerParent = page.locator('.pg-polygrid-frame > tfoot [data-testid="doc-footer"]');
  await expect(footerParent).toHaveCount(1);
});

// ------------------------------------------------------------
// Umwandlung: Rechnungs-Defaults statt Angebots-Bausteine
// ------------------------------------------------------------

test('Angebot→Rechnung: Editor zeigt Rechnungs-Standardbausteine, nicht die Angebots-Bausteine', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'quote');
  await addLineItem(page, 'Website-Erstellung', '590');
  // Angebots-Baustein individuell anpassen
  await page.getByTestId('block-expand-included').click();
  await page.getByTestId('block-title-included').fill('Individueller Leistungsumfang');
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  await page.getByTestId('document-issue').click();
  await expect(page.getByText(/ausgestellt/)).toBeVisible();

  await page.getByTestId('quote-convert').click();
  await expect(page.getByText('Rechnungs-Entwurf aus Angebot erstellt')).toBeVisible();
  await expect(page.getByTestId('document-editor-title')).toContainText('Rechnung (Entwurf)');

  // Rechnungs-Defaults geladen: nur payment_terms aktiv, keine Angebots-Anpassungen
  await expect(page.getByTestId('content-blocks-editor')).not.toContainText(
    'Individueller Leistungsumfang',
  );
  await expect(page.getByTestId('block-row-validity_signature')).toHaveCount(0);
  await expect(page.getByTestId('doc-block-payment_terms')).toBeVisible();
  await expect(page.getByTestId('doc-block-included')).toHaveCount(0);
});

// ------------------------------------------------------------
// Regression: modern/classic rendern unverändert (Alt-Dokument ohne Bausteine)
// ------------------------------------------------------------

test('modern/classic: Alt-Dokumente ohne Bausteine rendern unverändert, polygrid als dritter Tab', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  // Alt-Draft aus der Zeit vor dem Addendum: layout modern, content_blocks NULL
  const now = new Date().toISOString();
  const documentId = crypto.randomUUID();
  tauri.execute(
    `INSERT INTO documents (
       id, type, number, status, client_id, line_items, total,
       service_date, layout, created_at, updated_at
     ) VALUES ($1, 'invoice', NULL, 'draft', $2, $3, 1200, 'Juli 2026', 'modern', $4, $5)`,
    [
      documentId,
      CLIENT_ID,
      JSON.stringify([{ description: 'Website-Erstellung', quantity: 1, unit_price: 1200 }]),
      now,
      now,
    ],
  );

  await page.goto(`/documents/${documentId}`);
  await expect(page.getByTestId('document-editor-title')).toContainText('Rechnung (Entwurf)');

  // Modern rendert wie bisher: Titel mit Nummer-Platzhalter, keine Bausteine
  await expect(page.getByTestId('doc-title')).toContainText('Rechnung');
  await expect(page.getByTestId('doc-blocks')).toHaveCount(0);
  await expect(page.getByTestId('doc-kleinunternehmer')).toBeVisible();

  // Klassisch ebenso
  await page.getByTestId('layout-classic').click();
  await expect(page.getByTestId('doc-blocks')).toHaveCount(0);
  await expect(page.getByTestId('doc-positions').locator('thead')).toContainText('Beschreibung');

  // polygrid als dritter Tab wählbar
  await page.getByTestId('layout-polygrid').click();
  await expect(page.getByTestId('doc-title')).toHaveCSS('text-transform', 'uppercase');
});
