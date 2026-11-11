/**
 * Адаптер RuStore: веб-сборка внутри Android-приложения (Capacitor).
 * Реклама — Yandex Mobile Ads SDK, покупки — платёжный SDK RuStore; оба подключены
 * своими Capacitor-плагинами (android/app/src/main/java/.../plugins).
 */
import { App } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { RUSTORE_AD_UNITS, RUSTORE_PAYMENTS_ENABLED } from '../config/ads';
import { PRODUCT_IDS, type ProductId } from '../config/economy';
import type { CatalogItem, HapticKind, PlatformAdapter, PlatformFeatures, Purchase } from './types';

interface YandexAdsPlugin {
  initialize(options: { interstitialId: string; rewardedId: string }): Promise<void>;
  showInterstitial(): Promise<{ shown: boolean }>;
  showRewarded(): Promise<{ rewarded: boolean }>;
}

interface RuStoreProduct {
  id: string;
  title: string;
  description: string;
  /** Цена строкой с валютой, как её отдаёт RuStore: «99 ₽». */
  priceLabel: string;
  /** Цена числом. */
  price: string;
  currency: string;
}

interface RuStorePurchase {
  productId: string;
  purchaseId: string;
}

interface RuStorePayPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  getProducts(options: { ids: string[] }): Promise<{ products: RuStoreProduct[] }>;
  purchase(options: { id: string }): Promise<{ purchase: RuStorePurchase | null }>;
  getPurchases(): Promise<{ purchases: RuStorePurchase[] }>;
  consume(options: { purchaseId: string }): Promise<void>;
}

const YandexAds = registerPlugin<YandexAdsPlugin>('YandexAds');
const RuStorePay = registerPlugin<RuStorePayPlugin>('RuStorePay');

const SAVE_KEY = 'slova.save';

export class RuStoreAdapter implements PlatformAdapter {
  readonly id = 'rustore' as const;
  readonly features: PlatformFeatures = { cloudSaves: false, payments: false, nativeBack: true };

  private pauseCallbacks: (() => void)[] = [];
  private resumeCallbacks: (() => void)[] = [];
  private adsReady = false;

  async init(): Promise<void> {
    try {
      await YandexAds.initialize({ interstitialId: RUSTORE_AD_UNITS.interstitial, rewardedId: RUSTORE_AD_UNITS.rewarded });
      this.adsReady = true;
    } catch (error) {
      console.warn('RuStore: рекламный SDK не запустился', error);
    }
    if (RUSTORE_PAYMENTS_ENABLED) {
      try {
        const { available } = await RuStorePay.isAvailable();
        this.features.payments = available;
      } catch (error) {
        console.warn('RuStore: платежи недоступны', error);
      }
    }
    void App.addListener('appStateChange', ({ isActive }) => {
      (isActive ? this.resumeCallbacks : this.pauseCallbacks).forEach((cb) => cb());
    });
  }

  gameReady(): void {
    /* у RuStore нет события готовности */
  }

  gameplayStart(): void {
    /* разметка геймплея нужна только Яндекс Играм */
  }

  gameplayStop(): void {
    /* см. выше */
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.adsReady) return false;
    try {
      return (await YandexAds.showInterstitial()).shown;
    } catch (error) {
      console.warn('RuStore: полноэкранная реклама не показана', error);
      return false;
    }
  }

  async showRewarded(): Promise<boolean> {
    if (!this.adsReady) return false;
    try {
      return (await YandexAds.showRewarded()).rewarded;
    } catch (error) {
      console.warn('RuStore: реклама за награду не показана', error);
      return false;
    }
  }

  setBannerVisible(): void {
    /* баннеров в сборке RuStore нет */
  }

  async getCatalog(): Promise<CatalogItem[]> {
    if (!this.features.payments) return [];
    try {
      const { products } = await RuStorePay.getProducts({ ids: [...PRODUCT_IDS] });
      const known = new Set<string>(PRODUCT_IDS);
      return products
        .filter((p) => known.has(p.id))
        .map((p) => ({
          id: p.id as ProductId,
          title: p.title,
          description: p.description,
          price: p.priceLabel,
          priceValue: p.price,
          currencyCode: p.currency,
        }));
    } catch (error) {
      console.warn('RuStore: каталог покупок не получен', error);
      return [];
    }
  }

  async purchase(id: ProductId): Promise<Purchase | null> {
    if (!this.features.payments) return null;
    try {
      const { purchase } = await RuStorePay.purchase({ id });
      return purchase ? { productId: purchase.productId, token: purchase.purchaseId } : null;
    } catch {
      return null;
    }
  }

  async getPurchases(): Promise<Purchase[]> {
    if (!this.features.payments) return [];
    try {
      const { purchases } = await RuStorePay.getPurchases();
      return purchases.map((p) => ({ productId: p.productId, token: p.purchaseId }));
    } catch (error) {
      console.warn('RuStore: список покупок не получен', error);
      return [];
    }
  }

  async consume(token: string): Promise<void> {
    await RuStorePay.consume({ purchaseId: token });
  }

  async loadData(): Promise<string | null> {
    try {
      return (await Preferences.get({ key: SAVE_KEY })).value;
    } catch {
      return null;
    }
  }

  async saveData(data: string): Promise<void> {
    try {
      await Preferences.set({ key: SAVE_KEY, value: data });
    } catch (error) {
      console.warn('RuStore: сохранение не записано', error);
    }
  }

  getLanguage(): string {
    return (navigator.language || 'ru').slice(0, 2).toLowerCase();
  }

  /** Серверного времени нет: защита от перевода часов назад сделана в состоянии игры (save.clock). */
  getServerTime(): number {
    return Date.now();
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
    const action =
      kind === 'tap'
        ? Haptics.impact({ style: ImpactStyle.Light })
        : Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Error });
    action.catch(() => undefined);
  }

  onBack(callback: () => void): void {
    void App.addListener('backButton', () => callback());
  }

  exitApp(): void {
    void App.exitApp();
  }
}
