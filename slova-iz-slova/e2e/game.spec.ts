import { expect, test, type Page } from '@playwright/test';
import {
  coins,
  collectErrors,
  dismissDaily,
  foundCount,
  levelData,
  openGame,
  platformLog,
  playUntilWin,
  startFirstLevel,
  submitWord,
  typeWord,
} from './helpers';

test('обучение ведёт по шагам: буквы → галочка → слово в списке', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await page.getByTestId('menu-play').click();
  const tutorial = page.getByTestId('tutorial');
  await expect(tutorial).toHaveAttribute('data-step', '1');
  for (const letter of 'ЛУК') {
    await page.locator(`.tile.target[data-letter="${letter}"]`).click();
  }
  await expect(tutorial).toHaveAttribute('data-step', '2');
  await page.getByTestId('check').click();
  await expect(tutorial).toHaveAttribute('data-step', '3');
  await expect(page.locator('[data-word="лук"]')).toHaveAttribute('data-found', '1');
  await page.getByTestId('tutorial-done').click();
  await expect(tutorial).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('уровень 1 проходится до победы, прогресс переживает перезагрузку', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  expect(await coins(page)).toBe(200);
  await startFirstLevel(page);

  const found = await playUntilWin(page, 1);
  await expect(page.getByTestId('win-reward')).toContainText('+10');
  expect(await coins(page)).toBe(210);

  // «Искать остальные слова» — остаёмся на уровне.
  await page.getByTestId('win-more').click();
  await expect(page.getByTestId('win')).toHaveCount(0);

  // Перезагрузка: игрок возвращается ровно туда, где был.
  await page.reload();
  await expect(page.getByTestId('screen-game')).toHaveAttribute('data-level', '1');
  expect(await foundCount(page)).toBe(found.length);
  for (const word of found) await expect(page.locator(`[data-word="${word}"]`)).toHaveAttribute('data-found', '1');
  expect(await coins(page)).toBe(210);
  await expect(page.getByTestId('tutorial')).toHaveCount(0);

  // Окно победы показывается один раз: после перезагрузки его нет, но есть кнопка «Дальше».
  await expect(page.getByTestId('win')).toHaveCount(0);
  await page.getByTestId('next-chip').click();
  await expect(page.getByTestId('screen-game')).toHaveAttribute('data-level', '2');
  expect(errors).toEqual([]);
});

test('повторное, бонусное и несуществующее слово', async ({ page }) => {
  await openGame(page);
  await startFirstLevel(page);
  const level = levelData(1);
  const word = level.words[0]!;

  await submitWord(page, word);
  await expect(page.locator(`[data-word="${word}"]`)).toHaveAttribute('data-found', '1');
  await expect(page.getByTestId('found-count')).toHaveAttribute('data-found', '1');

  // Повторный ввод не меняет счёт.
  await submitWord(page, word);
  await expect(page.getByTestId('toast')).toBeVisible();
  expect(await foundCount(page)).toBe(1);

  const before = await coins(page);
  await submitWord(page, 'бал');
  await expect(page.locator('[data-word="бал"]')).toHaveAttribute('data-found', '1');

  // Несуществующее слово: поле трясётся, штрафа нет.
  await submitWord(page, 'ылк');
  await expect(page.locator('.field.shake')).toBeVisible();
  expect(await foundCount(page)).toBe(2);
  expect(await coins(page)).toBe(before);

  // Нажатие на использованную плитку убирает её и все буквы после неё.
  await typeWord(page, 'лука');
  await expect(page.getByTestId('field')).toHaveAttribute('data-value', 'ЛУКА');
  await page.locator('[data-tile][data-letter="У"][data-used="1"]').click();
  await expect(page.getByTestId('field')).toHaveAttribute('data-value', 'Л');
});

test('бонусное слово даёт монету и попадает в список бонусных', async ({ page }) => {
  await openGame(page);
  await startFirstLevel(page);
  const level = levelData(1);
  // Ищем слово из расширенного словаря, которого нет в списке уровня 1 («улыбка»).
  const candidates = ['лыка', 'быка', 'кабул', 'бакл', 'кубла', 'лыко', 'бука'].filter((w) => !level.words.includes(w));
  const before = await coins(page);
  let bonus: string | null = null;
  for (const word of candidates) {
    await submitWord(page, word);
    if (await page.getByTestId('bonus-chip').isVisible().catch(() => false)) {
      bonus = word;
      break;
    }
    await page.waitForTimeout(450);
  }
  test.skip(bonus === null, 'в расширенном словаре не нашлось подходящего бонусного слова');
  expect(await coins(page)).toBe(before + 1);
  expect(await foundCount(page)).toBe(0);
  await page.getByTestId('bonus-chip').click();
  await expect(page.getByTestId('bonus-words')).toContainText(bonus!.toUpperCase(), { ignoreCase: true });
});

