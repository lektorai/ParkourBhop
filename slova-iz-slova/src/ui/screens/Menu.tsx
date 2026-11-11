import { APP_NAME, APP_NAME_EN } from '../../config/app';
import { getLanguage, t } from '../../i18n';
import { TopBar } from '../components';
import { useAppState, useGame } from '../context';
import { IconCart, IconGear, IconGrid, IconPalette } from '../icons';

export function Menu() {
  const game = useGame();
  const level = useAppState((s) => s.save.unlocked);
  const tap = (action: () => void) => () => {
    game.sound('tap');
    action();
  };
  const name = getLanguage() === 'en' ? APP_NAME_EN : APP_NAME;
  const words = name.split(' ');
  return (
    <div class="screen menu" data-testid="screen-menu">
      <TopBar
        left={
          <button type="button" class="icon-btn" aria-label={t('menu.settings')} data-testid="menu-settings" onClick={tap(() => game.go('settings'))}>
            <IconGear />
          </button>
        }
      />
      <div class="menu-body">
        <div class="logo-tiles" aria-hidden="true">
          {['С', 'Л', 'О', 'В', 'А'].map((letter, index) => (
            <span class="logo-tile" key={index}>
              {letter}
            </span>
          ))}
        </div>
        <h1 class="menu-title" data-testid="menu-title">
          {/* Как на референсе: первое слово на своей строке. */}
          {words.length >= 3 ? (
            <>
              {words[0]}{' '}
              <br />
              {words.slice(1).join(' ')}
            </>
          ) : (
            name
          )}
        </h1>
        <p class="menu-tagline">{t('menu.tagline')}</p>
        <button type="button" class="btn menu-play" data-testid="menu-play" onClick={tap(() => void game.openLevel(game.playLevel))}>
          {t('menu.play')}
          <small>{t('menu.level', { n: level })}</small>
        </button>
        <div class="menu-row">
          <button type="button" class="btn btn-wood" data-testid="menu-levels" onClick={tap(() => game.go('levels'))}>
            <IconGrid />
            {t('menu.levels')}
          </button>
          <button type="button" class="btn btn-wood" data-testid="menu-themes" onClick={tap(() => game.go('themes'))}>
            <IconPalette />
            {t('menu.themes')}
          </button>
          <button type="button" class="btn btn-wood" data-testid="menu-shop" onClick={tap(() => game.go('shop'))}>
            <IconCart />
            {t('menu.shop')}
          </button>
        </div>
      </div>
    </div>
  );
}
