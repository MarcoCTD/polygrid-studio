/**
 * E2E: Angebote und Rechnungen (Modul 17).
 * Deckt die Akzeptanzkriterien der Spec ab: Draft-Flow und Ausstellen mit
 * Pflichtangaben-Gate, Nummernkreise, Snapshot-Isolation, Unveränderbarkeit,
 * Storno, Angebot→Rechnung, Bezahlt-Markieren mit Auftrags-Kopplung,
 * Layouts mit 30+ Positionen und §19-Satz, OneDrive-Fallback,
 * Smart-Action invoice_overdue und Steuerberater-Hinweis.
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

/** Setzt last_backup_at auf jetzt, damit backup_stale in den Dashboard-Tests still bleibt. */
function silenceBackupRule(tauri: TauriMock): void {
  setSetting(tauri, 'last_backup_at', new Date().toISOString());
}

function setSetting(tauri: TauriMock, key: string, value: unknown): void {
  tauri.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, JSON.stringify(value), new Date().toISOString()],
  );
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** Vollständige Aussteller-Stammdaten, damit Rechnungen ausstellbar sind. */
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

function seedClient(
  tauri: TauriMock,
  options: { id?: string; name?: string; address?: string | null } = {},
): string {
  const id = options.id ?? CLIENT_ID;
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO clients (id, name, address, credentials, created_at, updated_at)
     VALUES ($1, $2, $3, '[]', $4, $5)`,
    [
      id,
      options.name ?? 'Malerbetrieb Weber',
      options.address === undefined ? 'Wandweg 3\n54321 Pinselhausen' : options.address,
      now,
      now,
    ],
  );
  return id;
}

function seedProject(
  tauri: TauriMock,
  options: { clientId?: string; name?: string; price?: number | null } = {},
): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO website_projects (
       id, client_id, name, status, price, credentials, created_at, updated_at
     ) VALUES ($1, $2, $3, 'review', $4, '[]', $5, $6)`,
    [
      id,
      options.clientId ?? CLIENT_ID,
      options.name ?? 'Relaunch Weber',
      options.price ?? 800,
      now,
      now,
    ],
  );
  return id;
}

interface SeedDocumentOptions {
  type?: 'quote' | 'invoice';
  status?: string;
  number?: string | null;
  clientId?: string;
  lineItems?: { description: string; quantity: number; unit_price: number }[];
  total?: number;
  issueDate?: string | null;
  dueDate?: string | null;
  serviceDate?: string | null;
  layout?: string;
}

