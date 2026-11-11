/**
 * Слой платформы. Игра не обращается к SDK площадок напрямую — только через этот интерфейс.
 * Новая площадка (VK Play и т. п.) добавляется одним файлом-адаптером и строкой в platform/index.ts.
 */
import type { ProductId } from '../config/economy';

export type PlatformId = 'yandex' | 'rustore' | 'local';

export interface CatalogItem {
  id: ProductId;
  title: string;
  description: string;
  /** Цена с валютой, как её отдаёт площадка: «49 YAN», «99 ₽». */
  price: string;
  /** Только число. */
  priceValue: string;
  /** Код или название валюты. */
  currencyCode: string;
  /** Адрес иконки валюты, если площадка её даёт (Яндекс Игры — портальная валюта). */
  currencyImage?: string;
}

export interface Purchase {
  productId: string;
  /** Токен покупки: по нему покупка «потребляется» и защищается от повторного начисления. */
  token: string;
}

export type HapticKind = 'tap' | 'success' | 'error';

export interface PlatformFeatures {
  /** Есть облачные сохранения и вход в аккаунт. */
  cloudSaves: boolean;
  /** Доступны покупки. */
  payments: boolean;
  /** Системная кнопка «Назад» и диалог выхода (Android). */
  nativeBack: boolean;
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly features: PlatformFeatures;

  /** Загрузка и инициализация SDK. Вызывается один раз до всего остального. */
  init(): Promise<void>;
  /** Игра загружена и готова к взаимодействию (LoadingAPI.ready). Вызывается один раз. */
  gameReady(): void;
  /** Разметка геймплея: игрок начал или возобновил составление слов. */
  gameplayStart(): void;
  gameplayStop(): void;

  /** Полноэкранная реклама. Резолвится после закрытия; true — реклама была показана. */
  showInterstitial(): Promise<boolean>;
  /** Реклама за награду. true — только если площадка засчитала просмотр. */
  showRewarded(): Promise<boolean>;
  /** Показать или скрыть sticky-баннер (если площадка даёт им управлять). */
  setBannerVisible(visible: boolean): void;

  getCatalog(): Promise<CatalogItem[]>;
  /** Запускает покупку. null — игрок отменил или покупка не удалась. */
  purchase(id: ProductId): Promise<Purchase | null>;
  /** Необработанные расходуемые и все постоянные покупки игрока. */
  getPurchases(): Promise<Purchase[]>;
  consume(token: string): Promise<void>;

  /** Долговременное хранилище площадки (облако Яндекса, Capacitor Preferences). */
  loadData(): Promise<string | null>;
  saveData(data: string, flush: boolean): Promise<void>;

  /** Двухбуквенный код языка интерфейса: 'ru', 'en'… */
  getLanguage(): string;
  /** Время, устойчивое к переводу часов (серверное время SDK, если есть). */
  getServerTime(): number;

  onPause(callback: () => void): void;
  onResume(callback: () => void): void;

  /** Можно ли предложить вход в аккаунт (игрок ещё не вошёл и площадка это умеет). */
  canLogin(): boolean;
  /** Открывает окно входа. true — игрок вошёл. */
  login(): Promise<boolean>;

  vibrate(kind: HapticKind): void;
  /** Подписка на системную кнопку «Назад». */
  onBack(callback: () => void): void;
  /** Закрыть приложение (только там, где это уместно). */
  exitApp(): void;
}
