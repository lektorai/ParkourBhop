/**
 * Формат сохранения, миграции версий и слияние локального сохранения с облачным.
 * Чистые функции без DOM — покрыты тестами (tests/save.test.ts).
 */
import { DEFAULT_THEME, ECONOMY, THEMES, type ThemeId } from '../config/economy';
import type { AdCoinsState, DailyState } from '../game/economy';
import { emptyProgress, type LevelData, type LevelProgress } from '../game/types';

export const SAVE_VERSION = 2;

/** Прогресс уровня в компактном виде: слова хранятся номерами в списке уровня. */
export interface SavedLevel {
  /** Найденные слова: битовая маска по индексам level.words (см. encodeBits). */
  f: string;
  /** Бонусные слова. */
  b?: string[];
  /** Подсказки: индекс слова → число открытых букв. */
  h?: Record<string, number>;
  /** За сколько звёзд выдана награда (0–3). */
  s: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
}

export interface SaveData {
  v: typeof SAVE_VERSION;
  /** Время последнего изменения, мс. */
  ts: number;
  /** Монеты, полученные в игре (включая стартовые). */
  earned: number;
  /** Потраченные монеты. */
  spent: number;
  /** Купленные монеты: токен покупки → сколько начислено. Защищает от двойного начисления. */
  purchases: Record<string, number>;
  /** Номер последнего открытого уровня. */
  unlocked: number;
  /** Уровень, который откроет кнопка «Играть». */
  lastLevel: number;
  levels: Record<string, SavedLevel>;
  /** Купленные темы. */
  themes: ThemeId[];
  theme: ThemeId;
  noAds: boolean;
  settings: Settings;
  tutorialDone: boolean;
  daily: DailyState;
  adCoins: AdCoinsState;
  /** Сколько уровней пройдено с последней полноэкранной рекламы. */
  levelsSinceAd: number;
  /** Самое позднее время, которое видела игра (защита от перевода часов назад). */
  clock: number;
}

export function createSave(now = 0): SaveData {
  return {
    v: SAVE_VERSION,
    ts: now,
    earned: ECONOMY.startCoins,
    spent: 0,
    purchases: {},
    unlocked: 1,
    lastLevel: 1,
    levels: {},
    themes: [],
    theme: DEFAULT_THEME,
    noAds: false,
    settings: { sound: true, music: true, vibration: true },
    tutorialDone: false,
    daily: { lastDay: 0, streak: 0 },
    adCoins: { day: 0, count: 0 },
    levelsSinceAd: 0,
    clock: now,
  };
}

export function coinsOf(save: SaveData): number {
  const purchased = Object.values(save.purchases).reduce((sum, n) => sum + n, 0);
  return Math.max(0, save.earned + purchased - save.spent);
}

// --- битовые маски найденных слов -------------------------------------------------

const BITS_PER_CHAR = 5;

/** Упаковывает набор индексов в строку: по 5 бит на символ в base32. */
export function encodeBits(indices: Iterable<number>): string {
  const chunks: number[] = [];
  for (const index of indices) {
    if (index < 0) continue;
    const chunk = Math.floor(index / BITS_PER_CHAR);
    while (chunks.length <= chunk) chunks.push(0);
    chunks[chunk]! |= 1 << (index % BITS_PER_CHAR);
  }
  return chunks.map((c) => c.toString(32)).join('');
}

export function decodeBits(mask: string): number[] {
  const indices: number[] = [];
  for (let chunk = 0; chunk < mask.length; chunk++) {
    const value = parseInt(mask[chunk]!, 32);
    if (Number.isNaN(value)) continue;
    for (let bit = 0; bit < BITS_PER_CHAR; bit++) {
      if (value & (1 << bit)) indices.push(chunk * BITS_PER_CHAR + bit);
    }
  }
  return indices;
}

export function countBits(mask: string): number {
  return decodeBits(mask).length;
}

function mergeBits(a: string, b: string): string {
  return encodeBits([...decodeBits(a), ...decodeBits(b)]);
}

// --- преобразование прогресса уровня -----------------------------------------------

export function toProgress(level: LevelData, saved: SavedLevel | undefined): LevelProgress {
  if (!saved) return emptyProgress();
  const found = decodeBits(saved.f)
    .map((i) => level.words[i])
    .filter((w): w is string => typeof w === 'string');
  const hints: Record<string, number> = {};
  for (const [index, count] of Object.entries(saved.h ?? {})) {
    const word = level.words[Number(index)];
    if (word && !found.includes(word)) hints[word] = count;
  }
  return { found, bonus: [...(saved.b ?? [])], hints, starsRewarded: saved.s };
}

