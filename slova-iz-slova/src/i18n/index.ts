/** Переводы интерфейса. Язык определяется автоматически через SDK площадки. */
import en from './en.json';
import ru from './ru.json';

export type Lang = 'ru' | 'en';
export type TextKey = keyof typeof ru;

const dictionaries: Record<Lang, Record<string, string>> = { ru, en };
let current: Lang = 'ru';

export function setLanguage(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
}

export function getLanguage(): Lang {
  return current;
}

/** Текст по ключу; {имя} в строке заменяется значением из params. */
export function t(key: TextKey, params?: Record<string, string | number>): string {
  const template = dictionaries[current][key] ?? ru[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Склонение: «3 буквы», «5 букв», «1 слово». В английском — единственное и множественное число. */
export function tn(base: 'letters' | 'words' | 'coins', n: number): string {
  if (current === 'en') return t(`${base}.${n === 1 ? 'one' : 'many'}` as TextKey, { n });
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  const form = abs > 10 && abs < 20 ? 'many' : last === 1 ? 'one' : last >= 2 && last <= 4 ? 'few' : 'many';
  return t(`${base}.${form}` as TextKey, { n });
}
