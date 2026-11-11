/** Доступ к контроллеру игры и состоянию из компонентов. */
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { AppState, Game } from '../state/game';
import { useStore } from '../state/store';

export const GameContext = createContext<Game | null>(null);

export function useGame(): Game {
  const game = useContext(GameContext);
  if (!game) throw new Error('GameContext не задан');
  return game;
}

export function useAppState<S>(selector: (state: AppState) => S): S {
  return useStore(useGame().store, selector);
}