function seedDocument(tauri: TauriMock, options: SeedDocumentOptions = {}): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const lineItems = options.lineItems ?? [
    { description: 'Website-Erstellung', quantity: 1, unit_price: 1200 },
  ];
  const total =
    options.total ??
    Math.round(lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) * 100) /
      100;
  tauri.execute(
    `INSERT INTO documents (
       id, type, number, status, client_id, line_items, total, issue_date,
       due_date, service_date, layout, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      options.type ?? 'invoice',
      options.number === undefined ? null : options.number,
      options.status ?? 'draft',
      options.clientId ?? CLIENT_ID,
      JSON.stringify(lineItems),
      total,
      options.issueDate ?? null,
      options.dueDate ?? null,
      options.serviceDate ?? null,
      options.layout ?? 'modern',
      now,
      now,
    ],
  );
  return id;
}

async function gotoDocuments(page: Page): Promise<void> {
  await page.goto('/websites?tab=documents');
  await expect(page.getByRole('heading', { name: 'Websites' })).toBeVisible();
  await expect(page.getByTestId('documents-tab')).toBeVisible();
}

/** Legt über die UI einen Dokument-Draft an und landet im Editor. */
async function createDraftViaUI(
  page: Page,
  type: 'quote' | 'invoice',
  clientName = 'Malerbetrieb Weber',
): Promise<void> {
  await gotoDocuments(page);
  await page.getByTestId(type === 'quote' ? 'new-quote-button' : 'new-invoice-button').click();
  await page.getByText('Kunde wählen').click();
  await page.getByRole('option', { name: clientName }).click();
  await page.getByTestId('new-document-create').click();
  await expect(page.getByTestId('document-editor-title')).toContainText(
    type === 'quote' ? 'Angebot' : 'Rechnung',
  );
}

/** Befüllt den Draft im Editor mit einer Position und stellt ihn aus. */
async function fillAndIssue(page: Page, options: { serviceDate?: boolean } = {}): Promise<void> {
  if (options.serviceDate !== false) {
    await page.getByTestId('document-service-date').fill('Juli 2026');
  }
  await page.getByTestId('add-line-item').click();
  await page.getByLabel('Position 1: Beschreibung').fill('Website-Erstellung');
  await page.getByLabel('Position 1: Einzelpreis').fill('1200');
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  await page.getByTestId('document-issue').click();
  await expect(page.getByText(/ausgestellt/)).toBeVisible();
}

// ------------------------------------------------------------
// Dokumente-Tab
// ------------------------------------------------------------

test('Dokumente-Tab: Steuerberater-Hinweis dauerhaft sichtbar, leerer Zustand', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedClient(tauri);
  await gotoDocuments(page);

  await expect(page.getByTestId('steuerberater-hinweis')).toBeVisible();
  await expect(page.getByTestId('steuerberater-hinweis')).toContainText('Steuerberater');
  await expect(page.getByText('Noch keine Dokumente')).toBeVisible();
});

// ------------------------------------------------------------
// Draft → Ausstellen (Rechnung)
// ------------------------------------------------------------

test('Rechnung: Draft anlegen, bearbeiten, ausstellen – Nummer, Snapshot und §19-Satz', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'invoice');
  // Live-Vorschau einer Rechnung trägt den §19-Satz immer (nicht abwählbar)
  await expect(page.getByTestId('doc-kleinunternehmer')).toContainText(
    'Gemäß §19 UStG wird keine Umsatzsteuer berechnet.',
  );

  await fillAndIssue(page);

  // Nummer vergeben, Titel aktualisiert
  await expect(page.getByTestId('document-editor-title')).toContainText(
    `Rechnung R-${CURRENT_YEAR}-001`,
  );

  const rows = tauri.select('SELECT number, status, snapshot, due_date FROM documents');
  expect(rows).toHaveLength(1);
  expect(rows[0].number).toBe(`R-${CURRENT_YEAR}-001`);
  expect(rows[0].status).toBe('issued');
  expect(rows[0].snapshot).toBeTruthy();
  expect(rows[0].due_date).toBeTruthy();

  // Snapshot enthält Aussteller, Empfänger und §19-Satz
  const snapshot = JSON.parse(String(rows[0].snapshot)) as Record<string, unknown>;
  expect((snapshot.issuer as Record<string, unknown>).street).toBe('Musterstraße 1');
  expect((snapshot.recipient as Record<string, unknown>).name).toBe('Malerbetrieb Weber');
  expect(snapshot.kleinunternehmer_hinweis).toBe(
    'Gemäß §19 UStG wird keine Umsatzsteuer berechnet.',
  );

  // Formular ist nach dem Ausstellen weg (unveränderbar), Blatt rendert aus dem Snapshot
  await expect(page.getByTestId('document-save')).toHaveCount(0);
  await expect(page.getByTestId('line-items-editor')).toHaveCount(0);
  await expect(page.getByTestId('doc-title')).toContainText(`Rechnung R-${CURRENT_YEAR}-001`);
});

test('Pflichtangaben-Gate: Ausstellen ist deaktiviert und listet fehlende Angaben', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  // KEINE Aussteller-Stammdaten, Kunde ohne Anschrift
  seedClient(tauri, { address: null });

  await createDraftViaUI(page, 'invoice');
  await expect(page.getByTestId('document-issue')).toBeDisabled();

  const missing = page.getByTestId('document-missing-requirements');
  await expect(missing).toBeVisible();
  await expect(missing).toContainText('Mindestens eine Position');
  await expect(missing).toContainText('Anschrift des Empfängers');
  await expect(missing).toContainText('Straße des Ausstellers');
  await expect(missing).toContainText('Steuernummer oder USt-IdNr');
  await expect(missing).toContainText('Leistungsdatum');
});

test('Nummernkreise: Drafts verbrauchen keine Nummern, Angebote/Rechnungen getrennt', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  page.on('dialog', (dialog) => void dialog.accept());

  // Draft anlegen und wieder löschen – darf keine Nummer verbrauchen
  await createDraftViaUI(page, 'invoice');
  await page.getByTestId('document-delete').click();
  await expect(page.getByTestId('documents-tab')).toBeVisible();

  // Angebot ausstellen → A-JJJJ-001
  await createDraftViaUI(page, 'quote');
  await fillAndIssue(page, { serviceDate: false });
  await expect(page.getByTestId('document-editor-title')).toContainText(
    `Angebot A-${CURRENT_YEAR}-001`,
  );

  // Rechnung ausstellen → R-JJJJ-001 (eigener Kreis, Lücke durch Draft gibt es nicht)
  await createDraftViaUI(page, 'invoice');
  await fillAndIssue(page);
  await expect(page.getByTestId('document-editor-title')).toContainText(
    `Rechnung R-${CURRENT_YEAR}-001`,
  );
});

// ------------------------------------------------------------
// Snapshot-Isolation und Storno
// ------------------------------------------------------------

test('Snapshot-Isolation: spätere Kundenänderung verändert das ausgestellte Dokument nicht', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'invoice');
  await fillAndIssue(page);

  // Livedaten ändern
  tauri.execute('UPDATE clients SET name = $1, address = $2 WHERE id = $3', [
    'Umbenannter Kunde GmbH',
    'Neue Straße 99',
    CLIENT_ID,
  ]);

  await page.reload();
  await expect(page.getByTestId('doc-recipient')).toContainText('Malerbetrieb Weber');
  await expect(page.getByTestId('doc-recipient')).toContainText('Wandweg 3');
  await expect(page.getByTestId('doc-recipient')).not.toContainText('Umbenannter Kunde');
});

test('Storno: Gegenrechnung mit Referenz und eigener Nummer, Original storniert', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  page.on('dialog', (dialog) => void dialog.accept());

  await createDraftViaUI(page, 'invoice');
  await fillAndIssue(page);

  // Ausgestellte Rechnung ist nicht löschbar (kein Löschen-Button mehr)
  await expect(page.getByTestId('document-delete')).toHaveCount(0);

  await page.getByTestId('invoice-cancel').click();
  await expect(page.getByText(/Gegenrechnung R-\d{4}-002 erstellt/)).toBeVisible();

  // Navigation zur Gegenrechnung: negativer Betrag, Referenz auf das Original
  await expect(page.getByTestId('document-editor-title')).toContainText(`R-${CURRENT_YEAR}-002`);
  await expect(page.getByTestId('doc-total')).toContainText('-1.200,00');
  await expect(page.getByTestId('doc-intro')).toContainText(
    `Stornorechnung zur Rechnung R-${CURRENT_YEAR}-001`,
  );

  const rows = tauri.select(
    'SELECT number, status, total, related_document_id FROM documents ORDER BY number',
  );
  expect(rows).toHaveLength(2);
  expect(rows[0].status).toBe('cancelled');
  expect(rows[1].total).toBe(-1200);
  expect(rows[1].related_document_id).toBeTruthy();
});

// ------------------------------------------------------------
// Angebot → Rechnung
// ------------------------------------------------------------

test('Angebot zu Rechnung: übernimmt Positionen und verknüpft beide Dokumente', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'quote');
  await fillAndIssue(page, { serviceDate: false });
  await expect(page.getByTestId('document-editor-title')).toContainText(
    `Angebot A-${CURRENT_YEAR}-001`,
  );

  await page.getByTestId('quote-convert').click();
  await expect(page.getByText('Rechnungs-Entwurf aus Angebot erstellt')).toBeVisible();

  // Rechnungs-Draft mit übernommenen Positionen
  await expect(page.getByTestId('document-editor-title')).toContainText('Rechnung (Entwurf)');
  await expect(page.getByLabel('Position 1: Beschreibung')).toHaveValue('Website-Erstellung');

  const rows = tauri.select(
    `SELECT d.type, d.status, d.related_document_id, q.status AS quote_status
     FROM documents d
     LEFT JOIN documents q ON q.id = d.related_document_id
     WHERE d.type = 'invoice'`,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe('draft');
  expect(rows[0].related_document_id).toBeTruthy();
  expect(rows[0].quote_status).toBe('accepted');
});

// ------------------------------------------------------------
// Bezahlt markieren + Auftrags-Kopplung
// ------------------------------------------------------------

test('Abrechnen mit Rechnung: Projekt erzeugt Auftrag + Draft, Bezahlt setzt Auftrag auf paid/completed', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  seedProject(tauri, { price: 800 });

  await page.goto('/websites?tab=projects');
  await page.getByTestId('projects-table').getByText('Relaunch Weber').click();
  await page.getByTestId('bill-with-invoice').click();
  await expect(page.getByText(/Rechnungs-Entwurf erstellt/)).toBeVisible();

  // Editor mit vorbefüllter Position aus dem Projektpreis
  await expect(page.getByTestId('document-editor-title')).toContainText('Rechnung (Entwurf)');
  await expect(page.getByLabel('Position 1: Beschreibung')).toHaveValue(
    'Website-Projekt „Relaunch Weber“',
  );
  await expect(page.getByLabel('Position 1: Einzelpreis')).toHaveValue('800');

  // Leistungsdatum ergänzen, speichern, ausstellen
  await page.getByTestId('document-service-date').fill('Juli 2026');
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  await page.getByTestId('document-issue').click();
  await expect(page.getByText(/ausgestellt/)).toBeVisible();

  // Bezahlt markieren → verknüpfter Auftrag wird paid/completed (EÜR zählt ihn)
  await page.getByTestId('invoice-mark-paid').click();
  await expect(page.getByText(/auf bezahlt\/abgeschlossen gesetzt/)).toBeVisible();

  const orders = tauri.select(
    'SELECT status, payment_status, payment_received_date, sale_price FROM orders',
  );
  expect(orders).toHaveLength(1);
  expect(orders[0].payment_status).toBe('paid');
  expect(orders[0].status).toBe('completed');
  expect(orders[0].payment_received_date).toBeTruthy();
  expect(orders[0].sale_price).toBe(800);

  const documents = tauri.select("SELECT status, order_id FROM documents WHERE type = 'invoice'");
  expect(documents[0].status).toBe('paid');
  expect(documents[0].order_id).toBeTruthy();
});

test('Bezahlt ohne verknüpften Auftrag: Hinweis-Dialog erzeugt Website-Auftrag', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'invoice');
  await fillAndIssue(page);

  await page.getByTestId('invoice-mark-paid').click();
  await expect(page.getByText('Kein Auftrag verknüpft')).toBeVisible();
  await page.getByTestId('paid-create-order').click();
  await expect(page.getByText(/Auftrag \d{4}-\d{4} \(Website\) erzeugt/)).toBeVisible();

  const orders = tauri.select('SELECT platform, status, payment_status, sale_price FROM orders');
  expect(orders).toHaveLength(1);
  expect(orders[0].platform).toBe('website');
  expect(orders[0].status).toBe('completed');
  expect(orders[0].payment_status).toBe('paid');
  expect(orders[0].sale_price).toBe(1200);
});

// ------------------------------------------------------------
// Dokument-Kopf und Variablenersetzung (Auftrag 1)
// ------------------------------------------------------------

/** 1x1-PNG als Data-URL – reicht als konfiguriertes Logo. */
const LOGO_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('Kopf mit Logo: Logo links als einziges Markenelement, rechts Dokumenttyp + Metazeilen – auch im Snapshot', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  setSetting(tauri, 'invoice_logo', LOGO_DATA_URL);
  seedClient(tauri);

  await createDraftViaUI(page, 'invoice');

  // Links: nur das Logo, kein Firmenname-Text im Kopf
  const header = page.getByTestId('doc-header');
  await expect(page.getByTestId('doc-header-logo')).toBeVisible();
  await expect(page.getByTestId('doc-header-brand')).toHaveCount(0);
  await expect(header).not.toContainText('PolyGrid Studio');

  // Rechts: Dokumenttyp mit Metazeilen, genau EIN Logo im gesamten Blatt
  await expect(header).toContainText('Rechnung');
  await expect(page.getByTestId('doc-header-meta')).toContainText('Datum');
  await expect(page.getByTestId('doc-header-meta')).toContainText('Fällig am');
  await expect(page.getByTestId('document-sheet').locator('img[alt="Logo"]')).toHaveCount(1);

  await fillAndIssue(page);

  // Snapshot-Fall: ausgestelltes Dokument rendert denselben Kopf aus dem Snapshot
  await expect(page.getByTestId('doc-header-logo')).toBeVisible();
  await expect(page.getByTestId('doc-header')).not.toContainText('PolyGrid Studio');
  await expect(page.getByTestId('document-sheet').locator('img[alt="Logo"]')).toHaveCount(1);

  const rows = tauri.select('SELECT snapshot FROM documents');
  const snapshot = JSON.parse(String(rows[0].snapshot)) as Record<string, unknown>;
  expect(snapshot.logo).toBe(LOGO_DATA_URL);
});

test('Kopf ohne Logo: Firmenname als Text links (Fallback), Metazeilen rechts', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'quote');

  const header = page.getByTestId('doc-header');
  await expect(page.getByTestId('doc-header-brand')).toContainText('PolyGrid Studio');
  await expect(page.getByTestId('doc-header-logo')).toHaveCount(0);
  await expect(header).toContainText('Angebot');
  await expect(page.getByTestId('doc-header-meta')).toContainText('Gültig bis');
});

test('Zahlungsbedingungen: {{iban}} und {{bic}} werden in Vorschau und Snapshot ersetzt', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'invoice');
  await page
    .getByTestId('document-outro')
    .fill('Zahlbar per Überweisung: IBAN {{iban}}, BIC {{bic}}.');

  // Live-Vorschau ersetzt sofort – keine rohen Variablen
  await expect(page.getByTestId('doc-outro')).toContainText('DE02120300000000202051');
  await expect(page.getByTestId('doc-outro')).toContainText('BYLADEM1001');
  await expect(page.getByTestId('doc-outro')).not.toContainText('{{');

  await fillAndIssue(page);

  // Snapshot-Fall: eingefrorener Schlusstext enthält die echten Werte
  const rows = tauri.select('SELECT snapshot FROM documents');
  const snapshot = JSON.parse(String(rows[0].snapshot)) as Record<string, unknown>;
  expect(snapshot.outro_text).toBe(
    'Zahlbar per Überweisung: IBAN DE02120300000000202051, BIC BYLADEM1001.',
  );
  await expect(page.getByTestId('doc-outro')).not.toContainText('{{');
});

test('Variablen ohne Wert: sichtbare Warnung, Ausstellen gesperrt, nach Pflege der Settings frei', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  setSetting(tauri, 'invoice_iban', '');
  setSetting(tauri, 'invoice_bic', '');
  seedClient(tauri);

  await createDraftViaUI(page, 'invoice');
  await page.getByTestId('document-service-date').fill('Juli 2026');
  await page.getByTestId('add-line-item').click();
  await page.getByLabel('Position 1: Beschreibung').fill('Website-Erstellung');
  await page.getByLabel('Position 1: Einzelpreis').fill('1200');
  await page
    .getByTestId('document-outro')
    .fill('Zahlungsbedingungen: IBAN {{iban}}, BIC {{bic}}.');
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();

  // Warnung sichtbar, Ausstellen-Button gesperrt, Variablen bleiben in der Vorschau roh
  const warning = page.getByTestId('document-unresolved-variables');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('Variablen ohne Wert: iban, bic');
  await expect(warning).toContainText('in den Einstellungen vervollständigen');
  await expect(page.getByTestId('document-issue')).toBeDisabled();
  await expect(page.getByTestId('doc-outro')).toContainText('{{iban}}');

  // Settings nachpflegen → Warnung verschwindet, Ausstellen wird frei
  setSetting(tauri, 'invoice_iban', 'DE02120300000000202051');
  setSetting(tauri, 'invoice_bic', 'BYLADEM1001');
  await page.reload();
  await expect(page.getByTestId('document-editor-title')).toContainText('Rechnung (Entwurf)');
  await expect(page.getByTestId('document-unresolved-variables')).toHaveCount(0);
  await expect(page.getByTestId('document-issue')).toBeEnabled();
});

// ------------------------------------------------------------
// Positionseditor (Auftrag 2)
// ------------------------------------------------------------

test('Positionseditor: Beschreibung als breite, mehrzeilige Textarea – kein gequetschtes Feld', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);

  await createDraftViaUI(page, 'invoice');
  await page.getByTestId('add-line-item').click();

  // Volle Breite statt gequetschter Spalte (Regression: ~20px im 420px-Panel)
  const description = page.getByLabel('Position 1: Beschreibung');
  const box = await description.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(250);

  // Mehrzeilige Beschreibung landet mit Umbruch in der Vorschau (pre-line)
  await description.fill('Website-Erstellung\nInklusive Responsive-Design');
  await page.getByLabel('Position 1: Einzelpreis').fill('1200');
  await expect(page.getByTestId('doc-positions')).toContainText('Inklusive Responsive-Design');
  await expect(page.getByTestId('line-items-total')).toContainText('1.200,00');

  // Speichern erhält den mehrzeiligen Text
  await page.getByTestId('document-service-date').fill('Juli 2026');
  await page.getByTestId('document-save').click();
  await expect(page.getByText('Entwurf gespeichert')).toBeVisible();
  await expect(description).toHaveValue('Website-Erstellung\nInklusive Responsive-Design');
});

// ------------------------------------------------------------
// Layouts und Seitenumbruch
// ------------------------------------------------------------

test('Beide Layouts rendern 30+ Positionen inkl. Kopfwiederholungs-thead und §19-Satz', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  const manyItems = Array.from({ length: 35 }, (_, index) => ({
    description: `Position ${index + 1}`,
    quantity: 1,
    unit_price: 10,
  }));
  const documentId = seedDocument(tauri, {
    lineItems: manyItems,
    serviceDate: 'Juli 2026',
  });

  await page.goto(`/documents/${documentId}`);
  await expect(page.getByTestId('document-editor-title')).toContainText('Rechnung (Entwurf)');

  // Modern: alle 35 Zeilen, thead (Kopfwiederholung) und §19-Satz
  const positions = page.getByTestId('doc-positions');
  await expect(positions.locator('tbody tr')).toHaveCount(35);
  await expect(positions.locator('thead')).toContainText('Beschreibung');
  await expect(page.getByTestId('doc-kleinunternehmer')).toBeVisible();
  await expect(page.getByTestId('doc-total')).toContainText('350,00');

  // Klassisch: gleicher Inhalt im zweiten Layout
  await page.getByTestId('layout-classic').click();
  await expect(positions.locator('tbody tr')).toHaveCount(35);
  await expect(positions.locator('thead')).toContainText('Beschreibung');
  await expect(page.getByTestId('doc-kleinunternehmer')).toBeVisible();
});

// ------------------------------------------------------------
// OneDrive-Ablage (dokumentierter Fallback E17-10)
// ------------------------------------------------------------

test('PDF-Ablage in OneDrive: Zielordner, Dateiname und Bestätigung setzen pdf_path + file_link', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedIssuerSettings(tauri);
  seedClient(tauri);
  setSetting(tauri, 'onedrive_base_path', '/mock/onedrive');

  await createDraftViaUI(page, 'invoice');
  await fillAndIssue(page);

  await page.getByTestId('document-onedrive').click();
  await expect(page.getByTestId('onedrive-filename')).toContainText(
    `R-${CURRENT_YEAR}-001_malerbetrieb-weber.pdf`,
  );

  // Mock: check_path_exists → true, damit gilt die PDF als gespeichert
  await page.getByTestId('onedrive-confirm').click();
  await expect(page.getByText(/PDF abgelegt/)).toBeVisible();

  const documents = tauri.select('SELECT pdf_path FROM documents');
  expect(String(documents[0].pdf_path)).toContain(
    `/mock/onedrive/01_Finanzen/Rechnungen_${CURRENT_YEAR}/R-${CURRENT_YEAR}-001_malerbetrieb-weber.pdf`,
  );

  const links = tauri.select(
    "SELECT entity_type, file_path, file_type, mime_type FROM file_links WHERE entity_type = 'document'",
  );
  expect(links).toHaveLength(1);
  expect(String(links[0].file_path)).toBe(
    `01_Finanzen/Rechnungen_${CURRENT_YEAR}/R-${CURRENT_YEAR}-001_malerbetrieb-weber.pdf`,
  );
  expect(links[0].file_type).toBe('beleg');
  expect(links[0].mime_type).toBe('application/pdf');
});

// ------------------------------------------------------------
// Smart Action invoice_overdue
// ------------------------------------------------------------

test('invoice_overdue: feuert bei überfälliger Rechnung, Klick öffnet gefilterten Dokumente-Tab', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedClient(tauri);
  // Überfällig: issued, due_date überschritten
  seedDocument(tauri, {
    status: 'issued',
    number: `R-${CURRENT_YEAR}-900`,
    issueDate: isoDaysFromNow(-20),
    dueDate: isoDaysFromNow(-5),
    serviceDate: 'Juni 2026',
  });
  // Nicht überfällig: due_date in der Zukunft
  seedDocument(tauri, {
    status: 'issued',
    number: `R-${CURRENT_YEAR}-901`,
    issueDate: isoDaysFromNow(-1),
    dueDate: isoDaysFromNow(10),
    serviceDate: 'Juli 2026',
  });
  await page.reload();

  const card = page.getByTestId('smart-action-invoice_overdue');
  await expect(card).toBeVisible();
  await expect(card).toContainText('1 Rechnung ist überfällig');

  await card.locator('button[title="Zur Ansicht springen"]').click();
  await expect(page).toHaveURL(/\/websites\?.*tab=documents.*filter=overdue/);

  // Gefiltert: nur die überfällige Rechnung, Filter-Chip sichtbar
  await expect(page.getByRole('button', { name: 'Filter entfernen' })).toContainText(
    'Überfällige Rechnungen',
  );
  await expect(page.getByText(`R-${CURRENT_YEAR}-900`)).toBeVisible();
  await expect(page.getByText(`R-${CURRENT_YEAR}-901`)).toHaveCount(0);
  await expect(page.getByTestId('document-status-badge')).toContainText('Überfällig');
});
