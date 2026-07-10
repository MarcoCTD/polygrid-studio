/**
 * E2E: Website-CRM (Modul 16).
 * Deckt die Akzeptanzkriterien der Spec ab: CRUD über die UI, Abrechnen,
 * Plattform website in Filtern/Kanban/EÜR, Recurring-Engine (Idempotenz und
 * Nachholen), Zugangsdaten im Keychain-Mock, Kennzahlen und die drei
 * Smart-Action-Regeln.
 */
import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';
import type { Page } from '@playwright/test';

const CLIENT_ID = 'dddddddd-4444-4444-8444-444444444444';

async function bootApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
}

/** Setzt last_backup_at auf jetzt, damit backup_stale in den Dashboard-Tests still bleibt. */
function silenceBackupRule(tauri: TauriMock): void {
  tauri.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('last_backup_at', $1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = $2`,
    [JSON.stringify(new Date().toISOString()), new Date().toISOString()],
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

function seedClient(tauri: TauriMock, options: { id?: string; name?: string } = {}): string {
  const id = options.id ?? CLIENT_ID;
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO clients (id, name, credentials, created_at, updated_at)
     VALUES ($1, $2, '[]', $3, $4)`,
    [id, options.name ?? 'Malerbetrieb Weber', now, now],
  );
  return id;
}

interface SeedProjectOptions {
  clientId?: string;
  name?: string;
  status?: string;
  price?: number | null;
  deadline?: string | null;
}

function seedProject(tauri: TauriMock, options: SeedProjectOptions = {}): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO website_projects (
       id, client_id, name, status, price, deadline, credentials, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, '[]', $7, $8)`,
    [
      id,
      options.clientId ?? CLIENT_ID,
      options.name ?? 'Relaunch Weber',
      options.status ?? 'in_progress',
      options.price ?? null,
      options.deadline ?? null,
      now,
      now,
    ],
  );
  return id;
}

interface SeedServiceOptions {
  clientId?: string;
  type?: string;
  label?: string;
  costOut?: number | null;
  costOutVendor?: string | null;
  priceIn?: number | null;
  interval?: string;
  nextDue?: string;
  expiresAt?: string | null;
  active?: boolean;
}

function seedService(tauri: TauriMock, options: SeedServiceOptions = {}): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO website_services (
       id, client_id, type, label, cost_out, cost_out_vendor, price_in,
       interval, next_due, expires_at, active, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      options.clientId ?? CLIENT_ID,
      options.type ?? 'hosting',
      options.label ?? 'Hetzner Webspace',
      options.costOut === undefined ? 5 : options.costOut,
      options.costOutVendor ?? null,
      options.priceIn === undefined ? 15 : options.priceIn,
      options.interval ?? 'monthly',
      options.nextDue ?? isoDaysFromNow(30),
      options.expiresAt ?? null,
      options.active === false ? 0 : 1,
      now,
      now,
    ],
  );
  return id;
}

let receiptCounter = 0;

function seedWebsiteOrder(
  tauri: TauriMock,
  options: {
    salePrice?: number;
    status?: string;
    paymentStatus?: string;
    paymentReceivedDate?: string | null;
    orderDate?: string;
  } = {},
): string {
  receiptCounter += 1;
  const receipt = `2026-${String(7000 + receiptCounter)}`;
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO orders (
       id, receipt_number, platform, quantity, sale_price, status,
       payment_status, payment_received_date, order_date, tax_locked,
       created_at, updated_at
     ) VALUES ($1, $2, 'website', 1, $3, $4, $5, $6, $7, 0, $8, $9)`,
    [
      crypto.randomUUID(),
      receipt,
      options.salePrice ?? 300,
      options.status ?? 'ordered',
      options.paymentStatus ?? 'pending',
      options.paymentReceivedDate ?? null,
      options.orderDate ?? isoDaysFromNow(-1),
      now,
      now,
    ],
  );
  return receipt;
}

async function gotoWebsites(page: Page, tab?: string): Promise<void> {
  await page.goto(tab ? `/websites?tab=${tab}` : '/websites');
  await expect(page.getByRole('heading', { name: 'Websites' })).toBeVisible();
}

// ------------------------------------------------------------
// CRUD über die UI
// ------------------------------------------------------------

