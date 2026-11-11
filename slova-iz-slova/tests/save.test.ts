import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../src/config/economy';
import { addFoundWord, applyHint } from '../src/game/session';
import { emptyProgress, type LevelData } from '../src/game/types';
import {
  coinsOf,
  countBits,
  createSave,
  decodeBits,
  encodeBits,
  fromProgress,
  mergeSaves,
  parseSave,
  SAVE_VERSION,
  serializeSave,
  toProgress,
} from '../src/state/save';

const level: LevelData = {
  id: 1,
  source: 'улыбка',
  words: ['аул', 'бак', 'бал', 'бук', 'бык', 'куб', 'лак', 'лук', 'бука', 'клуб', 'булка'],
};

describe('битовые маски', () => {
  it('упаковка и распаковка обратимы', () => {
    for (const set of [[], [0], [4], [5], [0, 1, 2, 59], [3, 7, 10, 31, 32, 33]]) {
      expect(decodeBits(encodeBits(set))).toEqual(set);
    }
    expect(countBits(encodeBits([1, 5, 9]))).toBe(3);
  });

  it('60 слов уровня занимают 12 символов', () => {
    expect(encodeBits(Array.from({ length: 60 }, (_, i) => i))).toHaveLength(12);
  });
});

describe('прогресс уровня', () => {
  it('сохраняется и восстанавливается', () => {
    let progress = addFoundWord(emptyProgress(), 'лук');
    progress = addFoundWord(progress, 'булка');
    progress = applyHint(level, progress)!.progress; // одна буква в «аул»
    progress = { ...progress, bonus: ['лыка'], starsRewarded: 1 };
    const restored = toProgress(level, fromProgress(level, progress));
    expect(new Set(restored.found)).toEqual(new Set(['лук', 'булка']));
    expect(restored.hints).toEqual({ аул: 1 });
    expect(restored.bonus).toEqual(['лыка']);
    expect(restored.starsRewarded).toBe(1);
  });

  it('нет сохранения — пустой прогресс', () => {
    expect(toProgress(level, undefined)).toEqual(emptyProgress());
  });
});

describe('новое сохранение', () => {
  it('стартовый баланс 200 монет', () => {
    const save = createSave(1);
    expect(coinsOf(save)).toBe(ECONOMY.startCoins);
    expect(save.v).toBe(SAVE_VERSION);
    expect(save.unlocked).toBe(1);
  });

  it('монеты = заработано + куплено − потрачено, не меньше нуля', () => {
    const save = { ...createSave(1), earned: 300, spent: 150, purchases: { a: 500, b: 1500 } };
    expect(coinsOf(save)).toBe(2150);
    expect(coinsOf({ ...save, spent: 99999 })).toBe(0);
  });
});

describe('разбор и миграции', () => {
  it('сериализация обратима', () => {
    const save = { ...createSave(5), unlocked: 7, lastLevel: 6, themes: ['sky' as const], theme: 'sky' as const };
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('мусор и пустые данные дают null', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('')).toBeNull();
    expect(parseSave('{не json')).toBeNull();
    expect(parseSave('42')).toBeNull();
    expect(parseSave('{"v":0}')).toBeNull();
  });

  it('версия 1 мигрирует в актуальную без потери прогресса', () => {
    const v1 = {
      v: 1,
      ts: 1000,
      coins: 340,
      unlocked: 4,
      levels: {
        '1': { found: [0, 1, 7], bonus: ['лыка'], stars: 1 },
        '2': { found: [2], hints: { '5': 2 }, stars: 0 },
      },
      themes: ['sakura'],
      theme: 'sakura',
      noAds: true,
      sound: false,
      music: true,
      tutorialDone: true,
    };
    const save = parseSave(JSON.stringify(v1))!;
    expect(save.v).toBe(SAVE_VERSION);
    expect(coinsOf(save)).toBe(340);
    expect(save.unlocked).toBe(4);
    expect(decodeBits(save.levels['1']!.f)).toEqual([0, 1, 7]);
    expect(save.levels['1']!.b).toEqual(['лыка']);
    expect(save.levels['1']!.s).toBe(1);
    expect(save.levels['2']!.h).toEqual({ '5': 2 });
    expect(save.themes).toEqual(['sakura']);
    expect(save.theme).toBe('sakura');
    expect(save.noAds).toBe(true);
    expect(save.settings).toEqual({ sound: false, music: true, vibration: true });
    expect(save.tutorialDone).toBe(true);
  });

  it('битые поля заменяются значениями по умолчанию', () => {
    const save = parseSave(JSON.stringify({ v: 2, earned: 'много', unlocked: -5, theme: 'неизвестная', levels: { x: 1 } }))!;
    expect(save.earned).toBe(ECONOMY.startCoins);
    expect(save.unlocked).toBe(1);
    expect(save.theme).toBe('cozy');
    expect(save.levels).toEqual({});
  });

  it('нельзя выбрать тему, которая не куплена', () => {
    const save = parseSave(JSON.stringify({ v: 2, theme: 'sky', themes: [] }))!;
    expect(save.theme).toBe('cozy');
  });
});

