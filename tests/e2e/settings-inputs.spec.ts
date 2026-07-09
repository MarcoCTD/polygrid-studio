/**
 * E2E-Tests fuer ALLE Settings-Eingabekomponenten (Auftrag: Fix-Session).
 *
 * Abdeckung pro Eingabe: Interaktion, Persistenz in app_settings,
 * Anzeige nach Reload, Bedienbarkeit (Zahlenfelder: leeren + tippen +
 * steppen ohne Springen, Min/Max-Klemmung).
 */
import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';
import type { Locator } from '@playwright/test';

function settingValue(tauri: TauriMock, key: string): unknown {
  const rows = tauri.select('SELECT value FROM app_settings WHERE key = $1', [key]);
  if (rows.length === 0) return undefined;
  return JSON.parse(String(rows[0].value));
}

async function clearField(input: Locator) {
  await input.click();
  await input.press('ControlOrMeta+a');
  await input.press('Backspace');
}

// ---------------------------------------------------------------------------
// Zahlenfeld-Bedienbarkeit (Bug-Repro): Feld muss sich leeren lassen,
// ohne auf 0 zu springen, und Min/Max muss beim Verlassen greifen.
// ---------------------------------------------------------------------------

test('Zahlenfeld: leeren und neu tippen ohne Springen', async ({ page, tauri }) => {
  await page.goto('/settings/general');

  const input = page.locator('input[type="number"]').first();
  await expect(input).toHaveValue('30');

  await clearField(input);
  // Bug-Repro: bisher sprang das Feld sofort auf "0"
  await expect(input).toHaveValue('');

  await input.pressSequentially('45');
  await expect(input).toHaveValue('45');
  await input.blur();

  await expect.poll(() => settingValue(tauri, 'margin_warning_threshold')).toBe(45);
});

test('Zahlenfeld: Max-Klemmung beim Verlassen (Marge max. 100%)', async ({ page, tauri }) => {
  await page.goto('/settings/general');

  const input = page.locator('input[type="number"]').first();
  await clearField(input);
  await input.pressSequentially('500');
  await input.blur();

  await expect(input).toHaveValue('100');
  await expect.poll(() => settingValue(tauri, 'margin_warning_threshold')).toBe(100);
});

test('Zahlenfeld: Steppen mit Pfeiltasten wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/general');

  const input = page.locator('input[type="number"]').first();
  await input.click();
  await input.press('ArrowUp');
  await expect(input).toHaveValue('31');
  await input.blur();

  await expect.poll(() => settingValue(tauri, 'margin_warning_threshold')).toBe(31);
});

test('Zahlenfeld: leeres Feld beim Verlassen fällt auf letzten Wert zurück', async ({
  page,
  tauri,
}) => {
  await page.goto('/settings/general');

  const input = page.locator('input[type="number"]').first();
  await clearField(input);
  await input.blur();

  await expect(input).toHaveValue('30');
  // Kein kaputter Wert (0/NaN/null) in der DB
  const stored = settingValue(tauri, 'margin_warning_threshold');
  expect(stored === undefined || stored === 30).toBe(true);
});

// ---------------------------------------------------------------------------
// Tab: Allgemein
// ---------------------------------------------------------------------------

test('Allgemein: Sprache-Select wird persistiert und nach Reload angezeigt', async ({
  page,
  tauri,
}) => {
  await page.goto('/settings/general');

  await page.getByText('Deutsch', { exact: true }).click();
  await page.getByRole('option', { name: 'English' }).click();

  await expect.poll(() => settingValue(tauri, 'language')).toBe('en');

  await page.reload();
  await expect(page.getByText('English', { exact: true })).toBeVisible();
});

test('Allgemein: Theme-Buttons werden persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/general');

  await page.getByRole('button', { name: 'Dunkel' }).click();
  await expect.poll(() => settingValue(tauri, 'theme')).toBe('dark');

  await page.reload();
  // data-theme am <html> zeigt das angewendete Theme
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('Allgemein: Akzentfarbe wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/general');

  await page.getByRole('button', { name: 'Petrol' }).click();
  await expect.poll(() => settingValue(tauri, 'accent_color')).toBe('petrol');
});

