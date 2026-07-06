import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';

function seedExpense(tauri: TauriMock): void {
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO expenses (id, date, amount_gross, vendor, category, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    ['exp-test-1', '2026-07-01', 29.99, 'Filament-Shop', 'filament', now, now],
  );
}

test('Detail-Panel schließt beim Modulwechsel', async ({ page, tauri }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();

  seedExpense(tauri);

  // Zu Ausgaben navigieren und Detail-Panel über die Tabellenzeile öffnen
  await page.getByRole('button', { name: 'Ausgaben' }).click();
  await page.getByText('Filament-Shop').first().click();
  const panel = page.getByText('Details', { exact: true });
  await expect(panel).toBeVisible();

  // Modulwechsel: Panel darf nicht stehen bleiben
  await page.getByRole('button', { name: 'Aufträge' }).click();
  await expect(panel).toBeHidden();
});
