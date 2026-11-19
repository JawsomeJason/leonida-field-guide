import { defineConfig } from '@playwright/test';

const touch = { hasTouch: true, isMobile: true };
const only = (...files) => ({ testMatch: files.map((f) => `**/${f}.spec.mjs`) });

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: true,
  fullyParallel: true,
  reporter: [['list'], ['./tests/e2e/touch-report.mjs']],
  use: { baseURL: 'http://127.0.0.1:4399' },
  webServer: { command: 'node tests/e2e/serve.mjs', url: 'http://127.0.0.1:4399/', timeout: 180_000, reuseExistingServer: !process.env.CI },
  // No test is skipped at run time: each project simply owns the files that apply to it.
  projects: [
    { name: 'phone-390', use: { viewport: { width: 390, height: 844 }, ...touch }, ...only('behaviour', 'nojs', 'touch', 'a11y') },
    { name: 'tablet-820', use: { viewport: { width: 820, height: 1180 }, ...touch }, ...only('behaviour', 'nojs', 'touch') },
    { name: 'sync', ...only('sync') },
    { name: 'new-screen', use: { viewport: { width: 390, height: 844 }, ...touch }, ...only('new') },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } }, ...only('behaviour', 'nojs', 'a11y', 'overflow', 'leak') },
  ],
});