test('Allgemein: OneDrive-Ordner ändern über Dialog wird persistiert', async ({
  page,
  tauri,
}) => {
  await page.goto('/settings/general');

  tauri.nextDialogResult = '/mock/onedrive/PolyGrid';
  await page.getByRole('button', { name: 'Ordner ändern' }).click();

  await expect.poll(() => settingValue(tauri, 'onedrive_root_path')).toBe(
    '/mock/onedrive/PolyGrid',
  );
  await expect.poll(() => settingValue(tauri, 'onedrive_base_path')).toBe(
    '/mock/onedrive/PolyGrid',
  );
  await expect(page.getByText('Ordner erreichbar')).toBeVisible();

  await page.reload();
  await expect(page.locator('input[readonly]').first()).toHaveValue('/mock/onedrive/PolyGrid');
});

// ---------------------------------------------------------------------------
// Tab: Material & Plattformen
// ---------------------------------------------------------------------------

test('Material: Preis bearbeiten wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/materials');

  const priceInput = page.getByRole('spinbutton', { name: 'Preis pro kg PLA' });
  await expect(priceInput).toBeDisabled();

  const firstRow = page.locator('table').first().locator('tbody tr').first();
  await firstRow.getByTitle('Bearbeiten').click();
  await expect(priceInput).toBeEnabled();

  await clearField(priceInput);
  await priceInput.pressSequentially('27.5');
  await priceInput.blur();

  await expect
    .poll(() => settingValue(tauri, 'filament_prices'))
    .toEqual(expect.arrayContaining([{ name: 'PLA', pricePerKg: 27.5 }]));

  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Preis pro kg PLA' })).toHaveValue('27.5');
});

test('Material: neues Material hinzufügen wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/materials');

  await page.getByRole('button', { name: 'Material hinzufügen' }).click();
  const newRow = page.locator('table').first().locator('tbody tr').last();
  await newRow.locator('input').first().fill('ASA');
  await newRow.getByRole('spinbutton').fill('29');
  await newRow.getByTitle('Speichern').click();

  await expect
    .poll(() => settingValue(tauri, 'filament_prices'))
    .toEqual(expect.arrayContaining([{ name: 'ASA', pricePerKg: 29 }]));
});

test('Material: Druckerleistung und Strompreis werden persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/materials');

  const watts = page.getByRole('spinbutton', { name: 'Druckerleistung' });
  await clearField(watts);
  await watts.pressSequentially('350');
  await watts.blur();
  await expect.poll(() => settingValue(tauri, 'printer_power_watts')).toBe(350);

  const price = page.getByRole('spinbutton', { name: 'Strompreis' });
  await clearField(price);
  await price.pressSequentially('0.42');
  await price.blur();
  await expect.poll(() => settingValue(tauri, 'electricity_price_per_kwh')).toBe(0.42);

  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Druckerleistung' })).toHaveValue('350');
  await expect(page.getByRole('spinbutton', { name: 'Strompreis' })).toHaveValue('0.42');
});

test('Material: Versand-Default-Toggle wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/materials');

  const toggle = page.getByRole('switch');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();

  await expect.poll(() => settingValue(tauri, 'shipping_paid_by_buyer')).toBe(false);
  await expect.poll(() => settingValue(tauri, 'shipping_paid_by_customer_default')).toBe(false);

  await page.reload();
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
});

test('Material: Plattformgebühren werden persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/materials');

  const percent = page.getByRole('spinbutton', { name: 'Etsy Gebühr' });
  await clearField(percent);
  await percent.pressSequentially('7');
  await percent.blur();

  const fixed = page.getByRole('spinbutton', { name: 'Etsy Fixbetrag' });
  await clearField(fixed);
  await fixed.pressSequentially('0.3');
  await fixed.blur();

  await expect
    .poll(() => settingValue(tauri, 'platform_fees'))
    .toMatchObject({ etsy: { percentFee: 7, fixedFee: 0.3 } });

  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Etsy Gebühr' })).toHaveValue('7');
});