test('Kunde kann über die UI angelegt, bearbeitet und soft-deleted werden', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  await gotoWebsites(page, 'clients');

  // Anlegen
  await page.getByRole('button', { name: 'Neuer Kunde' }).click();
  await page.getByLabel('Name *').fill('Malerbetrieb Weber');
  await page.getByLabel('E-Mail').fill('info@weber.de');
  await page.getByRole('button', { name: 'Kunde anlegen' }).click();
  await expect(page.getByText('Kunde angelegt')).toBeVisible();
  await expect(page.getByTestId('clients-table').getByText('Malerbetrieb Weber')).toBeVisible();

  // Bearbeiten über das Detail-Panel
  await page.getByTestId('clients-table').getByText('Malerbetrieb Weber').click();
  const panel = page.getByTestId('client-detail-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Ansprechpartner').fill('Herr Weber');
  await panel.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Kunde gespeichert')).toBeVisible();

  const saved = tauri.select(
    `SELECT contact_person FROM clients WHERE name = 'Malerbetrieb Weber'`,
  );
  expect(saved[0]?.contact_person).toBe('Herr Weber');

  // Soft-Delete über das Zeilenmenü
  await page.getByTestId('clients-table').locator('button[aria-haspopup]').last().click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Kunde gelöscht')).toBeVisible();
  await expect(page.getByText('Noch keine Kunden.')).toBeVisible();

  const deleted = tauri.select(`SELECT deleted_at FROM clients WHERE name = 'Malerbetrieb Weber'`);
  expect(deleted[0]?.deleted_at).not.toBeNull();
});

test('Projekt und laufender Posten: anlegen, bearbeiten, soft-deleten', async ({ page, tauri }) => {
  await bootApp(page);
  seedClient(tauri);
  await gotoWebsites(page);

  // Projekt anlegen (Default-Tab Projekte)
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.getByText('Kunde wählen').click();
  await page.getByRole('option', { name: 'Malerbetrieb Weber' }).click();
  await page.getByLabel('Name *').fill('Relaunch Weber');
  await page.getByLabel('Preis (brutto)').fill('1200');
  await page.getByRole('button', { name: 'Projekt anlegen' }).click();
  await expect(page.getByText('Projekt angelegt')).toBeVisible();
  await expect(page.getByTestId('projects-table').getByText('Relaunch Weber')).toBeVisible();

  // Projekt bearbeiten
  await page.getByTestId('projects-table').getByText('Relaunch Weber').click();
  const projectPanel = page.getByTestId('project-detail-panel');
  await expect(projectPanel).toBeVisible();
  await projectPanel.getByLabel('Name').fill('Relaunch Weber 2.0');
  await projectPanel.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Projekt gespeichert')).toBeVisible();
  await expect(page.getByTestId('projects-table').getByText('Relaunch Weber 2.0')).toBeVisible();

  // Posten anlegen
  await gotoWebsites(page, 'services');
  await page.getByRole('button', { name: 'Neuer Posten' }).click();
  await page.getByLabel('Label *').fill('malerweber.de');
  await page.getByText('Kunde wählen').click();
  await page.getByRole('option', { name: 'Malerbetrieb Weber' }).click();
  await page.getByLabel('Kosten/Periode (ich zahle)').fill('12');
  await page.getByRole('button', { name: 'Posten anlegen' }).click();
  await expect(page.getByText('Laufender Posten angelegt')).toBeVisible();
  await expect(page.getByTestId('services-table').getByText('malerweber.de')).toBeVisible();

  // Posten bearbeiten: Kundenpreis ergänzen
  await page.getByTestId('services-table').getByText('malerweber.de').click();
  const servicePanel = page.getByTestId('service-detail-panel');
  await expect(servicePanel).toBeVisible();
  await servicePanel.getByLabel('Kundenpreis/Periode').fill('25');
  await servicePanel.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Posten gespeichert')).toBeVisible();

  const service = tauri.select(
    `SELECT price_in FROM website_services WHERE label = 'malerweber.de'`,
  );
  expect(Number(service[0]?.price_in)).toBe(25);

  // Posten löschen
  await page.getByTestId('services-table').locator('button[aria-haspopup]').last().click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Posten gelöscht')).toBeVisible();

  const deletedService = tauri.select(
    `SELECT deleted_at FROM website_services WHERE label = 'malerweber.de'`,
  );
  expect(deletedService[0]?.deleted_at).not.toBeNull();

  // Projekt löschen
  await gotoWebsites(page, 'projects');
  await page.getByTestId('projects-table').locator('button[aria-haspopup]').last().click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Projekt gelöscht')).toBeVisible();

  const deletedProject = tauri.select(
    `SELECT deleted_at FROM website_projects WHERE name = 'Relaunch Weber 2.0'`,
  );
  expect(deletedProject[0]?.deleted_at).not.toBeNull();
});

