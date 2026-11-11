/**
 * Проверка сгенерированных уровней (public/levels) и самого генератора.
 * Если тест падает после правки словарей или стоп-листа — запустите `npm run levels`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { decodeFrontCoded } from '../src/game/dictionary';
import { canForm, normalizeWord } from '../src/game/letters';
import {
  CHAPTER_SIZE,
  DEFAULT_OPTIONS,
  encodeFrontCoded,
  generateLevels,
  loadDictionaries,
  matchesPatterns,
  tooSimilar,
  type ChapterFile,
  type Dictionaries,
} from '../scripts/lib/levelgen';

const root = join(__dirname, '..');
const levelsDir = join(root, 'public', 'levels');

let dict: Dictionaries;
let chapters: ChapterFile[];
let levels: ChapterFile['levels'];

beforeAll(() => {
  dict = loadDictionaries(root);
  chapters = readdirSync(levelsDir)
    .filter((name) => /^chapter-\d+\.json$/.test(name))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(levelsDir, name), 'utf8')) as ChapterFile);
  levels = chapters.flatMap((chapter) => chapter.levels);
});

describe('готовые уровни', () => {
  it('не меньше 600 уровней, главы по 20, номера по порядку', () => {
    expect(levels.length).toBeGreaterThanOrEqual(600);
    chapters.forEach((chapter, index) => {
      expect(chapter.chapter).toBe(index + 1);
      expect(chapter.levels).toHaveLength(CHAPTER_SIZE);
      expect(chapter.title.length).toBeGreaterThan(0);
    });
    levels.forEach((level, index) => expect(level.id).toBe(index + 1));
    const index = JSON.parse(readFileSync(join(levelsDir, 'index.json'), 'utf8')) as { levelCount: number };
    expect(index.levelCount).toBe(levels.length);
  });

  it('у глав разные названия', () => {
    expect(new Set(chapters.map((c) => c.title)).size).toBe(chapters.length);
  });

  it('каждое слово составляется из букв исходного слова', () => {
    for (const level of levels) {
      for (const word of level.words) {
        expect(canForm(word, level.source), `уровень ${level.id}: «${word}» из «${level.source}»`).toBe(true);
      }
    }
  });

  it('слова нормализованы: нижний регистр, без Ё, от 3 букв, только кириллица', () => {
    for (const level of levels) {
      for (const word of [level.source, ...level.words]) {
        expect(word).toBe(normalizeWord(word));
        expect(word).toMatch(/^[а-я]{3,}$/);
      }
    }
  });

  it('нет дублей в списках, исходное слово в список не входит, исходные слова не повторяются', () => {
    for (const level of levels) {
      expect(new Set(level.words).size, `уровень ${level.id}`).toBe(level.words.length);
      expect(level.words).not.toContain(level.source);
    }
    expect(new Set(levels.map((l) => l.source)).size).toBe(levels.length);
  });

  it('нет слов из стоп-листа и из списка «только бонусные»', () => {
    for (const level of levels) {
      for (const word of [level.source, ...level.words]) {
        expect(matchesPatterns(word, dict.blocklist), `стоп-лист: «${word}», уровень ${level.id}`).toBe(false);
        expect(matchesPatterns(word, dict.levelsExclude), `только бонусное: «${word}», уровень ${level.id}`).toBe(false);
      }
    }
  });

  it('все слова есть в расширенном словаре, короткие — в ручном списке', () => {
    for (const level of levels) {
      for (const word of level.words) {
        expect(dict.extended.has(word), `«${word}»`).toBe(true);
        if (word.length <= 4) expect(dict.shortWords.has(word), `короткое слово «${word}»`).toBe(true);
      }
    }
  });

  it('в уровне 10–60 слов хотя бы трёх разных длин, исходное слово 6–13 букв', () => {
    for (const level of levels) {
      expect(level.words.length).toBeGreaterThanOrEqual(10);
      expect(level.words.length).toBeLessThanOrEqual(60);
      expect(new Set(level.words.map((w) => w.length)).size).toBeGreaterThanOrEqual(3);
      expect(level.source.length).toBeGreaterThanOrEqual(6);
      expect(level.source.length).toBeLessThanOrEqual(13);
    }
  });

  it('первые уровни простые: 6–7 букв и 10–15 слов', () => {
    for (const level of levels.slice(0, 20)) {
      expect(level.source.length).toBeLessThanOrEqual(7);
      expect(level.words.length).toBeLessThanOrEqual(15);
    }
    expect(levels.slice(0, 5).map((l) => l.source)).toEqual(dict.firstLevels);
  });

  it('сложность растёт и не скачет', () => {
    const average = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
    const perChapter = chapters.map((chapter) => ({
      words: average(chapter.levels.map((l) => l.words.length)),
      letters: average(chapter.levels.map((l) => l.source.length)),
    }));
    for (let i = 1; i < perChapter.length; i++) {
      // От главы к главе среднее число слов не падает заметно и не прыгает больше чем на 12.
      expect(perChapter[i]!.words, `глава ${i + 1}`).toBeGreaterThan(perChapter[i - 1]!.words - 3);
      expect(perChapter[i]!.words - perChapter[i - 1]!.words, `глава ${i + 1}`).toBeLessThan(12);
    }
    expect(perChapter[perChapter.length - 1]!.words).toBeGreaterThan(perChapter[0]!.words * 2);
    expect(perChapter[perChapter.length - 1]!.letters).toBeGreaterThan(perChapter[0]!.letters + 2);
    // К уровню 100 — 9–11 букв и 25–40 слов.
    const around100 = levels.slice(95, 105);
    expect(average(around100.map((l) => l.source.length))).toBeGreaterThanOrEqual(8.5);
    expect(average(around100.map((l) => l.words.length))).toBeGreaterThanOrEqual(25);
    expect(average(around100.map((l) => l.words.length))).toBeLessThanOrEqual(40);
  });

  it('похожие исходные слова не идут подряд', () => {
    for (let i = 1; i < levels.length; i++) {
      expect(tooSimilar(levels[i - 1]!.source, levels[i]!.source), `${levels[i - 1]!.source} / ${levels[i]!.source}`).toBe(false);
    }
  });
});

describe('генератор', () => {
  it('детерминирован: повторный запуск даёт те же уровни, что лежат в public/levels', () => {
    const generated = generateLevels(dict, DEFAULT_OPTIONS);
    expect(generated.map((l) => [l.id, l.source, l.words])).toEqual(levels.map((l) => [l.id, l.source, l.words]));
  }, 120_000);

  it('определяет похожие слова', () => {
    expect(tooSimilar('подушка', 'подушечка')).toBe(true);
    expect(tooSimilar('секретарь', 'секретарша')).toBe(true);
    expect(tooSimilar('улыбка', 'молоток')).toBe(false);
  });
});

describe('расширенный словарь', () => {
  it('компактная запись обратима', () => {
    const words = ['аист', 'аистенок', 'аистиха', 'банан', 'банка', 'я'];
    expect(decodeFrontCoded(encodeFrontCoded(words))).toEqual(words);
  });

  it('файл игры содержит весь словарь без стоп-листа', () => {
    const words = decodeFrontCoded(readFileSync(join(root, 'public', 'dict', 'extended.txt'), 'utf8'));
    expect(words.length).toBeGreaterThan(50000);
    const set = new Set(words);
    for (const word of ['лук', 'кот', 'молоко', 'переводчик']) expect(set.has(word)).toBe(true);
    for (const word of words) {
      if (matchesPatterns(word, dict.blocklist)) throw new Error(`слово из стоп-листа в словаре игры: ${word}`);
    }
    // Слова уровней тоже должны приниматься словарём.
    for (const level of levels.slice(0, 50)) for (const word of level.words) expect(set.has(word)).toBe(true);
  });

  it('проверка слова быстрее 5 мс', () => {
    const set = new Set(decodeFrontCoded(readFileSync(join(root, 'public', 'dict', 'extended.txt'), 'utf8')));
    const started = performance.now();
    for (let i = 0; i < 1000; i++) {
      canForm('переводчик', 'переводчик');
      set.has('переводчик');
    }
    expect((performance.now() - started) / 1000).toBeLessThan(5);
  });
});
