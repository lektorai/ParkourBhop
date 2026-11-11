/** Размеры сцены: по ним считаются плитки букв и колонки списка слов. */
import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';

export interface StageSize {
  width: number;
  height: number;
  /** Размер 1rem в пикселях. */
  rem: number;
  /** Телефон в альбомной ориентации: игровой экран в две колонки. */
  compact: boolean;
}

export const StageContext = createContext<StageSize>({ width: 360, height: 640, rem: 16, compact: false });

export function useStage(): StageSize {
  return useContext(StageContext);
}

/** Следит за размером сцены и масштабирует шрифт: крупнее на больших экранах, компактнее на узких. */
export function useStageSize(getElement: () => HTMLElement | null): StageSize {
  const [size, setSize] = useState<StageSize>({ width: 360, height: 640, rem: 16, compact: false });
  useEffect(() => {
    const element = getElement();
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      const compact = window.innerWidth > window.innerHeight && window.innerHeight <= 560;
      // Невысокое окно (ноутбук, планшет в альбомной) — шрифт и плитки мельче, чтобы списку слов хватало места.
      const rem = Math.max(13, Math.min(20, width / 24, height / 42));
      document.documentElement.style.fontSize = `${rem.toFixed(2)}px`;
      setSize((prev) =>
        prev.width === width && prev.height === height && prev.rem === rem && prev.compact === compact
          ? prev
          : { width, height, rem, compact },
      );
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      observer?.disconnect();
    };
  }, []);
  return size;
}

export const MIN_TILE = 56;
const TILE_GAP = 6;
const MAX_PER_ROW = 7;

/**
 * Раскладка плиток исходного слова: до 7 в ряду, плитка не меньше 56 px.
 * На узком экране в ряд помещается меньше букв, и рядов становится больше.
 */
export function tileLayout(count: number, availableWidth: number, rem: number, compact: boolean) {
  const maxCols = Math.max(3, Math.min(MAX_PER_ROW, Math.floor(availableWidth / (MIN_TILE + TILE_GAP))));
  const rows = Math.ceil(count / maxCols);
  const cols = Math.ceil(count / rows);
  const maxTile = compact ? MIN_TILE : Math.round(rem * 4.1);
  const size = Math.max(MIN_TILE, Math.min(maxTile, Math.floor(availableWidth / cols) - TILE_GAP));
  return { cols, rows, size, gap: TILE_GAP, width: cols * (size + TILE_GAP) };
}
