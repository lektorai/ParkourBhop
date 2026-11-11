import { ECONOMY, THEMES, type ThemeId } from '../../config/economy';
import { t, type TextKey } from '../../i18n';
import { TopBar } from '../components';
import { useAppState, useGame } from '../context';
import { IconCheck, IconCoin } from '../icons';

/** Уменьшенный игровой экран в цветах темы. */
function Preview({ theme }: { theme: ThemeId }) {
  return (
    <div class={`theme-preview theme-${theme}`} aria-hidden="true">
      <div class="theme-preview-inner">
        <div class="preview-words">
          <div class="preview-word found" />
          <div class="preview-word found" />
          <div class="preview-word" />
        </div>
        <div class="preview-field">ВЕК</div>
        <div class="preview-tiles">
          {['С', 'Л', 'О', 'В'].map((letter) => (
            <span class="preview-tile" key={letter}>
              {letter}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Themes() {
  const game = useGame();
  const save = useAppState((s) => s.save);
  const coins = useAppState((s) => s.coins);
  return (
    <div class="screen" data-testid="screen-themes">
      <TopBar title={t('themes.title')} onBack={() => game.go('menu')} />
      <div class="scroll">
        {THEMES.map((theme) => {
          const owned = game.ownsTheme(theme);
          const selected = save.theme === theme;
          const missing = ECONOMY.themeCost - coins;
          return (
            <section class="panel theme-card" key={theme} data-testid={`theme-${theme}`}>
              <Preview theme={theme} />
              <div class="theme-info">
                <h2 class="theme-name">{t(`themes.${theme}` as TextKey)}</h2>
                {selected ? (
                  <div class="badge-selected" data-testid={`theme-${theme}-selected`}>
                    <IconCheck />
                    {t('themes.selected')}
                  </div>
                ) : owned ? (
                  <button
                    type="button"
                    class="btn"
                    data-testid={`theme-${theme}-select`}
                    onClick={() => {
                      game.sound('tap');
                      game.selectTheme(theme);
                    }}
                  >
                    {t('themes.select')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      class="btn"
                      data-testid={`theme-${theme}-buy`}
                      onClick={() => {
                        if (!game.buyTheme(theme)) {
                          game.sound('error');
                          game.showToast('info', t('toast.notEnough'));
                        }
                      }}
                    >
                      {t('themes.buy', { n: ECONOMY.themeCost })}
                      <IconCoin />
                    </button>
                    {missing > 0 && <p class="theme-note muted">{t('themes.needMore', { n: missing })}</p>}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
