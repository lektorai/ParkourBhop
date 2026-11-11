/**
 * Контроллер игры: связывает состояние, сохранения, площадку, уровни и звук.
 * Интерфейс вызывает методы этого класса и подписывается на `store`.
 */
import { AudioEngine, type Sfx } from '../audio/engine';
import { CONSUMABLE_PRODUCTS, DEFAULT_THEME, ECONOMY, PAID_THEMES, type ProductId, type ThemeId } from '../config/economy';
import { BonusDictionary } from '../game/dictionary';
import { adCoinsLeft, canShowInterstitial, claimDaily, dailyOffer, dayNumber, starReward, useAdCoins } from '../game/economy';
import { LevelRepository, type ChapterInfo } from '../game/levels';
import { addBonusWord, addFoundWord, applyHint, checkWord, starsFor, type SubmitResult } from '../game/session';
import type { LevelData, LevelProgress } from '../game/types';
import { setLanguage, type Lang } from '../i18n';
import type { CatalogItem, PlatformAdapter, Purchase } from '../platform';
import { storageGet, storageSet } from '../platform/storage';
import { Persistence } from './persistence';
import { coinsOf, createSave, fromProgress, toProgress, type SaveData, type Settings } from './save';
import { Store } from './store';

export type Screen = 'menu' | 'levels' | 'game' | 'themes' | 'shop' | 'settings';

export type Modal =
  | { type: 'win'; stars: number; reward: number; doubled: boolean; allFound: boolean }
  | { type: 'daily'; day: number; reward: number }
  | { type: 'noCoins' }
  | { type: 'bonusWords' }
  | { type: 'howto' }
  | { type: 'privacy' }
  | { type: 'about' }
  | { type: 'exit' }
  | { type: 'finished' };

export interface Toast {
  id: number;
  kind: 'bonus' | 'info' | 'star' | 'coins';
  text: string;
}

export interface AppState {
  ready: boolean;
  save: SaveData;
  coins: number;
  screen: Screen;
  modal: Modal | null;
  level: LevelData | null;
  progress: LevelProgress | null;
  /** 0 — обучения нет; 1 — «нажми буквы», 2 — «нажми галочку», 3 — «слово в списке». */
  tutorialStep: 0 | 1 | 2 | 3;
  catalog: CatalogItem[];
  catalogLoaded: boolean;
  chapters: ChapterInfo[];
  levelCount: number;
  lang: Lang;
  /** Идёт реклама или покупка: кнопки временно не реагируют. */
  busy: boolean;
  adPlaying: boolean;
  paused: boolean;
  canLogin: boolean;
  payments: boolean;
  toast: Toast | null;
}

/** Что произошло после успешно найденного слова (для анимаций). */
export interface FoundOutcome {
  word: string;
  /** Сколько звёзд стало. */
  stars: number;
  /** Сколько новых звёзд получено этим словом. */
  newStars: number;
  reward: number;
  /** Уровень пройден именно этим словом (первая звезда). */
  passedNow: boolean;
  allFound: boolean;
}

export type SubmitOutcome =
  | { kind: 'found'; outcome: FoundOutcome }
  | { kind: 'already'; word: string }
  | { kind: 'bonus'; word: string }
  | { kind: 'bonus-already'; word: string }
  | { kind: 'too-short' }
  | { kind: 'source' }
  | { kind: 'invalid' };

const UI_KEY = 'slova.ui';
const TUTORIAL_WORD = 'лук';

export class Game {
  readonly store: Store<AppState>;
  readonly audio = new AudioEngine();
  readonly levels = new LevelRepository();
  readonly dictionary = new BonusDictionary();
  private readonly persistence: Persistence;
  private lastInterstitialAt = 0;
  private gameplayActive = false;
  private toastId = 0;
  private toastTimer: number | null = null;

  constructor(readonly platform: PlatformAdapter) {
    this.persistence = new Persistence(platform);
    const save = createSave(Date.now());
    this.store = new Store<AppState>({
      ready: false,
      save,
      coins: coinsOf(save),
      screen: 'menu',
      modal: null,
      level: null,
      progress: null,
      tutorialStep: 0,
      catalog: [],
      catalogLoaded: false,
      chapters: [],
      levelCount: 0,
      lang: 'ru',
      busy: false,
      adPlaying: false,
      paused: false,
      canLogin: false,
      payments: false,
      toast: null,
    });
  }