// ------------------------------------------------------------
// Abrechnen und Plattform website
// ------------------------------------------------------------

test('Abrechnen erzeugt Website-Auftrag, verknüpft ihn und deaktiviert den Button', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedClient(tauri);
  seedProject(tauri, { name: 'Relaunch Weber', price: 1200, status: 'live' });
  await gotoWebsites(page);

  await page.getByTestId('projects-table').getByText('Relaunch Weber').click();
  const panel = page.getByTestId('project-detail-panel');
  await panel.getByRole('button', { name: /Abrechnen/ }).click();
  await expect(page.getByText(/Auftrag 2026-\d+ erstellt/)).toBeVisible();

  // Button ist ersetzt durch den Link zum Auftrag
  await expect(panel.getByRole('button', { name: /Abrechnen/ })).toHaveCount(0);
  await expect(panel.getByText('Abgerechnet')).toBeVisible();

  const orders = tauri.select(
    `SELECT id, platform, status, payment_status, sale_price, customer_name FROM orders`,
  );
  expect(orders).toHaveLength(1);
  expect(orders[0].platform).toBe('website');
  expect(orders[0].status).toBe('ordered');
  expect(orders[0].payment_status).toBe('pending');
  expect(Number(orders[0].sale_price)).toBe(1200);
  expect(orders[0].customer_name).toBe('Malerbetrieb Weber');

  const project = tauri.select(`SELECT order_id FROM website_projects`);
  expect(project[0].order_id).toBe(orders[0].id);

  // Link führt zum Auftrag (Detail-Panel öffnet über ?order=)
  await panel.getByRole('button', { name: 'Zum Auftrag' }).click();
  await expect(page).toHaveURL(/\/orders\?.*order=/);
  await expect(page.getByRole('tab', { name: 'Übersicht' })).toBeVisible();
  await expect(page.getByText('Malerbetrieb Weber').first()).toBeVisible();
});

test('Plattform website erscheint in Auftragsfilter und Kanban', async ({ page, tauri }) => {
  await bootApp(page);
  const receipt = seedWebsiteOrder(tauri, { salePrice: 500 });
  await page.goto('/orders?view=kanban&platform=website');

  // Kanban: Auftrag in Spalte "Bestellt", Plattform-Badge Website
  const column = page.locator('section', { has: page.getByRole('heading', { name: 'Bestellt' }) });
  await expect(column.getByText(receipt)).toBeVisible();

  // Plattform-Filter enthält Website und ist aus der URL vorbelegt
  await page.getByRole('button', { name: /Plattform: Website/ }).click();
  await expect(page.getByRole('dialog').getByText('Website')).toBeVisible();
});

test('EÜR: Website-Einnahmen zählen erst bei paid', async ({ page, tauri }) => {
  await bootApp(page);
  seedWebsiteOrder(tauri, {
    salePrice: 500,
    status: 'completed',
    paymentStatus: 'paid',
    paymentReceivedDate: '2025-06-01',
    orderDate: '2025-05-20',
  });
  seedWebsiteOrder(tauri, {
    salePrice: 300,
    status: 'ordered',
    paymentStatus: 'pending',
    paymentReceivedDate: null,
    orderDate: '2025-06-10',
  });

  await page.goto('/analytics');
  await page.getByRole('tab', { name: 'Steuer-Export' }).click();
  await expect(page.getByTestId('euer-vorschau')).toBeVisible();
  await page.getByLabel('Jahr wählen').click();
  await page.getByRole('option', { name: '2025' }).click();

  // Nur der bezahlte Website-Auftrag (500 €) zählt als Einnahme
  await expect(page.getByTestId('euer-einnahmen')).toContainText('500,00 €');
});

