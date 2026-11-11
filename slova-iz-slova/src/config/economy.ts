/** Все числа экономики игры в одном месте (раздел 7 ТЗ). */
export const ECONOMY = {
  startCoins: 200,
  /** Награда за звёзды: первая (уровень пройден), вторая, третья. */
  starRewards: [10, 5, 5] as const,
  /** Доля найденных слов для 1, 2 и 3 звёзд. */
  starThresholds: [0.5, 0.75, 1] as const,
  bonusWordReward: 1,
  dailyRewards: [20, 30, 40, 50, 60, 80, 100] as const,
  adCoinsReward: 25,
  adCoinsPerDay: 5,
  hintCost: 50,
  themeCost: 1500,
  /** Множитель награды за уровень при просмотре рекламы. */
  winAdMultiplier: 2,
  /** Сколько монет даёт каждая расходуемая покупка. */
  coinPacks: { coins_500: 500, coins_1500: 1500, coins_5000: 5000 } as const,
  minWordLength: 3,
} as const;

export const PRODUCT_IDS = ['no_ads', 'coins_500', 'coins_1500', 'coins_5000', 'themes_all'] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

export const CONSUMABLE_PRODUCTS: readonly ProductId[] = ['coins_500', 'coins_1500', 'coins_5000'];

export const THEMES = ['cozy', 'sky', 'sakura'] as const;
export type ThemeId = (typeof THEMES)[number];
export const DEFAULT_THEME: ThemeId = 'cozy';
export const PAID_THEMES: readonly ThemeId[] = ['sky', 'sakura'];
