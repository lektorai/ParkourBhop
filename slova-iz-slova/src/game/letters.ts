/** Работа с буквами: нормализация и проверка «можно ли составить слово». Без DOM. */

/** Приводит слово к виду, в котором оно лежит в словарях: нижний регистр, Ё = Е. */
export function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase().replace(/ё/g, 'е');
}

/** Считает, сколько раз каждая буква встречается в слове. */
export function letterCounts(word: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return counts;
}

/**
 * Можно ли составить `word` из букв `source`: каждая буква используется не чаще,
 * чем она встречается в исходном слове. Оба слова должны быть нормализованы.
 */
export function canForm(word: string, source: string): boolean {
  if (word.length === 0 || word.length > source.length) return false;
  const available = letterCounts(source);
  for (const ch of word) {
    const left = available.get(ch);
    if (!left) return false;
    available.set(ch, left - 1);
  }
  return true;
}

/** Буквы исходного слова для показа на плитках: верхний регистр. */
export function toTiles(source: string): string[] {
  return Array.from(normalizeWord(source).toUpperCase());
}

/** Русское склонение числительных: plural(5, ['слово', 'слова', 'слов']) → 'слов'. */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}
