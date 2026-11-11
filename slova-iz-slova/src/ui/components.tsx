/** Общие компоненты: верхняя панель, счётчик монет, окно, звёзды, всплывающая надпись. */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { useAppState, useGame } from './context';
import { IconBack, IconClose, IconCoin, IconPlus, IconStar } from './icons';

/** Счётчик монет. С плюсом — кнопка, открывающая магазин. */
export function Coins({ withShop = true }: { withShop?: boolean }) {
  const game = useGame();
  const coins = useAppState((s) => s.coins);
  if (!withShop) {
    return (
      <div class="coins static" data-testid="coins" aria-label={`${t('common.coins')}: ${coins}`}>
        <IconCoin />
        <span class="coins-value">{coins}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      class="coins"
      data-testid="coins"
      aria-label={t('game.shop', { n: coins })}
      onClick={() => {
        game.sound('tap');
        game.go('shop');
      }}
    >
      <IconCoin />
      <span class="coins-value">{coins}</span>
      <span class="coins-plus">
        <IconPlus />
      </span>
    </button>
  );
}

interface TopBarProps {
  title?: string;
  onBack?: () => void;
  left?: ComponentChildren;
  coinsShop?: boolean;
}

export function TopBar({ title, onBack, left, coinsShop = true }: TopBarProps) {
  const game = useGame();
  return (
    <header class="topbar">
      {left ??
        (onBack && (
          <button
            type="button"
            class="icon-btn"
            data-testid="back"
            aria-label={t('common.back')}
            onClick={() => {
              game.sound('tap');
              onBack();
            }}
          >
            <IconBack />
          </button>
        ))}
      <div class="topbar-title">{title && <h1 class="pill">{title}</h1>}</div>
      <Coins withShop={coinsShop} />
    </header>
  );
}

interface DialogProps {
  title: string;
  onClose?: () => void;
  children: ComponentChildren;
  testId?: string;
}

/** Модальное окно. Если задан onClose — закрывается крестиком, по Escape и по нажатию мимо окна. */
export function Dialog({ title, onClose, children, testId }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      class="overlay"
      onClick={(event) => {
        if (onClose && event.target === event.currentTarget) onClose();
      }}
    >
      <div class="dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} data-testid={testId}>
        {onClose && (
          <button type="button" class="dialog-close" aria-label={t('common.close')} onClick={onClose} data-testid="dialog-close">
            <IconClose />
          </button>
        )}
        <h2 class="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Stars({ count, class: className }: { count: number; class?: string }) {
  return (
    <span class={className} aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <IconStar key={n} on={count >= n} />
      ))}
    </span>
  );
}

export function ToastView() {
  const toast = useAppState((s) => s.toast);
  if (!toast) return null;
  return (
    <div class="toast" key={toast.id} role="status" data-testid="toast" data-kind={toast.kind}>
      {toast.kind === 'star' && <IconStar on />}
      {(toast.kind === 'coins' || toast.kind === 'bonus') && <IconCoin />}
      {toast.text}
    </div>
  );
}
