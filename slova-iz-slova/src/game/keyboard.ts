/** Ввод с клавиатуры в любой раскладке: латинские клавиши соответствуют буквам ЙЦУКЕН. */
const CODE_TO_LETTER: Record<string, string> = {
  KeyQ: 'й', KeyW: 'ц', KeyE: 'у', KeyR: 'к', KeyT: 'е', KeyY: 'н', KeyU: 'г', KeyI: 'ш', KeyO: 'щ', KeyP: 'з',
  BracketLeft: 'х', BracketRight: 'ъ',
  KeyA: 'ф', KeyS: 'ы', KeyD: 'в', KeyF: 'а', KeyG: 'п', KeyH: 'р', KeyJ: 'о', KeyK: 'л', KeyL: 'д',
  Semicolon: 'ж', Quote: 'э',
  KeyZ: 'я', KeyX: 'ч', KeyC: 'с', KeyV: 'м', KeyB: 'и', KeyN: 'т', KeyM: 'ь', Comma: 'б', Period: 'ю',
  Backquote: 'е',
};

/**
 * Русская буква для нажатой клавиши или null.
 * Если раскладка русская, берём символ как есть; иначе — букву по положению клавиши.
 */
export function keyToLetter(key: string, code: string): string | null {
  const lower = key.toLowerCase();
  if (/^[а-яё]$/.test(lower)) return lower === 'ё' ? 'е' : lower;
  return CODE_TO_LETTER[code] ?? null;
}
