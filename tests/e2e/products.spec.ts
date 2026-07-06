import { test, expect } from './support/tauriMock';

test('Produkt-Schnellerfassung: alle Eingaben aus dem 4-Step-Modal werden gespeichert', async ({
  page,
  tauri,
}) => {
  await page.goto('/products');
  await page.getByRole('button', { name: 'Neues Produkt' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Neues Produkt')).toBeVisible();

  // Step 1: Basics
  await dialog.getByPlaceholder('Produktname').fill('Test-Vase Spiral');
  await dialog.getByPlaceholder('z.B. Deko, Organizer').fill('Deko');
  await dialog.getByPlaceholder('Optional').fill('Vasen');
  await dialog.getByPlaceholder('z.B. Minimal, Industrial').fill('Minimal');
  await dialog.getByRole('button', { name: 'Weiter' }).click();

  // Step 2: Kosten
  await dialog.getByPlaceholder('z.B. 120').fill('90');
  await dialog.getByPlaceholder('z.B. 50').fill('42');
  await dialog.getByPlaceholder('z.B. 0.50').fill('0.80');
  await dialog.getByPlaceholder('z.B. 14.99').fill('19.99');
  await dialog.getByPlaceholder('z.B. 9.99').fill('12.5');
  await dialog.getByRole('button', { name: 'Weiter' }).click();

  // Step 3: Lizenz
  await dialog.getByPlaceholder('z.B. Thingiverse, Printables, Eigen').fill('Eigenes Design');
  await dialog.getByPlaceholder('https://...').fill('https://example.com/lizenz');
  await dialog.getByRole('button', { name: 'Weiter' }).click();

  // Step 4: Übersicht muss die eingegebenen Werte anzeigen
  await expect(dialog.getByText('Test-Vase Spiral')).toBeVisible();
  await expect(dialog.getByText('Deko', { exact: true })).toBeVisible();
  await expect(dialog.getByText('90 Min.')).toBeVisible();
  await expect(dialog.getByText('42 g')).toBeVisible();

  await dialog.getByRole('button', { name: 'Erstellen' }).click();
  await expect(dialog).toBeHidden();

  // In der DB muss das Produkt mit ALLEN Werten stehen
  const rows = tauri.select('SELECT * FROM products WHERE deleted_at IS NULL');
  expect(rows).toHaveLength(1);
  const product = rows[0];
  expect(product.name).toBe('Test-Vase Spiral');
  expect(product.category).toBe('Deko');
  expect(product.subcategory).toBe('Vasen');
  expect(product.collection).toBe('Minimal');
  expect(product.print_time_minutes).toBe(90);
  expect(product.material_grams).toBe(42);
  expect(product.packaging_cost).toBe(0.8);
  expect(product.target_price).toBe(19.99);
  expect(product.min_price).toBe(12.5);
  expect(product.license_source).toBe('Eigenes Design');
  expect(product.license_url).toBe('https://example.com/lizenz');
});
