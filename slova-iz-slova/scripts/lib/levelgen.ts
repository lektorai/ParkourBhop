/**
 * Логика генератора уровней. Вынесена отдельно от CLI, чтобы её можно было тестировать.
 * Работает только с готовыми словарями из data/dict (см. scripts/build-dictionary.py).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canForm, normalizeWord } from '../../src/game/letters';

export interface WordPatterns {
  exact: Set<string>;
  prefixes: string[];
}

export interface Dictionaries {
  /** Основной словарь по убыванию частоты. */
  main: { word: string; freq: number }[];
  mainRank: Map<string, number>;
  extended: Set<string>;
  blocklist: WordPatterns;
  levelsExclude: WordPatterns;
  shortWords: Set<string>;
  sourceExclude: WordPatterns;
  firstLevels: string[];
}

export interface GeneratedLevel {
  id: number;
  source: string;
  words: string[];
  difficulty: number;
}

export interface GeneratorOptions {
  levelCount: number;
  /** Слова от 5 букв попадают в список уровня, только если их место в частотном словаре выше этого. */
  listRank: number;
  /** Исходные слова берутся из самых частотных слов основного словаря. */
  sourceRank: number;
  minWords: number;
  maxWords: number;
  minSourceLength: number;
  maxSourceLength: number;
}

export const DEFAULT_OPTIONS: GeneratorOptions = {
  levelCount: 600,
  listRank: 8000,
  sourceRank: 7500,
  minWords: 10,
  maxWords: 60,
  minSourceLength: 6,
  maxSourceLength: 13,
};

export const CHAPTER_SIZE = 20;

export const CHAPTER_TITLES = [
  'Утренний чай', 'Дача', 'Бабушкин сад', 'Тёплый плед', 'Летняя веранда',
  'Яблочный пирог', 'Лесная тропинка', 'Книжная полка', 'Вечер у окна', 'Грибная пора',
  'Старый альбом', 'Речной берег', 'Малиновое варенье', 'Осенний парк', 'Домашний уют',
  'Первый снег', 'Зимний вечер', 'Самовар', 'Весенняя капель', 'Цветущий луг',
  'Морской бриз', 'Горная дорога', 'Золотая осень', 'Сельская ярмарка', 'Вишнёвый сад',
  'Тихая гавань', 'Звёздное небо', 'Старая мельница', 'Сосновый бор', 'Большое путешествие',
];

export function parsePatterns(text: string): WordPatterns {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  for (const raw of text.split('\n')) {
    const line = normalizeWord(raw);
    if (!line || line.startsWith('#')) continue;
    if (line.endsWith('*')) prefixes.push(line.slice(0, -1));
    else exact.add(line);
  }
  return { exact, prefixes };
}

export function matchesPatterns(word: string, patterns: WordPatterns): boolean {
  return patterns.exact.has(word) || patterns.prefixes.some((p) => word.startsWith(p));
}

function readLines(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => normalizeWord(l))
    .filter((l) => l && !l.startsWith('#'));
}

export function loadDictionaries(root: string): Dictionaries {
  const data = join(root, 'data');
  const main = readLines(join(data, 'dict', 'main.tsv')).map((line) => {
    const [word = '', freq = '0'] = line.split('\t');
    return { word, freq: Number(freq) };
  });
  return {
    main,
    mainRank: new Map(main.map((entry, index) => [entry.word, index])),
    extended: new Set(readLines(join(data, 'dict', 'extended.txt'))),
    blocklist: parsePatterns(readFileSync(join(data, 'blocklist.txt'), 'utf8')),
    levelsExclude: parsePatterns(readFileSync(join(data, 'levels-exclude.txt'), 'utf8')),
    shortWords: new Set(readLines(join(data, 'short-words.txt'))),
    sourceExclude: parsePatterns(readFileSync(join(data, 'source-exclude.txt'), 'utf8')),
    firstLevels: readLines(join(data, 'first-levels.txt')),
  };
}

/** Слова, которые могут стоять в списке уровня (а не быть только бонусными). */
export function listEligibleWords(dict: Dictionaries, options: GeneratorOptions): string[] {
  const banned = (w: string) =>
    matchesPatterns(w, dict.blocklist) || matchesPatterns(w, dict.levelsExclude);
  const result = new Set<string>();
  for (const word of dict.shortWords) {
    if (dict.extended.has(word) && !banned(word)) result.add(word);
  }
  dict.main.slice(0, options.listRank).forEach(({ word }) => {
    if (word.length >= 5 && dict.extended.has(word) && !banned(word)) result.add(word);
  });
  return [...result];
}

/** Расширенный словарь для игры: всё допустимое, кроме стоп-листа. */
export function bonusDictionary(dict: Dictionaries): string[] {
  return [...dict.extended].filter((w) => !matchesPatterns(w, dict.blocklist)).sort();
}

