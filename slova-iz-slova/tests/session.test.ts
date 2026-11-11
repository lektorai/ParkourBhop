import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../src/config/economy';
import {
  addBonusWord,
  addFoundWord,
  applyHint,
  checkWord,
  groupByLength,
  hintTarget,
  isLevelPassed,
  starsFor,
  starTargets,
} from '../src/game/session';
import { emptyProgress, type LevelData } from '../src/game/types';

const level: LevelData = {
  id: 1,
  source: 'улыбка',
  words: ['аул', 'бак', 'бал', 'бук', 'бык', 'куб', 'лак', 'лук', 'бука', 'клуб', 'булка'],
};
const bonusWords = new Set(['кал', 'лыка', 'кабул']);
const isBonus = (w: string) => bonusWords.has(w);

describe('проверка слова', () => {
  it('засчитывает слово из списка', () => {
    expect(checkWord(level, emptyProgress(), 'ЛУК', isBonus)).toEqual({ kind: 'found', word: 'лук' });
  });

  it('повторный ввод не засчитывается второй раз', () => {
    const progress = addFoundWord(emptyProgress(), 'лук');
    expect(checkWord(level, progress, 'лук', isBonus)).toEqual({ kind: 'already', word: 'лук' });
    expect(addFoundWord(progress, 'лук').found).toEqual(['лук']);
  });

  it('слово из расширенного словаря — бонусное, но только один раз', () => {
    expect(checkWord(level, emptyProgress(), 'лыка', isBonus)).toEqual({ kind: 'bonus', word: 'лыка' });
    const progress = addBonusWord(emptyProgress(), 'лыка');
    expect(checkWord(level, progress, 'лыка', isBonus)).toEqual({ kind: 'bonus-already', word: 'лыка' });
    expect(addBonusWord(progress, 'лыка').bonus).toEqual(['лыка']);
  });

  it('бонусное слово не идёт в прогресс уровня', () => {
    const progress = addBonusWord(emptyProgress(), 'лыка');
    expect(progress.found).toEqual([]);
  });

  it('не принимает исходное слово, короткие слова и чужие буквы', () => {
    expect(checkWord(level, emptyProgress(), 'улыбка', isBonus).kind).toBe('source');
    expect(checkWord(level, emptyProgress(), 'ау', isBonus).kind).toBe('too-short');
    expect(checkWord(level, emptyProgress(), 'кот', isBonus).kind).toBe('invalid');
    // «кабул» есть в словаре, но в «улыбка» только одна «а»… и это не повод принять слово не из этих букв.
    expect(checkWord(level, emptyProgress(), 'кабак', isBonus).kind).toBe('invalid');
  });

  it('Ё и Е считаются одной буквой', () => {
    const yo: LevelData = { id: 2, source: 'самолет', words: ['мед', 'лет', 'мел'] };
    expect(checkWord(yo, emptyProgress(), 'лёт', () => false)).toEqual({ kind: 'found', word: 'лет' });
  });

  it('пока словарь не загружен, бонусных слов нет', () => {
    expect(checkWord(level, emptyProgress(), 'лыка', () => false).kind).toBe('invalid');
  });
});

describe('звёзды', () => {
  it('считает пороги: 50%, 75% и 100% с округлением вверх', () => {
    expect(starTargets(11)).toEqual([6, 9, 11]);
    expect(starTargets(10)).toEqual([5, 8, 10]);
    expect(starTargets(38)).toEqual([19, 29, 38]);
  });

  it('выдаёт звёзды по числу найденных слов', () => {
    expect(starsFor(5, 11)).toBe(0);
    expect(starsFor(6, 11)).toBe(1);
    expect(starsFor(8, 11)).toBe(1);
    expect(starsFor(9, 11)).toBe(2);
    expect(starsFor(11, 11)).toBe(3);
    expect(starsFor(0, 0)).toBe(0);
  });

  it('уровень пройден с первой звездой', () => {
    let progress = emptyProgress();
    for (const word of level.words.slice(0, 5)) progress = addFoundWord(progress, word);
    expect(isLevelPassed(level, progress)).toBe(false);
    progress = addFoundWord(progress, level.words[5]!);
    expect(isLevelPassed(level, progress)).toBe(true);
  });
});

describe('подсказки', () => {
  it('открывает следующую букву в самом коротком ненайденном слове', () => {
    expect(hintTarget(level, emptyProgress())).toBe('аул');
    const first = applyHint(level, emptyProgress())!;
    expect(first.outcome).toEqual({ word: 'аул', revealed: 1, completed: false });
    const second = applyHint(level, first.progress)!;
    expect(second.outcome.revealed).toBe(2);
    expect(second.progress.hints).toEqual({ аул: 2 });
  });

  it('когда открыты все буквы, слово засчитывается', () => {
    let progress = emptyProgress();
    let last = applyHint(level, progress)!;
    for (let i = 0; i < 2; i++) {
      progress = last.progress;
      last = applyHint(level, progress)!;
    }
    expect(last.outcome).toEqual({ word: 'аул', revealed: 3, completed: true });
    expect(last.progress.found).toEqual(['аул']);
    expect(last.progress.hints).toEqual({});
  });

  it('пропускает найденные слова и переходит к более длинным', () => {
    let progress = emptyProgress();
    for (const word of level.words.filter((w) => w.length === 3)) progress = addFoundWord(progress, word);
    expect(hintTarget(level, progress)).toBe('бука');
  });

  it('найденное слово сбрасывает подсказки по нему', () => {
    const hinted = applyHint(level, emptyProgress())!.progress;
    expect(addFoundWord(hinted, 'аул').hints).toEqual({});
  });

  it('когда всё найдено, подсказывать нечего', () => {
    let progress = emptyProgress();
    for (const word of level.words) progress = addFoundWord(progress, word);
    expect(applyHint(level, progress)).toBeNull();
  });
});

describe('список слов', () => {
  it('группируется по длине', () => {
    expect(groupByLength(level.words).map(([length, words]) => [length, words.length])).toEqual([
      [3, 8],
      [4, 2],
      [5, 1],
    ]);
  });

  it('минимальная длина слова задана в экономике', () => {
    expect(ECONOMY.minWordLength).toBe(3);
  });
});
