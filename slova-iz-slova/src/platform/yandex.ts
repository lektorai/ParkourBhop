/**
 * Адаптер Яндекс Игр. SDK подключается тегом <script src="/sdk.js"> в index.html
 * (его добавляет сборка PLATFORM=yandex) и инициализируется через YaGames.init() — строго по документации:
 * https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
 */
import { PRODUCT_IDS, type ProductId } from '../config/economy';
import type { CatalogItem, HapticKind, PlatformAdapter, PlatformFeatures, Purchase } from './types';

interface YaProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  priceValue: string;
  priceCurrencyCode: string;
  getPriceCurrencyImage?: (size: 'small' | 'medium' | 'svg') => string;
}

interface YaPurchase {
  productID: string;
  purchaseToken: string;
}

interface YaPayments {
  getCatalog(): Promise<YaProduct[]>;
  purchase(data: { id: string }): Promise<YaPurchase>;
  getPurchases(): Promise<YaPurchase[]>;
  consumePurchase(token: string): Promise<void>;
}

interface YaPlayer {
  isAuthorized(): boolean;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

interface YaAdCallbacks {
  onOpen?: () => void;
  onRewarded?: () => void;
  onClose?: (wasShown?: boolean) => void;
  onError?: (error: unknown) => void;
}

interface YaSdk {
  features: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv: {
    showFullscreenAdv(options: { callbacks: YaAdCallbacks }): void;
    showRewardedVideo(options: { callbacks: YaAdCallbacks }): void;
    showBannerAdv?: () => Promise<unknown>;
    hideBannerAdv?: () => Promise<unknown>;
  };
  auth: { openAuthDialog(): Promise<void> };
  environment: { i18n: { lang: string } };
  EVENTS?: Record<string, string>;
  getPlayer(options?: { signed?: boolean }): Promise<YaPlayer>;
  getPayments(options?: { signed?: boolean }): Promise<YaPayments>;
  serverTime(): number;
  on(event: string, listener: () => void): void;
}

declare global {
  interface Window {
    YaGames?: { init(): Promise<YaSdk> };
  }
}

const SAVE_KEY = 'save';

/** Ждём, пока тег <script src="/sdk.js"> выполнится (он может быть async). */
function waitForYaGames(timeoutMs: number): Promise<NonNullable<Window['YaGames']>> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (window.YaGames) resolve(window.YaGames);
      else if (Date.now() - started > timeoutMs) reject(new Error('SDK Яндекс Игр не загрузился'));
      else window.setTimeout(check, 30);
    };
    check();
  });
}

export class YandexAdapter implements PlatformAdapter {
  readonly id = 'yandex' as const;
  readonly features: PlatformFeatures = { cloudSaves: true, payments: true, nativeBack: false };

  private sdk: YaSdk | null = null;
  private player: YaPlayer | null = null;
  private payments: YaPayments | null = null;
  private readySent = false;
  private pauseCallbacks: (() => void)[] = [];
  private resumeCallbacks: (() => void)[] = [];
  private accountChangedCallbacks: (() => void)[] = [];

  async init(): Promise<void> {
    const yaGames = await waitForYaGames(15000);
    this.sdk = await yaGames.init();
    this.sdk.on('game_api_pause', () => this.pauseCallbacks.forEach((cb) => cb()));
    this.sdk.on('game_api_resume', () => this.resumeCallbacks.forEach((cb) => cb()));
    const closed = this.sdk.EVENTS?.ACCOUNT_SELECTION_DIALOG_CLOSED;
    if (closed) {
      // Игрок выбрал другой прогресс в диалоге аккаунтов — перечитываем объект игрока.
      this.sdk.on(closed, () => {
        this.player = null;
        this.accountChangedCallbacks.forEach((cb) => cb());
      });
    }
    try {
      this.player = await this.sdk.getPlayer();
    } catch (error) {
      console.warn('Яндекс Игры: объект игрока недоступен', error);
    }
  }

  /** Подписка на смену аккаунта (нужно перечитать облачное сохранение). */
  onAccountChanged(callback: () => void): void {
    this.accountChangedCallbacks.push(callback);
  }

  gameReady(): void {
    if (this.readySent) return;
    this.readySent = true;
    this.sdk?.features.LoadingAPI?.ready();
  }

  gameplayStart(): void {
    this.sdk?.features.GameplayAPI?.start();
  }

  gameplayStop(): void {
    this.sdk?.features.GameplayAPI?.stop();
  }