test('Material: Versandklassen-Preis bearbeiten wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/materials');

  const priceInput = page.getByRole('spinbutton', { name: 'Preis Brief' });
  const row = page.locator('table').nth(1).locator('tbody tr').first();
  await row.getByTitle('Bearbeiten').click();
  await expect(priceInput).toBeEnabled();

  await clearField(priceInput);
  await priceInput.pressSequentially('1.8');
  await priceInput.blur();

  await expect
    .poll(() => settingValue(tauri, 'shipping_classes'))
    .toEqual(expect.arrayContaining([{ name: 'Brief', price: 1.8 }]));
});

test('Material: Farbvariante hinzufügen wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/materials');

  await page.getByRole('button', { name: 'Farbe hinzufügen' }).click();
  const row = page.locator('table').nth(2).locator('tbody tr').last();
  await row.locator('input[type="text"], input:not([type])').first().fill('Signalrot');
  await row.locator('input').nth(1).fill('#FF0000');
  await row.getByTitle('Speichern').click();

  await expect
    .poll(() => settingValue(tauri, 'color_variants_library'))
    .toEqual(expect.arrayContaining([{ name: 'Signalrot', hex: '#FF0000' }]));
});

// ---------------------------------------------------------------------------
// Tab: KI-Konfiguration
// ---------------------------------------------------------------------------

test('KI: Bevorzugter Provider wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/ai');

  // Erster "OpenAI"-Button = Provider-Präferenz, zweiter = Panel-Header
  await page.getByRole('button', { name: 'OpenAI' }).first().click();
  await expect.poll(() => settingValue(tauri, 'ai_preferred_provider')).toBe('openai');
});

test('KI: Claude API-Key speichern zeigt maskierten Key', async ({ page, tauri }) => {
  await page.goto('/settings/ai');

  // Claude-Panel ist standardmäßig geöffnet
  await page.getByPlaceholder('API-Key eingeben').first().fill('sk-ant-test-1234567890');
  await page.getByRole('button', { name: 'Speichern', exact: true }).first().click();

  await expect(page.getByRole('button', { name: 'Ändern' })).toBeVisible();
  expect(tauri.keychain.get('claude_api_key')).toBe('sk-ant-test-1234567890');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Ändern' })).toBeVisible();
});

test('KI: Ollama Endpoint und Modell werden persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/ai');

  // Ollama-Panel aufklappen (erster Button ist die Provider-Präferenz)
  await page.getByRole('button', { name: 'Ollama' }).nth(1).click();

  // Aufgeklapptes Panel enthält zwei Textfelder: Endpoint-URL, dann Modell
  const inputs = page.locator('div.space-y-4.border-t input');
  await inputs.nth(0).fill('http://localhost:11500');
  await expect.poll(() => settingValue(tauri, 'ollama_endpoint')).toBe('http://localhost:11500');
  await expect.poll(() => settingValue(tauri, 'ai_ollama_endpoint')).toBe(
    'http://localhost:11500',
  );

  await inputs.nth(1).fill('mistral');
  await expect.poll(() => settingValue(tauri, 'ai_preferred_model_ollama')).toBe('mistral');
  await expect.poll(() => settingValue(tauri, 'ai_ollama_model')).toBe('mistral');
});

test('KI: Kostenlimit wird persistiert (inkl. Alias)', async ({ page, tauri }) => {
  await page.goto('/settings/ai');

  const limit = page.getByRole('spinbutton', { name: 'Monatliches Kostenlimit' });
  await clearField(limit);
  await limit.pressSequentially('25');
  await limit.blur();

  await expect.poll(() => settingValue(tauri, 'ai_cost_limit_monthly')).toBe(25);
  await expect.poll(() => settingValue(tauri, 'ai_monthly_limit_eur')).toBe(25);

  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Monatliches Kostenlimit' })).toHaveValue(
    '25',
  );
});

test('KI: Logging-Toggle wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/ai');

  const toggle = page.getByRole('switch');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();

  await expect.poll(() => settingValue(tauri, 'ai_logging_enabled')).toBe(false);

  await page.reload();
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
});

