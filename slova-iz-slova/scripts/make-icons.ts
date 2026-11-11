/**
 * Рисует временный значок игры (деревянные плитки с буквами) и раскладывает его по размерам:
 *   android/app/src/main/res/mipmap-*   — значки приложения и слой adaptive icon;
 *   android/app/src/main/res/drawable/splash_icon.png — значок на нативном сплэше;
 *   publish/icon-512.png               — значок для карточки (временный, см. ASSETS_TODO.md).
 * Запуск: `npm run icons`. Чтобы поставить свой значок, положите PNG 1024×1024 в assets/icon.png
 * (и при желании assets/icon-foreground.png с прозрачным фоном) и запустите команду ещё раз.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const font = readFileSync(join(root, 'src', 'assets', 'fonts', 'nunito-cyrillic.woff2')).toString('base64');
const customIcon = join(root, 'assets', 'icon.png');
const customForeground = join(root, 'assets', 'icon-foreground.png');
const dataUrl = (path: string) => `data:image/png;base64,${readFileSync(path).toString('base64')}`;

function tile(x: number, y: number, size: number, angle: number, letter: string): string {
  const r = size * 0.2;
  const cx = x + size / 2;
  const cy = y + size / 2;
  return `
  <g transform="rotate(${angle} ${cx} ${cy})">
    <rect x="${x}" y="${y + size * 0.09}" width="${size}" height="${size}" rx="${r}" fill="#9c6226"/>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="url(#wood)"/>
    <rect x="${x + size * 0.04}" y="${y + size * 0.03}" width="${size * 0.92}" height="${size * 0.5}" rx="${r * 0.8}" fill="#fff0cf" opacity=".28"/>
    <text x="${cx}" y="${cy + size * 0.23}" font-family="Nunito" font-weight="900" font-size="${size * 0.66}" text-anchor="middle" fill="#40220e">${letter}</text>
  </g>`;
}

/** Плитки «С» и «Л». scale < 1 — уменьшенный вариант для безопасной зоны adaptive icon. */
function artwork(scale: number): string {
  const shift = (512 * (1 - scale)) / 2;
  return `<g transform="translate(${shift} ${shift}) scale(${scale})">
    <ellipse cx="256" cy="430" rx="190" ry="26" fill="#4a2a12" opacity=".14"/>
    ${tile(236, 96, 200, 11, 'Л')}
    ${tile(74, 170, 250, -8, 'С')}
  </g>`;
}

function svg(options: { background: boolean; scale: number }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f0c27e"/><stop offset="1" stop-color="#c9873d"/>
    </linearGradient>
    <radialGradient id="paper" cx="0.3" cy="0.2" r="1">
      <stop offset="0" stop-color="#fdf5e4"/><stop offset="0.6" stop-color="#f3e6cf"/><stop offset="1" stop-color="#e3caa2"/>
    </radialGradient>
  </defs>
  ${options.background ? '<rect width="512" height="512" fill="url(#paper)"/><path d="M-10 -10C120 20 190 110 200 230 80 210 -5 120 -10 -10z" fill="#5e8f62" opacity=".35"/><path d="M522 522c-110-18-180-90-196-196 110 14 184 90 196 196z" fill="#5e8f62" opacity=".3"/>' : ''}
  ${artwork(options.scale)}
</svg>`;
}

function page(content: string, size: number, round: boolean): string {
  return `<!doctype html><html><head><style>
    @font-face { font-family: 'Nunito'; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 200 1000; }
    html, body { margin: 0; background: transparent; }
    #icon { width: ${size}px; height: ${size}px; overflow: hidden; ${round ? 'border-radius: 50%;' : ''} }
    #icon img, #icon svg { display: block; width: 100%; height: 100%; }
  </style></head><body><div id="icon">${content}</div></body></html>`;
}

const full = existsSync(customIcon) ? `<img src="${dataUrl(customIcon)}">` : svg({ background: true, scale: 1 });
const foreground = existsSync(customForeground)
  ? `<img src="${dataUrl(customForeground)}">`
  : existsSync(customIcon)
    ? `<div style="padding:19%;box-sizing:border-box;width:100%;height:100%"><img src="${dataUrl(customIcon)}" style="border-radius:18%"></div>`
    : svg({ background: false, scale: 0.6 });

interface Job {
  file: string;
  size: number;
  content: string;
  round?: boolean;
}

const res = join(root, 'android', 'app', 'src', 'main', 'res');
const densities: [string, number][] = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];
const jobs: Job[] = [
  { file: join(root, 'publish', 'icon-512.png'), size: 512, content: full },
  { file: join(res, 'drawable', 'splash_icon.png'), size: 432, content: foreground },
];
for (const [name, factor] of densities) {
  jobs.push({ file: join(res, `mipmap-${name}`, 'ic_launcher.png'), size: 48 * factor, content: full });
  jobs.push({ file: join(res, `mipmap-${name}`, 'ic_launcher_round.png'), size: 48 * factor, content: full, round: true });
  jobs.push({ file: join(res, `mipmap-${name}`, 'ic_launcher_foreground.png'), size: 108 * factor, content: foreground });
}

const browser = await chromium.launch();
const tab = await browser.newPage({ deviceScaleFactor: 1 });
for (const job of jobs) {
  mkdirSync(dirname(job.file), { recursive: true });
  await tab.setViewportSize({ width: Math.ceil(job.size), height: Math.ceil(job.size) });
  await tab.setContent(page(job.content, job.size, Boolean(job.round)));
  await tab.evaluate(() => document.fonts.ready);
  await tab.locator('#icon').screenshot({ path: job.file, omitBackground: true });
}
await browser.close();
console.log(`Значки готовы: ${jobs.length} файлов${existsSync(customIcon) ? ' (из assets/icon.png)' : ' (временный значок)'}`);
