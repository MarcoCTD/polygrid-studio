/**
 * E2E-Tests Modul 13 (Playbooks) – deckt die Akzeptanzkriterien aus
 * Abschnitt 6 der Spec ab (docs/specs/MODUL_13_PLAYBOOKS.md).
 */
import { test, expect, type TauriMock } from './support/tauriMock';
import type { Page } from '@playwright/test';

// ------------------------------------------------------------
// Seed-Helfer: schreiben direkt in die In-Memory-SQLite des Mocks.
// Voraussetzung: page.goto() wurde bereits einmal ausgeführt, damit
// die App-Migrationen gelaufen sind.
// ------------------------------------------------------------

let seedCounter = 0;

/**
 * Navigiert und wartet, bis die App initialisiert ist (Sidebar sichtbar =
 * Migrationen gelaufen). Erst danach darf direkt in die DB geseedet werden.
 */
async function gotoAndWaitReady(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
}

function uuid(): string {
  return crypto.randomUUID();
}

function nowISO(): string {
  return new Date().toISOString();
}

function seedProduct(tauri: TauriMock, name: string): string {
  const id = uuid();
  tauri.execute(
    `INSERT INTO products (id, name, category, status, material_type, created_at, updated_at)
     VALUES ($1, $2, 'deko', 'aktiv', 'PLA', $3, $4)`,
    [id, name, nowISO(), nowISO()],
  );
  return id;
}

