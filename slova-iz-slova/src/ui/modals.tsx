/** Содержимое модальных окон. */
import { APP_NAME, APP_NAME_EN, APP_VERSION, SUPPORT_EMAIL } from '../config/app';
import { ECONOMY } from '../config/economy';
import { getLanguage, t, type TextKey } from '../i18n';
import type { Modal } from '../state/game';
import { Dialog } from './components';
import { useAppState, useGame } from './context';
import { IconCoin, IconStar, IconVideo } from './icons';

function WinDialog({ modal }: { modal: Extract<Modal, { type: 'win' }> }) {
  const game = useGame();
  const isLast = useAppState((s) => (s.level?.id ?? 0) >= s.levelCount);
  return (
    <Dialog title={modal.allFound ? t('win.allFound') : t('win.title')} testId="win">
      <div class="win-stars" role="img" aria-label={t('win.stars', { n: modal.stars })}>
        {[1, 2, 3].map((n) => (
          <span class="win-star" key={n}>
            <IconStar on={modal.stars >= n} />
          </span>
        ))}
      </div>
      {modal.reward > 0 && (
        <div class="reward">
          {t('win.reward')}
          <span class="reward-value" data-testid="win-reward">
            <IconCoin />+{modal.reward}
          </span>
        </div>
      )}
      {modal.doubled && <p class="reward-note muted">{t('win.doubled')}</p>}
      <div class="dialog-actions">
        <button type="button" class="btn" data-testid="win-next" onClick={() => void game.nextLevel()}>
          {isLast ? t('win.menu') : t('win.next')}
        </button>
        {!modal.doubled && modal.reward > 0 && (
          <button type="button" class="btn btn-wood" data-testid="win-double" onClick={() => void game.doubleWinReward()}>
            <IconVideo />
            {t('win.double')}
          </button>
        )}
        {!modal.allFound && modal.stars < 3 && (
          <button type="button" class="btn btn-plain" data-testid="win-more" onClick={() => game.closeModal()}>
            {t('win.more')}
          </button>
        )}
      </div>
    </Dialog>
  );
}

function DailyDialog({ modal }: { modal: Extract<Modal, { type: 'daily' }> }) {
  const game = useGame();
  return (
    <Dialog title={t('daily.title')} testId="daily">
      <p class="dialog-body" style="text-align:center">
        {t('daily.text')}
      </p>
      <div class="daily-grid">
        {ECONOMY.dailyRewards.map((reward, index) => {
          const day = index + 1;
          const state = day < modal.day ? ' done' : day === modal.day ? ' today' : '';
          return (
            <div class={`daily-day${state}`} key={day}>
              {t('daily.day', { n: day })}
              <IconCoin />
              <b>{reward}</b>
            </div>
          );
        })}
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn" data-testid="daily-claim" onClick={() => game.claimDaily()}>
          {t('daily.claim', { n: modal.reward })}
        </button>
      </div>
    </Dialog>
  );
}

function NoCoinsDialog() {
  const game = useGame();
  return (
    <Dialog title={t('nocoins.title')} onClose={() => game.closeModal()} testId="nocoins">
      <p class="dialog-body" style="text-align:center">
        {t('nocoins.text', { n: ECONOMY.hintCost })}
      </p>
      <div class="dialog-actions">
        <button
          type="button"
          class="btn"
          data-testid="nocoins-ad"
          onClick={async () => {
            const result = await game.hintForAd();
            if (!result) game.showToast('info', t('toast.noReward'));
            else if (result.outcome) game.celebrate(result.outcome);
          }}
        >
          <IconVideo />
          {t('nocoins.ad')}
        </button>
        <button type="button" class="btn btn-wood" data-testid="nocoins-shop" onClick={() => game.go('shop')}>
          {t('nocoins.shop')}
        </button>
      </div>
    </Dialog>
  );
}