  get state(): AppState {
    return this.store.get();
  }

  // --- запуск ------------------------------------------------------------------------

  /** Загружает всё нужное до первого экрана. `onProgress` двигает полосу загрузки (0…1). */
  async start(onProgress: (value: number) => void): Promise<void> {
    onProgress(0.1);
    try {
      await this.platform.init();
    } catch (error) {
      // Игра должна работать, даже если SDK площадки не ответил.
      console.warn('Площадка не инициализировалась', error);
    }
    onProgress(0.4);

    const lang: Lang = this.platform.getLanguage() === 'en' ? 'en' : 'ru';
    setLanguage(lang);

    const [index, remote] = await Promise.all([this.levels.loadIndex(), this.persistence.loadRemote()]);
    onProgress(0.7);
    const merged = Persistence.merge(this.persistence.loadLocal(), remote) ?? createSave(this.now());
    merged.unlocked = Math.min(Math.max(1, merged.unlocked), index.levelCount);
    merged.lastLevel = Math.min(Math.max(1, merged.lastLevel), merged.unlocked);

    this.store.set({
      save: merged,
      coins: coinsOf(merged),
      chapters: index.chapters,
      levelCount: index.levelCount,
      lang,
      canLogin: this.platform.canLogin(),
      payments: this.platform.features.payments,
    });
    this.applySettings(merged.settings);
    this.bindPlatformEvents();

    // Возвращаем игрока туда, где он был до перезагрузки страницы.
    const ui = this.readUi();
    if (ui === 'game') {
      await this.openLevel(merged.lastLevel).catch(() => this.store.set({ screen: 'menu' }));
    } else if (ui) {
      this.store.set({ screen: ui });
    }
    onProgress(1);
    this.store.set({ ready: true });

    // Остальное грузится в фоне, меню уже доступно. Словарь — чуть позже, чтобы не мешать первой отрисовке.
    window.setTimeout(() => void this.loadDictionary(), 600);
    void this.refreshCatalog();
    void this.processPurchases();
    this.platform.setBannerVisible(!merged.noAds);
    if (this.state.screen === 'menu') this.offerDaily();
  }

  private async loadDictionary(): Promise<void> {
    try {
      const response = await fetch('./dict/extended.txt');
      if (response.ok) this.dictionary.load(await response.text());
    } catch (error) {
      console.warn('Расширенный словарь не загрузился: бонусные слова временно недоступны', error);
    }
  }

  private bindPlatformEvents(): void {
    this.platform.onPause(() => this.setPaused(true));
    this.platform.onResume(() => this.setPaused(false));
    this.platform.onBack(() => this.handleBack());

    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      this.audio.setSuspended('hidden', hidden);
      if (hidden) this.persistence.flush();
      this.syncGameplay();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', () => this.persistence.flush());
    window.addEventListener('blur', () => this.audio.setSuspended('blur', true));
    window.addEventListener('focus', () => this.audio.setSuspended('blur', false));

    const maybeYandex = this.platform as PlatformAdapter & { onAccountChanged?: (cb: () => void) => void };
    maybeYandex.onAccountChanged?.(() => void this.reloadRemote());
  }

  private setPaused(paused: boolean): void {
    this.audio.setSuspended('pause', paused);
    if (paused) this.persistence.flush();
    this.store.set({ paused });
    this.syncGameplay();
  }

  // --- время -------------------------------------------------------------------------

  /** Время, которое нельзя «отмотать назад» переводом часов устройства. */
  private now(): number {
    return Math.max(this.platform.getServerTime(), this.state.save.clock);
  }

  private today(): number {
    return dayNumber(this.now());
  }

  // --- сохранение --------------------------------------------------------------------

  private commit(patch: Partial<SaveData>, extra: Partial<AppState> = {}, flush = false): void {
    const now = this.now();
    const save: SaveData = { ...this.state.save, ...patch, ts: now, clock: now };
    this.store.set({ ...extra, save, coins: coinsOf(save) });
    this.persistence.write(save, flush);
    this.syncGameplay();
  }