// ------------------------------------------------------------
// Recurring-Engine (App-Start)
// ------------------------------------------------------------

test('Recurring-Engine erzeugt beim App-Start Ausgabe und Auftrags-Entwurf exakt einmal', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedClient(tauri);
  const serviceId = seedService(tauri, {
    label: 'Hetzner Webspace',
    costOut: 5,
    costOutVendor: 'Hetzner',
    priceIn: 15,
    nextDue: toIso(new Date()),
  });

  // App-Start Nr. 2: Engine läuft und erzeugt beide Posten
  await page.reload();
  await expect(
    page.getByText('Website-Posten: 1 Ausgabe und 1 Auftrags-Entwurf automatisch erzeugt'),
  ).toBeVisible();

  const expenses = tauri.select(
    `SELECT vendor, category, subcategory, purpose, recurring, import_source FROM expenses WHERE import_ref = $1`,
    [serviceId],
  );
  expect(expenses).toHaveLength(1);
  expect(expenses[0].vendor).toBe('Hetzner');
  expect(expenses[0].category).toBe('software_saas');
  expect(expenses[0].subcategory).toBe('hosting');
  expect(expenses[0].purpose).toBe('Hetzner Webspace monatlich');

  const orders = tauri.select(
    `SELECT status, payment_status, sale_price, notes FROM orders WHERE platform = 'website'`,
  );
  expect(orders).toHaveLength(1);
  expect(orders[0].status).toBe('ordered');
  expect(orders[0].payment_status).toBe('pending');
  expect(Number(orders[0].sale_price)).toBe(15);
  expect(orders[0].notes).toBe('Hetzner Webspace, automatisch erzeugt');

  // App-Start Nr. 3 und 4 am selben Tag: keine Duplikate
  await page.reload();
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();

  expect(tauri.select(`SELECT id FROM expenses WHERE import_ref = $1`, [serviceId])).toHaveLength(
    1,
  );
  expect(tauri.select(`SELECT id FROM orders WHERE platform = 'website'`)).toHaveLength(1);
});

test('Recurring-Engine holt verpasste Perioden nach (3 Monate zurück: 3 Posten)', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  seedClient(tauri);

  // next_due so wählen, dass exakt 3 Monatsperioden fällig sind
  // (die vierte liegt 5 Tage in der Zukunft)
  const anchor = new Date();
  anchor.setDate(anchor.getDate() + 5);
  anchor.setMonth(anchor.getMonth() - 3);
  const serviceId = seedService(tauri, {
    label: 'Wartungsvertrag',
    costOut: 10,
    priceIn: 29,
    nextDue: toIso(anchor),
  });

  await page.reload();
  await expect(
    page.getByText('Website-Posten: 3 Ausgaben und 3 Auftrags-Entwürfe automatisch erzeugt'),
  ).toBeVisible();

  expect(tauri.select(`SELECT id FROM expenses WHERE import_ref = $1`, [serviceId])).toHaveLength(
    3,
  );
  expect(tauri.select(`SELECT id FROM orders WHERE platform = 'website'`)).toHaveLength(3);

  // Fälligkeit steht danach in der Zukunft
  const service = tauri.select(`SELECT next_due FROM website_services WHERE id = $1`, [serviceId]);
  expect(String(service[0].next_due) > toIso(new Date())).toBe(true);
});

test('"Jetzt prüfen"-Button stößt die Engine manuell an', async ({ page, tauri }) => {
  await bootApp(page);
  seedClient(tauri);
  await gotoWebsites(page, 'services');

  // Seed NACH dem App-Boot: nur der Button darf die Engine anstoßen
  seedService(tauri, {
    label: 'Adhoc-Hosting',
    costOut: 5,
    priceIn: null,
    nextDue: toIso(new Date()),
  });

  await page.getByRole('button', { name: 'Jetzt prüfen' }).click();
  await expect(page.getByText('Website-Posten: 1 Ausgabe automatisch erzeugt')).toBeVisible();
  expect(tauri.select(`SELECT id FROM expenses`)).toHaveLength(1);

  // Zweiter Klick: nichts Neues
  await page.getByRole('button', { name: 'Jetzt prüfen' }).click();
  await expect(page.getByText('Keine fälligen Posten – alles aktuell.')).toBeVisible();
  expect(tauri.select(`SELECT id FROM expenses`)).toHaveLength(1);
});