export function fromProgress(level: LevelData, progress: LevelProgress): SavedLevel {
  const saved: SavedLevel = {
    f: encodeBits(progress.found.map((w) => level.words.indexOf(w))),
    s: progress.starsRewarded,
  };
  if (progress.bonus.length) saved.b = [...progress.bonus];
  const hints: Record<string, number> = {};
  for (const [word, count] of Object.entries(progress.hints)) {
    const index = level.words.indexOf(word);
    if (index >= 0 && count > 0) hints[String(index)] = count;
  }
  if (Object.keys(hints).length) saved.h = hints;
  return saved;
}

// --- миграции ------------------------------------------------------------------------

/** Версия 1 (прототип): монеты одним числом, найденные слова — массивом индексов. */
interface SaveV1 {
  v: 1;
  ts?: number;
  coins?: number;
  unlocked?: number;
  levels?: Record<string, { found?: number[]; bonus?: string[]; hints?: Record<string, number>; stars?: number }>;
  themes?: string[];
  theme?: string;
  noAds?: boolean;
  sound?: boolean;
  music?: boolean;
  vibration?: boolean;
  tutorialDone?: boolean;
}

function migrateV1(old: SaveV1): SaveData {
  const save = createSave(old.ts ?? 0);
  // В v1 не было раздельного учёта: считаем весь баланс заработанным.
  save.earned = Math.max(0, Math.floor(old.coins ?? ECONOMY.startCoins));
  save.unlocked = Math.max(1, Math.floor(old.unlocked ?? 1));
  save.lastLevel = save.unlocked;
  for (const [id, level] of Object.entries(old.levels ?? {})) {
    const saved: SavedLevel = { f: encodeBits(level.found ?? []), s: level.stars ?? 0 };
    if (level.bonus?.length) saved.b = level.bonus;
    if (level.hints && Object.keys(level.hints).length) saved.h = level.hints;
    save.levels[id] = saved;
  }
  save.themes = sanitizeThemes(old.themes);
  save.theme = isTheme(old.theme) ? old.theme : DEFAULT_THEME;
  save.noAds = Boolean(old.noAds);
  save.settings = {
    sound: old.sound ?? true,
    music: old.music ?? true,
    vibration: old.vibration ?? true,
  };
  save.tutorialDone = Boolean(old.tutorialDone);
  return save;
}

function isTheme(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

function sanitizeThemes(value: unknown): ThemeId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isTheme))].filter((t) => t !== DEFAULT_THEME);
}

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Приводит произвольные данные к актуальному сохранению. Битые поля заменяются значениями по умолчанию. */
function sanitize(raw: Record<string, unknown>): SaveData {
  const base = createSave(num(raw.ts, 0));
  const levels: Record<string, SavedLevel> = {};
  if (raw.levels && typeof raw.levels === 'object') {
    for (const [id, value] of Object.entries(raw.levels as Record<string, Partial<SavedLevel>>)) {
      if (!value || typeof value !== 'object' || !/^\d+$/.test(id)) continue;
      const saved: SavedLevel = {
        f: typeof value.f === 'string' ? value.f : '',
        s: Math.min(3, Math.max(0, Math.floor(num(value.s, 0)))),
      };
      if (Array.isArray(value.b)) saved.b = value.b.filter((w) => typeof w === 'string');
      if (value.h && typeof value.h === 'object') saved.h = value.h;
      levels[id] = saved;
    }
  }
  const purchases: Record<string, number> = {};
  if (raw.purchases && typeof raw.purchases === 'object') {
    for (const [token, coins] of Object.entries(raw.purchases as Record<string, unknown>)) {
      purchases[token] = Math.max(0, num(coins, 0));
    }
  }
  const settings = (raw.settings ?? {}) as Partial<Settings>;
  const daily = (raw.daily ?? {}) as Partial<DailyState>;
  const adCoins = (raw.adCoins ?? {}) as Partial<AdCoinsState>;
  const unlocked = Math.max(1, Math.floor(num(raw.unlocked, 1)));
  const themes = sanitizeThemes(raw.themes);
  const theme = isTheme(raw.theme) && (raw.theme === DEFAULT_THEME || themes.includes(raw.theme)) ? raw.theme : DEFAULT_THEME;
  return {
    ...base,
    earned: Math.max(0, num(raw.earned, base.earned)),
    spent: Math.max(0, num(raw.spent, 0)),
    purchases,
    unlocked,
    lastLevel: Math.min(unlocked, Math.max(1, Math.floor(num(raw.lastLevel, unlocked)))),
    levels,
    themes,
    theme,
    noAds: Boolean(raw.noAds),
    settings: {
      sound: settings.sound ?? true,
      music: settings.music ?? true,
      vibration: settings.vibration ?? true,
    },
    tutorialDone: Boolean(raw.tutorialDone),
    daily: { lastDay: num(daily.lastDay, 0), streak: num(daily.streak, 0) },
    adCoins: { day: num(adCoins.day, 0), count: num(adCoins.count, 0) },
    levelsSinceAd: Math.max(0, num(raw.levelsSinceAd, 0)),
    clock: num(raw.clock, 0),
  };
}

