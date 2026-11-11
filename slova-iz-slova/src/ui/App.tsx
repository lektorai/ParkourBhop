import { useEffect, useRef } from 'preact/hooks';
import type { Game } from '../state/game';
import { ToastView } from './components';
import { GameContext, useAppState } from './context';
import { StageContext, useStageSize } from './layout';
import { ModalHost } from './modals';
import { GameScreen } from './screens/GameScreen';
import { Levels } from './screens/Levels';
import { Menu } from './screens/Menu';
import { Settings } from './screens/Settings';
import { Shop } from './screens/Shop';
import { Themes } from './screens/Themes';

function Background() {
  const theme = useAppState((s) => s.save.theme);
  const images = __THEME_BACKGROUNDS__[theme];
  const style: Record<string, string> = {};
  if (images?.portrait) style['--bg-portrait'] = `url(./assets/themes/${theme}/bg-portrait.webp)`;
  if (images?.landscape) style['--bg-landscape'] = `url(./assets/themes/${theme}/bg-landscape.webp)`;
  const hasImage = Boolean(images?.portrait || images?.landscape);
  if (hasImage && !images?.portrait) style['--bg-portrait'] = style['--bg-landscape']!;
  return (
    <div class="bg" aria-hidden="true">
      {hasImage ? <div class="bg-image" style={style} /> : <div class="bg-decor" />}
      <div class="bg-veil" />
    </div>
  );
}

function Shell() {
  const screen = useAppState((s) => s.screen);
  const theme = useAppState((s) => s.save.theme);
  const busy = useAppState((s) => s.busy);
  const stageRef = useRef<HTMLDivElement>(null);
  const size = useStageSize(() => stageRef.current);

  // Тема переключается сменой класса на <body>.
  useEffect(() => {
    const body = document.body;
    body.className = body.className.replace(/\btheme-\S+/g, '').trim();
    body.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle('busy', busy);
  }, [busy]);

  return (
    <StageContext.Provider value={size}>
      <Background />
      <div class="stage" ref={stageRef}>
        {screen === 'menu' && <Menu />}
        {screen === 'levels' && <Levels />}
        {screen === 'game' && <GameScreen />}
        {screen === 'themes' && <Themes />}
        {screen === 'shop' && <Shop />}
        {screen === 'settings' && <Settings />}
        <ModalHost />
        <ToastView />
      </div>
    </StageContext.Provider>
  );
}

export function App({ game }: { game: Game }) {
  return (
    <GameContext.Provider value={game}>
      <Shell />
    </GameContext.Provider>
  );
}
