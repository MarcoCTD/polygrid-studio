/**
 * E2E: Inline-Statuswechsel in Tabellen-/Listenansichten (Fix-Session Auftrag 3).
 *
 * Der Wechsel MUSS über denselben zentralen Service-Pfad laufen wie bisher:
 * - Aufträge:  updateOrder feuert die Playbook-Engine (Modul 13)
 * - Produkte:  Lizenz-Warnung beim Wechsel auf online mit risky/unclear Lizenz
 * - Aufgaben:  Wiederkehr-Logik bei done (Nachfolger-Task, Modul 09)
 * Dokumente (Angebote/Rechnungen) haben bewusst KEINEN Inline-Wechsel.
 */
import { test, expect, type TauriMock } from './support/tauriMock';
import type { Page } from '@playwright/test';

let seedCounter = 0;

function uuid(): string {
  return crypto.randomUUID();
}

function nowISO(): string {
  return new Date().toISOString();
}

/** Navigiert und wartet, bis die App initialisiert ist (Migrationen gelaufen). */
async function gotoAndWaitReady(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
}

function seedOrder(
  tauri: TauriMock,
  overrides: Partial<Record<string, unknown>> = {},
): { id: string; receipt_number: string } {
  const id = uuid();
  seedCounter += 1;
  const receipt = `2026-${String(9500 + seedCounter)}`;
  const row: Record<string, unknown> = {
    id,
    receipt_number: receipt,
    external_order_id: null,
    customer_name: 'Anna Beispiel',
    platform: 'etsy',
    product_id: null,
    variant: null,
    quantity: 1,
    sale_price: 19.99,
    shipping_revenue: null,
    shipping_cost: null,
    material_cost: null,
    platform_fee: null,
    payout_amount: null,
    status: 'ordered',
    payment_status: 'pending',
    payment_received_date: null,
    shipping_status: 'not_shipped',
    tracking_number: null,
    order_date: '2026-07-01',
    notes: null,
    tax_locked: 0,
    bank_match_id: null,
    created_at: nowISO(),
    updated_at: nowISO(),
    deleted_at: null,
    ...overrides,
  };
  const columns = Object.keys(row);
  tauri.execute(
    `INSERT INTO orders (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    columns.map((column) => row[column]),
  );
  return { id, receipt_number: receipt };
}

function seedPlaybook(
  tauri: TauriMock,
  options: { name: string; trigger_status: string; actions: Record<string, unknown>[] },
): void {
  tauri.execute(
    `INSERT INTO playbooks (id, name, enabled, trigger_status, platform_filter, actions, created_at, updated_at)
     VALUES ($1, $2, 1, $3, NULL, $4, $5, $6)`,
    [uuid(), options.name, options.trigger_status, JSON.stringify(options.actions), nowISO(), nowISO()],
  );
}

function seedProduct(
  tauri: TauriMock,
  options: { name: string; status?: string; license_risk?: string | null },
): string {
  const id = uuid();
  tauri.execute(
    `INSERT INTO products (id, name, category, status, material_type, license_risk, license_type, license_source, created_at, updated_at)
     VALUES ($1, $2, 'Deko', $3, 'PLA', $4, 'unclear', 'Thingiverse', $5, $6)`,
    [id, options.name, options.status ?? 'idea', options.license_risk ?? null, nowISO(), nowISO()],
  );
  return id;
}

function seedRecurringTask(
  tauri: TauriMock,
  options: { title: string; due_date: string },
): string {
  const id = uuid();
  tauri.execute(
    `INSERT INTO tasks (id, title, priority, status, due_date, recurring_rule, created_at, updated_at)
     VALUES ($1, $2, 'medium', 'todo', $3, $4, $5, $6)`,
    [id, options.title, options.due_date, JSON.stringify({ interval: 'weekly' }), nowISO(), nowISO()],
  );
  return id;
}

function seedClient(tauri: TauriMock, name: string): string {
  const id = uuid();
  tauri.execute(
    `INSERT INTO clients (id, name, address, credentials, created_at, updated_at)
     VALUES ($1, $2, 'Wandweg 3', '[]', $3, $4)`,
    [id, name, nowISO(), nowISO()],
  );
  return id;
}

function seedWebsiteProject(tauri: TauriMock, clientId: string, name: string): string {
  const id = uuid();
  tauri.execute(
    `INSERT INTO website_projects (id, client_id, name, status, price, credentials, created_at, updated_at)
     VALUES ($1, $2, $3, 'review', 800, '[]', $4, $5)`,
    [id, clientId, name, nowISO(), nowISO()],
  );
  return id;
}

function seedListing(tauri: TauriMock, productId: string, title: string): string {
  const id = uuid();
  tauri.execute(
    `INSERT INTO listings (
       id, product_id, master_title, master_tags, base_price, inventory_mode,
       language, status, created_at, updated_at
     ) VALUES ($1, $2, $3, '[]', 24.99, 'made_to_order', 'de', 'draft', $4, $5)`,
    [id, productId, title, nowISO(), nowISO()],
  );
  return id;
}

// ------------------------------------------------------------
// Aufträge: Inline-Wechsel feuert die Playbook-Engine
// ------------------------------------------------------------

test('Aufträge: Inline-Statuswechsel in der Tabelle feuert die Playbook-Engine', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/orders');
  const order = seedOrder(tauri);
  seedPlaybook(tauri, {
    name: 'Produktionsaufgabe',
    trigger_status: 'in_production',
    actions: [
      {
        type: 'create_task',
        title_template: 'Druckauftrag für {{kundenname}}',
        priority: 'high',
        due_offset_days: 1,
        link_order: true,
      },
    ],
  });
  await page.reload();

  const trigger = page.getByRole('button', { name: `Status von ${order.receipt_number} ändern` });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Produktion' }).click();

  // Badge aktualisiert ohne Reload, Toast bestätigt
  await expect(page.getByText('Status geändert: Produktion')).toBeVisible();
  await expect(trigger).toContainText('Produktion');

  // Zentraler Pfad: Status persistiert UND Playbook hat die Aufgabe angelegt
  await expect
    .poll(() => tauri.select('SELECT status FROM orders WHERE id = $1', [order.id])[0]?.status)
    .toBe('in_production');
  await expect.poll(() => tauri.select('SELECT id FROM tasks').length).toBe(1);
  const tasks = tauri.select('SELECT title, order_id, priority FROM tasks');
  expect(tasks[0].title).toBe('Druckauftrag für Anna Beispiel');
  expect(tasks[0].order_id).toBe(order.id);
  expect(tasks[0].priority).toBe('high');
});

// ------------------------------------------------------------
// Produkte: Lizenz-Warnung greift auch beim Inline-Wechsel
// ------------------------------------------------------------

test('Produkte: Inline-Wechsel auf online zeigt die Lizenz-Warnung bei risky Lizenz', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/products');
  seedProduct(tauri, { name: 'Lizenz-Testprodukt', license_risk: 'risky' });
  await page.reload();

  const trigger = page.getByRole('button', { name: 'Status von Lizenz-Testprodukt ändern' });
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Online' }).click();

  // Dialog erscheint auch beim Inline-Wechsel; Abbrechen ändert nichts
  await expect(page.getByText('Lizenz-Risiko prüfen')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByText('Lizenz-Risiko prüfen')).toBeHidden();
  expect(tauri.select('SELECT status FROM products')[0].status).toBe('idea');

  // Bestätigen stellt über denselben Service-Pfad online
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Online' }).click();
  await page.getByRole('button', { name: 'Trotzdem online stellen' }).click();
  await expect(page.getByText('Status geändert: Online')).toBeVisible();
  await expect
    .poll(() => tauri.select('SELECT status FROM products')[0]?.status)
    .toBe('online');
  await expect(trigger).toContainText('Online');
});

test('Produkte: Inline-Wechsel auf online ohne Risiko läuft ohne Dialog durch', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/products');
  seedProduct(tauri, { name: 'Sicheres Produkt', license_risk: 'safe' });
  await page.reload();

  await page.getByRole('button', { name: 'Status von Sicheres Produkt ändern' }).click();
  await page.getByRole('menuitem', { name: 'Online' }).click();

  await expect(page.getByText('Status geändert: Online')).toBeVisible();
  await expect(page.getByText('Lizenz-Risiko prüfen')).toHaveCount(0);
  await expect
    .poll(() => tauri.select('SELECT status FROM products')[0]?.status)
    .toBe('online');
});

// ------------------------------------------------------------
// Aufgaben: Wiederkehr-Logik bei done über den Inline-Weg
// ------------------------------------------------------------

test('Aufgaben: Inline-Wechsel auf done stößt die Wiederkehr-Logik an', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/tasks');
  const taskId = seedRecurringTask(tauri, { title: 'Wocheninventur', due_date: '2026-07-13' });
  await page.reload();
  await page.getByRole('button', { name: 'Liste' }).click();

  await page.getByRole('button', { name: 'Status von Wocheninventur ändern' }).click();
  await page.getByRole('menuitem', { name: 'Erledigt' }).click();
  await expect(page.getByText('Status geändert: Erledigt')).toBeVisible();

  // Original done + completed_at, Nachfolger eine Woche später mit parent_task_id
  await expect.poll(() => tauri.select('SELECT id FROM tasks').length).toBe(2);
  const original = tauri.select('SELECT status, completed_at FROM tasks WHERE id = $1', [taskId])[0];
  expect(original.status).toBe('done');
  expect(original.completed_at).not.toBeNull();

  const successor = tauri.select(
    'SELECT status, due_date, recurring_rule FROM tasks WHERE parent_task_id = $1',
    [taskId],
  );
  expect(successor).toHaveLength(1);
  expect(successor[0].status).toBe('todo');
  expect(successor[0].due_date).toBe('2026-07-20');
  expect(String(successor[0].recurring_rule)).toContain('weekly');
});

// ------------------------------------------------------------
// Website-Projekte und Listings: Inline-Wechsel speichert sofort
// ------------------------------------------------------------

test('Website-Projekte: Inline-Statuswechsel speichert sofort und aktualisiert den Badge', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/websites?tab=projects');
  const clientId = seedClient(tauri, 'Malerbetrieb Weber');
  const projectId = seedWebsiteProject(tauri, clientId, 'Relaunch Weber');
  await page.reload();

  const trigger = page.getByRole('button', { name: 'Status von Relaunch Weber ändern' });
  await expect(trigger).toContainText('Abnahme');
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Live' }).click();

  await expect(page.getByText('Status geändert: Live')).toBeVisible();
  await expect(trigger).toContainText('Live');
  await expect
    .poll(
      () =>
        tauri.select('SELECT status FROM website_projects WHERE id = $1', [projectId])[0]?.status,
    )
    .toBe('live');
});

test('Listings: Inline-Statuswechsel speichert sofort über den zentralen Status-Pfad', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/listings');
  const productId = seedProduct(tauri, { name: 'Vase Spiral', status: 'online' });
  const listingId = seedListing(tauri, productId, 'Spiralvase Minimal');
  await page.reload();

  const trigger = page.getByRole('button', { name: 'Status von Spiralvase Minimal ändern' });
  await expect(trigger).toContainText('Entwurf');
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Online' }).click();

  await expect(page.getByText('Status geändert: Online')).toBeVisible();
  await expect(trigger).toContainText('Online');
  await expect
    .poll(() => tauri.select('SELECT status FROM listings WHERE id = $1', [listingId])[0]?.status)
    .toBe('online');
});

// ------------------------------------------------------------
// Dokumente: bewusst KEIN Inline-Statuswechsel
// ------------------------------------------------------------

test('Dokumente: Status-Badge bleibt nicht klickbar (kontrollierte Aktionen)', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/websites?tab=documents');
  const clientId = seedClient(tauri, 'Malerbetrieb Weber');
  tauri.execute(
    `INSERT INTO documents (
       id, type, number, status, client_id, line_items, total, layout, created_at, updated_at
     ) VALUES ($1, 'invoice', NULL, 'draft', $2, '[]', 0, 'modern', $3, $4)`,
    [uuid(), clientId, nowISO(), nowISO()],
  );
  await page.reload();

  await expect(page.getByTestId('document-status-badge').first()).toBeVisible();
  await expect(
    page.getByTestId('documents-tab').getByTestId('inline-status-trigger'),
  ).toHaveCount(0);
});
