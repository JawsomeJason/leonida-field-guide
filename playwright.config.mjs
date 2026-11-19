import { defineConfig } from '@playwright/test';

// LFG_PORT lets two worktrees run the suite at once.
const port = process.env.LFG_PORT ?? 4399;
const touch = { hasTouch: true, isMobile: true };
const only = (...files) => ({ testMatch: files.map((f) => `**/${f}.spec.mjs`) });

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: true,
  // One retry on CI only: a shared runner can stall a page now and then. A test that needed the retry is listed as flaky in the report.
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  reporter: [['list'], ['./tests/e2e/touch-report.mjs']],
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: { command: 'node tests/e2e/serve.mjs', url: `http://127.0.0.1:${port}/`, timeout: 180_000, reuseExistingServer: !process.env.CI },
  // No test is skipped at run time: each project simply owns the files that apply to it.
  projects: [
    { name: 'phone-320', use: { viewport: { width: 320, height: 640 }, ...touch }, ...only('touch', 'touch-all', 'ui2', 'hidden-gate', 'nextup', 'consoles', 'round5', 'round6b', 'round7b') },
    { name: 'phone-390', use: { viewport: { width: 390, height: 844 }, ...touch }, ...only('behaviour', 'nojs', 'touch', 'touch-all', 'a11y', 'search', 'notfound', 'design', 'ui2', 'hidden-gate', 'nextup', 'outside', 'consoles', 'pointers', 'round4', 'round5', 'round6', 'round6b', 'round7b') },
    { name: 'tablet-820', use: { viewport: { width: 820, height: 1180 }, ...touch }, ...only('behaviour', 'nojs', 'touch', 'touch-all', 'search', 'design', 'ui2', 'hidden-gate', 'nextup', 'outside', 'round4', 'round5', 'round6b') },
    { name: 'sync', ...only('sync') },
    { name: 'new-screen', use: { viewport: { width: 390, height: 844 }, ...touch }, ...only('new') },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } }, ...only('behaviour', 'nojs', 'a11y', 'overflow', 'leak', 'search', 'notfound', 'design', 'ui2', 'hidden-gate', 'nextup', 'outside', 'consoles', 'round4', 'round5', 'round6', 'round6b', 'round7b') },
  ],
});
