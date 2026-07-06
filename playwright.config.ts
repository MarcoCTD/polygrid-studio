import { defineConfig } from '@playwright/test';

/**
 * E2E-Tests laufen gegen den Vite-Dev-Server im Browser.
 * Die Tauri-API wird pro Test gemockt (siehe tests/e2e/support/tauriMock.ts),
 * SQLite laeuft dabei als sql.js In-Memory-Datenbank im Node-Prozess.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  workers: 4,
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4183',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run dev -- --port 4183 --strictPort',
    url: 'http://localhost:4183',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
