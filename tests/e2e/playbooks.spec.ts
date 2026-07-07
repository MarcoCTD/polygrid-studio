import { test, expect } from './support/tauriMock';

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