/** Компактная запись отсортированного списка: первая цифра — длина общего начала с предыдущим словом. */
export function encodeFrontCoded(sortedWords: string[]): string {
  let prev = '';
  const lines: string[] = [];
  for (const word of sortedWords) {
    let shared = 0;
    const limit = Math.min(prev.length, word.length, 35);
    while (shared < limit && prev[shared] === word[shared]) shared++;
    lines.push(shared.toString(36) + word.slice(shared));
    prev = word;
  }
  return lines.join('\n');
}

const sortWords = (a: string, b: string) => a.length - b.length || a.localeCompare(b, 'ru');

function freqScore(freq: number): number {
  // 0 — очень редкое слово, 1 — очень частое (логарифмическая шкала 0.1…1000 ipm).
  return Math.min(1, Math.max(0, (Math.log10(Math.max(freq, 0.1)) + 1) / 4));
}

interface Candidate {
  source: string;
  words: string[];
  difficulty: number;
  sourceRank: number;
}

export function buildCandidates(dict: Dictionaries, options: GeneratorOptions): Candidate[] {
  const eligible = listEligibleWords(dict, options);
  const byLength = new Map<number, string[]>();
  for (const word of eligible) {
    const bucket = byLength.get(word.length) ?? [];
    bucket.push(word);
    byLength.set(word.length, bucket);
  }
  const freqOf = (w: string) => dict.main[dict.mainRank.get(w) ?? -1]?.freq ?? 1;

  const candidates: Candidate[] = [];
  dict.main.slice(0, options.sourceRank).forEach(({ word: source }, sourceRank) => {
    if (source.length < options.minSourceLength || source.length > options.maxSourceLength) return;
    if (matchesPatterns(source, dict.blocklist) || matchesPatterns(source, dict.levelsExclude)) return;
    if (matchesPatterns(source, dict.sourceExclude)) return;

    const words: string[] = [];
    for (let len = 3; len <= source.length; len++) {
      for (const word of byLength.get(len) ?? []) {
        if (word !== source && canForm(word, source)) words.push(word);
      }
    }
    if (words.length < options.minWords || words.length > options.maxWords) return;
    if (new Set(words.map((w) => w.length)).size < 3) return;

    const rarity = 1 - words.reduce((sum, w) => sum + freqScore(freqOf(w)), 0) / words.length;
    const lengthPart = (source.length - options.minSourceLength) / (options.maxSourceLength - options.minSourceLength);
    const countPart = (words.length - options.minWords) / (options.maxWords - options.minWords);
    const difficulty = 0.4 * lengthPart + 0.45 * countPart + 0.15 * rarity;
    candidates.push({ source, words: words.sort(sortWords), difficulty, sourceRank });
  });
  return candidates;
}

/** Целевые длина исходного слова и число слов для уровня: растут плавно (раздел 5 ТЗ). */
const CURVE: [level: number, length: number, count: number][] = [
  [1, 6.5, 11],
  [20, 7, 14],
  [60, 8, 20],
  [100, 9.5, 30],
  [200, 10, 36],
  [400, 11, 46],
  [600, 12, 56],
];

function target(level: number): { length: number; count: number } {
  const first = CURVE[0]!;
  const last = CURVE[CURVE.length - 1]!;
  if (level <= first[0]) return { length: first[1], count: first[2] };
  if (level >= last[0]) return { length: last[1], count: last[2] };
  for (let i = 1; i < CURVE.length; i++) {
    const [l1, len1, c1] = CURVE[i - 1]!;
    const [l2, len2, c2] = CURVE[i]!;
    if (level <= l2) {
      const t = (level - l1) / (l2 - l1);
      return { length: len1 + (len2 - len1) * t, count: c1 + (c2 - c1) * t };
    }
  }
  return { length: last[1], count: last[2] };
}

/** Жёсткие рамки по этапам игры. */
function window(level: number): { minLen: number; maxLen: number; minCount: number; maxCount: number } {
  if (level <= 20) return { minLen: 6, maxLen: 7, minCount: 10, maxCount: 15 };
  if (level <= 60) return { minLen: 7, maxLen: 9, minCount: 12, maxCount: 24 };
  if (level < 100) return { minLen: 8, maxLen: 10, minCount: 18, maxCount: 34 };
  if (level <= 250) return { minLen: 9, maxLen: 11, minCount: 25, maxCount: 42 };
  if (level <= 450) return { minLen: 9, maxLen: 12, minCount: 28, maxCount: 54 };
  return { minLen: 9, maxLen: 13, minCount: 34, maxCount: 60 };
}

