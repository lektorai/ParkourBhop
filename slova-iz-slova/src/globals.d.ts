/** Площадка сборки: подставляется Vite из переменной окружения PLATFORM. */
declare const __PLATFORM__: 'yandex' | 'rustore' | 'local';

/** Какие растровые фоны тем лежат в public/assets/themes (определяется при сборке). */
declare const __THEME_BACKGROUNDS__: Record<string, { portrait: boolean; landscape: boolean }>;

/** Настройки сборки RuStore из .env: рекламные блоки Yandex Mobile Ads и флаг покупок. */
declare const __RUSTORE_CONFIG__: { interstitialId: string; rewardedId: string; payments: boolean };
