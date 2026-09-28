import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const port = process.env.PORT || '4174';
process.env.DB_PATH ||= resolve(`.data/test-${randomUUID()}.sqlite`);

export default defineConfig({
  testDir: './tests',
  outputDir: process.env.QA_OUTPUT_DIR || 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 20_000,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'artifacts/test-results.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node app/server.mjs',
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    env: { PORT: port, DB_PATH: process.env.DB_PATH, APP_BUG: process.env.APP_BUG || '' },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 1000 },
  },
});