  private setUi(patch: Partial<AppState>): void {
    this.store.set(patch);
    if (patch.screen) storageSet(UI_KEY, patch.screen);
    this.syncGameplay();
  }

  private readUi(): Screen | null {
    const value = storageGet(UI_KEY);
    const screens: Screen[] = ['menu', 'levels', 'game', 'themes', 'shop', 'settings'];
    return screens.includes(value as Screen) ? (value as Screen) : null;
  }

  private async reloadRemote(): Promise<void> {
    const remote = await this.persistence.loadRemote();
    if (!remote) return;
    const merged = Persistence.merge(this.state.save, remote)!;
    merged.unlocked = Math.min(merged.unlocked, this.state.levelCount || merged.unlocked);
    this.store.set({ save: merged, coins: coinsOf(merged), canLogin: this.platform.canLogin() });
    this.persistence.write(merged, true);
    this.applySettings(merged.settings);
    const level = this.state.level;
    if (level) this.store.set({ progress: toProgress(level, merged.levels[String(level.id)]) });
  }

  // --- разметка геймплея (GameplayAPI) ----------------------------------------------

  /** Геймплей активен, только когда игрок реально может составлять слова. */
  private syncGameplay(): void {
    const s = this.state;
    const active =
      s.ready && s.screen === 'game' && !s.modal && !s.paused && !s.adPlaying && document.visibilityState !== 'hidden';
    if (active === this.gameplayActive) return;
    this.gameplayActive = active;
    if (active) this.platform.gameplayStart();
    else this.platform.gameplayStop();
  }

  /** Вызывается из интерфейса после первой отрисовки готового экрана. */
  notifyReady(): void {
    this.platform.gameReady();
    this.syncGameplay();
  }

  // --- звук и отклик ------------------------------------------------------------------

  sound(name: Sfx): void {
    this.audio.play(name);
  }

  haptic(kind: 'tap' | 'success' | 'error'): void {
    if (this.state.save.settings.vibration) this.platform.vibrate(kind);
  }

  private applySettings(settings: Settings): void {
    this.audio.setSoundEnabled(settings.sound);
    this.audio.setMusicEnabled(settings.music);
  }

  updateSettings(patch: Partial<Settings>): void {
    const settings = { ...this.state.save.settings, ...patch };
    this.applySettings(settings);
    this.commit({ settings });
  }

