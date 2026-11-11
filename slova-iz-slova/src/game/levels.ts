/** Загрузка уровней по главам. Главы подгружаются по мере надобности и кешируются. */
import type { LevelData } from './types';

export interface ChapterInfo {
  chapter: number;
  title: string;
  levels: number;
}

export interface LevelIndex {
  levelCount: number;
  chapterSize: number;
  chapters: ChapterInfo[];
}

interface ChapterFile {
  chapter: number;
  title: string;
  levels: LevelData[];
}

export type Fetcher = (path: string) => Promise<unknown>;

const defaultFetcher: Fetcher = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Не удалось загрузить ${path}: ${response.status}`);
  return response.json();
};

export class LevelRepository {
  private index: LevelIndex | null = null;
  private chapters = new Map<number, Promise<ChapterFile>>();

  constructor(
    private readonly base = './levels',
    private readonly fetcher: Fetcher = defaultFetcher,
  ) {}

  async loadIndex(): Promise<LevelIndex> {
    if (!this.index) this.index = (await this.fetcher(`${this.base}/index.json`)) as LevelIndex;
    return this.index;
  }

  get levelCount(): number {
    return this.index?.levelCount ?? 0;
  }

  get chapterList(): ChapterInfo[] {
    return this.index?.chapters ?? [];
  }

  chapterOf(levelId: number): number {
    return Math.ceil(levelId / (this.index?.chapterSize ?? 20));
  }

  private loadChapter(chapter: number): Promise<ChapterFile> {
    let pending = this.chapters.get(chapter);
    if (!pending) {
      const name = `chapter-${String(chapter).padStart(2, '0')}.json`;
      pending = this.fetcher(`${this.base}/${name}`) as Promise<ChapterFile>;
      pending.catch(() => this.chapters.delete(chapter));
      this.chapters.set(chapter, pending);
    }
    return pending;
  }

  async getLevel(levelId: number): Promise<LevelData> {
    const chapter = await this.loadChapter(this.chapterOf(levelId));
    const level = chapter.levels.find((l) => l.id === levelId);
    if (!level) throw new Error(`Уровень ${levelId} не найден`);
    return level;
  }

  /** Заранее подгружает главу следующего уровня, чтобы переход был мгновенным. */
  preload(levelId: number): void {
    if (levelId >= 1 && levelId <= this.levelCount) void this.loadChapter(this.chapterOf(levelId)).catch(() => undefined);
  }
}
