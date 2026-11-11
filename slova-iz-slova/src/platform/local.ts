/**
 * Адаптер для разработки и автотестов: реклама и покупки имитируются, «облако» лежит в localStorage.
 * Поведение настраивается через window.__localPlatform (см. e2e-тесты).
 */
import type { ProductId } from '../config/economy';
import { storageGet, storageSet } from './storage';
import type { CatalogItem, HapticKind, PlatformAdapter, PlatformFeatures, Purchase } from './types';

const CLOUD_KEY = 'slova.local.cloud';
const PURCHASES_KEY = 'slova.local.purchases';

export interface LocalPlatformOptions {
  /** Сколько миллисекунд «идёт» рекламный ролик. */
  adDurationMs: number;
  /** Реклама недоступна (проверка, что игра это переживает). */
  adsFail: boolean;
  /** Игрок закрывает рекламу за награду, не досмотрев. */
  rewardedSkipped: boolean;
  /** Сдвиг «серверного» времени, мс (для проверки ежедневного бонуса). */
  timeShiftMs: number;
  /** Журнал вызовов — его читают e2e-тесты. */
  log: string[];
}

declare global {
  interface Window {
    __localPlatform?: Partial<LocalPlatformOptions>;
  }
}

const CATALOG: CatalogItem[] = [
  { id: 'no_ads', title: 'Без рекламы', description: 'Отключает рекламу между уровнями и баннер навсегда', price: '199 ТСТ', priceValue: '199', currencyCode: 'ТСТ' },
  { id: 'coins_500', title: '500 монет', description: '500 монет', price: '49 ТСТ', priceValue: '49', currencyCode: 'ТСТ' },
  { id: 'coins_1500', title: '1500 монет', description: '1500 монет', price: '129 ТСТ', priceValue: '129', currencyCode: 'ТСТ' },
  { id: 'coins_5000', title: '5000 монет', description: '5000 монет', price: '349 ТСТ', priceValue: '349', currencyCode: 'ТСТ' },
  { id: 'themes_all', title: 'Все темы', description: 'Темы «Небо» и «Сакура»', price: '149 ТСТ', priceValue: '149', currencyCode: 'ТСТ' },
];

export class LocalAdapter implements PlatformAdapter {
  readonly id = 'local' as const;
  readonly features: PlatformFeatures = { cloudSaves: false, payments: true, nativeBack: false };

  private pauseCallbacks: (() => void)[] = [];
  private resumeCallbacks: (() => void)[] = [];
  private options: LocalPlatformOptions = {
    adDurationMs: 900,
    adsFail: false,
    rewardedSkipped: false,
    timeShiftMs: 0,
    log: [],
  };

  async init(): Promise<void> {
    const overrides = window.__localPlatform ?? {};
    this.options = { ...this.options, ...overrides, log: overrides.log ?? [] };
    window.__localPlatform = this.options;
  }

  private log(event: string): void {
    this.options.log.push(event);
  }

  gameReady(): void {
    this.log('gameReady');
  }

  gameplayStart(): void {
    this.log('gameplayStart');
  }

  gameplayStop(): void {
    this.log('gameplayStop');
  }

  /** Заглушка рекламы: полупрозрачный экран «Тестовая реклама» на заданное время. */
  private playMockAd(label: string): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.setAttribute('data-testid', 'mock-ad');
      overlay.style.cssText =
        'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(20,20,20,.92);color:#fff;font:600 20px/1.4 sans-serif;text-align:center;padding:24px';
      overlay.textContent = label;
      document.body.appendChild(overlay);
      this.pauseCallbacks.forEach((cb) => cb());
      window.setTimeout(() => {
        overlay.remove();
        this.resumeCallbacks.forEach((cb) => cb());
        resolve();
      }, this.options.adDurationMs);
    });
  }

  async showInterstitial(): Promise<boolean> {
    this.log('interstitial');
    if (this.options.adsFail) return false;
    await this.playMockAd('Тестовая реклама (адаптер local)');
    return true;
  }

  async showRewarded(): Promise<boolean> {
    this.log('rewarded');
    if (this.options.adsFail) return false;
    await this.playMockAd('Тестовая реклама за награду (адаптер local)');
    return !this.options.rewardedSkipped;
  }

  setBannerVisible(visible: boolean): void {
    this.log(`banner:${visible ? 'on' : 'off'}`);
  }

  async getCatalog(): Promise<CatalogItem[]> {
    return CATALOG;
  }

  private readPurchases(): Purchase[] {
    try {
      return JSON.parse(storageGet(PURCHASES_KEY) ?? '[]') as Purchase[];
    } catch {
      return [];
    }
  }

  async purchase(id: ProductId): Promise<Purchase | null> {
    this.log(`purchase:${id}`);
    const purchase: Purchase = { productId: id, token: `local-${id}-${Date.now()}` };
    storageSet(PURCHASES_KEY, JSON.stringify([...this.readPurchases(), purchase]));
    return purchase;
  }

  async getPurchases(): Promise<Purchase[]> {
    return this.readPurchases();
  }

  async consume(token: string): Promise<void> {
    this.log(`consume:${token}`);
    storageSet(PURCHASES_KEY, JSON.stringify(this.readPurchases().filter((p) => p.token !== token)));
  }

  async loadData(): Promise<string | null> {
    return storageGet(CLOUD_KEY);
  }

  async saveData(data: string): Promise<void> {
    storageSet(CLOUD_KEY, data);
  }

  getLanguage(): string {
    return (navigator.language || 'ru').slice(0, 2).toLowerCase();
  }

  getServerTime(): number {
    return Date.now() + this.options.timeShiftMs;
  }

  onPause(callback: () => void): void {
    this.pauseCallbacks.push(callback);
  }

  onResume(callback: () => void): void {
    this.resumeCallbacks.push(callback);
  }

  canLogin(): boolean {
    return false;
  }

  async login(): Promise<boolean> {
    return false;
  }

  vibrate(kind: HapticKind): void {
    try {
      navigator.vibrate?.(kind === 'tap' ? 8 : kind === 'success' ? [10, 40, 20] : 30);
    } catch {
      /* вибрация недоступна */
    }
  }

  onBack(): void {
    /* в браузере системной кнопки «Назад» у игры нет */
  }

  exitApp(): void {
    /* в браузере приложение не закрывается */
  }
}