// ------------------------------------------------------------
// Zugangsdaten (Keychain)
// ------------------------------------------------------------

test.describe('Zugangsdaten', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('Secret landet im Keychain, nie in der DB; Kopieren und Löschen funktionieren', async ({
    page,
    tauri,
  }) => {
    await bootApp(page);
    seedClient(tauri);
    await gotoWebsites(page, 'clients');

    await page.getByTestId('clients-table').getByText('Malerbetrieb Weber').click();
    const panel = page.getByTestId('client-detail-panel');
    await expect(panel).toBeVisible();

    // Anlegen
    await panel.getByTestId('credentials-section').getByRole('button', { name: 'Neu' }).click();
    await page.getByLabel('Bezeichnung *').fill('WordPress-Admin');
    await page.getByLabel('Benutzername').fill('admin');
    await page.getByLabel('Secret / Passwort *').fill('super-geheim-123');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Zugangsdaten gespeichert')).toBeVisible();

    // Secret liegt im Keychain-Mock unter polygrid_credential_{id}
    const keychainKeys = Array.from(tauri.keychain.keys()).filter((key) =>
      key.startsWith('polygrid_credential_'),
    );
    expect(keychainKeys).toHaveLength(1);
    expect(tauri.keychain.get(keychainKeys[0])).toBe('super-geheim-123');

    // DB enthält nur Metadaten, niemals das Secret
    const row = tauri.select(`SELECT credentials FROM clients WHERE id = $1`, [CLIENT_ID]);
    const credentialsJson = String(row[0].credentials);
    expect(credentialsJson).toContain('WordPress-Admin');
    expect(credentialsJson).toContain('admin');
    expect(credentialsJson).not.toContain('super-geheim-123');

    // Maskiert bis zum Auge-Klick
    await expect(page.getByTestId('credential-secret')).toHaveText('••••••••');
    await panel.getByRole('button', { name: 'Secret anzeigen' }).click();
    await expect(page.getByTestId('credential-secret')).toHaveText('super-geheim-123');
    await panel.getByRole('button', { name: 'Secret verbergen' }).click();
    await expect(page.getByTestId('credential-secret')).toHaveText('••••••••');

    // Kopieren liest aus dem Keychain, ohne Anzeige
    await panel.getByRole('button', { name: 'Secret kopieren' }).click();
    await expect(page.getByText('Secret in die Zwischenablage kopiert')).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe('super-geheim-123');
    await expect(page.getByTestId('credential-secret')).toHaveText('••••••••');

    // Löschen entfernt Metadaten UND Keychain-Eintrag
    await panel.getByRole('button', { name: 'Zugangsdaten löschen' }).click();
    await page.getByRole('button', { name: 'Löschen' }).click();
    await expect(page.getByText('Zugangsdaten gelöscht')).toBeVisible();
    expect(tauri.keychain.has(keychainKeys[0])).toBe(false);

    const afterDelete = tauri.select(`SELECT credentials FROM clients WHERE id = $1`, [CLIENT_ID]);
    expect(String(afterDelete[0].credentials)).toBe('[]');
  });
});

// ------------------------------------------------------------
// Kennzahlen
// ------------------------------------------------------------

test('Kennzahlen rechnen monthly/yearly korrekt auf Monatsbasis um', async ({ page, tauri }) => {
  await bootApp(page);
  seedClient(tauri);
  seedProject(tauri, { name: 'Aktives Projekt', status: 'in_progress' });
  seedProject(tauri, { name: 'Archiviert', status: 'archived' });
  seedService(tauri, { label: 'Hosting M', costOut: 5, priceIn: 15, interval: 'monthly' });
  seedService(tauri, {
    label: 'Domain J',
    type: 'domain',
    costOut: 60,
    priceIn: 120,
    interval: 'yearly',
  });
  // Inaktiv: zählt nicht
  seedService(tauri, { label: 'Inaktiv', costOut: 99, priceIn: 99, active: false });

  await gotoWebsites(page);
  const kpis = page.getByTestId('website-kpis');
  // Aktive Projekte: 1 (Archiviert zählt nicht)
  await expect(kpis).toContainText('Aktive Projekte');
  await expect(kpis.getByText('1', { exact: true })).toBeVisible();
  // Einnahmen: 15 + 120/12 = 25 · Kosten: 5 + 60/12 = 10 · Saldo: 15
  await expect(kpis).toContainText('25,00 €');
  await expect(kpis).toContainText('10,00 €');
  await expect(kpis).toContainText('15,00 €');
});

