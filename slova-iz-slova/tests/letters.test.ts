import { describe, expect, it } from 'vitest';
import { keyToLetter } from '../src/game/keyboard';
import { canForm, letterCounts, normalizeWord, plural } from '../src/game/letters';

describe('буквы', () => {
  it('нормализует регистр и Ё = Е', () => {
    expect(normalizeWord('  ЁЛКА ')).toBe('елка');
    expect(normalizeWord('Мёд')).toBe('мед');
  });

  it('считает буквы с повторами', () => {
    const counts = letterCounts('молоко');
    expect(counts.get('о')).toBe(3);
    expect(counts.get('м')).toBe(1);
    expect(counts.get('я')).toBeUndefined();
  });

  it('разрешает букву столько раз, сколько она есть в исходном слове', () => {
    expect(canForm('око', 'молоток')).toBe(true);
    expect(canForm('молоко', 'молоток')).toBe(true);
    // В слове «улыбка» одна «а» и одна «к».
    expect(canForm('бак', 'улыбка')).toBe(true);
    expect(canForm('кабак', 'улыбка')).toBe(false);
    expect(canForm('баба', 'улыбка')).toBe(false);
  });

  it('не принимает буквы, которых нет, пустое и слишком длинное слово', () => {
    expect(canForm('кот', 'улыбка')).toBe(false);
    expect(canForm('', 'улыбка')).toBe(false);
    expect(canForm('улыбкаа', 'улыбка')).toBe(false);
  });

  it('склоняет числительные', () => {
    const forms = ['слово', 'слова', 'слов'] as const;
    expect([1, 2, 5, 11, 21, 22, 25, 111].map((n) => plural(n, forms))).toEqual([
      'слово', 'слова', 'слов', 'слов', 'слово', 'слова', 'слов', 'слов',
    ]);
  });
});

describe('клавиатура', () => {
  it('берёт русскую букву как есть', () => {
    expect(keyToLetter('л', 'KeyK')).toBe('л');
    expect(keyToLetter('Ё', 'Backquote')).toBe('е');
  });

  it('в латинской раскладке мапит клавиши на ЙЦУКЕН', () => {
    expect(keyToLetter('k', 'KeyK')).toBe('л');
    expect(keyToLetter('e', 'KeyE')).toBe('у');
    expect(keyToLetter(',', 'Comma')).toBe('б');
    expect(keyToLetter('`', 'Backquote')).toBe('е');
  });

  it('не реагирует на служебные клавиши', () => {
    expect(keyToLetter('Shift', 'ShiftLeft')).toBeNull();
    expect(keyToLetter('1', 'Digit1')).toBeNull();
  });
});
