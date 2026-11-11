/**
 * Название и идентификаторы игры — единственное место, где они заданы.
 * Отсюда их берут меню, заголовок страницы, Android-проект (capacitor.config.ts) и тексты карточки.
 * Название в APK должно совпадать с карточкой в RuStore, а в игре — с черновиком Яндекс Игр.
 */
export const APP_NAME = 'Слова из слова';
export const APP_NAME_EN = 'Words from a Word';
export const APP_ID = 'ru.lektorai.slovaizslova';
export const APP_VERSION = '1.0.0';
/** Целочисленный код версии для Android: увеличивать при каждой загрузке в RuStore. */
export const APP_VERSION_CODE = 1;
/** Почта для обратной связи (показывается в «Об игре» и политике конфиденциальности). Пустая строка — не показывать. */
export const SUPPORT_EMAIL = '';
