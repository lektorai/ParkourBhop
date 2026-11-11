/**
 * Генератор уровней. Запуск: `npm run levels`.
 * Читает словари из data/, пишет:
 *   public/levels/chapter-NN.json — уровни по главам (по 20);
 *   public/levels/index.json      — оглавление (названия глав, число уровней);
 *   public/dict/extended.txt      — расширенный словарь для бонусных слов (компактная запись);
 *   reports/levels.csv            — отчёт для ручной проверки.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bonusDictionary,
  DEFAULT_OPTIONS,
  encodeFrontCoded,
  generateLevels,
  loadDictionaries,
  toChapters,
} from './lib/levelgen';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dict = loadDictionaries(root);
const levels = generateLevels(dict, DEFAULT_OPTIONS);
const chapters = toChapters(levels);

const levelsDir = join(root, 'public', 'levels');
mkdirSync(levelsDir, { recursive: true });
for (const file of readdirSync(levelsDir)) rmSync(join(levelsDir, file));
for (const chapter of chapters) {
  const name = `chapter-${String(chapter.chapter).padStart(2, '0')}.json`;
  writeFileSync(join(levelsDir, name), JSON.stringify(chapter));
}
writeFileSync(
  join(levelsDir, 'index.json'),
  JSON.stringify({
    levelCount: levels.length,
    chapterSize: 20,
    chapters: chapters.map((c) => ({ chapter: c.chapter, title: c.title, levels: c.levels.length })),
  }),
);

const dictDir = join(root, 'public', 'dict');
mkdirSync(dictDir, { recursive: true });
const bonus = bonusDictionary(dict);
writeFileSync(join(dictDir, 'extended.txt'), encodeFrontCoded(bonus));

const reportsDir = join(root, 'reports');
mkdirSync(reportsDir, { recursive: true });
const csv = ['level;chapter;source;letters;words_count;difficulty;words'];
for (const level of levels) {
  const chapter = Math.ceil(level.id / 20);
  csv.push(
    [level.id, chapter, level.source, level.source.length, level.words.length, level.difficulty, level.words.join(' ')].join(';'),
  );
}
writeFileSync(join(reportsDir, 'levels.csv'), '﻿' + csv.join('\n') + '\n');

const distinct = new Set(levels.flatMap((l) => l.words));
console.log(`Уровней: ${levels.length}, глав: ${chapters.length}`);
console.log(`Разных слов в списках: ${distinct.size}, бонусный словарь: ${bonus.length} слов`);
for (const from of [1, 21, 61, 100, 200, 400, 581]) {
  const slice = levels.slice(from - 1, from + 19);
  const avg = (f: (l: (typeof levels)[number]) => number) => (slice.reduce((s, l) => s + f(l), 0) / slice.length).toFixed(1);
  console.log(`  уровни ${from}–${from + 19}: букв ${avg((l) => l.source.length)}, слов ${avg((l) => l.words.length)}`);
}