function BonusDialog() {
  const game = useGame();
  const bonus = useAppState((s) => s.progress?.bonus ?? []);
  return (
    <Dialog title={t('bonus.title')} onClose={() => game.closeModal()} testId="bonus-words">
      <div class="dialog-body scroll">
        <p>{bonus.length ? t('bonus.note') : t('bonus.empty')}</p>
        <div class="bonus-list">
          {bonus.map((word) => (
            <span class="bonus-word" key={word}>
              {word}
            </span>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

function TextDialog({ title, testId, children }: { title: string; testId: string; children: preact.ComponentChildren }) {
  const game = useGame();
  return (
    <Dialog title={title} onClose={() => game.closeModal()} testId={testId}>
      <div class="dialog-body scroll">{children}</div>
      <div class="dialog-actions">
        <button type="button" class="btn" data-testid="dialog-ok" onClick={() => game.closeModal()}>
          {t('common.ok')}
        </button>
      </div>
    </Dialog>
  );
}

function HowToDialog() {
  const game = useGame();
  const keys: TextKey[] = ['howto.1', 'howto.2', 'howto.3', 'howto.4', 'howto.5', 'howto.6', 'howto.7'];
  // Управление с клавиатуры описываем там, где оно есть.
  if (game.platform.id !== 'rustore') keys.push('howto.keys');
  return (
    <TextDialog title={t('howto.title')} testId="howto">
      <ol class="text-list">
        {keys.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>
    </TextDialog>
  );
}

function PrivacyDialog() {
  const name = getLanguage() === 'en' ? APP_NAME_EN : APP_NAME;
  return (
    <TextDialog title={t('privacy.title')} testId="privacy">
      <p>{t('privacy.1', { name })}</p>
      <p>{t('privacy.2')}</p>
      <p>{t('privacy.3')}</p>
      <p>{t('privacy.4')}</p>
      <p>{t('privacy.5')}</p>
      {SUPPORT_EMAIL && <p>{t('privacy.contact', { email: SUPPORT_EMAIL })}</p>}
    </TextDialog>
  );
}

function AboutDialog() {
  const levels = useAppState((s) => s.levelCount);
  const name = getLanguage() === 'en' ? APP_NAME_EN : APP_NAME;
  return (
    <TextDialog title={t('about.title')} testId="about">
      <p>
        <b>{name}</b>. {t('about.version', { version: APP_VERSION })}
      </p>
      <p>{t('about.text', { levels })}</p>
      <p>
        <b>{t('about.credits')}</b>
      </p>
      <p>{t('about.dict')}</p>
      <p>{t('about.font')}</p>
    </TextDialog>
  );
}

function ExitDialog() {
  const game = useGame();
  return (
    <Dialog title={t('exit.title')} onClose={() => game.closeModal()} testId="exit">
      <p class="dialog-body" style="text-align:center">
        {t('exit.text')}
      </p>
      <div class="dialog-actions">
        <button type="button" class="btn" data-testid="exit-no" onClick={() => game.closeModal()}>
          {t('exit.no')}
        </button>
        <button type="button" class="btn btn-plain" data-testid="exit-yes" onClick={() => game.exitApp()}>
          {t('exit.yes')}
        </button>
      </div>
    </Dialog>
  );
}

function FinishedDialog() {
  return (
    <TextDialog title={t('finished.title')} testId="finished">
      <p>{t('finished.text')}</p>
    </TextDialog>
  );
}

export function ModalHost() {
  const modal = useAppState((s) => s.modal);
  if (!modal) return null;
  switch (modal.type) {
    case 'win':
      return <WinDialog modal={modal} />;
    case 'daily':
      return <DailyDialog modal={modal} />;
    case 'noCoins':
      return <NoCoinsDialog />;
    case 'bonusWords':
      return <BonusDialog />;
    case 'howto':
      return <HowToDialog />;
    case 'privacy':
      return <PrivacyDialog />;
    case 'about':
      return <AboutDialog />;
    case 'exit':
      return <ExitDialog />;
    case 'finished':
      return <FinishedDialog />;
  }
}
