# Лицензии

Это сводка лицензий сторонних материалов в игре. Она не заменяет юридическую консультацию.

## Словарь

Списки слов игры (`data/dict/`, `public/dict/`, `public/levels/`, `reports/levels.csv`) получены из трёх открытых источников.

| Источник | Что взято | Лицензия | Адрес |
| --- | --- | --- | --- |
| OpenCorpora, морфологический словарь (сборка `pymorphy3-dicts-ru` 2.4.417150) | часть речи, начальная форма, пометы слов | CC BY-SA 3.0 | https://opencorpora.org · https://github.com/no-plagiarism/pymorphy3-dicts |
| Russian-Nouns, © 2018 Антон Сергиенко (Harrix) | список нарицательных существительных | MIT | https://github.com/Harrix/Russian-Nouns |
| FrequencyWords, Hermit Dave — `content/2018/ru/ru_full.txt` (по корпусу OpenSubtitles 2018) | частоты словоформ | CC BY-SA 4.0 (данные) | https://github.com/hermitdave/FrequencyWords |

Все три лицензии разрешают коммерческое использование. CC BY-SA требует указать авторов и распространять производные
данные на тех же условиях, поэтому:

- **списки слов игры распространяются на условиях CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/deed.ru);
  CC BY-SA 3.0 допускает переход на более позднюю версию той же лицензии;
- атрибуция показана в игре: «Настройки → Об игре» (без адресов сайтов — их запрещают требования Яндекс Игр, пункт 8.4.2);
- что изменено: из источников отобраны нарицательные существительные в начальной форме, Ё заменена на Е, убраны слова
  из стоп-листа, слова ранжированы по частоте и разложены по уровням.

Условие «на тех же условиях» относится к спискам слов. Программный код игры — отдельное произведение.

Текст лицензии MIT для Russian-Nouns:

> Copyright © 2018-present Sergienko Anton
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
> documentation files (the “Software”), to deal in the Software without restriction, including without limitation the
> rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
> persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
> WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Шрифт

**Nunito** — © 2014 The Nunito Project Authors (Vernon Adams, Cyreal, Jacques Le Bailly), https://github.com/googlefonts/nunito.
Лицензия SIL Open Font License 1.1; полный текст — `src/assets/fonts/OFL.txt`. Файлы шрифта лежат в сборке
(`src/assets/fonts/*.woff2`, взяты из пакета `@fontsource-variable/nunito`), с Google Fonts игра ничего не загружает.

## Звуки и музыка

Все звуки и фоновая мелодия синтезируются кодом (`src/audio/engine.ts`) через Web Audio API. Сторонних записей нет.

## Графика

Плитки, кнопки, панели, фоны тем и иконки интерфейса нарисованы CSS и SVG в этом проекте. Сторонних изображений нет.
Временный значок приложения рисует `scripts/make-icons.ts`.

## Библиотеки в сборке

| Библиотека | Где используется | Лицензия |
| --- | --- | --- |
| Preact | обе сборки | MIT |
| Capacitor (core, android, app, haptics, preferences) | сборка RuStore | MIT |
| AndroidX (appcompat, core-splashscreen и др.) | сборка RuStore | Apache 2.0 |
| Yandex Mobile Ads SDK 8.6.0 | сборка RuStore | лицензионное соглашение Яндекса (условия использования Mobile Ads SDK) |
| Pay SDK RuStore (BOM 2026.10.01) | сборка RuStore, вариант `pay` | условия использования RuStore SDK |
| SDK Яндекс Игр | сборка Яндекс Игр, подключается с площадки | условия Яндекс Игр |

Инструменты разработки (Vite, TypeScript, Vitest, Playwright, ESLint, fflate, tsx, pymorphy3) в игру не попадают.
