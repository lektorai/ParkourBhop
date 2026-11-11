/**
 * Выбор адаптера по переменной сборки PLATFORM=yandex|rustore|local.
 * Константа __PLATFORM__ подставляется Vite, поэтому лишние адаптеры в сборку не попадают.
 */
import type { PlatformAdapter } from './types';

export async function createPlatform(): Promise<PlatformAdapter> {
  if (__PLATFORM__ === 'yandex') {
    const { YandexAdapter } = await import('./yandex');
    return new YandexAdapter();
  }
  if (__PLATFORM__ === 'rustore') {
    const { RuStoreAdapter } = await import('./rustore');
    return new RuStoreAdapter();
  }
  const { LocalAdapter } = await import('./local');
  return new LocalAdapter();
}

export type { CatalogItem, HapticKind, PlatformAdapter, PlatformFeatures, PlatformId, Purchase } from './types';
