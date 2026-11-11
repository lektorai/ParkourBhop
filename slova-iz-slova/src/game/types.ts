/** Данные уровня из public/levels/chapter-NN.json. Слова нормализованы (нижний регистр, ё = е). */
export interface LevelData {
  id: number;
  source: string;
  words: string[];
}

/** Прогресс игрока на одном уровне. */
export interface LevelProgress {
  /** Найденные слова из списка уровня. */
  found: string[];
  /** Найденные бонусные слова. */
  bonus: string[];
  /** Сколько букв открыто подсказкой в ещё не найденных словах: слово → число букв. */
  hints: Record<string, number>;
  /** За сколько звёзд уже выдана награда (0–3). */
  starsRewarded: number;
}

export function emptyProgress(): LevelProgress {
  return { found: [], bonus: [], hints: {}, starsRewarded: 0 };
}
