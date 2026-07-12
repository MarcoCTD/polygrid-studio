/**
 * E2E: Trennung von Auftragsstatus und Zahlungsstatus (Modul 08).
 * Deckt die Akzeptanzkriterien der Spec MODUL_08_STATUS_TRENNUNG ab:
 * Enum-Umbenennung, payment_status sichtbar/editierbar + Disambiguierung,
 * entkoppelte Felder, Rechnungs-Sperre, Widerspruchs-Warnung, Smart-Action.
 */
import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';
import type { Page } from '@playwright/test';

let receiptCounter = 0;

async function bootOrders(page: Page): Promise<void> {
  await page.goto('/orders');
  await page.getByRole('button', { name: 'Neuer Auftrag' }).waitFor();
}

function seedOrder(
  tauri: TauriMock,
  options: { status?: string; paymentStatus?: string; receipt?: string } = {},
): string {
  const id = crypto.randomUUID();
  receiptCounter += 1;
  const receipt = options.receipt ?? `2026-${String(9000 + receiptCounter)}`;
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO orders (id, receipt_number, platform, quantity, sale_price, status, payment_status, order_date, tax_locked, created_at, updated_at)
     VALUES ($1, $2, 'direkt', 1, 55, $3, $4, '2026-07-01', 0, $5, $5)`,
    [id, receipt, options.status ?? 'confirmed', options.paymentStatus ?? 'pending', now],
  );
  return receipt;
}

function seedPaidInvoice(tauri: TauriMock, orderReceipt: string): void {
  const now = new Date().toISOString();
  const clientId = crypto.randomUUID();
  tauri.execute(
    `INSERT INTO clients (id, name, created_at, updated_at) VALUES ($1, 'ACME GmbH', $2, $2)`,
    [clientId, now],
  );
  const orderRow = tauri.select('SELECT id FROM orders WHERE receipt_number = $1', [orderReceipt]);
  tauri.execute(
    `INSERT INTO documents (id, type, status, client_id, order_id, line_items, total, layout, created_at, updated_at)
     VALUES ($1, 'invoice', 'paid', $2, $3, '[]', 55, 'polygrid', $4, $4)`,
    [crypto.randomUUID(), clientId, orderRow[0].id as string, now],
  );
}

test('Status-Enum: Inline-Dropdown zeigt "Angenommen", kein "Bezahlt"', async ({ page, tauri }) => {
  await bootOrders(page);
  const receipt = seedOrder(tauri, { status: 'confirmed' });
  await page.reload();
  await page.getByText(receipt).first().waitFor();

  await page.getByRole('button', { name: `Status von ${receipt} ändern` }).click();
  await expect(page.getByTestId('inline-status-option-confirmed')).toHaveText('Angenommen');
  // Es gibt keinen Status "paid"/"Bezahlt" mehr im Ablauf-Status.
  await expect(page.getByTestId('inline-status-option-paid')).toHaveCount(0);
  await expect(page.getByRole('menu').getByText('Bezahlt', { exact: true })).toHaveCount(0);
});

test('Zahlung inline änderbar + Disambiguierung (Icon + "Zahlung:"-Präfix)', async ({
  page,
  tauri,
}) => {
  await bootOrders(page);
  const receipt = seedOrder(tauri, { status: 'confirmed', paymentStatus: 'pending' });
  await page.reload();
  await page.getByText(receipt).first().waitFor();

  // Disambiguierung: Präfix sichtbar
  await expect(page.getByText('Zahlung: Offen')).toBeVisible();

  await page.getByRole('button', { name: `Zahlung von ${receipt} ändern` }).click();
  await page.getByTestId('inline-status-option-paid').click();

  await expect
    .poll(
      () =>
        tauri.select('SELECT payment_status, payment_received_date, status FROM orders')[0]
          ?.payment_status,
      { timeout: 5000 },
    )
    .toBe('paid');
  const row = tauri.select('SELECT status, payment_received_date FROM orders')[0];
  // Zahlungsdatum folgt dem payment_status, Ablauf-Status bleibt unberührt.
  expect(row.payment_received_date).toBeTruthy();
  expect(row.status).toBe('confirmed');
  await expect(page.getByText('Zahlung: Bezahlt')).toBeVisible();
});

test('Entkopplung: Statuswechsel ändert den Zahlungsstatus nicht', async ({ page, tauri }) => {
  await bootOrders(page);
  const receipt = seedOrder(tauri, { status: 'confirmed', paymentStatus: 'pending' });
  await page.reload();
  await page.getByText(receipt).first().waitFor();

  await page.getByRole('button', { name: `Status von ${receipt} ändern` }).click();
  await page.getByTestId('inline-status-option-shipped').click();

  await expect
    .poll(() => tauri.select('SELECT status FROM orders')[0]?.status, { timeout: 5000 })
    .toBe('shipped');
  const row = tauri.select('SELECT payment_status, payment_received_date FROM orders')[0];
  expect(row.payment_status).toBe('pending');
  expect(row.payment_received_date).toBeNull();
});

test('Rechnungs-Sperre: Zahlung bei bezahlter verknüpfter Rechnung nicht editierbar', async ({
  page,
  tauri,
}) => {
  await bootOrders(page);
  const receipt = seedOrder(tauri, { status: 'confirmed', paymentStatus: 'pending' });
  seedPaidInvoice(tauri, receipt);
  await page.reload();
  await page.getByText(receipt).first().waitFor();

  // Zahlungs-Dropdown gesperrt, Ablauf-Status weiterhin editierbar.
  await expect(page.getByRole('button', { name: `Zahlung von ${receipt} ändern` })).toBeDisabled();
  await expect(page.getByRole('button', { name: `Status von ${receipt} ändern` })).toBeEnabled();
});

test('Widerspruch: Detail-Panel warnt und Korrektur-Button setzt auf bezahlt', async ({
  page,
  tauri,
}) => {
  await bootOrders(page);
  const receipt = seedOrder(tauri, { status: 'confirmed', paymentStatus: 'pending' });
  seedPaidInvoice(tauri, receipt);
  await page.reload();
  await page.getByText(receipt).first().click();

  await expect(page.getByText('Widerspruch zur verknüpften Rechnung')).toBeVisible();
  await page.getByRole('button', { name: 'Auf bezahlt setzen' }).click();

  await expect
    .poll(() => tauri.select('SELECT payment_status FROM orders')[0]?.payment_status, {
      timeout: 5000,
    })
    .toBe('paid');
  await expect(page.getByText('Widerspruch zur verknüpften Rechnung')).toBeHidden();
});

test('Smart-Action order_invoice_mismatch erscheint als danger-Karte', async ({ page, tauri }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
  // backup_stale stumm schalten, damit nur die Mismatch-Karte relevant ist
  tauri.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('last_backup_at', $1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $1, updated_at = $2`,
    [JSON.stringify(new Date().toISOString()), new Date().toISOString()],
  );
  const receipt = seedOrder(tauri, { status: 'confirmed', paymentStatus: 'pending' });
  seedPaidInvoice(tauri, receipt);
  await page.reload();

  const card = page.getByTestId('smart-action-order_invoice_mismatch');
  await expect(card).toBeVisible();
  await expect(card).toContainText('bezahlte Rechnung');
});
