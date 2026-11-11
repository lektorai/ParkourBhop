import { describe, expect, it } from 'vitest';
import { ADS } from '../src/config/ads';
import { ECONOMY } from '../src/config/economy';
import {
  adCoinsLeft,
  canShowInterstitial,
  claimDaily,
  dailyOffer,
  dayNumber,
  starReward,
  useAdCoins,
} from '../src/game/economy';

describe('награды за звёзды', () => {
  it('10 за первую и по 5 за вторую и третью', () => {
    expect(starReward(0, 1)).toBe(10);
    expect(starReward(1, 2)).toBe(5);
    expect(starReward(2, 3)).toBe(5);
    expect(starReward(0, 3)).toBe(20);
    expect(starReward(2, 2)).toBe(0);
  });

  it('числа из ТЗ', () => {
    expect(ECONOMY.startCoins).toBe(200);
    expect(ECONOMY.hintCost).toBe(50);
    expect(ECONOMY.themeCost).toBe(1500);
    expect(ECONOMY.bonusWordReward).toBe(1);
    expect(ECONOMY.adCoinsReward).toBe(25);
    expect(ECONOMY.adCoinsPerDay).toBe(5);
    expect([...ECONOMY.dailyRewards]).toEqual([20, 30, 40, 50, 60, 80, 100]);
  });
});

describe('ежедневный бонус', () => {
  const day = 20000;

  it('первый заход — день 1', () => {
    expect(dailyOffer({ lastDay: 0, streak: 0 }, day)).toEqual({ day: 1, reward: 20 });
  });

  it('второй раз за день бонус не выдаётся', () => {
    const claimed = claimDaily({ lastDay: 0, streak: 0 }, day)!;
    expect(claimed.state).toEqual({ lastDay: day, streak: 1 });
    expect(dailyOffer(claimed.state, day)).toBeNull();
    expect(claimDaily(claimed.state, day)).toBeNull();
  });

  it('лесенка растёт семь дней подряд и начинается заново', () => {
    let state = { lastDay: 0, streak: 0 };
    const rewards: number[] = [];
    for (let i = 0; i < 8; i++) {
      const claimed = claimDaily(state, day + i)!;
      rewards.push(claimed.offer.reward);
      state = claimed.state;
    }
    expect(rewards).toEqual([20, 30, 40, 50, 60, 80, 100, 20]);
  });

  it('пропуск дня сбрасывает лесенку', () => {
    expect(dailyOffer({ lastDay: day, streak: 4 }, day + 2)).toEqual({ day: 1, reward: 20 });
  });

  it('перевод часов назад бонус не даёт', () => {
    expect(dailyOffer({ lastDay: day, streak: 2 }, day - 1)).toBeNull();
  });

  it('номер дня считается в часовом поясе игрока', () => {
    const ts = Date.UTC(2026, 10, 11, 22, 30); // 22:30 UTC
    expect(dayNumber(ts, 0)).toBe(dayNumber(Date.UTC(2026, 10, 11, 1, 0), 0));
    // В Москве (UTC+3, смещение −180 минут) это уже следующий день.
    expect(dayNumber(ts, -180)).toBe(dayNumber(ts, 0) + 1);
  });
});

describe('монеты за рекламу', () => {
  it('не больше пяти раз в день', () => {
    let state = { day: 0, count: 0 };
    for (let i = 0; i < 5; i++) {
      expect(adCoinsLeft(state, 100)).toBe(5 - i);
      state = useAdCoins(state, 100);
    }
    expect(adCoinsLeft(state, 100)).toBe(0);
    expect(adCoinsLeft(state, 101)).toBe(5);
    expect(useAdCoins(state, 101)).toEqual({ day: 101, count: 1 });
  });
});

describe('полноэкранная реклама', () => {
  const base = { levelsPassed: 10, levelsSinceAd: 2, lastShownAt: 0, noAds: false };
  const now = 1_000_000;

  it('показывается в логической паузе, когда все условия выполнены', () => {
    expect(canShowInterstitial(base, now)).toBe(true);
  });

  it('не раньше уровня 3', () => {
    expect(canShowInterstitial({ ...base, levelsPassed: ADS.interstitialMinLevel - 1 }, now)).toBe(false);
  });

  it('не чаще раза в 2 уровня', () => {
    expect(canShowInterstitial({ ...base, levelsSinceAd: 1 }, now)).toBe(false);
  });

  it('не чаще раза в 90 секунд', () => {
    expect(canShowInterstitial({ ...base, lastShownAt: now - 89_000 }, now)).toBe(false);
    expect(canShowInterstitial({ ...base, lastShownAt: now - 91_000 }, now)).toBe(true);
  });

  it('не показывается после покупки «Без рекламы»', () => {
    expect(canShowInterstitial({ ...base, noAds: true }, now)).toBe(false);
  });
});
