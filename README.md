# Японские кроссворды: Нонограммы

Офлайн-головоломка для Android (RuStore) на Godot 4.4: бесконечные
процедурные нонограммы 5×5 / 10×10 / 15×15, головоломка дня, галерея из
38 рисованных картинок, подсказки, звёзды, статистика, тёмная тема, RU/EN.

Продукт спроектирован под быстрый выход в RuStore и стабильный небольшой
доход: нет сервера и контент-пайплайна, генератор гарантирует решаемость
чистой логикой, точки монетизации (rewarded/interstitial реклама, покупка
«Убрать рекламу») уже встроены и включаются установкой SDK.

## Структура

```
project.godot            настройки проекта (портрет 720×1280, GL Compatibility)
export_presets.cfg       пресеты Android APK / AAB
monetization_config.gd   id рекламы, продукты, частота показов
autoload/                SaveData, I18n, Ui (тема), Sfx, Ads, Billing, Session
core/                    Nonogram, LineSolver, NonogramSolver, NonogramGenerator, BoardModel, Pictures
scenes/                  main_menu, level_select, game (+ board_view), gallery, stats, settings
tests/run_tests.gd       headless-тесты (решатель, генератор, картинки, сохранения, сцены)
tools/                   генерация иконок/звуков, скриншоты, проверка картинок
store/                   иконка, скриншоты, тексты карточки, PUBLISH.md
docs/privacy.html        политика конфиденциальности (GitHub Pages)
legacy/                  прежний прототип ParkourBhop (zip)
```

## Запуск и проверка

```bash
# импорт ресурсов (обязательно первый раз и в CI)
godot --headless --path . --import
# тесты
godot --headless --path . --script tests/run_tests.gd
# запуск игры на ПК (мышь эмулирует касания)
godot --path .
# скриншоты для стора (нужен дисплей или xvfb)
xvfb-run -a -s "-screen 0 720x1280x24" godot --path . --rendering-driver opengl3 --script tools/screenshots.gd
# проверить, что все картинки галереи решаются логикой
godot --headless --path . --script tools/check_pictures.gd
```

Сборка APK/AAB — через GitHub Actions (`.github/workflows/build-android.yml`)
или локально с Android SDK + JDK 17. Публикация — см. `store/PUBLISH.md`.

## Как добавить картинку в галерею

В `core/pictures.gd` добавьте элемент `{"id": "...", "rows": [...]}` (`#` —
закрашено, `.` — пусто, все строки одной длины), строку `pic_<id>` в
`autoload/i18n.gd` для RU и EN, затем запустите тесты: они откажут, если
картинка не решается построчной логикой.
