# Публикация в RuStore: пошагово

Цель — от репозитория до карточки в магазине за один вечер и затем выход на
стабильный, пусть и небольшой, доход с рекламы и покупки «Убрать рекламу».

## 0. Что уже готово

| Что | Где |
|---|---|
| Игра (Godot 4.4, GDScript), офлайн, RU/EN | корень репозитория |
| Пресеты экспорта Android (APK и AAB) | `export_presets.cfg` |
| CI: тесты + экспорт APK/AAB | `.github/workflows/build-android.yml` |
| Иконка 512×512 без прозрачности | `store/icon_512.png` |
| Скриншоты телефона | `store/screenshots/ru/` |
| Тексты карточки | `store/listing_ru.md`, `store/listing_en.md` |
| Политика конфиденциальности | `docs/privacy.html` (включите GitHub Pages для папки `docs/`) |
| Точки монетизации в коде | `monetization_config.gd`, `autoload/ads.gd`, `autoload/billing.gd` |

## 1. Ключ подписи (один раз, храните вечно)

```bash
keytool -genkeypair -v -keystore release.keystore -alias nonograms \
  -keyalg RSA -keysize 2048 -validity 10000
```

Добавьте в GitHub → Settings → Secrets and variables → Actions:

| Secret | Значение |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEY_ALIAS` | `nonograms` |
| `ANDROID_KEY_PASSWORD` | пароль ключа (он же пароль хранилища) |

Потеря ключа = невозможность обновлять приложение. Сделайте резервную копию.

## 2. Сборка

Запустите workflow «Build Android (Godot 4)» (или просто сделайте push).
Артефакт `nonograms-android` содержит:

- `nonograms-debug.apk` — для проверки на своём телефоне;
- `nonograms-release.apk` — подписанная сборка для RuStore (если заданы секреты);
- `nonograms-release.aab` — то же в формате AAB (шаг не блокирует сборку, если Gradle не собрался).

Локально: `godot --headless --path . --export-release "Android APK" build/nonograms.apk`
(нужны Android SDK, JDK 17 и шаблоны экспорта той же версии Godot).

Перед каждой новой версией увеличьте `version/code` и `version/name` в обоих
пресетах `export_presets.cfg` и в `project.godot` (`config/version`).

## 3. Кабинет RuStore

1. Зарегистрируйтесь на <https://console.rustore.ru> как физлицо/самозанятый/ИП
   (для выплат за покупки нужен договор с РуСтор; реклама выплачивается Яндексом отдельно).
2. «Приложения → Добавить приложение» → название из `store/listing_ru.md`.
3. «Загрузить версию»: тип **Универсальный**, загрузите APK (или AAB).
4. Заполните:
   - «Что нового», короткое и полное описание (из `listing_ru.md`);
   - категория **Игры → Головоломки**, возраст **0+**;
   - безопасность данных: без сбора данных (базовая сборка) — см. подсказки в `listing_ru.md`;
   - контакты разработчика (e-mail обязателен);
   - иконка `store/icon_512.png`, минимум 3 скриншота из `store/screenshots/ru/`;
   - ссылка на политику: `https://<ваш-логин>.github.io/<репозиторий>/privacy.html`
     (обновите `PRIVACY_URL` в `monetization_config.gd`, чтобы кнопка в настройках вела туда же).
5. «Отправить на модерацию». Обычно 1–3 рабочих дня.

Частые причины отказа: отсутствует политика конфиденциальности при наличии
рекламы, скриншоты не соответствуют приложению, нерабочие кнопки покупок.
В базовой сборке покупки скрыты, пока не установлен SDK, — отказа по этой
причине не будет.

## 4. Монетизация (после первой публикации)

Стратегия: сначала выпустить чистую офлайн-версию (быстрая модерация,
первые оценки), затем версией 1.1 включить рекламу и покупку.

### 4.1 Реклама — Яндекс Реклама (Yandex Mobile Ads)

1. Зарегистрируйтесь в <https://ads.yandex.ru> (раздел «Монетизация приложений»),
   добавьте приложение (ссылка на страницу RuStore), создайте блоки:
   **Interstitial** и **Rewarded**. Получите id вида `R-M-XXXXXXX-1`.
2. Установите плагин для Godot: <https://github.com/noctisalamandra/godot-yandex-ads-android>
   (папка `addons/GodotAndroidYandexAds`, включить в Project → Plugins).
3. В `monetization_config.gd` впишите `INTERSTITIAL_ID`, `REWARDED_ID`.
4. В `export_presets.cfg`: `gradle_build/use_gradle_build=true`,
   `permissions/internet=true`, `permissions/access_network_state=true`.
5. Поведение уже реализовано в `autoload/ads.gd`:
   - rewarded-видео за подсказку и за +3 попытки после 3 ошибок;
   - interstitial после каждого 3-го решённого кроссворда (`INTERSTITIAL_EVERY_N_WINS`);
   - ничего не показывается, если куплено «Убрать рекламу».
6. В карточке RuStore обновите раздел «Безопасность данных» и «Что нового».

### 4.2 Покупки — RuStore Pay SDK

1. RuStore Консоль → приложение → «Монетизация» → создайте товары:
   `no_ads` (невозобновляемый, 149 ₽) и `hints_20` (потребляемый, 79 ₽).
   Id должны совпадать с `monetization_config.gd`.
2. Скачайте плагины `RuStoreGodotPay` и `RuStoreGodotCore` из официального
   репозитория <https://gitflic.ru/project/rustore/rustore-godot-pay> в `addons/`,
   включите их в Project → Plugins, выполните шаги из документации
   <https://www.rustore.ru/help/sdk/pay/godot> (manifest, `rustore_values.xml`
   с `consoleApplicationId`, deeplink-схема). Нужен Gradle-билд.
3. `autoload/billing.gd` подхватывает SDK автоматически и показывает кнопки
   в настройках. Проверьте названия методов/сигналов по версии SDK — адаптер
   написан по документации 11.x и обращается к ним динамически.
4. Тестовые покупки: добавьте тестовых пользователей в консоли RuStore.

### 4.3 Ожидания по доходу

Нонограммы — «вечнозелёный» жанр с ровным спросом (запросы «японские
кроссворды», «нонограммы» в поиске стора). Типичные ориентиры для казуальной
головоломки в RuStore с органикой: eCPM interstitial 60–150 ₽, rewarded
150–300 ₽; при 300–500 DAU и 2–3 показах на сессию — порядка 10–30 тыс. ₽ в
месяц плюс единичные покупки «Убрать рекламу». Это оценка, а не гарантия:
реальный результат зависит от карточки, оценок и регулярных обновлений.

## 5. Что обновлять регулярно (удержание и ранжирование)

- Раз в 2–4 недели: 5–10 новых картинок в `core/pictures.gd`
  (тест проверит, что они решаются логикой) + пункт в «Что нового».
- Отвечайте на отзывы в консоли — это влияет на видимость.
- Следите за «Статистикой» RuStore: доля удержания D1/D7, крэши.
- Не меняйте `NonogramGenerator.level_seed` — иначе у игроков «поедут» уровни.
