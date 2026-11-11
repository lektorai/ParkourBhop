/**
 * Запись сохранений: всегда локально (localStorage), дополнительно — в хранилище площадки
 * (облако Яндекса или Capacitor Preferences) с дебаунсом 2 с и немедленно при сворачивании.
 */
import type { PlatformAdapter } from '../platform';
import { storageGet, storageSet } from '../platform/storage';
import { mergeSaves, parseSave, serializeSave, type SaveData } from './save';

const LOCAL_KEY = 'slova.save';
const CLOUD_DEBOUNCE_MS = 2000;
const CLOUD_LOAD_TIMEOUT_MS = 5000;

export class Persistence {
  private timer: number | null = null;
  private pending: string | null = null;

  constructor(private readonly platform: PlatformAdapter) {}

  loadLocal(): SaveData | null {
    return parseSave(storageGet(LOCAL_KEY));
  }

  /** Читает сохранение площадки. Не дольше 5 секунд: игра не должна зависать на загрузке. */
  async loadRemote(): Promise<SaveData | null> {
    const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), CLOUD_LOAD_TIMEOUT_MS));
    try {
      return parseSave(await Promise.race([this.platform.loadData(), timeout]));
    } catch {
      return null;
    }
  }

  static merge(local: SaveData | null, remote: SaveData | null): SaveData | null {
    if (local && remote) return mergeSaves(local, remote);
    return local ?? remote;
  }

  /** Сохраняет сразу локально и откладывает запись на площадку. */
  write(save: SaveData, flush = false): void {
    const text = serializeSave(save);
    storageSet(LOCAL_KEY, text);
    this.pending = text;
    if (flush) {
      this.flush();
      return;
    }
    if (this.timer === null) {
      this.timer = window.setTimeout(() => this.flush(), CLOUD_DEBOUNCE_MS);
    }
  }

  /** Немедленно отправляет отложенную запись (сворачивание страницы, пауза, покупка). */
  flush(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending === null) return;
    const text = this.pending;
    this.pending = null;
    void this.platform.saveData(text, true).catch(() => undefined);
  }
}