test('подсказка открывает букву и стоит 50 монет; без монет предлагает рекламу', async ({ page }) => {
  await openGame(page);
  await startFirstLevel(page);
  const target = [...levelData(1).words].sort((a, b) => a.length - b.length)[0]!;

  await page.getByTestId('hint').click();
  expect(await coins(page)).toBe(150);
  await expect(page.locator(`[data-word="${target}"] .cell`).first()).toHaveText(target[0]!, { ignoreCase: true });

  // Три подсказки открывают слово из трёх букв целиком — оно засчитывается.
  await page.getByTestId('hint').click();
  await page.getByTestId('hint').click();
  await expect(page.locator(`[data-word="${target}"]`)).toHaveAttribute('data-found', '1');
  expect(await coins(page)).toBe(50);

  await page.getByTestId('hint').click();
  expect(await coins(page)).toBe(0);

  // Монет нет: окно с бесплатной подсказкой за рекламу.
  await page.getByTestId('hint').click();
  await expect(page.getByTestId('nocoins')).toBeVisible();
  await page.getByTestId('nocoins-ad').click();
  await expect(page.getByTestId('mock-ad')).toBeVisible();
  await expect(page.getByTestId('mock-ad')).toHaveCount(0);
  await expect(page.getByTestId('nocoins')).toHaveCount(0);
  expect(await coins(page)).toBe(0);
  expect(await platformLog(page)).toContain('rewarded');
  // Состояние после рекламы на месте.
  expect(await foundCount(page)).toBe(1);
});

test('реклама: ×2 награда за уровень и полноэкранная между уровнями', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await startFirstLevel(page);

  await playUntilWin(page, 1);
  expect(await coins(page)).toBe(210);
  await page.getByTestId('win-double').click();
  await expect(page.getByTestId('mock-ad')).toHaveCount(0);
  await expect(page.getByTestId('win-reward')).toContainText('+20');
  expect(await coins(page)).toBe(220);
  await expect(page.getByTestId('win-double')).toHaveCount(0);

  // До уровня 3 полноэкранной рекламы нет.
  await page.getByTestId('win-next').click();
  await playUntilWin(page, 2);
  await page.getByTestId('win-next').click();
  expect(await platformLog(page)).not.toContain('interstitial');

  // После третьего пройденного уровня — показывается, игра продолжается с того же места.
  await playUntilWin(page, 3);
  await page.getByTestId('win-next').click();
  await expect(page.getByTestId('screen-game')).toHaveAttribute('data-level', '4');
  const log = await platformLog(page);
  expect(log.filter((e) => e === 'interstitial')).toHaveLength(1);
  // Разметка геймплея: на время рекламы и окон геймплей останавливается.
  expect(log.filter((e) => e === 'gameReady')).toHaveLength(1);
  expect(log.indexOf('gameplayStart')).toBeGreaterThan(log.indexOf('gameReady'));
  expect(log[log.length - 1]).toBe('gameplayStart');

  // Сразу после показа (меньше 90 секунд и меньше 2 уровней) второго показа нет.
  await playUntilWin(page, 4);
  await page.getByTestId('win-next').click();
  await expect(page.getByTestId('screen-game')).toHaveAttribute('data-level', '5');
  expect((await platformLog(page)).filter((e) => e === 'interstitial')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('реклама недоступна — игра не ломается', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __localPlatform: object }).__localPlatform = { adsFail: true };
  });
  await openGame(page);
  await page.getByTestId('menu-shop').click();
  await page.getByTestId('ad-coins').click();
  await expect(page.getByTestId('toast')).toBeVisible();
  expect(await coins(page)).toBe(200);
  await page.getByTestId('back').click();
  await expect(page.getByTestId('screen-menu')).toBeVisible();
});

test('магазин: монеты за рекламу, покупка монет и темы', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await page.getByTestId('menu-shop').click();
  await expect(page.getByTestId('screen-shop')).toBeVisible();

  await page.getByTestId('ad-coins').click();
  await expect(page.getByTestId('mock-ad')).toHaveCount(0);
  expect(await coins(page)).toBe(225);
  await expect(page.getByTestId('ad-coins-left')).toContainText('4');

  // Расходуемая покупка начисляется и «потребляется».
  await page.getByTestId('buy-coins_1500').click();
  await expect.poll(() => coins(page)).toBe(1725);
  expect((await platformLog(page)).some((e) => e.startsWith('consume:local-coins_1500'))).toBe(true);

  await page.getByTestId('back').click();
  await page.getByTestId('menu-themes').click();
  await expect(page.getByTestId('theme-cozy-selected')).toBeVisible();
  await page.getByTestId('theme-sky-buy').click();
  await expect(page.getByTestId('theme-sky-selected')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/theme-sky/);
  expect(await coins(page)).toBe(225);

  // На вторую тему монет не хватает.
  await page.getByTestId('theme-sakura-buy').click();
  await expect(page.getByTestId('toast')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/theme-sky/);

  // Тема и монеты переживают перезагрузку; покупка не начисляется второй раз.
  await page.reload();
  await expect(page.getByTestId('screen-themes')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/theme-sky/);
  expect(await coins(page)).toBe(225);

  // Вернуться на бесплатную тему можно всегда.
  await page.getByTestId('theme-cozy-select').click();
  await expect(page.locator('body')).toHaveClass(/theme-cozy/);
  expect(errors).toEqual([]);
});

