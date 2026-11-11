import { existsSync } from 'node:fs';
import { join } from 'node:path';
import preact from '@preact/preset-vite';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { APP_NAME } from './src/config/app';
import { THEMES } from './src/config/economy';

const platform = (process.env.PLATFORM ?? 'local') as 'yandex' | 'rustore' | 'local';
if (!['yandex', 'rustore', 'local'].includes(platform)) {
  throw new Error(`Неизвестная площадка PLATFORM=${platform}. Допустимо: yandex, rustore, local`);
}

// Настройки сборки RuStore берутся из .env (см. .env.example) или из переменных окружения.
const env = { ...loadEnv('production', __dirname, ''), ...process.env };
const rustoreConfig = {
  interstitialId: env.YANDEX_ADS_INTERSTITIAL_ID || 'demo-interstitial-yandex',
  rewardedId: env.YANDEX_ADS_REWARDED_ID || 'demo-rewarded-yandex',
  payments: env.PAYMENTS_ENABLED === 'true',
};

/** Растровые фоны тем: если файл лежит в public/assets/themes/<тема>/, он заменяет CSS-фон. */
function themeBackgrounds(): Record<string, { portrait: boolean; landscape: boolean }> {
  const result: Record<string, { portrait: boolean; landscape: boolean }> = {};
  for (const theme of THEMES) {
    const dir = join(__dirname, 'public', 'assets', 'themes', theme);
    result[theme] = {
      portrait: existsSync(join(dir, 'bg-portrait.webp')),
      landscape: existsSync(join(dir, 'bg-landscape.webp')),
    };
  }
  return result;
}

/** Подставляет название игры и (только для Яндекс Игр) подключает SDK строго по документации. */
function htmlPlugin(): Plugin {
  return {
    name: 'slova-html',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        let result = html.replace(/%APP_NAME%/g, APP_NAME);
        if (platform === 'yandex') {
          result = result.replace(
            '</title>',
            '</title>\n    <!-- Yandex Games SDK -->\n    <script src="/sdk.js"></script>',
          );
        }
        return result;
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), htmlPlugin()],
  define: {
    __PLATFORM__: JSON.stringify(platform),
    __THEME_BACKGROUNDS__: JSON.stringify(themeBackgrounds()),
    __RUSTORE_CONFIG__: JSON.stringify(rustoreConfig),
  },
  build: {
    outDir: `dist/${platform}`,
    emptyOutDir: true,
    target: ['es2019', 'chrome70', 'safari12'],
    cssTarget: ['chrome70', 'safari12'],
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 400,
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