  showToast(kind: Toast['kind'], text: string): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.store.set({ toast: { id: ++this.toastId, kind, text } });
    this.toastTimer = window.setTimeout(() => this.store.set({ toast: null }), 1800);
  }

  // --- навигация ---------------------------------------------------------------------

  go(screen: Exclude<Screen, 'game'>): void {
    this.setUi({ screen, modal: null });
    if (screen === 'menu') this.offerDaily();
    if (screen === 'shop' && !this.state.catalogLoaded) void this.refreshCatalog();
  }

  openModal(modal: Modal): void {
    this.setUi({ modal });
  }

  closeModal(): void {
    this.setUi({ modal: null });
  }

  /** Уровень, который открывает кнопка «Играть». */
  get playLevel(): number {
    return this.state.save.unlocked;
  }

  async openLevel(id: number): Promise<void> {
    const save = this.state.save;
    if (id < 1 || id > save.unlocked) return;
    const level = await this.levels.getLevel(id);
    const progress = toProgress(level, save.levels[String(id)]);
    const tutorial = !save.tutorialDone && id === 1 && progress.found.length === 0;
    this.store.set({ level, progress, tutorialStep: tutorial ? 1 : 0 });
    this.commit({ lastLevel: id });
    this.setUi({ screen: 'game', modal: null });
    this.levels.preload(id + 1);
  }

  /** Слово, на котором показывается обучение. */
  get tutorialWord(): string {
    const level = this.state.level;
    if (!level) return TUTORIAL_WORD;
    return level.words.includes(TUTORIAL_WORD) ? TUTORIAL_WORD : (level.words[0] ?? TUTORIAL_WORD);
  }

  setTutorialStep(step: AppState['tutorialStep']): void {
    this.store.set({ tutorialStep: step });
    if (step === 0 && !this.state.save.tutorialDone) this.commit({ tutorialDone: true });
  }

  /** Возврат из игры в меню — логическая пауза, здесь может показаться реклама. */
  async leaveGame(): Promise<void> {
    if (this.state.busy) return;
    this.setUi({ screen: 'menu', modal: null, tutorialStep: 0 });
    await this.maybeInterstitial();
    this.offerDaily();
  }

  /** Системная кнопка «Назад» (Android): закрыть окно → предыдущий экран → диалог выхода. */
  handleBack(): void {
    const s = this.state;
    if (s.adPlaying || s.busy) return;
    if (s.modal) {
      this.closeModal();
      return;
    }
    if (s.screen === 'game') void this.leaveGame();
    else if (s.screen !== 'menu') this.go('menu');
    else this.openModal({ type: 'exit' });
  }

  exitApp(): void {
    this.persistence.flush();
    this.platform.exitApp();
  }

  // --- ход игры ----------------------------------------------------------------------

  private saveProgress(level: LevelData, progress: LevelProgress, patch: Partial<SaveData> = {}): void {
    const levels = { ...this.state.save.levels, [String(level.id)]: fromProgress(level, progress) };
    this.commit({ levels, ...patch }, { progress });
  }

  /** Учитывает найденное слово: звёзды, награды, открытие следующего уровня. */
  private registerFound(level: LevelData, progress: LevelProgress, word: string, extra: Partial<SaveData> = {}): FoundOutcome {
    const save = { ...this.state.save, ...extra };
    const stars = starsFor(progress.found.length, level.words.length);
    const newStars = Math.max(0, stars - progress.starsRewarded);
    const reward = starReward(progress.starsRewarded, stars);
    const passedNow = progress.starsRewarded === 0 && stars >= 1;
    const next: LevelProgress = { ...progress, starsRewarded: Math.max(progress.starsRewarded, stars) };
    const patch: Partial<SaveData> = { ...extra, earned: save.earned + reward };
    if (passedNow) {
      patch.unlocked = Math.min(this.state.levelCount, Math.max(save.unlocked, level.id + 1));
      patch.levelsSinceAd = save.levelsSinceAd + 1;
    }
    this.saveProgress(level, next, patch);
    return { word, stars, newStars, reward, passedNow, allFound: next.found.length >= level.words.length };
  }

  /** Проверяет введённое слово и применяет результат. */
  submit(raw: string): SubmitOutcome {
    const { level, progress } = this.state;
    if (!level || !progress) return { kind: 'invalid' };
    const result: SubmitResult = checkWord(level, progress, raw, (w) => this.dictionary.has(w));
    switch (result.kind) {
      case 'found': {
        const outcome = this.registerFound(level, addFoundWord(progress, result.word), result.word);
        return { kind: 'found', outcome };
      }
      case 'bonus': {
        this.saveProgress(level, addBonusWord(progress, result.word), {
          earned: this.state.save.earned + ECONOMY.bonusWordReward,
        });
        return result;
      }
      default:
        return result;
    }
  }

  /** Показывает окно победы или сообщение о новой звезде. Вызывается после анимации слова. */
  celebrate(outcome: FoundOutcome): void {
    if (outcome.newStars <= 0) return;
    if (outcome.passedNow || outcome.allFound) {
      this.sound('win');
      this.openModal({
        type: 'win',
        stars: outcome.stars,
        reward: outcome.reward,
        doubled: false,
        allFound: outcome.allFound && !outcome.passedNow,
      });
    } else {
      this.sound('star');
      this.showToast('star', `+${outcome.reward}`);
    }
  }

  /** Подсказка за монеты. Возвращает результат для анимации; null — подсказка не сработала. */
  hint(): { word: string; completed: boolean; outcome?: FoundOutcome } | null {
    const { level, progress, coins, busy } = this.state;
    if (!level || !progress || busy) return null;
    if (coins < ECONOMY.hintCost) {
      this.openModal({ type: 'noCoins' });
      return null;
    }
    return this.revealLetter(level, progress, ECONOMY.hintCost);
  }

  private revealLetter(level: LevelData, progress: LevelProgress, cost: number) {
    const applied = applyHint(level, progress);
    if (!applied) return null;
    const spent = this.state.save.spent + cost;
    if (applied.outcome.completed) {
      const outcome = this.registerFound(level, applied.progress, applied.outcome.word, { spent });
      return { word: applied.outcome.word, completed: true, outcome };
    }
    this.saveProgress(level, applied.progress, { spent });
    return { word: applied.outcome.word, completed: false };
  }

  /** Бесплатная подсказка за просмотр рекламы (когда не хватает монет). */
  async hintForAd(): Promise<{ word: string; completed: boolean; outcome?: FoundOutcome } | null> {
    this.closeModal();
    const rewarded = await this.runAd(() => this.platform.showRewarded());
    const { level, progress } = this.state;
    if (!rewarded || !level || !progress) return null;
    return this.revealLetter(level, progress, 0);
  }

  /** «×2 монеты за рекламу» на экране победы. */
  async doubleWinReward(): Promise<void> {
    const modal = this.state.modal;
    if (modal?.type !== 'win' || modal.doubled || modal.reward <= 0) return;
    const rewarded = await this.runAd(() => this.platform.showRewarded());
    if (!rewarded) return;
    const bonus = modal.reward * (ECONOMY.winAdMultiplier - 1);
    this.commit({ earned: this.state.save.earned + bonus }, { modal: { ...modal, reward: modal.reward + bonus, doubled: true } });
    this.sound('coin');
  }

  /** «Дальше» на экране победы: возможна реклама, затем следующий уровень. */
  async nextLevel(): Promise<void> {
    const level = this.state.level;
    if (!level || this.state.busy) return;
    this.closeModal();
    await this.maybeInterstitial();
    if (level.id >= this.state.levelCount) {
      this.setUi({ screen: 'menu', modal: { type: 'finished' } });
      return;
    }
    await this.openLevel(level.id + 1);
  }

  // --- реклама -----------------------------------------------------------------------

  /** Показывает рекламу: на это время звук и игра на паузе, после — всё восстанавливается. */
  private async runAd(show: () => Promise<boolean>): Promise<boolean> {
    if (this.state.adPlaying) return false;
    this.store.set({ adPlaying: true, busy: true });
    this.audio.setSuspended('ad', true);
    this.syncGameplay();
    let result = false;
    try {
      result = await show();
    } catch (error) {
      console.warn('Реклама не показана', error);
    }
    this.audio.setSuspended('ad', false);
    this.store.set({ adPlaying: false, busy: false });
    this.syncGameplay();
    return result;
  }

  private async maybeInterstitial(): Promise<void> {
    const save = this.state.save;
    const allowed = canShowInterstitial(
      {
        levelsPassed: save.unlocked - 1,
        levelsSinceAd: save.levelsSinceAd,
        lastShownAt: this.lastInterstitialAt,
        noAds: save.noAds,
      },
      Date.now(),
    );
    if (!allowed) return;
    const shown = await this.runAd(() => this.platform.showInterstitial());
    if (shown) {
      this.lastInterstitialAt = Date.now();
      this.commit({ levelsSinceAd: 0 });
    }
  }

  // --- ежедневный бонус --------------------------------------------------------------

  private offerDaily(): void {
    const s = this.state;
    if (s.modal || s.screen !== 'menu') return;
    // Новичку сначала показываем игру, а не окна.
    if (!s.save.tutorialDone && s.save.unlocked === 1) return;
    const offer = dailyOffer(s.save.daily, this.today());
    if (offer) this.openModal({ type: 'daily', day: offer.day, reward: offer.reward });
  }

  claimDaily(): void {
    const claimed = claimDaily(this.state.save.daily, this.today());
    if (claimed) {
      this.commit({ daily: claimed.state, earned: this.state.save.earned + claimed.offer.reward });
      this.sound('coin');
    }
    this.closeModal();
  }

  // --- темы --------------------------------------------------------------------------

  ownsTheme(theme: ThemeId): boolean {
    return theme === DEFAULT_THEME || this.state.save.themes.includes(theme);
  }

  selectTheme(theme: ThemeId): void {
    if (this.ownsTheme(theme)) this.commit({ theme });
  }

  /** Покупка темы за монеты. false — не хватило монет. */
  buyTheme(theme: ThemeId): boolean {
    if (this.ownsTheme(theme)) return true;
    if (this.state.coins < ECONOMY.themeCost) return false;
    this.commit({
      spent: this.state.save.spent + ECONOMY.themeCost,
      themes: [...this.state.save.themes, theme],
      theme,
    });
    this.sound('success');
    return true;
  }

  // --- магазин -----------------------------------------------------------------------

  get adCoinsLeft(): number {
    return adCoinsLeft(this.state.save.adCoins, this.today());
  }

  /** Бесплатные монеты за просмотр рекламы (не больше 5 раз в день). */
  async watchAdForCoins(): Promise<boolean> {
    if (this.adCoinsLeft <= 0 || this.state.busy) return false;
    const rewarded = await this.runAd(() => this.platform.showRewarded());
    if (!rewarded) return false;
    this.commit({
      earned: this.state.save.earned + ECONOMY.adCoinsReward,
      adCoins: useAdCoins(this.state.save.adCoins, this.today()),
    });
    this.sound('coin');
    this.showToast('coins', `+${ECONOMY.adCoinsReward}`);
    return true;
  }

  async refreshCatalog(): Promise<void> {
    if (!this.platform.features.payments) {
      this.store.set({ catalog: [], catalogLoaded: true, payments: false });
      return;
    }
    const catalog = await this.platform.getCatalog().catch(() => [] as CatalogItem[]);
    this.store.set({ catalog, catalogLoaded: true, payments: this.platform.features.payments });
  }

  async buyProduct(id: ProductId): Promise<boolean> {
    if (this.state.busy) return false;
    this.store.set({ busy: true });
    this.audio.setSuspended('purchase', true);
    let purchase: Purchase | null = null;
    try {
      purchase = await this.platform.purchase(id);
    } catch (error) {
      console.warn('Покупка не удалась', error);
    }
    this.audio.setSuspended('purchase', false);
    this.store.set({ busy: false });
    if (!purchase) return false;
    await this.applyPurchase(purchase);
    this.sound('coin');
    return true;
  }

  /** Начисляет покупку. Расходуемые сначала сохраняются, потом «потребляются» на площадке. */
  private async applyPurchase(purchase: Purchase): Promise<void> {
    const id = purchase.productId as ProductId;
    const save = this.state.save;
    if (CONSUMABLE_PRODUCTS.includes(id)) {
      const coins = ECONOMY.coinPacks[id as keyof typeof ECONOMY.coinPacks] ?? 0;
      if (!(purchase.token in save.purchases)) {
        this.commit({ purchases: { ...save.purchases, [purchase.token]: coins } }, {}, true);
      }
      try {
        await this.platform.consume(purchase.token);
      } catch (error) {
        // Не страшно: покупка останется необработанной и будет потреблена при следующем запуске,
        // а токен в сохранении не даст начислить монеты второй раз.
        console.warn('Покупка не потреблена, повторим при следующем запуске', error);
      }
      return;
    }
    if (id === 'no_ads' && !save.noAds) {
      this.commit({ noAds: true }, {}, true);
      this.platform.setBannerVisible(false);
    }
    if (id === 'themes_all') {
      const themes = [...new Set([...save.themes, ...PAID_THEMES])];
      if (themes.length !== save.themes.length) this.commit({ themes }, {}, true);
    }
  }

  /** При каждом запуске: доначисляет необработанные покупки и восстанавливает постоянные. */
  async processPurchases(): Promise<void> {
    if (!this.platform.features.payments) return;
    const purchases = await this.platform.getPurchases().catch(() => [] as Purchase[]);
    for (const purchase of purchases) await this.applyPurchase(purchase);
  }

  // --- вход в аккаунт ------------------------------------------------------------------

  async login(): Promise<void> {
    if (this.state.busy) return;
    this.store.set({ busy: true });
    const ok = await this.platform.login().catch(() => false);
    this.store.set({ busy: false, canLogin: this.platform.canLogin() });
    if (ok) {
      await this.reloadRemote();
      void this.processPurchases();
    }
  }
}