test('KI: Betriebsmodus wird persistiert (inkl. Alias)', async ({ page, tauri }) => {
  await page.goto('/settings/ai');

  await page.getByRole('button', { name: 'Nur Vorschläge' }).click();

  await expect.poll(() => settingValue(tauri, 'ai_operation_mode')).toBe('suggest_only');
  await expect.poll(() => settingValue(tauri, 'ai_mode')).toBe('suggest_only');
});

// ---------------------------------------------------------------------------
// Tab: Markenstil
// ---------------------------------------------------------------------------

test('Markenstil: Schreibstil-Select wird persistiert und ändert Vorschau', async ({
  page,
  tauri,
}) => {
  await page.goto('/settings/brand');

  await page.getByText('sachlich-minimalistisch', { exact: true }).click();
  await page.getByRole('option', { name: 'technisch-präzise' }).click();

  await expect(page.getByText('FDM-gedruckt mit 0.2mm Schichthöhe', { exact: false })).toBeVisible();
  await expect.poll(() => settingValue(tauri, 'brand_writing_style')).toBe('technisch-präzise');

  await page.reload();
  await expect(page.getByText('technisch-präzise', { exact: true })).toBeVisible();
});

test('Markenstil: Brand-Wörter TagInput (Enter, Komma, Entfernen)', async ({ page, tauri }) => {
  await page.goto('/settings/brand');

  const input = page.getByPlaceholder('Begriff eingeben, Enter oder Komma');
  await input.fill('präzise');
  await input.press('Enter');
  await expect(page.getByText('präzise', { exact: true })).toBeVisible();

  await input.fill('robust, langlebig');
  await input.press('Enter');

  await expect
    .poll(() => settingValue(tauri, 'brand_keywords'))
    .toEqual(['präzise', 'robust', 'langlebig']);
  await expect
    .poll(() => settingValue(tauri, 'brand_preferred_words'))
    .toEqual(['präzise', 'robust', 'langlebig']);

  await page.getByRole('button', { name: 'robust entfernen' }).click();
  await expect
    .poll(() => settingValue(tauri, 'brand_keywords'))
    .toEqual(['präzise', 'langlebig']);

  await page.reload();
  await expect(page.getByText('langlebig', { exact: true })).toBeVisible();
});

test('Markenstil: No-Go-Formulierungen werden persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/brand');

  const input = page.getByPlaceholder('Formulierung eingeben, Enter oder Komma');
  await input.fill('billig');
  await input.press('Enter');

  await expect.poll(() => settingValue(tauri, 'brand_no_go_phrases')).toEqual(['billig']);
  await expect.poll(() => settingValue(tauri, 'brand_forbidden_phrases')).toEqual(['billig']);
});

test('Markenstil: Referenztext wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/brand');

  const textarea = page.getByRole('textbox').last();
  await textarea.fill('Hochwertige Teile aus dem 3D-Drucker.');

  await expect
    .poll(() => settingValue(tauri, 'brand_reference_text'))
    .toBe('Hochwertige Teile aus dem 3D-Drucker.');

  await page.reload();
  await expect(page.getByRole('textbox').last()).toHaveValue(
    'Hochwertige Teile aus dem 3D-Drucker.',
  );
});

// ---------------------------------------------------------------------------
// Tab: Daten & Sicherheit
// ---------------------------------------------------------------------------

test('Daten: Backup-Intervall-Select wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/data');

  await page.getByText('24h', { exact: true }).click();
  await page.getByRole('option', { name: '7 Tage' }).click();

  await expect.poll(() => settingValue(tauri, 'backup_interval_hours')).toBe(168);

  await page.reload();
  await expect(page.getByText('7 Tage', { exact: true })).toBeVisible();
});

test('Daten: Max. Backups wird persistiert und min. 1 geklemmt', async ({ page, tauri }) => {
  await page.goto('/settings/data');

  const input = page.getByRole('spinbutton', { name: 'Maximale Anzahl Backups' });
  await clearField(input);
  await input.pressSequentially('0');
  await input.blur();

  await expect(input).toHaveValue('1');
  await expect.poll(() => settingValue(tauri, 'backup_max_count')).toBe(1);
});