function seedOrder(
  tauri: TauriMock,
  overrides: Partial<Record<string, unknown>> = {},
): { id: string; receipt_number: string } {
  const id = uuid();
  seedCounter += 1;
  const receipt = `2026-${String(9000 + seedCounter)}`;
  const row: Record<string, unknown> = {
    id,
    receipt_number: receipt,
    external_order_id: null,
    customer_name: 'Max Muster',
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

function seedTemplate(tauri: TauriMock, name: string, content: string): string {
  const id = uuid();
  tauri.execute(
    `INSERT INTO templates (id, name, category, content, version, is_legal, created_at, updated_at)
     VALUES ($1, $2, 'versand', $3, 1, 0, $4, $5)`,
    [id, name, content, nowISO(), nowISO()],
  );
  return id;
}

function seedPlaybook(
  tauri: TauriMock,
  options: {
    name: string;
    trigger_status: string;
    actions: Record<string, unknown>[];
    enabled?: boolean;
    platform_filter?: string[] | null;
  },
): string {
  const id = uuid();
  tauri.execute(
    `INSERT INTO playbooks (id, name, enabled, trigger_status, platform_filter, actions, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      options.name,
      options.enabled === false ? 0 : 1,
      options.trigger_status,
      options.platform_filter && options.platform_filter.length > 0
        ? JSON.stringify(options.platform_filter)
        : null,
      JSON.stringify(options.actions),
      nowISO(),
      nowISO(),
    ],
  );
  return id;
}

const CREATE_TASK_ACTION = {
  type: 'create_task',
  title_template: '{{produktname}} für {{kundenname}} drucken',
  priority: 'high',
  due_offset_days: 1,
  link_order: true,
};

/** Öffnet den Auftrag im Detail-Panel (Tabellenansicht) und setzt den Status. */
async function setStatusInDetailPanel(page: Page, receiptNumber: string, statusLabel: string) {
  await page.goto('/orders');
  // Die Tabelle ist virtualisiert (keine row-Rollen): Zelle mit Belegnummer klicken
  await page.getByText(receiptNumber).first().click();

  const panel = page.locator('aside').filter({ hasText: 'Auftrag' });
  await expect(panel.getByRole('heading', { name: receiptNumber })).toBeVisible();

  // Übersicht-Tab: Comboboxen in fester Reihenfolge Versandstatus(0), Status(1), Payment(2)
  await panel.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: statusLabel, exact: true }).click();
  await panel.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Auftrag gespeichert').first()).toBeVisible();
}

function localISODate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ------------------------------------------------------------
// AK: Seeds vorhanden, Tab funktioniert
// ------------------------------------------------------------

test('Automatisierung: Tab öffnet, Seed-Playbooks erscheinen deaktiviert', async ({ page }) => {
  const crashes: string[] = [];
  page.on('pageerror', (err) => crashes.push(err.message));

  await page.goto('/settings/automation');

  await expect(page.getByText('Regelbasierte Automatisierung', { exact: false })).toBeVisible();
  await expect(page.getByText('Versandaufgabe bei Zahlungseingang')).toBeVisible();
  await expect(page.getByText('Versandkosten buchen bei Versand')).toBeVisible();

  const toggles = page.getByRole('switch');
  await expect(toggles).toHaveCount(2);
  await expect(toggles.first()).toHaveAttribute('aria-checked', 'false');
  await expect(toggles.last()).toHaveAttribute('aria-checked', 'false');

  await expect(page.getByText('Ausführungs-Log')).toBeVisible();
  expect(crashes).toEqual([]);
});

// ------------------------------------------------------------
// AK: Playbook mit allen drei Aktionstypen anlegen, bearbeiten,
//     deaktivieren und löschen
// ------------------------------------------------------------

test('Playbook mit allen drei Aktionstypen anlegen, bearbeiten, deaktivieren, löschen', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/settings/automation');
  seedTemplate(tauri, 'Versandbestätigung', 'Hallo {{kundenname}}');

  // Anlegen
  await page.getByRole('button', { name: 'Neues Playbook' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Komplett-Playbook');

  // Aktion 1 (create_task, Standard) ausfüllen
  await dialog.getByLabel('Aufgaben-Titel').fill('Drucken für {{kundenname}}');

  // Aktion 2: Ausgabe anlegen
  await dialog.getByRole('button', { name: 'Aktion hinzufügen' }).click();
  await page.getByRole('menuitem', { name: 'Ausgabe anlegen' }).click();
  await dialog.getByLabel('Anbieter/Händler').fill('DHL');

  // Aktion 3: Vorlage vorschlagen
  await dialog.getByRole('button', { name: 'Aktion hinzufügen' }).click();
  await page.getByRole('menuitem', { name: 'Vorlage vorschlagen' }).click();
  await dialog.getByLabel('Vorlage wählen').click();
  await page.getByRole('option', { name: 'Versandbestätigung' }).click();

  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Playbook angelegt')).toBeVisible();
  await expect(page.getByText('Komplett-Playbook')).toBeVisible();
  await expect(page.getByText('3 Aktionen')).toBeVisible();

  const saved = tauri.select("SELECT * FROM playbooks WHERE name = 'Komplett-Playbook'");
  expect(saved).toHaveLength(1);
  const actions = JSON.parse(String(saved[0].actions)) as { type: string }[];
  expect(actions.map((action) => action.type)).toEqual([
    'create_task',
    'create_expense',
    'suggest_template',
  ]);

  // Bearbeiten
  const row = page.getByTestId('playbook-list-item').filter({ hasText: 'Komplett-Playbook' });
  await row.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Komplett-Playbook v2');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Playbook aktualisiert')).toBeVisible();
  await expect(page.getByText('Komplett-Playbook v2')).toBeVisible();

  // Deaktivieren über den Toggle
  const rowV2 = page.getByTestId('playbook-list-item').filter({ hasText: 'Komplett-Playbook v2' });
  const toggle = rowV2.getByRole('switch');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect
    .poll(
      () =>
        tauri.select("SELECT enabled FROM playbooks WHERE name = 'Komplett-Playbook v2'")[0]
          ?.enabled,
    )
    .toBe(0);

  // Löschen mit Bestätigung (Soft-Delete)
  await rowV2.getByRole('button', { name: 'Playbook Komplett-Playbook v2 löschen' }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(page.getByText('Playbook „Komplett-Playbook v2“ gelöscht')).toBeVisible();
  await expect(
    page.getByTestId('playbook-list-item').filter({ hasText: 'Komplett-Playbook v2' }),
  ).toHaveCount(0);

  const deleted = tauri.select(
    "SELECT deleted_at FROM playbooks WHERE name = 'Komplett-Playbook v2'",
  );
  expect(deleted).toHaveLength(1);
  expect(deleted[0].deleted_at).not.toBeNull();
});

// ------------------------------------------------------------
// AK: Statusänderung im Kanban löst Playbooks aus +
//     create_task mit Variablen und Fälligkeitsdatum + Toast
// ------------------------------------------------------------

test('Kanban-Drag löst Playbook aus: verknüpfte Aufgabe mit Variablen und Fälligkeit', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/orders');
  const productId = seedProduct(tauri, 'Drachenfigur');
  const order = seedOrder(tauri, { product_id: productId, customer_name: 'Anna Beispiel' });
  seedPlaybook(tauri, {
    name: 'Produktionsaufgabe',
    trigger_status: 'in_production',
    actions: [CREATE_TASK_ACTION],
  });
  await page.reload();

  await page.getByRole('button', { name: 'Kanban' }).click();
  const card = page.getByText(order.receipt_number).first();
  await expect(card).toBeVisible();

  const targetColumn = page
    .locator('section', { has: page.getByRole('heading', { name: 'In Produktion' }) })
    .first();
  const cardBox = await card.boundingBox();
  const targetBox = await targetColumn.boundingBox();
  if (!cardBox || !targetBox) throw new Error('BoundingBox nicht verfügbar');

  // dnd-kit PointerSensor (activation distance 6px): manuelle Maus-Geste
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + cardBox.width / 2 + 20, cardBox.y + cardBox.height / 2, {
    steps: 5,
  });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 15,
  });
  // Das Board kann während des Drags horizontal autoscrollen (dnd-kit),
  // wodurch die Spalte unter dem Zeiger wegrutscht. Deshalb die Zielposition
  // nachführen, bis das Board stillsteht und die Zielspalte als aktives
  // Dropziel markiert ist (isOver-Highlight), erst dann loslassen.
  await expect(async () => {
    const before = await targetColumn.boundingBox();
    if (!before) throw new Error('BoundingBox nicht verfügbar');
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2, { steps: 5 });
    await page.waitForTimeout(150);
    const after = await targetColumn.boundingBox();
    if (!after || Math.abs(after.x - before.x) > 1) throw new Error('Board scrollt noch');
    await expect(targetColumn).toHaveClass(/border-pg-accent/, { timeout: 500 });
  }).toPass({ timeout: 10_000 });
  await page.mouse.up();

  // Statusänderung persistiert
  await expect
    .poll(() => tauri.select('SELECT status FROM orders WHERE id = $1', [order.id])[0]?.status, {
      timeout: 5000,
    })
    .toBe('in_production');

  // Toast (Spec 4.3)
  await expect(page.getByText(/Playbook „Produktionsaufgabe“/)).toBeVisible();

  // Aufgabe: Variablen ersetzt, verknüpft, Fälligkeit = heute + 1
  await expect
    .poll(() => tauri.select('SELECT COUNT(*) AS c FROM tasks')[0]?.c, { timeout: 5000 })
    .toBe(1);
  const task = tauri.select('SELECT * FROM tasks')[0];
  expect(task.title).toBe('Drachenfigur für Anna Beispiel drucken');
  expect(task.order_id).toBe(order.id);
  expect(task.priority).toBe('high');
  expect(task.due_date).toBe(localISODate(1));

  const runs = tauri.select('SELECT status FROM playbook_runs');
  expect(runs).toHaveLength(1);
  expect(runs[0].status).toBe('success');
});

// ------------------------------------------------------------
// AK: Statusänderung im Detail-Panel löst Playbooks aus (gleicher
//     Codepfad) + Idempotenz nach Zurück- und Wiedervorschieben
// ------------------------------------------------------------

test('Detail-Panel-Statusänderung löst Playbook aus; Idempotenz bei erneutem Erreichen', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/orders');
  const order = seedOrder(tauri, { customer_name: 'Bernd Kunde' });
  seedPlaybook(tauri, {
    name: 'Zahlungsaufgabe',
    trigger_status: 'paid',
    actions: [{ ...CREATE_TASK_ACTION, title_template: 'Verpacken für {{kundenname}}' }],
  });
  await page.reload();

  // Status im Detail-Panel auf Bezahlt setzen
  await setStatusInDetailPanel(page, order.receipt_number, 'Bezahlt');
  await expect
    .poll(() => tauri.select('SELECT COUNT(*) AS c FROM tasks')[0]?.c, { timeout: 5000 })
    .toBe(1);
  expect(tauri.select('SELECT title FROM tasks')[0]?.title).toBe('Verpacken für Bernd Kunde');

  // Zurückschieben und erneut vorschieben: kein zweiter Run, keine zweite Aufgabe
  await setStatusInDetailPanel(page, order.receipt_number, 'Bestellt');
  await setStatusInDetailPanel(page, order.receipt_number, 'Bezahlt');

  expect(tauri.select('SELECT COUNT(*) AS c FROM tasks')[0]?.c).toBe(1);
  expect(
    tauri.select("SELECT COUNT(*) AS c FROM playbook_runs WHERE status != 'dry_run'")[0]?.c,
  ).toBe(1);
});

// ------------------------------------------------------------
// AK: create_expense mit amount_source liest den Wert aus dem
//     Auftrag; leerer Wert überspringt mit Hinweis
// ------------------------------------------------------------

test('create_expense: amount_source liest Auftragswert; leerer Wert wird mit Hinweis übersprungen', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/orders');
  // Seed-Playbook "Versandkosten buchen bei Versand" (amount_source shipping_cost) aktivieren
  tauri.execute("UPDATE playbooks SET enabled = 1 WHERE trigger_status = 'shipped'");

  const withCost = seedOrder(tauri, { shipping_cost: 4.5, external_order_id: 'ETSY-77' });
  const withoutCost = seedOrder(tauri, { shipping_cost: null });
  await page.reload();

  // Auftrag MIT Versandkosten: Ausgabe wird erstellt, Wert aus dem Auftrag
  await setStatusInDetailPanel(page, withCost.receipt_number, 'Versendet');
  await expect
    .poll(() => tauri.select('SELECT COUNT(*) AS c FROM expenses')[0]?.c, { timeout: 5000 })
    .toBe(1);
  const expense = tauri.select('SELECT * FROM expenses')[0];
  expect(expense.amount_gross).toBe(4.5);
  expect(expense.vendor).toBe('Versanddienstleister');
  expect(expense.purpose).toBe('Versand Bestellung ETSY-77');
  expect(expense.order_id).toBe(withCost.id);

  // Auftrag OHNE Versandkosten: übersprungen mit Hinweis, keine Ausgabe, Run partial
  await setStatusInDetailPanel(page, withoutCost.receipt_number, 'Versendet');
  await expect
    .poll(
      () =>
        tauri.select('SELECT COUNT(*) AS c FROM playbook_runs WHERE order_id = $1', [
          withoutCost.id,
        ])[0]?.c,
      { timeout: 5000 },
    )
    .toBe(1);
  expect(tauri.select('SELECT COUNT(*) AS c FROM expenses')[0]?.c).toBe(1);

  const partialRun = tauri.select('SELECT status, results FROM playbook_runs WHERE order_id = $1', [
    withoutCost.id,
  ])[0];
  expect(partialRun.status).toBe('partial');
  expect(String(partialRun.results)).toContain('Versandkosten sind am Auftrag nicht erfasst');

  // Log-Viewer zeigt den partial-Run mit aufklappbaren Details (AK Log-Viewer)
  await page.goto('/settings/automation');
  const log = page.getByTestId('playbook-run-log');
  await expect(log.getByText('Teilweise')).toBeVisible();
  await log.getByRole('row').filter({ hasText: withoutCost.receipt_number }).first().click();
  await expect(log.getByText('übersprungen').first()).toBeVisible();
  await expect(
    log.getByText('Versandkosten sind am Auftrag nicht erfasst', { exact: false }),
  ).toBeVisible();
});

// ------------------------------------------------------------
// AK: suggest_template zeigt Banner im Auftrags-Detail-Panel,
//     Kopieren-Dialog ist vorbefüllt, Banner ist verwerfbar
// ------------------------------------------------------------

test('suggest_template: Banner im Detail-Panel, vorbefüllter Kopieren-Dialog, verwerfbar', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/orders');
  const productId = seedProduct(tauri, 'Vase Modern');
  const templateId = seedTemplate(
    tauri,
    'Versandinfo',
    'Hallo {{kundenname}}, deine Bestellung {{bestellnummer}} ({{produktname}}) ist unterwegs.',
  );
  const order = seedOrder(tauri, {
    product_id: productId,
    customer_name: 'Clara Kundin',
    external_order_id: 'ETSY-4711',
  });
  seedPlaybook(tauri, {
    name: 'Vorlagen-Vorschlag',
    trigger_status: 'paid',
    actions: [{ type: 'suggest_template', template_id: templateId }],
  });
  await page.reload();

  await setStatusInDetailPanel(page, order.receipt_number, 'Bezahlt');

  // Banner erscheint im geöffneten Detail-Panel
  const banner = page.getByTestId('template-suggestion-banner');
  await expect(banner.getByText('Vorlage „Versandinfo“ bereit')).toBeVisible();

  // Kopieren-Dialog öffnet vorbefüllt über die Registry
  await banner.getByRole('button', { name: 'Öffnen' }).click();
  const copyDialog = page.getByRole('dialog').filter({ hasText: 'Vorlage kopieren' });
  await expect(copyDialog).toBeVisible();
  await expect(copyDialog.locator('#copy-var-kundenname')).toHaveValue('Clara Kundin');
  await expect(copyDialog.locator('#copy-var-bestellnummer')).toHaveValue('ETSY-4711');
  await expect(copyDialog.locator('#copy-var-produktname')).toHaveValue('Vase Modern');
  await expect(
    copyDialog.getByText(
      'Hallo Clara Kundin, deine Bestellung ETSY-4711 (Vase Modern) ist unterwegs.',
    ),
  ).toBeVisible();
  await copyDialog.getByRole('button', { name: 'Abbrechen' }).click();

  // Banner verwerfen: verschwindet und bleibt nach Reload verschwunden
  await banner.getByRole('button', { name: 'Vorschlag Versandinfo verwerfen' }).click();
  await expect(page.getByTestId('template-suggestion-banner')).toBeHidden();

  await page.reload();
  await page.getByText(order.receipt_number).first().click();
  await expect(page.getByRole('heading', { name: order.receipt_number })).toBeVisible();
  await expect(page.getByTestId('template-suggestion-banner')).toBeHidden();
});

// ------------------------------------------------------------
// AK: Playbook-Fehler blockiert die Statusänderung nicht
// ------------------------------------------------------------

test('Playbook-Fehler blockiert die Statusänderung nicht', async ({ page, tauri }) => {
  await gotoAndWaitReady(page, '/orders');
  const order = seedOrder(tauri);
  // suggest_template auf eine nicht existierende Vorlage -> alle Aktionen schlagen fehl
  seedPlaybook(tauri, {
    name: 'Defektes Playbook',
    trigger_status: 'paid',
    actions: [{ type: 'suggest_template', template_id: uuid() }],
  });
  await page.reload();

  await setStatusInDetailPanel(page, order.receipt_number, 'Bezahlt');

  // Status ist trotz fehlgeschlagenem Playbook persistiert
  expect(tauri.select('SELECT status FROM orders WHERE id = $1', [order.id])[0]?.status).toBe(
    'paid',
  );
  // Fehler-Toast weist auf das Log hin
  await expect(page.getByText(/Playbook „Defektes Playbook“ fehlgeschlagen/)).toBeVisible();
  // Run ist als error protokolliert
  const runs = tauri.select('SELECT status FROM playbook_runs WHERE order_id = $1', [order.id]);
  expect(runs).toHaveLength(1);
  expect(runs[0].status).toBe('error');
});

// ------------------------------------------------------------
// AK: Dry-Run schreibt keine Entitäten, loggt aber
// ------------------------------------------------------------

test('Dry-Run: schreibt keine Entitäten, zeigt Vorschau und loggt mit status=dry_run', async ({
  page,
  tauri,
}) => {
  await gotoAndWaitReady(page, '/settings/automation');
  const productId = seedProduct(tauri, 'Halter');
  seedOrder(tauri, { product_id: productId, customer_name: 'Doris Test' });
  await page.reload();

  // Dry-Run des Seed-Playbooks "Versandaufgabe bei Zahlungseingang" (deaktiviert!)
  const row = page
    .getByTestId('playbook-list-item')
    .filter({ hasText: 'Versandaufgabe bei Zahlungseingang' });
  await row.getByRole('button', { name: 'Testen' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Auftrag wählen').fill('Doris');
  await dialog.getByRole('button', { name: /Doris Test/ }).click();
  await dialog.getByRole('button', { name: 'Dry-Run ausführen' }).click();

  // Ergebnis-Vorschau: was WÜRDE erstellt
  const results = page.getByTestId('dry-run-results');
  await expect(results).toBeVisible();
  await expect(results.getByText(/Halter für Doris Test drucken und verpacken/)).toBeVisible();

  // Nichts geschrieben, aber geloggt
  expect(tauri.select('SELECT COUNT(*) AS c FROM tasks')[0]?.c).toBe(0);
  expect(tauri.select('SELECT COUNT(*) AS c FROM expenses')[0]?.c).toBe(0);
  const runs = tauri.select('SELECT status FROM playbook_runs');
  expect(runs).toHaveLength(1);
  expect(runs[0].status).toBe('dry_run');

  // Log zeigt den Dry-Run-Eintrag
  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByTestId('playbook-run-log').getByText('Dry-Run')).toBeVisible();
});
