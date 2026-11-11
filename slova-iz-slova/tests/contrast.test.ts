/** Контраст текста во всех темах не ниже WCAG AA (4.5:1). Цвета читаются прямо из themes.css. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', 'src', 'ui', 'styles', 'themes.css'), 'utf8');

function themeVars(theme: string): Record<string, string> {
  const block = css.split(`.theme-${theme} {`)[1]?.split('\n}')[0] ?? '';
  const vars: Record<string, string> = {};
  for (const match of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[match[1]!] = match[2]!.trim();
  return vars;
}

function rgb(color: string): [number, number, number] {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const fn = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  throw new Error(`Не удалось разобрать цвет: ${color}`);
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Пары «текст / фон под ним». Для градиента плитки берётся более тёмный и более светлый край. */
const PAIRS: [string, string][] = [
  ['text', 'page'],
  ['text-soft', 'page'],
  ['text', 'panel'],
  ['text-soft', 'panel'],
  ['text', 'dialog'],
  ['text-soft', 'dialog'],
  ['text', 'panel-inset'],
  ['accent-text', 'accent'],
  ['tile-text', 'tile-top'],
  ['tile-text', 'tile-bottom'],
  ['group-head-text', 'group-head'],
  ['input-text', 'input'],
  ['input-placeholder', 'input'],
  ['coin-pill-text', 'coin-pill'],
  ['toast-text', 'toast'],
  ['slot-hint', 'slot'],
  ['accent', 'panel'],
];

describe.each(['cozy', 'sky', 'sakura'])('тема %s', (theme) => {
  const vars = themeVars(theme);
  it.each(PAIRS)('%s на %s — не ниже 4.5:1', (fg, bg) => {
    expect(vars[fg], `нет переменной --${fg}`).toBeDefined();
    expect(vars[bg], `нет переменной --${bg}`).toBeDefined();
    const ratio = contrast(vars[fg]!, vars[bg]!);
    expect(ratio, `${fg} ${vars[fg]} на ${bg} ${vars[bg]}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });
});