function hashJitter(word: string): number {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Похожие исходные слова (общий корень или почти те же буквы) не должны идти подряд. */
export function tooSimilar(a: string, b: string): boolean {
  if (commonPrefix(a, b) >= 4) return true;
  const reverse = (s: string) => [...s].reverse().join('');
  if (commonPrefix(reverse(a), reverse(b)) >= 5) return true;
  const sorted = (s: string) => [...s].sort().join('');
  return sorted(a) === sorted(b);
}

export function generateLevels(dict: Dictionaries, options: GeneratorOptions = DEFAULT_OPTIONS): GeneratedLevel[] {
  const candidates = buildCandidates(dict, options);
  const bySource = new Map(candidates.map((c) => [c.source, c]));
  const used = new Set<string>();
  const levels: GeneratedLevel[] = [];

  const take = (candidate: Candidate) => {
    used.add(candidate.source);
    levels.push({
      id: levels.length + 1,
      source: candidate.source,
      words: candidate.words,
      difficulty: Number(candidate.difficulty.toFixed(3)),
    });
  };

  // Первые уровни подобраны вручную (data/first-levels.txt).
  for (const source of dict.firstLevels) {
    const candidate = bySource.get(source);
    if (!candidate) throw new Error(`Слово «${source}» из first-levels.txt не подходит как уровень`);
    take(candidate);
  }

  while (levels.length < options.levelCount) {
    const level = levels.length + 1;
    const goal = target(level);
    const frame = window(level);
    const recent = levels.slice(-4).map((l) => l.source);

    // Сначала ищем в рамках этапа; если запас исчерпан — расширяем рамки (порядок потом
    // всё равно выравнивается по сложности в smoothOrder).
    const frames = [frame, { minLen: 8, maxLen: options.maxSourceLength, minCount: 22, maxCount: options.maxWords }];
    let best: Candidate | undefined;
    for (const limits of frames) {
      let bestCost = Infinity;
      for (const candidate of candidates) {
        if (used.has(candidate.source)) continue;
        const len = candidate.source.length;
        const count = candidate.words.length;
        if (len < limits.minLen || len > limits.maxLen || count < limits.minCount || count > limits.maxCount) continue;
        if (recent.some((r) => tooSimilar(r, candidate.source))) continue;
        const cost =
          Math.abs(len - goal.length) / 7 +
          (Math.abs(count - goal.count) / 50) * 1.5 +
          (candidate.sourceRank / options.sourceRank) * 0.25 +
          hashJitter(candidate.source) * 0.12;
        if (cost < bestCost) {
          bestCost = cost;
          best = candidate;
        }
      }
      if (best) break;
    }
    if (!best) throw new Error(`Не хватило слов-кандидатов для уровня ${level}`);
    take(best);
  }
  return smoothOrder(levels, dict.firstLevels.length);
}

/**
 * Жадный подбор даёт нужный набор слов, но в конце игры запас кандидатов редеет и сложность
 * начинает «гулять». Поэтому уровни после ручных пересортировываются по сложности,
 * а похожие соседние слова разводятся перестановкой с ближайшим подходящим.
 */
function smoothOrder(levels: GeneratedLevel[], fixedCount: number): GeneratedLevel[] {
  const fixed = levels.slice(0, fixedCount);
  const rest = levels
    .slice(fixedCount)
    .sort((a, b) => a.difficulty - b.difficulty || a.source.localeCompare(b.source, 'ru'));
  const ordered = [...fixed, ...rest];
  const conflicts = (index: number, source: string) =>
    ordered.slice(Math.max(0, index - 3), index).some((prev) => tooSimilar(prev.source, source));
  for (let i = fixedCount; i < ordered.length; i++) {
    if (!conflicts(i, ordered[i]!.source)) continue;
    for (let j = i + 1; j < Math.min(ordered.length, i + 12); j++) {
      if (!conflicts(i, ordered[j]!.source)) {
        [ordered[i], ordered[j]] = [ordered[j]!, ordered[i]!];
        break;
      }
    }
  }
  return ordered.map((level, index) => ({ ...level, id: index + 1 }));
}

export interface ChapterFile {
  chapter: number;
  title: string;
  levels: { id: number; source: string; words: string[] }[];
}

export function toChapters(levels: GeneratedLevel[]): ChapterFile[] {
  const chapters: ChapterFile[] = [];
  for (let i = 0; i < levels.length; i += CHAPTER_SIZE) {
    const chapter = i / CHAPTER_SIZE + 1;
    chapters.push({
      chapter,
      title: CHAPTER_TITLES[chapter - 1] ?? `Глава ${chapter}`,
      levels: levels.slice(i, i + CHAPTER_SIZE).map(({ id, source, words }) => ({ id, source, words })),
    });
  }
  return chapters;
}
