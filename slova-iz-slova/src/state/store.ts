/** Минимальное наблюдаемое хранилище состояния для Preact. */
import { useEffect, useState } from 'preact/hooks';

export class Store<T extends object> {
  private listeners = new Set<() => void>();

  constructor(private state: T) {}

  get(): T {
    return this.state;
  }

  set(patch: Partial<T>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** Подписывает компонент на часть состояния. Перерисовка — только когда выбранное значение изменилось. */
export function useStore<T extends object, S>(store: Store<T>, selector: (state: T) => S): S {
  const [value, setValue] = useState(() => selector(store.get()));
  useEffect(() => {
    const update = () => setValue(() => selector(store.get()));
    update();
    return store.subscribe(update);
    // Селектор намеренно не в зависимостях: он создаётся заново на каждый рендер.
  }, [store]);
  return value;
}
