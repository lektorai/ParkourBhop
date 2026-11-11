# Слова из слова

Казуальная головоломка: игрок составляет слова из букв одного исходного слова. Одна кодовая база собирается
в веб-архив для **Яндекс Игр** и в Android-приложение для **RuStore**.

- 600 уровней (30 глав по 20), три темы оформления, подсказки, бонусные слова, ежедневный бонус.
- TypeScript + Vite + Preact, интерфейс на DOM и CSS, без игрового движка.
- Игра не обращается к SDK площадок напрямую: всё идёт через `PlatformAdapter` (`src/platform`).

Связанные документы: [DECISIONS.md](DECISIONS.md) — принятые решения, [LICENSES.md](LICENSES.md) — лицензии,
[ASSETS_TODO.md](ASSETS_TODO.md) — картинки, которые нужно сгенерировать, [publish/CHECKLIST.md](publish/CHECKLIST.md) —
что заполнить в консолях, [publish/texts-ru.md](publish/texts-ru.md) — тексты карточки.

## Быстрый старт

Нужен Node.js 20 или новее.

```bash
npm install
npm run dev          # игра на http://localhost:5173 с адаптером local (имитация рекламы и покупок)
```

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | Запуск для разработки (адаптер `local`) |
| `npm run check` | Проверка типов, ESLint и модульные тесты (Vitest) |
| `npm run e2e` | Сквозные тесты в браузере (Playwright, адаптер `local`) |
| `npm run levels` | Перегенерация уровней из словарей |
| `npm run build:yandex` | Сборка и проверка архива `dist/yandex.zip` для Яндекс Игр |
| `npm run build:rustore` | Сборка Android AAB и APK для RuStore в `dist/android/` |
| `npm run build:rustore -- --debug` | Отладочный APK с демо-рекламой (подпись не нужна) |
| `npm run screenshots` | Скриншоты для карточек в `publish/screenshots/` |
| `npm run icons` | Значки приложения из `assets/icon.png` (или временный значок) |

## Структура

```
src/
  platform/      PlatformAdapter и адаптеры: yandex.ts, rustore.ts, local.ts
  game/          чистая логика: буквы, проверка слов, звёзды, подсказки, экономика (без DOM)
  state/         состояние игры, сохранения, миграции, слияние с облаком
  ui/            экраны, компоненты, стили и темы
  audio/         звуки и музыка (синтез через Web Audio API)
  i18n/          ru.json, en.json
  config/        app.ts (название, пакет, версия), economy.ts, ads.ts
scripts/         build-dictionary.py, generate-levels.ts, build-yandex.ts, build-rustore.ts,
                 screenshots.ts, make-icons.ts
data/            словари и ручные списки (стоп-лист, короткие слова, первые уровни)
public/levels/   готовые уровни: chapter-NN.json и index.json
public/dict/     расширенный словарь для бонусных слов
android/         проект Capacitor и нативные плагины (реклама, платежи)
tests/, e2e/     модульные и сквозные тесты
publish/         тексты карточки, скриншоты, значок, чек-лист
reports/         levels.csv — все уровни для ручной проверки
```

Название игры, имя пакета и версия заданы в одном месте — `src/config/app.ts`. Оттуда их берут меню, заголовок
страницы и Android-проект. Все числа экономики — в `src/config/economy.ts`, правила показа рекламы — в `src/config/ads.ts`.

## Словарь и уровни

Уровни генерируются заранее, в игре только готовые данные.

- `data/dict/main.tsv` — основной словарь (15 000 слов с частотами), `data/dict/extended.txt` — расширенный (63 000 слов).
  Оба собраны скриптом `scripts/build-dictionary.py` из открытых источников (см. LICENSES.md).
- `data/blocklist.txt` — стоп-лист: слова, которых нет нигде, даже среди бонусных.
- `data/levels-exclude.txt` — слова «только бонусные»: игра их принимает, но в список уровня не ставит.
- `data/short-words.txt` — проверенные вручную слова из 3 и 4 букв, которые могут стоять в списке уровня.
- `data/source-exclude.txt` — слова, которые не берутся как исходное слово уровня.
- `data/first-levels.txt` — исходные слова первых пяти уровней, подобранные вручную.

Чтобы убрать или добавить слово, отредактируйте нужный файл и выполните:

```bash
npm run levels       # перегенерирует public/levels, public/dict и reports/levels.csv
npm run test         # проверит уровни
```

`reports/levels.csv` открывается в Excel или LibreOffice (разделитель — точка с запятой): номер, исходное слово,
число слов и все слова уровня.

