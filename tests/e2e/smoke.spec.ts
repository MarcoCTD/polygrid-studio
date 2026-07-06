import { test, expect } from './support/tauriMock';

test('App startet, Migrationen laufen, Sidebar wird angezeigt', async ({ page, tauri }) => {
  await page.goto('/');

  // Sidebar-Navigation sichtbar => DB-Init war erfolgreich
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Einstellungen' })).toBeVisible();

  // Migrationen wurden in der Mock-DB ausgefuehrt
  const migrations = tauri.select('SELECT tag FROM _migrations ORDER BY tag');
  expect(migrations.length).toBeGreaterThanOrEqual(13);

  // Default-Settings vorhanden
  const settings = tauri.select('SELECT key FROM app_settings');
  expect(settings.length).toBeGreaterThan(0);
});
