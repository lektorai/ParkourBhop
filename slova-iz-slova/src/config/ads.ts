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
 * В отладочной сборке Android демо-блоки используются всегда.
 */
export const RUSTORE_AD_UNITS = {
  interstitial: __RUSTORE_CONFIG__.interstitialId,
  rewarded: __RUSTORE_CONFIG__.rewardedId,
} as const;

/** Покупки в сборке RuStore включаются флагом PAYMENTS_ENABLED (нужен статус ИП или юрлица). */
export const RUSTORE_PAYMENTS_ENABLED = __RUSTORE_CONFIG__.payments;