// ------------------------------------------------------------
// Smart Actions
// ------------------------------------------------------------

test('domain_expiring: feuert bei ablaufender Domain, Klick öffnet gefilterte Posten', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedClient(tauri);
  seedService(tauri, {
    label: 'malerweber.de',
    type: 'domain',
    costOut: 12,
    priceIn: null,
    interval: 'yearly',
    nextDue: isoDaysFromNow(300),
    expiresAt: isoDaysFromNow(10),
  });
  // Nicht ablaufende Domain: bleibt nach Filter unsichtbar
  seedService(tauri, {
    label: 'langlebig.de',
    type: 'domain',
    costOut: 12,
    priceIn: null,
    interval: 'yearly',
    nextDue: isoDaysFromNow(300),
    expiresAt: isoDaysFromNow(200),
  });
  await page.reload();

  const card = page.getByTestId('smart-action-domain_expiring');
  await expect(card).toBeVisible();
  await expect(card).toContainText('1 Domain läuft innerhalb von 30 Tagen ab');

  await card.locator('button[title="Zur Ansicht springen"]').click();
  await expect(page).toHaveURL(/\/websites\?.*filter=expiring/);
  await expect(page.getByTestId('services-table').getByText('malerweber.de')).toBeVisible();
  await expect(page.getByTestId('services-table').getByText('langlebig.de')).toHaveCount(0);
});

test('domain_expiring: danger unter 7 Tagen', async ({ page, tauri }) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedClient(tauri);
  seedService(tauri, {
    label: 'dringend.de',
    type: 'domain',
    costOut: 12,
    priceIn: null,
    interval: 'yearly',
    nextDue: isoDaysFromNow(300),
    expiresAt: isoDaysFromNow(3),
  });
  await page.reload();

  const card = page.getByTestId('smart-action-domain_expiring');
  await expect(card).toBeVisible();
  // danger-Karten tragen die Danger-Rahmenklasse
  await expect(card).toHaveClass(/border-danger/);
});

test('website_order_unpaid: feuert nach 14 Tagen, Klick öffnet Kanban mit Website-Filter', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  const receipt = seedWebsiteOrder(tauri, {
    salePrice: 300,
    orderDate: isoDaysFromNow(-20),
  });
  await page.reload();

  const card = page.getByTestId('smart-action-website_order_unpaid');
  await expect(card).toBeVisible();
  await expect(card).toContainText('1 Website-Auftrag ist seit über 14 Tagen unbezahlt');

  await card.locator('button[title="Zur Ansicht springen"]').click();
  await expect(page).toHaveURL(/\/orders\?.*platform=website/);
  await expect(page).toHaveURL(/view=kanban/);

  const column = page.locator('section', { has: page.getByRole('heading', { name: 'Bestellt' }) });
  await expect(column.getByText(receipt)).toBeVisible();
});

test('project_deadline: feuert bei naher Deadline, Klick öffnet gefilterte Projekte', async ({
  page,
  tauri,
}) => {
  await bootApp(page);
  silenceBackupRule(tauri);
  seedClient(tauri);
  seedProject(tauri, {
    name: 'Eiliges Projekt',
    status: 'in_progress',
    deadline: isoDaysFromNow(3),
  });
  seedProject(tauri, {
    name: 'Entspanntes Projekt',
    status: 'in_progress',
    deadline: isoDaysFromNow(60),
  });
  await page.reload();

  const card = page.getByTestId('smart-action-project_deadline');
  await expect(card).toBeVisible();
  await expect(card).toContainText('1 Website-Projekt hat eine Deadline innerhalb von 7 Tagen');

  await card.locator('button[title="Zur Ansicht springen"]').click();
  await expect(page).toHaveURL(/\/websites\?.*filter=deadline/);
  await expect(page.getByTestId('projects-table').getByText('Eiliges Projekt')).toBeVisible();
  await expect(page.getByTestId('projects-table').getByText('Entspanntes Projekt')).toHaveCount(0);
});
