import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';

function settingValue(tauri: TauriMock, key: string): unknown {
  const rows = tauri.select('SELECT value FROM app_settings WHERE key = $1', [key]);
  if (rows.length === 0) return undefined;
  return JSON.parse(String(rows[0].value));
}

test('Settings: Toggle (Auto-Snapshot) ändert sich und wird persistiert', async ({
  page,
  tauri,
}) => {
  await page.goto('/settings/general');

  const toggle = page.getByRole('switch');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Gespeichert').first()).toBeVisible();

  await expect
    .poll(() => settingValue(tauri, 'dashboard_auto_snapshot'))
    .toBe(false);

  // Nach Reload muss der Zustand erhalten bleiben
  await page.reload();
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
});

test('Settings: Textfeld (Firmenname) wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/general');

  const input = page.getByRole('textbox').first();
  await expect(input).toHaveValue('PolyGrid Studio');
  await input.fill('Mein 3D-Shop');
  await expect(page.getByText('Gespeichert').first()).toBeVisible();

  await expect.poll(() => settingValue(tauri, 'company_name')).toBe('Mein 3D-Shop');

  await page.reload();
  await expect(page.getByRole('textbox').first()).toHaveValue('Mein 3D-Shop');
});

test('Settings: Dropdown (Datumsformat) wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/general');

  await page.getByText('TT.MM.JJJJ').click();
  await page.getByRole('option', { name: 'JJJJ-MM-TT' }).click();
  await expect(page.getByText('Gespeichert').first()).toBeVisible();

  await expect.poll(() => settingValue(tauri, 'date_format')).toBe('YYYY-MM-DD');

  await page.reload();
  await expect(page.getByText('JJJJ-MM-TT')).toBeVisible();
});

test('Settings: Zahlenfeld (Marge-Schwellwert) wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/general');

  const numberInput = page.locator('input[type="number"]').first();
  await expect(numberInput).toHaveValue('30');
  await numberInput.fill('45');
  await expect(page.getByText('Gespeichert').first()).toBeVisible();

  await expect.poll(() => settingValue(tauri, 'margin_warning_threshold')).toBe(45);

  await page.reload();
  await expect(page.locator('input[type="number"]').first()).toHaveValue('45');
});

test('Settings: Toggle wird auch bei schnellem Modulwechsel gespeichert', async ({
  page,
  tauri,
}) => {
  await page.goto('/settings/general');

  const toggle = page.getByRole('switch');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();

  // Sofort wegnavigieren, bevor der Auto-Save-Debounce (500ms) feuert
  await page.getByRole('button', { name: 'Dashboard' }).click();

  await expect.poll(() => settingValue(tauri, 'dashboard_auto_snapshot')).toBe(false);
});

test('Settings: Tax-Lock-Toggles im Daten-Tab werden persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/data');

  const monthly = page.getByRole('switch').first();
  await expect(monthly).toHaveAttribute('aria-checked', 'false');
  await monthly.click();
  await expect(monthly).toHaveAttribute('aria-checked', 'true');

  await expect.poll(() => settingValue(tauri, 'tax_lock_monthly')).toBe(true);

  await page.reload();
  await expect(page.getByRole('switch').first()).toHaveAttribute('aria-checked', 'true');
});
