import { test, expect } from './support/tauriMock';
import type { TauriMock } from './support/tauriMock';

/**
 * Auto-Import beim Datei-Verknuepfen: Dateien ausserhalb des
 * OneDrive-Basisordners werden beim Verknuepfen in die Basis kopiert
 * (nie verschoben), der file_link zeigt auf die Kopie. Dateien innerhalb
 * der Basis werden wie bisher nur referenziert.
 */

const BASE_PATH = '/mock/onedrive';
const SEED_PRODUCT_ID = '3f0a1b2c-4d5e-4f60-8a9b-0c1d2e3f4a5b';

function seedBasePath(tauri: TauriMock): void {
  tauri.execute(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    ['onedrive_base_path', JSON.stringify(BASE_PATH), new Date().toISOString()],
  );
}

function seedProduct(tauri: TauriMock, id = SEED_PRODUCT_ID, name = 'Spiral-Vase'): void {
  const now = new Date().toISOString();
  tauri.execute(
    `INSERT INTO products (id, name, category, status, material_type, target_price, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, name, 'Deko', 'online', 'PLA', 19.99, now, now],
  );
}

async function openLinkDialogWithFile(
  page: import('@playwright/test').Page,
  tauri: TauriMock,
  filePath: string,
) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Produkte' })).toBeVisible();
  seedBasePath(tauri);
  seedProduct(tauri);

  await page.goto(`/products/${SEED_PRODUCT_ID}`);
  await page.getByRole('tab', { name: 'Dateien' }).click();

  tauri.nextDialogResult = filePath;
  await page.getByRole('button', { name: 'Datei verknüpfen' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Datei verknüpfen')).toBeVisible();
  return dialog;
}

async function chooseFileType(
  dialog: ReturnType<import('@playwright/test').Page['getByRole']>,
  page: import('@playwright/test').Page,
  label: string,
) {
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: label }).click();
}

test('Import aus externem Pfad: Hinweis mit Zielordner, Kopie, file_link auf Kopie', async ({
  page,
  tauri,
}) => {
  const dialog = await openLinkDialogWithFile(page, tauri, '/mock/downloads/foto.png');

  // Standard-Dateityp "Sonstiges" -> Produktordner-Root als Ziel
  await expect(dialog.getByText('außerhalb deines OneDrive-Ordners')).toBeVisible();
  await expect(dialog.getByText('02_Produkte/spiral-vase', { exact: true })).toBeVisible();

  // Dateityp Produktbild -> Zielordner wechselt auf Bilder-Unterordner
  await chooseFileType(dialog, page, 'Produktbild');
  await expect(dialog.getByText('02_Produkte/spiral-vase/Bilder', { exact: true })).toBeVisible();

  // Verknuepfen-Button ist AKTIV (keine Sperre mehr)
  const saveButton = dialog.getByRole('button', { name: 'Verknüpfen', exact: true });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(dialog).toBeHidden();

  // file_link zeigt auf die Kopie innerhalb der Basis
  const links = tauri.select('SELECT * FROM file_links');
  expect(links).toHaveLength(1);
  expect(links[0].file_path).toBe('02_Produkte/spiral-vase/Bilder/foto.png');
  expect(links[0].file_type).toBe('image');
  expect(links[0].entity_id).toBe(SEED_PRODUCT_ID);

  // Kopie lief ueber den Import-Command, Original als Quelle
  expect(tauri.importedFiles).toEqual([
    { source: '/mock/downloads/foto.png', targetPath: '02_Produkte/spiral-vase/Bilder/foto.png' },
  ]);

  // Operations-Log enthaelt den Import
  const ops = tauri.select(
    "SELECT * FROM file_operations WHERE operation_type = 'import' AND status = 'success'",
  );
  expect(ops).toHaveLength(1);
  expect(ops[0].source_path).toBe('/mock/downloads/foto.png');
  expect(ops[0].target_path).toBe('02_Produkte/spiral-vase/Bilder/foto.png');
});

test('Namenskonflikt am Ziel: Kopie bekommt Suffix -1, nichts wird überschrieben', async ({
  page,
  tauri,
}) => {
  tauri.existingImportTargets.add('02_Produkte/spiral-vase/Bilder/foto.png');

  const dialog = await openLinkDialogWithFile(page, tauri, '/mock/downloads/foto.png');
  await chooseFileType(dialog, page, 'Produktbild');
  await dialog.getByRole('button', { name: 'Verknüpfen', exact: true }).click();
  await expect(dialog).toBeHidden();

  const links = tauri.select('SELECT file_path FROM file_links');
  expect(links).toHaveLength(1);
  expect(links[0].file_path).toBe('02_Produkte/spiral-vase/Bilder/foto-1.png');
});

test('Kopierfehler: klare Meldung, KEIN file_link, Fehler im Operations-Log', async ({
  page,
  tauri,
}) => {
  tauri.nextImportError = 'Keine Berechtigung zum Lesen der Quelldatei.';

  const dialog = await openLinkDialogWithFile(page, tauri, '/mock/downloads/foto.png');
  await chooseFileType(dialog, page, 'Produktbild');
  await dialog.getByRole('button', { name: 'Verknüpfen', exact: true }).click();

  // Fehlermeldung sichtbar (Toast + Inline), Dialog bleibt offen
  await expect(page.getByText(/Keine Berechtigung zum Lesen/).first()).toBeVisible();
  await expect(dialog).toBeVisible();

  // KEIN Verweis auf eine nicht existierende Kopie
  expect(tauri.select('SELECT * FROM file_links')).toHaveLength(0);
  expect(tauri.importedFiles).toHaveLength(0);

  // Fehlversuch ist im Operations-Log dokumentiert
  const failedOps = tauri.select(
    "SELECT * FROM file_operations WHERE operation_type = 'import' AND status = 'failed'",
  );
  expect(failedOps).toHaveLength(1);
});

test('Bestandsweg unverändert: Datei in OneDrive wird nur referenziert, keine Kopie', async ({
  page,
  tauri,
}) => {
  const dialog = await openLinkDialogWithFile(
    page,
    tauri,
    `${BASE_PATH}/02_Produkte/spiral-vase/STL/vase.stl`,
  );

  // Kein Import-Hinweis fuer Dateien innerhalb der Basis
  await expect(dialog.getByText('außerhalb deines OneDrive-Ordners')).toBeHidden();

  await chooseFileType(dialog, page, 'STL-Datei');
  await dialog.getByRole('button', { name: 'Verknüpfen', exact: true }).click();
  await expect(dialog).toBeHidden();

  const links = tauri.select('SELECT file_path, file_type FROM file_links');
  expect(links).toHaveLength(1);
  expect(links[0].file_path).toBe('02_Produkte/spiral-vase/STL/vase.stl');
  expect(links[0].file_type).toBe('stl');

  // Kein Import-Command, kein Import-Log
  expect(tauri.importedFiles).toHaveLength(0);
  expect(tauri.invokeLog.filter((entry) => entry.cmd === 'import_file_to_base')).toHaveLength(0);
  expect(
    tauri.select("SELECT * FROM file_operations WHERE operation_type = 'import'"),
  ).toHaveLength(0);
});

test('Beleg-Import: externer Beleg wird nach Bestätigung nach Belege_{Jahr} kopiert', async ({
  page,
  tauri,
}) => {
  await page.goto('/expenses');
  await expect(page.getByRole('button', { name: 'Hinzufügen' })).toBeVisible();
  seedBasePath(tauri);

  // Ausgabe ueber die Schnellerfassung anlegen (Datum = heute)
  await page.getByLabel('Betrag brutto').fill('12.34');
  await page.getByLabel('Händler').fill('Bauhaus');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText('Ausgabe hinzugefügt')).toBeVisible();

  // Detailpanel oeffnen, Beleg-Tab
  await page.getByText('Bauhaus').first().click();
  await page.getByRole('tab', { name: 'Beleg' }).click();

  tauri.nextDialogResult = '/mock/downloads/rechnung.pdf';
  await page.getByRole('button', { name: 'Beleg verknüpfen' }).click();

  // Bestaetigungsdialog zeigt den Zielordner mit Jahr aus dem Ausgabendatum
  const year = new Date().getFullYear();
  const confirmDialog = page.getByRole('alertdialog');
  await expect(confirmDialog.getByText('Beleg in OneDrive kopieren')).toBeVisible();
  await expect(confirmDialog.getByText(`01_Finanzen/Belege_${year}`)).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Kopieren und verknüpfen' }).click();

  await expect(page.getByText('Beleg kopiert und verknüpft')).toBeVisible();

  // receipt_file_path zeigt auf die Kopie in der Basis
  await expect
    .poll(() => tauri.select('SELECT receipt_file_path FROM expenses')[0]?.receipt_file_path)
    .toBe(`${BASE_PATH}/01_Finanzen/Belege_${year}/rechnung.pdf`);
  expect(tauri.importedFiles).toEqual([
    {
      source: '/mock/downloads/rechnung.pdf',
      targetPath: `01_Finanzen/Belege_${year}/rechnung.pdf`,
    },
  ]);
});

test('Beleg-Bestandsweg: Beleg innerhalb OneDrive wird ohne Kopie verknüpft', async ({
  page,
  tauri,
}) => {
  await page.goto('/expenses');
  await expect(page.getByRole('button', { name: 'Hinzufügen' })).toBeVisible();
  seedBasePath(tauri);

  await page.getByLabel('Betrag brutto').fill('9.99');
  await page.getByLabel('Händler').fill('Obi');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText('Ausgabe hinzugefügt')).toBeVisible();

  await page.getByText('Obi').first().click();
  await page.getByRole('tab', { name: 'Beleg' }).click();

  const insidePath = `${BASE_PATH}/01_Finanzen/Belege_2026/kassenbon.pdf`;
  tauri.nextDialogResult = insidePath;
  await page.getByRole('button', { name: 'Beleg verknüpfen' }).click();

  // Kein Bestaetigungsdialog, direkt verknuepft
  await expect(page.getByText('Beleg verknüpft', { exact: true })).toBeVisible();
  await expect(page.getByRole('alertdialog')).toBeHidden();

  await expect
    .poll(() => tauri.select('SELECT receipt_file_path FROM expenses')[0]?.receipt_file_path)
    .toBe(insidePath);
  expect(tauri.importedFiles).toHaveLength(0);
});