  showInterstitial(): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk) return Promise.resolve(false);
    return new Promise((resolve) => {
      let done = false;
      const finish = (shown: boolean) => {
        if (done) return;
        done = true;
        resolve(shown);
      };
      try {
        sdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: (wasShown) => finish(Boolean(wasShown)),
            onError: (error) => {
              console.warn('Яндекс Игры: полноэкранная реклама не показана', error);
              // onClose приходит и после ошибки; подстрахуемся, если его не будет.
              window.setTimeout(() => finish(false), 1000);
            },
          },
        });
      } catch (error) {
        console.warn('Яндекс Игры: ошибка вызова рекламы', error);
        finish(false);
      }
    });
  }

  showRewarded(): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk) return Promise.resolve(false);
    return new Promise((resolve) => {
      let rewarded = false;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(rewarded);
      };
      try {
        sdk.adv.showRewardedVideo({
          callbacks: {
            // Награда начисляется только по событию «просмотрено» от SDK.
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => finish(),
            onError: (error) => {
              console.warn('Яндекс Игры: реклама за награду не показана', error);
              window.setTimeout(finish, 1000);
            },
          },
        });
      } catch (error) {
        console.warn('Яндекс Игры: ошибка вызова рекламы', error);
        finish();
      }
    });
  }

  setBannerVisible(visible: boolean): void {
    // Работает, если в консоли включена опция «Использовать API для показа sticky-баннера».
    const call = visible ? this.sdk?.adv.showBannerAdv : this.sdk?.adv.hideBannerAdv;
    try {
      void call?.call(this.sdk?.adv)?.catch(() => undefined);
    } catch {
      /* баннеры не подключены */
    }
  }

  private async getPaymentsObject(): Promise<YaPayments | null> {
    if (this.payments) return this.payments;
    try {
      this.payments = (await this.sdk?.getPayments({ signed: false })) ?? null;
    } catch (error) {
      console.warn('Яндекс Игры: покупки недоступны', error);
      this.payments = null;
    }
    return this.payments;
  }

  async getCatalog(): Promise<CatalogItem[]> {
    const payments = await this.getPaymentsObject();
    if (!payments) return [];
    try {
      const products = await payments.getCatalog();
      const known = new Set<string>(PRODUCT_IDS);
      return products
        .filter((p) => known.has(p.id))
        .map((p) => {
          let currencyImage: string | undefined;
          try {
            currencyImage = p.getPriceCurrencyImage?.('medium');
          } catch {
            currencyImage = undefined;
          }
          return {
            id: p.id as ProductId,
            title: p.title,
            description: p.description,
            price: p.price,
            priceValue: p.priceValue,
            currencyCode: p.priceCurrencyCode,
            currencyImage,
          };
        });
    } catch (error) {
      console.warn('Яндекс Игры: каталог покупок не получен', error);
      return [];
    }
  }

  async purchase(id: ProductId): Promise<Purchase | null> {
    const payments = await this.getPaymentsObject();
    if (!payments) return null;
    try {
      const result = await payments.purchase({ id });
      return { productId: result.productID, token: result.purchaseToken };
    } catch {
      // Игрок закрыл окно оплаты, не хватило средств и т. п.
      return null;
    }
  }

  async getPurchases(): Promise<Purchase[]> {
    const payments = await this.getPaymentsObject();
    if (!payments) return [];
    try {
      const purchases = await payments.getPurchases();
      return Array.from(purchases).map((p) => ({ productId: p.productID, token: p.purchaseToken }));
    } catch (error) {
      console.warn('Яндекс Игры: список покупок не получен', error);
      return [];
    }
  }

  async consume(token: string): Promise<void> {
    const payments = await this.getPaymentsObject();
    await payments?.consumePurchase(token);
  }

  private async getPlayerObject(): Promise<YaPlayer | null> {
    if (this.player) return this.player;
    try {
      this.player = (await this.sdk?.getPlayer()) ?? null;
    } catch {
      this.player = null;
    }
    return this.player;
  }

  async loadData(): Promise<string | null> {
    const player = await this.getPlayerObject();
    if (!player) return null;
    try {
      const data = await player.getData([SAVE_KEY]);
      const value = data[SAVE_KEY];
      return typeof value === 'string' ? value : null;
    } catch (error) {
      console.warn('Яндекс Игры: облачное сохранение не прочитано', error);
      return null;
    }
  }

  async saveData(data: string, flush: boolean): Promise<void> {
    const player = await this.getPlayerObject();
    if (!player) return;
    try {
      await player.setData({ [SAVE_KEY]: data }, flush);
    } catch (error) {
      console.warn('Яндекс Игры: облачное сохранение не записано', error);
    }
  }

  getLanguage(): string {
    return (this.sdk?.environment.i18n.lang || 'ru').slice(0, 2).toLowerCase();
  }

  getServerTime(): number {
    try {
      return this.sdk?.serverTime() ?? Date.now();
    } catch {
      return Date.now();
    }
  }

  onPause(callback: () => void): void {
    this.pauseCallbacks.push(callback);
  }

  onResume(callback: () => void): void {
    this.resumeCallbacks.push(callback);
  }

  canLogin(): boolean {
    try {
      return this.player ? !this.player.isAuthorized() : false;
    } catch {
      return false;
    }
  }

  async login(): Promise<boolean> {
    if (!this.sdk) return false;
    try {
      await this.sdk.auth.openAuthDialog();
      this.player = await this.sdk.getPlayer();
      return this.player.isAuthorized();
    } catch {
      // Игрок закрыл окно входа.
      return false;
    }
  }

  vibrate(kind: HapticKind): void {
    try {
      navigator.vibrate?.(kind === 'tap' ? 8 : kind === 'success' ? [10, 40, 20] : 30);
    } catch {
      /* вибрация недоступна */
    }
  }

  onBack(): void {
    /* событие HISTORY_BACK есть только на телевизорах — эта платформа в черновике не выбирается */
  }

  exitApp(): void {
    /* в каталоге Яндекс Игр кнопки выхода нет (пункт 6.7) */
  }
}
