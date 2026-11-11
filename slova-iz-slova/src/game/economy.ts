/** Расчёты экономики: награды, ежедневный бонус, лимиты, правила показа рекламы. Чистые функции. */
import { ADS } from '../config/ads';
import { ECONOMY } from '../config/economy';

/** Награда за звёзды с номерами (from, to]: например, было 0 звёзд, стало 2 → 10 + 5. */
export function starReward(fromStars: number, toStars: number): number {
  let total = 0;
  for (let star = fromStars; star < toStars; star++) total += ECONOMY.starRewards[star] ?? 0;
  return total;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Номер календарного дня в часовом поясе игрока. */
export function dayNumber(timestamp: number, timezoneOffsetMin = new Date(timestamp).getTimezoneOffset()): number {
  return Math.floor((timestamp - timezoneOffsetMin * 60 * 1000) / DAY_MS);
}

export interface DailyState {
  /** День последнего получения бонуса (dayNumber) или 0, если не получал. */
  lastDay: number;
  /** Сколько дней подряд получен бонус (1–7). */
  streak: number;
}

export interface DailyOffer {
  /** Порядковый день лесенки, 1–7. */
  day: number;
  reward: number;
}

/** Какой бонус положен сегодня; `null` — уже получен (или часы ушли назад). */
export function dailyOffer(state: DailyState, today: number): DailyOffer | null {
  if (state.lastDay >= today) return null;
  const continues = state.lastDay === today - 1 && state.streak > 0;
  const day = continues ? (state.streak % ECONOMY.dailyRewards.length) + 1 : 1;
  return { day, reward: ECONOMY.dailyRewards[day - 1] ?? ECONOMY.dailyRewards[0] };
}

export function claimDaily(state: DailyState, today: number): { state: DailyState; offer: DailyOffer } | null {
  const offer = dailyOffer(state, today);
  if (!offer) return null;
  return { state: { lastDay: today, streak: offer.day }, offer };
}

export interface AdCoinsState {
  day: number;
  count: number;
}

/** Сколько раз сегодня ещё можно получить монеты за рекламу в магазине. */
export function adCoinsLeft(state: AdCoinsState, today: number): number {
  if (state.day !== today) return ECONOMY.adCoinsPerDay;
  return Math.max(0, ECONOMY.adCoinsPerDay - state.count);
}

export function useAdCoins(state: AdCoinsState, today: number): AdCoinsState {
  return state.day === today ? { day: today, count: state.count + 1 } : { day: today, count: 1 };
}

export interface InterstitialState {
  /** Сколько уровней игрок прошёл всего (открыто следующих). */
  levelsPassed: number;
  /** Сколько уровней пройдено с последнего показа. */
  levelsSinceAd: number;
  /** Время последнего показа, мс (0 — не было). */
  lastShownAt: number;
  noAds: boolean;
}

/** Можно ли сейчас показать полноэкранную рекламу (в логической паузе). */
export function canShowInterstitial(state: InterstitialState, now: number): boolean {
  if (state.noAds) return false;
  if (state.levelsPassed < ADS.interstitialMinLevel) return false;
  if (state.levelsSinceAd < ADS.interstitialEveryLevels) return false;
  if (state.lastShownAt && now - state.lastShownAt < ADS.interstitialMinIntervalSec * 1000) return false;
  return true;
}