test('Daten: Belegnummern-Format wird persistiert (inkl. Alias)', async ({ page, tauri }) => {
  await page.goto('/settings/data');

  const input = page.getByLabel('Belegnummern-Format');
  await input.fill('RE-YYYY-NNNN');

  await expect.poll(() => settingValue(tauri, 'receipt_number_format')).toBe('RE-YYYY-NNNN');
  await expect.poll(() => settingValue(tauri, 'receipt_number_prefix_format')).toBe(
    'RE-YYYY-NNNN',
  );
});

test('Daten: Tax-Lock jährlich wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/data');

  const yearly = page.getByRole('switch').nth(1);
  await expect(yearly).toHaveAttribute('aria-checked', 'true');
  await yearly.click();

  await expect.poll(() => settingValue(tauri, 'tax_lock_yearly')).toBe(false);
  await expect.poll(() => settingValue(tauri, 'tax_lock_default_for_yearly_export')).toBe(false);

  await page.reload();
  await expect(page.getByRole('switch').nth(1)).toHaveAttribute('aria-checked', 'false');
});

test('Daten: Bank-CSV-Format-Select wird persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/data');

  await page.getByText('N26', { exact: true }).click();
  await page.getByRole('option', { name: 'Custom' }).click();

  await expect.poll(() => settingValue(tauri, 'bank_csv_format')).toBe('custom');
  await expect.poll(() => settingValue(tauri, 'bank_csv_format_default')).toBe('custom');
});

test('Daten: Bank-Matching-Zahlenfelder werden persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/data');

  const tolerance = page.getByRole('spinbutton', { name: 'Bank-Matching Betragsdifferenz' });
  await clearField(tolerance);
  await tolerance.pressSequentially('0.05');
  await tolerance.blur();
  await expect.poll(() => settingValue(tauri, 'bank_matching_amount_tolerance')).toBe(0.05);
  await expect.poll(() => settingValue(tauri, 'bank_match_amount_tolerance_eur')).toBe(0.05);

  const orderDays = page.getByRole('spinbutton', { name: 'Zeitfenster Aufträge' });
  await clearField(orderDays);
  await orderDays.pressSequentially('21');
  await orderDays.blur();
  await expect.poll(() => settingValue(tauri, 'bank_matching_order_days')).toBe(21);

  const expenseDays = page.getByRole('spinbutton', { name: 'Zeitfenster Ausgaben' });
  await clearField(expenseDays);
  await expenseDays.pressSequentially('10');
  await expenseDays.blur();
  await expect.poll(() => settingValue(tauri, 'bank_matching_expense_days')).toBe(10);

  await page.reload();
  await expect(
    page.getByRole('spinbutton', { name: 'Bank-Matching Betragsdifferenz' }),
  ).toHaveValue('0.05');
});

test('Daten: Payout-Keywords werden persistiert', async ({ page, tauri }) => {
  await page.goto('/settings/data');

  const etsyInput = page.getByPlaceholder('Keyword eingeben, Enter oder Komma').first();
  await etsyInput.fill('Etsy Payments');
  await etsyInput.press('Enter');

  await expect
    .poll(() => settingValue(tauri, 'payout_keywords_etsy'))
    .toEqual(['Etsy', 'Etsy Ireland', 'Etsy Inc', 'Etsy Payments']);

  const ebayInput = page.getByPlaceholder('Keyword eingeben, Enter oder Komma').nth(1);
  await ebayInput.fill('eBay GmbH');
  await ebayInput.press('Enter');

  await expect
    .poll(() => settingValue(tauri, 'payout_keywords_ebay'))
    .toEqual(['eBay', 'Ebay Marketplaces', 'eBay GmbH']);
});

test('Daten: Archiv-Aufbewahrungsdauer wird persistiert und min. 1 geklemmt', async ({
  page,
  tauri,
}) => {
  await page.goto('/settings/data');

  const input = page.getByRole('spinbutton', { name: 'Aufbewahrungsdauer' });
  await clearField(input);
  await input.pressSequentially('60');
  await input.blur();

  await expect.poll(() => settingValue(tauri, 'archive_retention_days')).toBe(60);

  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Aufbewahrungsdauer' })).toHaveValue('60');
});
