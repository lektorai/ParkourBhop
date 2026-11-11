/** Правила показа полноэкранной рекламы (раздел 7 ТЗ). */
export const ADS = {
  /** Полноэкранная реклама не показывается, пока игрок не прошёл столько уровней. */
  interstitialMinLevel: 3,
  /** Не чаще одного показа на столько пройденных уровней. */
  interstitialEveryLevels: 2,
  /** Не чаще одного показа за столько секунд. */
  interstitialMinIntervalSec: 90,
} as const;

/**
 * Идентификаторы рекламных блоков Yandex Mobile Ads для сборки RuStore.
 * Боевые значения задаются в .env (см. .env.example); без них используются демо-блоки Яндекса.
 */
export const RUSTORE_AD_UNITS = {
  interstitial: (import.meta.env?.VITE_YANDEX_ADS_INTERSTITIAL_ID as string | undefined) || 'demo-interstitial-yandex',
  rewarded: (import.meta.env?.VITE_YANDEX_ADS_REWARDED_ID as string | undefined) || 'demo-rewarded-yandex',
} as const;

/** Покупки в сборке RuStore включаются флагом (нужен статус ИП или юрлица). */
export const RUSTORE_PAYMENTS_ENABLED = import.meta.env?.VITE_PAYMENTS_ENABLED === 'true';
