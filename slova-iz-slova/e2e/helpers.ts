import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

interface Level {
  id: number;
  source: string;
  words: string[];
}

const chapter = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'levels', 'chapter-01.json'), 'utf8'),
) as { levels: Level[] };

export function levelData(id: number): Level {
  const level = chapter.levels.find((l) => l.id === id);
  if (!level) throw new Error(`Нет уровня ${id} в первой главе`);
  return level;
}

/** Собирает ошибки консоли и страницы: в конце теста их быть не должно. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

export async function openGame(page: Page, options: { adDurationMs?: number } = {}): Promise<void> {
  await page.addInitScript((adDurationMs) => {
    const w = window as unknown as { __localPlatform?: Record<string, unknown> };
    w.__localPlatform = { ...(w.__localPlatform ?? {}), adDurationMs };
  }, options.adDurationMs ?? 150);
  await page.goto('/');
  await expect(page.getByTestId('screen-menu').or(page.getByTestId('screen-game'))).toBeVisible();
}

export async function startFirstLevel(page: Page): Promise<void> {
  await page.getByTestId('menu-play').click();
  await expect(page.getByTestId('screen-game')).toBeVisible();
  const skip = page.getByTestId('tutorial-skip');
  if (await skip.isVisible()) await skip.click();
}

export async function typeWord(page: Page, word: string): Promise<void> {
  for (const letter of word.toUpperCase()) {
    await page.locator(`[data-tile][data-letter="${letter}"][data-used="0"]`).first().click();
  }
}

export async function submitWord(page: Page, word: string): Promise<void> {
  await typeWord(page, word);
  await expect(page.getByTestId('field')).toHaveAttribute('data-value', word.toUpperCase());
  await page.getByTestId('check').click();
}

export async function foundCount(page: Page): Promise<number> {
  return Number(await page.getByTestId('found-count').getAttribute('data-found'));
}

/** Находит слова уровня, пока не появится окно победы. Возвращает найденные слова. */
export async function playUntilWin(page: Page, levelId: number): Promise<string[]> {
  const level = levelData(levelId);
  await expect(page.getByTestId('screen-game')).toHaveAttribute('data-level', String(levelId));
  const done: string[] = [];
  for (const word of level.words) {
    await submitWord(page, word);
    done.push(word);
    await expect(page.locator(`[data-word="${word}"]`)).toHaveAttribute('data-found', '1');
    await expect(page.getByTestId('found-count')).toHaveAttribute('data-found', String(done.length));
    if (done.length >= Math.ceil(level.words.length * 0.5)) break;
  }
  await expect(page.getByTestId('win')).toBeVisible();
  return done;
}

export async function coins(page: Page): Promise<number> {
  const text = await page.getByTestId('coins').locator('.coins-value').innerText();
  return Number(text.replace(/\D/g, ''));
}

export async function platformLog(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __localPlatform: { log: string[] } }).__localPlatform.log.slice());
}

/** Закрывает окно ежедневного бонуса, если оно появилось. */
export async function dismissDaily(page: Page): Promise<void> {
  const claim = page.getByTestId('daily-claim');
  if (await claim.isVisible().catch(() => false)) await claim.click();
}
