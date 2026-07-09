/**
 * E2E-Tests fuer die KI-Modelllisten (Auftrag: Gemini-Modelle aktualisieren).
 *
 * - Modell-Dropdowns zeigen die aktuellen Modelle (Stand Juli 2026)
 * - Abgeschaltete Modelle tauchen nicht mehr als Auswahl auf
 * - Gespeicherte Settings mit abgeschalteten Modellen werden beim Lesen
 *   auf den neuen Default migriert (statt spaeter mit 404 zu scheitern)
 */
import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';
import type { Page } from '@playwright/test';

function settingValue(tauri: TauriMock, key: string): unknown {
  const rows = tauri.select('SELECT value FROM app_settings WHERE key = $1', [key]);
  if (rows.length === 0) return undefined;
  return JSON.parse(String(rows[0].value));
}

function seedSetting(tauri: TauriMock, key: string, value: unknown) {
  tauri.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, JSON.stringify(value), new Date().toISOString()],
  );
}

/** Laedt erst eine andere Route, damit die DB-Migrationen gelaufen sind. */
async function gotoAiTabWithSeed(
  page: Page,
  tauri: TauriMock,
  seeds: Record<string, unknown>,
) {
  await page.goto('/settings/general');
  await expect(page.getByText('Grundeinstellungen')).toBeVisible();
  for (const [key, value] of Object.entries(seeds)) {
    seedSetting(tauri, key, value);
  }
  await page.getByRole('button', { name: 'KI-Konfiguration' }).click();
  await expect(page.getByText('KI-Provider')).toBeVisible();
}

test('KI-Modelle: Gemini-Dropdown zeigt aktuelle Modelle, keine abgeschalteten', async ({
  page,
}) => {
  await page.goto('/settings/ai');
  await expect(page.getByText('KI-Provider')).toBeVisible();

  await page.getByRole('button', { name: 'Gemini (Google AI Studio)' }).nth(1).click();
  await page.getByText('Gemini 3.5 Flash — empfohlen').click();

  await expect(page.getByRole('option', { name: 'Gemini 3.5 Flash — empfohlen' })).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'Gemini 3.1 Pro — stärkstes Reasoning' }),
  ).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'Gemini 3.1 Flash Lite — günstig, z.B. Klassifikation' }),
  ).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'Gemini 2.5 Flash — stabil, weiterhin verfügbar' }),
  ).toBeVisible();

  // Abgeschaltete Modelle (1.x, 2.0) duerfen nicht mehr angeboten werden
  await expect(page.getByRole('option', { name: /Gemini 2\.0|Gemini 1\.5/ })).toHaveCount(0);
});

test('KI-Modelle: Claude-Dropdown zeigt aktuelle Modelle mit Labels', async ({ page }) => {
  await page.goto('/settings/ai');
  await expect(page.getByText('KI-Provider')).toBeVisible();

  // Claude-Panel ist standardmaessig geoeffnet; Trigger zeigt Label statt Rohwert
  await page.getByText('Claude Sonnet 5 — empfohlen').click();

  await expect(page.getByRole('option', { name: 'Claude Sonnet 5 — empfohlen' })).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'Claude Opus 4.8 — leistungsstärkstes Modell' }),
  ).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'Claude Haiku 4.5 — schnell & günstig' }),
  ).toBeVisible();
  await expect(page.getByRole('option', { name: /claude-sonnet-4-20250514/ })).toHaveCount(0);
});

test('KI-Modelle: OpenAI-Dropdown zeigt aktuelle Modelle', async ({ page }) => {
  await page.goto('/settings/ai');
  await expect(page.getByText('KI-Provider')).toBeVisible();

  await page.getByRole('button', { name: 'OpenAI' }).nth(1).click();
  await page.getByText('GPT-5.4 — empfohlen').click();

  await expect(page.getByRole('option', { name: 'GPT-5.4 — empfohlen' })).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'GPT-5.5 — leistungsstärkstes Modell' }),
  ).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'GPT-5.4 Mini — schnell & günstig' }),
  ).toBeVisible();
  await expect(
    page.getByRole('option', { name: 'GPT-4o — Legacy, weiterhin verfügbar' }),
  ).toBeVisible();
});

test('KI-Modelle: abgeschaltetes Gemini-Modell wird beim Lesen migriert', async ({
  page,
  tauri,
}) => {
  await gotoAiTabWithSeed(page, tauri, { ai_preferred_model_gemini: 'gemini-2.0-flash' });

  await page.getByRole('button', { name: 'Gemini (Google AI Studio)' }).nth(1).click();
  await expect(page.getByText('Gemini 3.5 Flash — empfohlen')).toBeVisible();

  await expect.poll(() => settingValue(tauri, 'ai_preferred_model_gemini')).toBe(
    'gemini-3.5-flash',
  );
});

test('KI-Modelle: abgeschaltetes Claude-Modell wird beim Lesen migriert', async ({
  page,
  tauri,
}) => {
  await gotoAiTabWithSeed(page, tauri, {
    ai_preferred_model_claude: 'claude-sonnet-4-20250514',
  });

  await expect(page.getByText('Claude Sonnet 5 — empfohlen')).toBeVisible();
  await expect.poll(() => settingValue(tauri, 'ai_preferred_model_claude')).toBe(
    'claude-sonnet-5',
  );
});

test('KI-Modelle: unbekanntes, selbst eingetragenes Modell bleibt erhalten', async ({
  page,
  tauri,
}) => {
  await gotoAiTabWithSeed(page, tauri, { ai_preferred_model_gemini: 'gemini-4.0-experimental' });

  await page.getByRole('button', { name: 'Gemini (Google AI Studio)' }).nth(1).click();
  // Kein bekanntes abgeschaltetes Modell -> keine Zwangsmigration
  await expect(page.getByText('gemini-4.0-experimental')).toBeVisible();
  await expect.poll(() => settingValue(tauri, 'ai_preferred_model_gemini')).toBe(
    'gemini-4.0-experimental',
  );
});

test('KI-Modelle: Modellauswahl wird persistiert und nach Reload angezeigt', async ({
  page,
  tauri,
}) => {
  await page.goto('/settings/ai');
  await expect(page.getByText('KI-Provider')).toBeVisible();

  await page.getByRole('button', { name: 'Gemini (Google AI Studio)' }).nth(1).click();
  await page.getByText('Gemini 3.5 Flash — empfohlen').click();
  await page.getByRole('option', { name: 'Gemini 3.1 Pro — stärkstes Reasoning' }).click();

  // Gespeichert wird die API-wahre Preview-ID ("gemini-3.1-pro" liefert 404)
  await expect
    .poll(() => settingValue(tauri, 'ai_preferred_model_gemini'))
    .toBe('gemini-3.1-pro-preview');

  await page.reload();
  await page.getByRole('button', { name: 'Gemini (Google AI Studio)' }).nth(1).click();
  await expect(page.getByText('Gemini 3.1 Pro — stärkstes Reasoning')).toBeVisible();
});
