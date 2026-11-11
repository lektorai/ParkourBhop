/** Чистая игровая логика одного уровня: проверка слова, звёзды, подсказки. Без DOM и без сохранений. */
import { ECONOMY } from '../config/economy';
import { canForm, normalizeWord } from './letters';
import type { LevelData, LevelProgress } from './types';

export type SubmitResult =
  | { kind: 'found'; word: string }
  | { kind: 'already'; word: string }
  | { kind: 'bonus'; word: string }
  | { kind: 'bonus-already'; word: string }
  | { kind: 'too-short' }
  | { kind: 'source' }
  | { kind: 'invalid' };

/**
 * Проверяет введённое слово. Прогресс не меняет — возвращает только вердикт.
 * `isBonusWord` — проверка по расширенному словарю (он грузится в фоне и может быть ещё не готов).
 */
export function checkWord(
  level: LevelData,
  progress: LevelProgress,
  raw: string,
  isBonusWord: (word: string) => boolean,
): SubmitResult {
  const word = normalizeWord(raw);
  if (word.length < ECONOMY.minWordLength) return { kind: 'too-short' };
  if (word === level.source) return { kind: 'source' };
  if (!canForm(word, level.source)) return { kind: 'invalid' };
  if (level.words.includes(word)) {
    return progress.found.includes(word) ? { kind: 'already', word } : { kind: 'found', word };
  }
  if (isBonusWord(word)) {
    return progress.bonus.includes(word) ? { kind: 'bonus-already', word } : { kind: 'bonus', word };
  }
  return { kind: 'invalid' };
}

/** Сколько слов нужно найти для 1, 2 и 3 звёзд. */
export function starTargets(totalWords: number): [number, number, number] {
  const [a, b, c] = ECONOMY.starThresholds;
  return [Math.ceil(totalWords * a), Math.ceil(totalWords * b), Math.ceil(totalWords * c)];
}

export function starsFor(foundCount: number, totalWords: number): 0 | 1 | 2 | 3 {
  if (totalWords <= 0) return 0;
  const targets = starTargets(totalWords);
  if (foundCount >= targets[2]) return 3;
  if (foundCount >= targets[1]) return 2;
  if (foundCount >= targets[0]) return 1;
  return 0;
}

export function isLevelPassed(level: LevelData, progress: LevelProgress): boolean {
  return starsFor(progress.found.length, level.words.length) >= 1;
}

export interface HintOutcome {
  word: string;
  /** Сколько букв слова теперь открыто. */
  revealed: number;
  /** Подсказка открыла последнюю букву — слово засчитано. */
  completed: boolean;
}

/** Слово, в котором подсказка откроет следующую букву: самое короткое из ненайденных (по порядку списка). */
export function hintTarget(level: LevelData, progress: LevelProgress): string | null {
  const found = new Set(progress.found);
  let best: string | null = null;
  for (const word of level.words) {
    if (found.has(word)) continue;
    if (best === null || word.length < best.length) best = word;
  }
  return best;
}

/** Применяет подсказку и возвращает новый прогресс. `null` — подсказывать нечего. */
export function applyHint(
  level: LevelData,
  progress: LevelProgress,
): { progress: LevelProgress; outcome: HintOutcome } | null {
  const word = hintTarget(level, progress);
  if (!word) return null;
  const revealed = Math.min(word.length, (progress.hints[word] ?? 0) + 1);
  const completed = revealed >= word.length;
  const hints = { ...progress.hints };
  if (completed) delete hints[word];
  else hints[word] = revealed;
  return {
    progress: {
      ...progress,
      hints,
      found: completed ? [...progress.found, word] : progress.found,
    },
    outcome: { word, revealed, completed },
  };
}

/** Добавляет найденное слово в прогресс (подсказки по нему больше не нужны). */
export function addFoundWord(progress: LevelProgress, word: string): LevelProgress {
  if (progress.found.includes(word)) return progress;
  const hints = { ...progress.hints };
  delete hints[word];
  return { ...progress, found: [...progress.found, word], hints };
}

export function addBonusWord(progress: LevelProgress, word: string): LevelProgress {
  if (progress.bonus.includes(word)) return progress;
  return { ...progress, bonus: [...progress.bonus, word] };
}

/** Группирует слова уровня по длине для показа списком: [[3, [...]], [4, [...]], ...]. */
export function groupByLength(words: readonly string[]): [number, string[]][] {
  const groups = new Map<number, string[]>();
  for (const word of words) {
    const bucket = groups.get(word.length) ?? [];
    bucket.push(word);
    groups.set(word.length, bucket);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}
