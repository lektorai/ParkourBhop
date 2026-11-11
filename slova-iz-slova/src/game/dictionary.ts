/** Расширенный словарь для бонусных слов. Хранится компактно (см. encodeFrontCoded в генераторе). */

/** Раскодирует список: первая цифра (base36) — длина общего начала с предыдущим словом. */
export function decodeFrontCoded(text: string): string[] {
  const words: string[] = [];
  let prev = '';
  for (const line of text.split('\n')) {
    if (!line) continue;
    const shared = parseInt(line[0]!, 36);
    const word = prev.slice(0, shared) + line.slice(1);
    words.push(word);
    prev = word;
  }
  return words;
}

export class BonusDictionary {
  private words: Set<string> | null = null;

  get ready(): boolean {
    return this.words !== null;
  }

  get size(): number {
    return this.words?.size ?? 0;
  }

  load(encoded: string): void {
    this.words = new Set(decodeFrontCoded(encoded));
  }

  /** Пока словарь не загружен, бонусных слов нет: слово просто «не подошло». */
  has(word: string): boolean {
    return this.words?.has(word) ?? false;
  }
}