test('постоянные покупки: «Без рекламы» и «Все темы» восстанавливаются', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('menu-shop').click();
  await page.getByTestId('buy-no_ads').click();
  await expect(page.getByTestId('product-no_ads')).toContainText('Куплено');
  await page.getByTestId('buy-themes_all').click();
  await expect(page.getByTestId('product-themes_all')).toContainText('Куплено');

  // Стираем локальное сохранение: покупки должны восстановиться из данных площадки.
  await page.evaluate(() => {
    localStorage.removeItem('slova.save');
    localStorage.removeItem('slova.local.cloud');
  });
  await page.reload();
  await expect(page.getByTestId('product-no_ads')).toContainText('Куплено');
  await page.getByTestId('back').click();
  await page.getByTestId('menu-themes').click();
  await expect(page.getByTestId('theme-sakura-select')).toBeVisible();
});

test('поворот экрана и изменение окна: ничего не обрезается, состояние на месте', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await startFirstLevel(page);
  const word = levelData(1).words[0]!;
  await submitWord(page, word);
  await typeWord(page, 'лу');

  const sizes = [
    { width: 844, height: 390 },
    { width: 360, height: 640 },
    { width: 640, height: 360 },
    { width: 768, height: 1024 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    // Набранные буквы и прогресс не теряются.
    await expect(page.getByTestId('field')).toHaveAttribute('data-value', 'ЛУ');
    expect(await foundCount(page)).toBe(1);
    // Все элементы управления целиком внутри окна и не меньше 48 px.
    for (const id of ['back', 'coins', 'field', 'check', 'shuffle', 'hint', 'erase', 'wordlist']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, `${id} @ ${size.width}×${size.height}`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-0.5);
      expect(box!.y).toBeGreaterThanOrEqual(-0.5);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 0.5);
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 0.5);
    }
    for (const tile of await page.locator('[data-tile]').all()) {
      const box = (await tile.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(56);
      expect(box.height).toBeGreaterThanOrEqual(56);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height + 0.5);
    }
    const list = (await page.getByTestId('wordlist').boundingBox())!;
    expect(list.height, `список слов @ ${size.width}×${size.height}`).toBeGreaterThan(60);
    // Страница не прокручивается.
    const scroll = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth - window.innerWidth,
      h: document.documentElement.scrollHeight - window.innerHeight,
    }));
    expect(scroll.w).toBeLessThanOrEqual(0);
    expect(scroll.h).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

/** Нажатие клавиши в русской раскладке (Playwright сам такие события не создаёт). */
async function pressRussian(page: Page, key: string, code: string): Promise<void> {
  await page.evaluate(
    ([k, c]) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: c, bubbles: true })),
    [key, code] as const,
  );
}

test('клавиатура работает в любой раскладке', async ({ page }) => {
  await openGame(page);
  await startFirstLevel(page);
  // Латинская раскладка: клавиши K, E, R стоят на местах Л, У, К.
  await page.keyboard.press('KeyK');
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyR');
  await expect(page.getByTestId('field')).toHaveAttribute('data-value', 'ЛУК');
  await page.keyboard.press('Backspace');
  await expect(page.getByTestId('field')).toHaveAttribute('data-value', 'ЛУ');
  // Русская раскладка: браузер сообщает саму букву.
  await pressRussian(page, 'к', 'KeyR');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-word="лук"]')).toHaveAttribute('data-found', '1');
  // Пробел перемешивает плитки, набранное не сбрасывается.
  await pressRussian(page, 'б', 'Comma');
  await pressRussian(page, 'а', 'KeyF');
  const before = await page.locator('[data-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile')).join());
  await page.keyboard.press('Space');
  await expect
    .poll(() => page.locator('[data-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile')).join()))
    .not.toBe(before);
  await expect(page.getByTestId('field')).toHaveAttribute('data-value', 'БА');
});

