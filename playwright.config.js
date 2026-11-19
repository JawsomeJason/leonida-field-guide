import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4377' },
  webServer: { command: 'npm run build && npm run preview -- --port 4377', url: 'http://localhost:4377', reuseExistingServer: true, timeout: 180_000 },
});
