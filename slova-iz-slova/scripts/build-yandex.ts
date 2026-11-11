/**
 * Сборка архива для консоли Яндекс Игр одной командой: `npm run build:yandex`.
 * Собирает игру (PLATFORM=yandex), проверяет требования к архиву и пишет dist/yandex.zip.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, type Zippable } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist', 'yandex');
const zipPath = join(root, 'dist', 'yandex.zip');

/** Пункт 1.21 требований: не больше 100 МБ в разархивированном виде. ТЗ: весь архив — до 20 МБ. */
const MAX_UNPACKED = 100 * 1024 * 1024;
const MAX_ZIP = 20 * 1024 * 1024;
/** До меню грузится не больше 3 МБ (ТЗ, раздел 4). */
const MAX_INITIAL = 3 * 1024 * 1024;

execFileSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, PLATFORM: 'yandex' } });

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(dist);
const problems: string[] = [];
const archive: Zippable = {};
let unpacked = 0;

for (const file of files) {
  const name = relative(dist, file).split('\\').join('/');
  // Пункт 1.22: в названиях файлов и папок нет пробелов и русских символов.
  if (!/^[A-Za-z0-9._\-/]+$/.test(name)) problems.push(`недопустимое имя файла: ${name}`);
  const data = readFileSync(file);
  unpacked += data.length;
  archive[name] = [data, { level: 9 }];
}

const names = new Set(Object.keys(archive));
if (!names.has('index.html')) problems.push('в корне архива нет index.html');

const html = names.has('index.html') ? readFileSync(join(dist, 'index.html'), 'utf8') : '';
// Пункт 1.19.1: SDK подключается относительным путём /sdk.js, без абсолютного адреса хранилища.
if (!html.includes('<script src="/sdk.js"></script>')) problems.push('в index.html нет <script src="/sdk.js"></script>');
const texts = files.filter((f) => /\.(html|js|css|json)$/.test(f)).map((f) => [f, readFileSync(f, 'utf8')] as const);
for (const [file, text] of texts) {
  const name = relative(dist, file);
  if (/games\.s3\.yandex\.net/.test(text)) problems.push(`абсолютный адрес хранилища Яндекса в ${name} (пункт 1.7)`);
  // Никаких внешних запросов, кроме SDK площадки: шрифты, звуки и данные лежат в сборке.
  const external = text.match(/(?:src|href)=["']https?:\/\/[^"']+|url\(["']?https?:\/\/[^)"']+|fetch\(["']https?:\/\/[^"']+/g);
  if (external) problems.push(`внешний адрес в ${name}: ${external[0]}`);
}
// Все локальные ссылки из index.html — относительные.
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = match[1]!;
  if (url === '/sdk.js' || url.startsWith('data:')) continue;
  if (url.startsWith('/') || /^https?:/.test(url)) problems.push(`неотносительный путь в index.html: ${url}`);
}

// Начальная загрузка: index.html и всё, на что он ссылается напрямую, плюс шрифты.
const initial = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map((m) => m[1]!).filter((n) => names.has(n));
const fonts = [...names].filter((n) => n.endsWith('.woff2'));
const initialSize = ['index.html', ...initial, ...fonts].reduce((sum, name) => sum + statSync(join(dist, name)).size, 0);
if (initialSize > MAX_INITIAL) problems.push(`до меню грузится ${(initialSize / 1024 / 1024).toFixed(2)} МБ, допустимо 3 МБ`);
if (unpacked > MAX_UNPACKED) problems.push(`размер файлов ${(unpacked / 1024 / 1024).toFixed(1)} МБ больше 100 МБ`);

const zip = zipSync(archive);
if (zip.length > MAX_ZIP) problems.push(`архив ${(zip.length / 1024 / 1024).toFixed(1)} МБ больше 20 МБ`);

if (problems.length) {
  console.error('\nАрхив не прошёл проверки:');
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

writeFileSync(zipPath, zip);
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} МБ`;
console.log(`\ndist/yandex.zip готов: ${files.length} файлов, ${mb(zip.length)} (распакованный размер ${mb(unpacked)})`);
console.log(`До меню грузится ${(initialSize / 1024).toFixed(0)} КБ. Проверки имён файлов, путей и подключения SDK пройдены.`);
