/**
 * Сборка Android-приложения для RuStore одной командой: `npm run build:rustore`.
 *   1. Записывает название, имя пакета и версию из src/config/app.ts в Android-проект.
 *   2. Собирает веб-часть (PLATFORM=rustore) и копирует её внутрь приложения (cap sync).
 *   3. Собирает релизный AAB (и APK для проверки на телефоне).
 * Результат: dist/android/*.aab и *.apk.
 * Флаги: --debug — отладочный APK с демо-рекламой (подписывать не нужно).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { APP_ID, APP_NAME, APP_VERSION, APP_VERSION_CODE } from '../src/config/app';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
const debug = process.argv.includes('--debug');
const env = { ...loadEnv('production', root, ''), ...process.env };
const payments = env.PAYMENTS_ENABLED === 'true';
const flavor = payments ? 'pay' : 'nopay';

function run(command: string, args: string[], cwd = root, extraEnv: Record<string, string> = {}): void {
  console.log(`\n> ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
}

const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
if (!sdk || !existsSync(sdk)) {
  if (!existsSync(join(android, 'local.properties'))) {
    console.error('Не найден Android SDK. Установите Android Studio и задайте переменную ANDROID_HOME (см. README, раздел «Сборка для RuStore»).');
    process.exit(1);
  }
}
if (payments && !/^\d+$/.test(env.RUSTORE_CONSOLE_APP_ID ?? '')) {
  console.error('PAYMENTS_ENABLED=true, но не задан RUSTORE_CONSOLE_APP_ID (число из адреса приложения в RuStore Консоли).');
  process.exit(1);
}

// 1. Единый конфиг → Android-проект.
const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, "\\'");
writeFileSync(
  join(android, 'app-config.properties'),
  [
    '# Файл создаётся scripts/build-rustore.ts из src/config/app.ts и .env. Не редактируйте вручную.',
    `appId=${APP_ID}`,
    `versionCode=${APP_VERSION_CODE}`,
    `versionName=${APP_VERSION}`,
    `rustoreConsoleAppId=${env.RUSTORE_CONSOLE_APP_ID || '0'}`,
    '',
  ].join('\n'),
);
writeFileSync(
  join(android, 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
  `<?xml version='1.0' encoding='utf-8'?>
<!-- Файл создаётся scripts/build-rustore.ts из src/config/app.ts. Не редактируйте вручную. -->
<resources>
    <string name="app_name">${xml(APP_NAME)}</string>
    <string name="title_activity_main">${xml(APP_NAME)}</string>
    <string name="package_name">${APP_ID}</string>
    <string name="custom_url_scheme">${APP_ID}</string>
</resources>
`,
);

// 2. Веб-часть внутрь приложения.
run('npx', ['vite', 'build'], root, { PLATFORM: 'rustore' });
run('npx', ['cap', 'sync', 'android']);

// 3. Gradle.
const hasKeystore = existsSync(join(android, 'keystore.properties'));
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const Flavor = flavor[0]!.toUpperCase() + flavor.slice(1);
const tasks = debug ? [`assemble${Flavor}Debug`] : [`bundle${Flavor}Release`, `assemble${Flavor}Release`];
run(gradlew, [...tasks, '--no-daemon', '--console=plain'], android);

const out = join(root, 'dist', 'android');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const outputs = join(android, 'app', 'build', 'outputs');
const base = `slova-${APP_VERSION}-${flavor}`;
const copyFrom = (dir: string, extension: string, name: string) => {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(extension))) {
    copyFileSync(join(dir, file), join(out, name));
    console.log(`  ${join('dist', 'android', name)}`);
  }
};
console.log('\nГотово:');
if (debug) {
  copyFrom(join(outputs, 'apk', flavor, 'debug'), '.apk', `${base}-debug.apk`);
} else {
  copyFrom(join(outputs, 'bundle', `${flavor}Release`), '.aab', `${base}-release.aab`);
  copyFrom(join(outputs, 'apk', flavor, 'release'), '.apk', `${base}-release${hasKeystore ? '' : '-unsigned'}.apk`);
  if (!hasKeystore) {
    console.warn(
      '\nВнимание: нет файла android/keystore.properties — сборка НЕ ПОДПИСАНА и в RuStore не загрузится.\n' +
        'Создайте ключ подписи по инструкции из README и запустите команду ещё раз.',
    );
  }
}
console.log(`Покупки: ${payments ? 'включены (вариант pay)' : 'выключены (вариант nopay)'}`);
