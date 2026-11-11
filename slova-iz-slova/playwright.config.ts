import { defineConfig } from '@playwright/test';

/** E2E-тесты идут на сборке с адаптером local (имитация рекламы и покупок). */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    locale: 'ru-RU',
    trace: 'off',
    video: 'off',
  },
  webServer: {
    command: 'npm run build && npx vite preview --outDir dist/local --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