describe('слияние локального и облачного сохранения', () => {
  const base = createSave(100);

  it('побеждает больший прогресс: слова и открытые уровни объединяются', () => {
    const local = { ...base, ts: 200, unlocked: 3, levels: { '1': { f: encodeBits([0, 1]), s: 0 } } };
    const cloud = { ...base, ts: 150, unlocked: 5, levels: { '1': { f: encodeBits([1, 2, 3]), s: 1 }, '4': { f: encodeBits([0]), s: 0 } } };
    const merged = mergeSaves(local, cloud);
    expect(merged.unlocked).toBe(5);
    expect(decodeBits(merged.levels['1']!.f)).toEqual([0, 1, 2, 3]);
    expect(merged.levels['1']!.s).toBe(1);
    expect(merged.levels['4']).toBeDefined();
    expect(merged.ts).toBe(200);
  });

  it('устаревшее облако не возвращает потраченные монеты', () => {
    const cloud = { ...base, ts: 100, earned: 260, spent: 0 };
    const local = { ...base, ts: 200, earned: 260, spent: 50 };
    expect(coinsOf(mergeSaves(local, cloud))).toBe(210);
    expect(coinsOf(mergeSaves(cloud, local))).toBe(210);
  });

  it('покупки не теряются и не начисляются дважды', () => {
    const phone = { ...base, ts: 200, purchases: { t1: 500 } };
    const tablet = { ...base, ts: 300, purchases: { t1: 500, t2: 1500 }, noAds: true };
    const merged = mergeSaves(phone, tablet);
    expect(merged.purchases).toEqual({ t1: 500, t2: 1500 });
    expect(coinsOf(merged)).toBe(ECONOMY.startCoins + 2000);
    expect(merged.noAds).toBe(true);
  });

  it('темы объединяются, выбранная берётся из свежего сохранения', () => {
    const a = { ...base, ts: 200, themes: ['sky' as const], theme: 'sky' as const };
    const b = { ...base, ts: 300, themes: ['sakura' as const], theme: 'cozy' as const };
    const merged = mergeSaves(a, b);
    expect(new Set(merged.themes)).toEqual(new Set(['sky', 'sakura']));
    expect(merged.theme).toBe('cozy');
  });

  it('подсказки по найденному слову не остаются', () => {
    const a = { ...base, levels: { '1': { f: encodeBits([]), h: { '0': 2 }, s: 0 } } };
    const b = { ...base, levels: { '1': { f: encodeBits([0]), s: 0 } } };
    expect(mergeSaves(a, b).levels['1']!.h).toBeUndefined();
  });

  it('ежедневный бонус нельзя получить дважды с двух устройств', () => {
    const a = { ...base, daily: { lastDay: 20000, streak: 3 } };
    const b = { ...base, daily: { lastDay: 19999, streak: 2 } };
    expect(mergeSaves(a, b).daily).toEqual({ lastDay: 20000, streak: 3 });
  });

  it('слияние симметрично по прогрессу', () => {
    const a = { ...base, ts: 1, unlocked: 2, earned: 250, levels: { '1': { f: encodeBits([0]), s: 1 } } };
    const b = { ...base, ts: 2, unlocked: 9, earned: 210, spent: 50, levels: { '1': { f: encodeBits([4]), s: 0 } } };
    const ab = mergeSaves(a, b);
    const ba = mergeSaves(b, a);
    expect(ab.unlocked).toBe(ba.unlocked);
    expect(ab.levels).toEqual(ba.levels);
    expect(coinsOf(ab)).toBe(coinsOf(ba));
  });
});