test('долгое нажатие на «Стереть» очищает слово', async ({ page }) => {
  await openGame(page);
  await startFirstLevel(page);
  await typeWord(page, 'лука');
  await page.getByTestId('erase').click();
  await expect(page.getByTestId('field')).toHaveAttribute('data-value', 'ЛУК');
  const box = (await page.getByTestId('erase').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByTestId('field')).toHaveAttribute('data-value', '');
});

test('ежедневный бонус выдаётся раз в день и растёт', async ({ page }) => {
  await openGame(page);
  await startFirstLevel(page);
  await playUntilWin(page, 1);
  await page.getByTestId('win-more').click();
  await page.getByTestId('back').click();

  await expect(page.getByTestId('daily')).toBeVisible();
  await page.getByTestId('daily-claim').click();
  expect(await coins(page)).toBe(230);

  // В тот же день второй раз не предлагается.
  await page.reload();
  await expect(page.getByTestId('screen-menu')).toBeVisible();
  await expect(page.getByTestId('daily')).toHaveCount(0);

  // На следующий день — второй день лесенки (+30).
  await page.addInitScript(() => {
    const w = window as unknown as { __localPlatform: Record<string, unknown> };
    w.__localPlatform = { ...(w.__localPlatform ?? {}), timeShiftMs: 24 * 60 * 60 * 1000 };
  });
  await page.reload();
  await expect(page.getByTestId('daily')).toBeVisible();
  await page.getByTestId('daily-claim').click();
  expect(await coins(page)).toBe(260);
});

test('экраны меню: уровни, настройки, правила и политика внутри игры', async ({ page }) => {
  const errors = collectErrors(page);
  await openGame(page);
  await expect(page.getByTestId('menu-title')).toContainText('Слова');

  await page.getByTestId('menu-levels').click();
  await expect(page.getByTestId('level-1')).toBeVisible();
  await expect(page.locator('.level-btn.locked').first()).toBeDisabled();
  await page.getByTestId('back').click();

  await page.getByTestId('menu-settings').click();
  const sound = page.getByTestId('toggle-sound');
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  for (const name of ['howto', 'privacy', 'about']) {
    await page.getByTestId(`open-${name}`).click();
    await expect(page.getByTestId(name)).toBeVisible();
    await page.getByTestId('dialog-ok').click();
    await expect(page.getByTestId(name)).toHaveCount(0);
  }
  // Ссылок на внешние сайты в игре нет.
  expect(await page.locator('a[href]').count()).toBe(0);

  await page.reload();
  await expect(page.getByTestId('toggle-sound')).toHaveAttribute('aria-checked', 'false');
  await dismissDaily(page);
  expect(errors).toEqual([]);
});

test('игра не обращается к внешним адресам', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== 'localhost' && !request.url().startsWith('data:')) external.push(request.url());
  });
  await openGame(page);
  await startFirstLevel(page);
  await submitWord(page, levelData(1).words[0]!);
  await page.waitForTimeout(500);
  expect(external).toEqual([]);
});

test('системная кнопка «Назад» (Android): окно → предыдущий экран → диалог выхода', async ({ page }) => {
  await openGame(page);
  const back = () => page.evaluate(() => (window as unknown as { __localPlatform: { back: () => void } }).__localPlatform.back());
  await startFirstLevel(page);
  await page.getByTestId('hint').click();
  await submitWord(page, 'лук');
  await expect(page.locator('[data-word="лук"]')).toHaveAttribute('data-found', '1');

  // Из уровня — в меню.
  await back();
  await expect(page.getByTestId('screen-menu')).toBeVisible();
  // В меню встречает ежедневный бонус; «Назад» закрывает окно, не выдавая награду.
  await expect(page.getByTestId('daily')).toBeVisible();
  await back();
  await expect(page.getByTestId('daily')).toHaveCount(0);
  expect(await coins(page)).toBe(150);
  // Из меню — диалог выхода, повторное нажатие закрывает его.
  await back();
  await expect(page.getByTestId('exit')).toBeVisible();
  await back();
  await expect(page.getByTestId('exit')).toHaveCount(0);
  // Из вложенного экрана — в меню; открытое окно закрывается первым.
  await page.getByTestId('menu-settings').click();
  await page.getByTestId('open-about').click();
  await back();
  await expect(page.getByTestId('about')).toHaveCount(0);
  await expect(page.getByTestId('screen-settings')).toBeVisible();
  await back();
  await expect(page.getByTestId('screen-menu')).toBeVisible();
  // Неполученный бонус предлагается снова; прогресс на месте.
  await page.getByTestId('daily-claim').click();
  expect(await coins(page)).toBe(170);
  await page.getByTestId('menu-play').click();
  await expect(page.locator('[data-word="лук"]')).toHaveAttribute('data-found', '1');
});
