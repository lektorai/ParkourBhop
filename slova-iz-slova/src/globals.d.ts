/** Площадка сборки: подставляется Vite из переменной окружения PLATFORM. */
declare const __PLATFORM__: 'yandex' | 'rustore' | 'local';

/** Какие растровые фоны тем лежат в public/assets/themes (определяется при сборке). */
declare const __THEME_BACKGROUNDS__: Record<string, { portrait: boolean; landscape: boolean }>;
