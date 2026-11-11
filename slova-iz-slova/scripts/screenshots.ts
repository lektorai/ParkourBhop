/**
 * Скриншоты настоящего геймплея для карточек игры: `npm run screenshots`.
 * Игра открывается в браузере (адаптер local), в неё подставляется сохранение с прогрессом,
 * и снимаются экраны во всех трёх темах — вертикальные и горизонтальные, без рамок и системных панелей.
 * Результат: publish/screenshots/portrait/*.png (1080×1920) и landscape/*.png (1920×1080).
 * Размеры можно поменять: `npm run screenshots -- --portrait=1080x1920 --landscape=1920x1080`.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'publish', 'screenshots');
const PORT = 4174;

function sizeArg(name: string, fallback: [number, number]): [number, number] {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  const match = arg?.match(/=(\d+)x(\d+)$/);
  return match ? [Number(match[1]), Number(match[2])] : fallback;
}
const [portraitW, portraitH] = sizeArg('portrait', [1080, 1920]);
const [landscapeW, landscapeH] = sizeArg('landscape', [1920, 1080]);

interface Level {
  id: number;
  source: string;
  words: string[];
}
function level(id: number): Level {
  const chapter = String(Math.ceil(id / 20)).padStart(2, '0');
  const file = JSON.parse(readFileSync(join(root, 'public', 'levels', `chapter-${chapter}.json`), 'utf8')) as { levels: Level[] };
  return file.levels.find((l) => l.id === id)!;
}

/** Сохранение «игрок на уровне N»: предыдущие уровни пройдены, монет как на референсе. */
function seed(theme: string, current: number): string {
  const levels: Record<string, { f: string; s: number }> = {};
  for (let id = 1; id < current; id++) levels[id] = { f: 'vvvv', s: 1 + ((id * 7) % 3) };
  return JSON.stringify({
    v: 2, ts: Date.now(), earned: 1250, spent: 0, purchases: {}, unlocked: current, lastLevel: current, levels,
    themes: ['sky', 'sakura'], theme, noAds: false, settings: { sound: false, music: false, vibration: false },
    tutorialDone: true, daily: { lastDay: 999999, streak: 3 }, adCoins: { day: 0, count: 0 }, levelsSinceAd: 0, clock: 0,
  });
}

async function open(browser: Browser, width: number, height: number, scale: number, theme: string, current: number): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, locale: 'ru-RU' });
  await context.addInitScript((save) => {
    if (!localStorage.getItem('slova.save')) localStorage.setItem('slova.save', save);
    (window as unknown as { __localPlatform: object }).__localPlatform = { adDurationMs: 50 };
  }, seed(theme, current));
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.getByTestId('screen-menu').waitFor();
  await page.waitForTimeout(400);
  return page;
}

async function typeLetters(page: Page, word: string): Promise<void> {
  for (const letter of word.toUpperCase()) {
    await page.locator(`[data-tile][data-letter="${letter}"][data-used="0"]`).first().click();
  }
}

/** Открывает текущий уровень, находит часть слов и набирает начало следующего. */
async function playSome(page: Page, id: number, share: number): Promise<Level> {
  const data = level(id);
  await page.getByTestId('menu-play').click();
  await page.getByTestId('screen-game').waitFor();
  const target = Math.floor(data.words.length * share);
  const picked = data.words.filter((_, index) => index % 4 !== 2).slice(0, target);
  for (const word of picked) {
    await typeLetters(page, word);
    await page.getByTestId('check').click();
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(700);
  const next = data.words.find((w) => !picked.includes(w) && w.length >= 4) ?? data.words[0]!;
  await typeLetters(page, next.slice(0, 3));
  await page.getByTestId('wordlist').evaluate((el) => (el.scrollTop = 0));
  await page.waitForTimeout(300);
  return data;
}

const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist/local', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
  env: { ...process.env, PLATFORM: 'local' },
});

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return;
    } catch {
      /* сервер ещё поднимается */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Не запустился сервер предпросмотра. Сначала выполните `npm run build`.');
}

try {
  await waitForServer();
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'portrait'), { recursive: true });
  mkdirSync(join(out, 'landscape'), { recursive: true });
  const browser = await chromium.launch();

  // Вертикальные: логические 360×640, плотность подбирается под нужный размер файла.
  const pScale = portraitW / 360;
  const pHeight = Math.round(portraitH / pScale);
  const lScale = landscapeW / 1280;
  const lHeight = Math.round(landscapeH / lScale);

  const plan: [theme: string, levelId: number, share: number][] = [
    ['cozy', 12, 0.45],
    ['sky', 47, 0.4],
    ['sakura', 28, 0.42],
  ];
  let index = 1;
  for (const [theme, levelId, share] of plan) {
    const portrait = await open(browser, 360, pHeight, pScale, theme, levelId);
    await playSome(portrait, levelId, share);
    await portrait.screenshot({ path: join(out, 'portrait', `${String(index).padStart(2, '0')}-game-${theme}.png`) });
    await portrait.context().close();

    const landscape = await open(browser, 1280, lHeight, lScale, theme, levelId);
    await playSome(landscape, levelId, share);
    await landscape.screenshot({ path: join(out, 'landscape', `${String(index).padStart(2, '0')}-game-${theme}.png`) });
    await landscape.context().close();
    index++;
  }

  // Победа, список уровней и выбор тем — в основной теме.
  for (const [folder, width, height, scale] of [
    ['portrait', 360, pHeight, pScale],
    ['landscape', 1280, lHeight, lScale],
  ] as const) {
    const page = await open(browser, width, height, scale, 'cozy', 9);
    const data = level(9);
    await page.getByTestId('menu-play').click();
    await page.getByTestId('screen-game').waitFor();
    for (const word of data.words.slice(0, Math.ceil(data.words.length / 2))) {
      await typeLetters(page, word);
      await page.getByTestId('check').click();
      await page.waitForTimeout(60);
    }
    await page.getByTestId('win').waitFor();
    await page.waitForTimeout(1300);
    await page.screenshot({ path: join(out, folder, '04-win.png') });
    await page.getByTestId('win-more').click();
    await page.getByTestId('back').click();
    await page.getByTestId('menu-levels').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, folder, '05-levels.png') });
    await page.getByTestId('back').click();
    await page.getByTestId('menu-themes').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, folder, '06-themes.png') });
    await page.context().close();
  }

  await browser.close();
  console.log(`Скриншоты готовы: publish/screenshots (вертикальные ${portraitW}×${portraitH}, горизонтальные ${landscapeW}×${landscapeH})`);
} finally {
  server.kill();
}
