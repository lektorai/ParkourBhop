import type { ComponentChildren } from 'preact';
import { t } from '../../i18n';
import { TopBar } from '../components';
import { useAppState, useGame } from '../context';
import { IconChevron, IconHelp, IconInfo, IconMusic, IconShield, IconSound, IconUser, IconVibration } from '../icons';

function Toggle(props: { icon: ComponentChildren; label: string; checked: boolean; testId: string; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      class="panel setting"
      role="switch"
      aria-checked={props.checked}
      data-testid={props.testId}
      onClick={() => props.onChange(!props.checked)}
    >
      {props.icon}
      <span class="setting-text">{props.label}</span>
      <span class="switch" />
    </button>
  );
}

function Link(props: { icon: ComponentChildren; label: string; note?: string; testId: string; onClick: () => void }) {
  return (
    <button type="button" class="panel setting" data-testid={props.testId} onClick={props.onClick}>
      {props.icon}
      <span class="setting-text">
        {props.label}
        {props.note && <span class="setting-note">{props.note}</span>}
      </span>
      <IconChevron class="chevron" />
    </button>
  );
}

export function Settings() {
  const game = useGame();
  const settings = useAppState((s) => s.save.settings);
  const canLogin = useAppState((s) => s.canLogin);
  return (
    <div class="screen" data-testid="screen-settings">
      <TopBar title={t('settings.title')} onBack={() => game.go('menu')} />
      <div class="scroll">
        <Toggle
          icon={<IconSound />}
          label={t('settings.sound')}
          checked={settings.sound}
          testId="toggle-sound"
          onChange={(sound) => {
            game.updateSettings({ sound });
            if (sound) game.sound('tap');
          }}
        />
        <Toggle
          icon={<IconMusic />}
          label={t('settings.music')}
          checked={settings.music}
          testId="toggle-music"
          onChange={(music) => game.updateSettings({ music })}
        />
        <Toggle
          icon={<IconVibration />}
          label={t('settings.vibration')}
          checked={settings.vibration}
          testId="toggle-vibration"
          onChange={(vibration) => {
            game.updateSettings({ vibration });
            if (vibration) game.haptic('tap');
          }}
        />
        <Link icon={<IconHelp />} label={t('settings.howto')} testId="open-howto" onClick={() => game.openModal({ type: 'howto' })} />
        {canLogin && (
          <Link
            icon={<IconUser />}
            label={t('settings.login')}
            note={t('settings.loginNote')}
            testId="login"
            onClick={() => void game.login()}
          />
        )}
        <Link icon={<IconShield />} label={t('settings.privacy')} testId="open-privacy" onClick={() => game.openModal({ type: 'privacy' })} />
        <Link icon={<IconInfo />} label={t('settings.about')} testId="open-about" onClick={() => game.openModal({ type: 'about' })} />
      </div>
    </div>
  );
}