/** Разбирает строку сохранения любой версии. `null` — данных нет или они не читаются. */
export function parseSave(text: string | null | undefined): SaveData | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (data.v === 1) return sanitize(migrateV1(data as unknown as SaveV1) as unknown as Record<string, unknown>);
  if (data.v === SAVE_VERSION) return sanitize(data);
  // Сохранение из более новой версии игры: берём то, что понимаем.
  if (typeof data.v === 'number' && data.v > SAVE_VERSION) return sanitize(data);
  return null;
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}

// --- слияние -----------------------------------------------------------------------

function mergeLevel(a: SavedLevel | undefined, b: SavedLevel | undefined): SavedLevel {
  if (!a) return b!;
  if (!b) return a;
  const merged: SavedLevel = { f: mergeBits(a.f, b.f), s: Math.max(a.s, b.s) };
  const bonus = [...new Set([...(a.b ?? []), ...(b.b ?? [])])];
  if (bonus.length) merged.b = bonus;
  const hints: Record<string, number> = { ...(a.h ?? {}) };
  for (const [index, count] of Object.entries(b.h ?? {})) hints[index] = Math.max(hints[index] ?? 0, count);
  const found = new Set(decodeBits(merged.f).map(String));
  for (const index of Object.keys(hints)) if (found.has(index)) delete hints[index];
  if (Object.keys(hints).length) merged.h = hints;
  return merged;
}

/**
 * Сливает два сохранения (локальное и облачное). Побеждает больший прогресс:
 * найденные слова, открытые уровни, темы и покупки объединяются; заработанные и потраченные
 * монеты берутся по максимуму, купленные — объединяются по токенам, поэтому покупки не теряются.
 * Настройки и выбранная тема берутся из более свежего сохранения.
 */
export function mergeSaves(a: SaveData, b: SaveData): SaveData {
  const newer = a.ts >= b.ts ? a : b;
  const levels: Record<string, SavedLevel> = {};
  for (const id of new Set([...Object.keys(a.levels), ...Object.keys(b.levels)])) {
    levels[id] = mergeLevel(a.levels[id], b.levels[id]);
  }
  const themes = [...new Set([...a.themes, ...b.themes])];
  const unlocked = Math.max(a.unlocked, b.unlocked);
  const daily = a.daily.lastDay >= b.daily.lastDay ? a.daily : b.daily;
  const adCoins =
    a.adCoins.day === b.adCoins.day
      ? { day: a.adCoins.day, count: Math.max(a.adCoins.count, b.adCoins.count) }
      : a.adCoins.day > b.adCoins.day
        ? a.adCoins
        : b.adCoins;
  return {
    v: SAVE_VERSION,
    ts: Math.max(a.ts, b.ts),
    earned: Math.max(a.earned, b.earned),
    spent: Math.max(a.spent, b.spent),
    purchases: { ...a.purchases, ...b.purchases },
    unlocked,
    lastLevel: Math.min(unlocked, newer.lastLevel),
    levels,
    themes,
    theme: newer.theme === DEFAULT_THEME || themes.includes(newer.theme) ? newer.theme : DEFAULT_THEME,
    noAds: a.noAds || b.noAds,
    settings: { ...newer.settings },
    tutorialDone: a.tutorialDone || b.tutorialDone,
    daily: { ...daily },
    adCoins: { ...adCoins },
    levelsSinceAd: newer.levelsSinceAd,
    clock: Math.max(a.clock, b.clock),
  };
}