> После релиза не перегенерируйте уже выпущенные уровни: прогресс игроков хранится по номерам слов в списке уровня.
> Новые уровни добавляйте в конец (увеличьте `levelCount` в `scripts/lib/levelgen.ts` и добавьте названия глав).

Пересборка самих словарей нужна редко (новые источники или правки стоп-листа, которые должны дойти до бонусных слов):

```bash
python3 -m venv .venv && .venv/bin/pip install pymorphy3 pymorphy3-dicts-ru
mkdir -p data/raw && cd data/raw
curl -LO https://raw.githubusercontent.com/Harrix/Russian-Nouns/main/dist/russian_nouns.txt
curl -LO https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_full.txt
cd ../.. && .venv/bin/python scripts/build-dictionary.py && npm run levels
```

## Сборка для Яндекс Игр

```bash
npm run build:yandex
```

Команда собирает игру с адаптером `yandex`, проверяет архив (есть `index.html` в корне, SDK подключён как `/sdk.js`,
нет абсолютных адресов и внешних запросов, имена файлов латиницей, размер) и пишет `dist/yandex.zip`.
Этот файл загружается в консоль Яндекс Игр. Дальше — по [publish/CHECKLIST.md](publish/CHECKLIST.md).

Проверка с настоящим SDK до загрузки в консоль:

```bash
npm run build:yandex
npx sdk-dev-proxy -p dist/yandex --dev-mode=true     # адрес игры появится в консоли
```

С параметром `--app-id=<ID игры>` вместо `--dev-mode` прокси подключается к черновику игры на Яндексе.

## Сборка для RuStore

Нужны JDK 21 и Android SDK (проще всего поставить Android Studio). Переменная `ANDROID_HOME` должна указывать на SDK.

1. Скопируйте `.env.example` в `.env` и впишите идентификаторы рекламных блоков Yandex Mobile Ads.
   Пока их нет, используются демо-блоки Яндекса.
2. Один раз создайте ключ подписи (он не попадает в git — сохраните файл и пароли в надёжном месте,
   без них нельзя будет выпускать обновления):

   ```bash
   keytool -genkeypair -v -keystore android/release.keystore -alias slova \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

   и файл `android/keystore.properties`:

   ```properties
   storeFile=release.keystore
   storePassword=ВАШ_ПАРОЛЬ
   keyAlias=slova
   keyPassword=ВАШ_ПАРОЛЬ
   ```

3. Соберите:

   ```bash
   npm run build:rustore
   ```

   В `dist/android/` появятся `slova-<версия>-nopay-release.aab` (для загрузки в RuStore) и APK для проверки на телефоне:
   `adb install dist/android/slova-<версия>-nopay-release.apk`.

Перед каждой новой загрузкой в RuStore увеличьте `APP_VERSION_CODE` в `src/config/app.ts`.

### Покупки в RuStore

По умолчанию сборка идёт без покупок (вариант `nopay`): платёжного SDK в приложении нет, магазин показывает только
монеты за рекламу. Чтобы включить покупки (нужен статус ИП или юрлица в RuStore Консоли):

1. Подключите монетизацию и заведите товары в RuStore Консоли (список — в publish/CHECKLIST.md).
2. В `.env` поставьте `PAYMENTS_ENABLED=true` и `RUSTORE_CONSOLE_APP_ID=<число из адреса приложения в консоли>`.
3. `npm run build:rustore` — соберётся вариант `pay` с Pay SDK RuStore.

## Свои фоны и значок

Фоны тем сейчас нарисованы CSS. Если положить картинки в `public/assets/themes/<тема>/bg-portrait.webp` (1080×1920)
и `bg-landscape.webp` (1920×1080), где `<тема>` — `cozy`, `sky` или `sakura`, при следующей сборке они заменят CSS-фон.
Значок: положите `assets/icon.png` (1024×1024) и выполните `npm run icons`. Промпты для генерации — в ASSETS_TODO.md.

## Тесты

- `npm run test` — Vitest: буквы с повторами, Ё = Е, повторный ввод, бонусные слова, звёзды, подсказки, экономика,
  сохранения, миграции и слияние, проверка всех 600 уровней, контраст цветов тем.
- `npm run e2e` — Playwright на сборке с адаптером `local`: обучение, прохождение уровня, перезагрузка, поворот экрана
  и размеры 360×640…1920×1080, реклама, покупки, темы, клавиатура, ежедневный бонус, отсутствие внешних запросов.

## Новая площадка

Чтобы добавить, например, VK Play: создайте `src/platform/vk.ts` с классом, реализующим `PlatformAdapter`,
добавьте ветку в `src/platform/index.ts` и значение в список площадок в `vite.config.ts`. Остальной код не меняется.
