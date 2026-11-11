/** Игровой экран: список слов, поле ввода, плитки букв, подсказки. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ECONOMY } from '../../config/economy';
import { keyToLetter } from '../../game/keyboard';
import { groupByLength, starsFor, starTargets } from '../../game/session';
import type { LevelData, LevelProgress } from '../../game/types';
import { t, tn } from '../../i18n';
import type { FoundOutcome } from '../../state/game';
import { TopBar } from '../components';
import { useAppState, useGame } from '../context';
import { IconBulb, IconCheck, IconCoin, IconErase, IconNext, IconPointer, IconShuffle, IconStar } from '../icons';
import { tileLayout, useStage } from '../layout';

const FLY_MS = 380;
const LONG_PRESS_MS = 500;

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Прокручивает список так, чтобы слово оказалось на виду. */
function revealWord(list: HTMLElement | null, word: string, smooth: boolean): HTMLElement | null {
  const target = list?.querySelector<HTMLElement>(`[data-word="${word}"]`) ?? null;
  if (!list || !target) return target;
  const listRect = list.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  if (rect.top < listRect.top + 4 || rect.bottom > listRect.bottom - 4) {
    const top = list.scrollTop + rect.top - listRect.top - (list.clientHeight - rect.height) / 2;
    if (smooth && !reducedMotion() && typeof list.scrollTo === 'function') list.scrollTo({ top, behavior: 'smooth' });
    else list.scrollTop = top;
  }
  return target;
}

/** Слово улетает из поля ввода в свою ячейку списка. */
function flyWord(from: HTMLElement, to: HTMLElement, text: string, done: () => void): void {
  if (reducedMotion() || typeof from.animate !== 'function') {
    done();
    return;
  }
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const width = Math.min(a.width, Math.max(b.width * 1.6, text.length * 26));
  const left = a.left + (a.width - width) / 2;
  const ghost = document.createElement('div');
  ghost.className = 'flying';
  ghost.textContent = text;
  ghost.style.cssText = `left:${left}px;top:${a.top}px;width:${width}px;height:${a.height}px;font-size:${a.height * 0.5}px`;
  // Тема задана классом на body, поэтому «призрак» добавляем туда же.
  document.body.appendChild(ghost);
  const animation = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      {
        transform: `translate(${b.left - left}px, ${b.top - a.top}px) scale(${b.width / width}, ${b.height / a.height})`,
        opacity: 0.85,
      },
    ],
    { duration: FLY_MS, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
  );
  const finish = () => {
    ghost.remove();
    done();
  };
  animation.onfinish = finish;
  animation.oncancel = finish;
}

function shuffled(order: number[]): number[] {
  if (order.length < 2) return order;
  const next = [...order];
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j]!, next[i]!];
    }
    if (next.some((value, index) => value !== order[index])) break;
  }
  return next;
}

export function GameScreen() {
  const level = useAppState((s) => s.level);
  const progress = useAppState((s) => s.progress);
  if (!level || !progress) return null;
  return <Board key={level.id} level={level} progress={progress} />;
}

function Board({ level, progress }: { level: LevelData; progress: LevelProgress }) {
  const game = useGame();
  const stage = useStage();
  const modal = useAppState((s) => s.modal);
  const busy = useAppState((s) => s.busy);
  const tutorialStep = useAppState((s) => s.tutorialStep);

  const letters = useMemo(() => Array.from(level.source.toUpperCase()), [level.source]);
  const [order, setOrder] = useState<number[]>(() => letters.map((_, i) => i));
  const [picked, setPicked] = useState<number[]>([]);
  const [shake, setShake] = useState(0);
  const [arriving, setArriving] = useState<string | null>(null);
  const [popWord, setPopWord] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ word: string; id: number } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const flipRects = useRef<Map<number, DOMRect> | null>(null);
  const timers = useRef<number[]>([]);
  const longPress = useRef<{ timer: number | null; fired: boolean }>({ timer: null, fired: false });

  const typed = picked.map((i) => letters[i]).join('');
  const found = useMemo(() => new Set(progress.found), [progress.found]);
  const groups = useMemo(() => groupByLength(level.words), [level.words]);
  const total = level.words.length;
  const stars = starsFor(progress.found.length, total);
  const targets = starTargets(total);
  const tutorialWord = game.tutorialWord.toUpperCase();
  const inputLocked = busy || Boolean(modal) || arriving !== null;

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // --- раскладка плиток -------------------------------------------------------------
  const [controlsWidth, setControlsWidth] = useState(stage.width - 24);
  useLayoutEffect(() => {
    const width = controlsRef.current?.clientWidth;
    if (width && width !== controlsWidth) setControlsWidth(width);
  }, [stage.width, stage.height, stage.compact, controlsWidth]);
  const layout = tileLayout(letters.length, controlsWidth, stage.rem, stage.compact);

  // --- ввод ---------------------------------------------------------------------------
  const pick = useCallback(
    (tile: number) => {
      if (inputLocked) return;
      const position = picked.indexOf(tile);
      if (tutorialStep === 2 || tutorialStep === 3) return;
      if (tutorialStep === 1) {
        // В обучении нажимается только следующая нужная буква.
        if (position >= 0 || letters[tile] !== tutorialWord[picked.length]) return;
      }
      if (position >= 0) {
        // Нажатие на использованную плитку убирает её и все буквы после неё.
        setPicked(picked.slice(0, position));
        game.sound('untap');
        return;
      }
      const next = [...picked, tile];
      setPicked(next);
      game.sound('tap');
      game.haptic('tap');
      if (tutorialStep === 1 && next.map((i) => letters[i]).join('') === tutorialWord) game.setTutorialStep(2);
    },
    [game, inputLocked, letters, picked, tutorialStep, tutorialWord],
  );

  const erase = useCallback(() => {
    if (inputLocked || tutorialStep !== 0 || picked.length === 0) return;
    setPicked(picked.slice(0, -1));
    game.sound('untap');
  }, [game, inputLocked, picked, tutorialStep]);

  const clear = useCallback(() => {
    if (inputLocked || tutorialStep !== 0 || picked.length === 0) return;
    setPicked([]);
    game.sound('untap');
  }, [game, inputLocked, picked, tutorialStep]);

  const shuffle = useCallback(() => {
    if (inputLocked) return;
    const rects = new Map<number, DOMRect>();
    tilesRef.current?.querySelectorAll<HTMLElement>('[data-tile]').forEach((el) => {
      rects.set(Number(el.dataset.tile), el.getBoundingClientRect());
    });
    flipRects.current = rects;
    setOrder((current) => shuffled(current));
    game.sound('shuffle');
  }, [game, inputLocked]);

  // Анимация перемешивания: плитки переезжают со старых мест на новые.
  useLayoutEffect(() => {
    const before = flipRects.current;
    flipRects.current = null;
    if (!before || reducedMotion()) return;
    tilesRef.current?.querySelectorAll<HTMLElement>('[data-tile]').forEach((el) => {
      const old = before.get(Number(el.dataset.tile));
      if (!old || typeof el.animate !== 'function') return;
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (dx || dy) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
          duration: 300,
          easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
        });
      }
    });
  }, [order]);

  const flashWord = useCallback((word: string) => {
    revealWord(listRef.current, word, true);
    setFlash((prev) => ({ word, id: (prev?.id ?? 0) + 1 }));
  }, []);

  const afterFound = useCallback(
    (outcome: FoundOutcome) => {
      setPopWord(outcome.word);
      game.celebrate(outcome);
    },
    [game],
  );

  const submit = useCallback(() => {
    if (inputLocked || typed.length === 0 || tutorialStep === 1 || tutorialStep === 3) return;
    const result = game.submit(typed);
    switch (result.kind) {
      case 'found': {
        const { outcome } = result;
        game.sound('success');
        game.haptic('success');
        setPicked([]);
        setArriving(outcome.word);
        if (tutorialStep === 2) game.setTutorialStep(3);
        // Ждём кадр, чтобы список отрисовал ячейку слова, и запускаем полёт.
        window.requestAnimationFrame(() => {
          const target = revealWord(listRef.current, outcome.word, false);
          const finish = () => {
            setArriving(null);
            afterFound(outcome);
          };
          if (target && fieldRef.current) flyWord(fieldRef.current, target, outcome.word.toUpperCase(), finish);
          else finish();
        });
        break;
      }
      case 'already':
        setPicked([]);
        game.sound('untap');
        flashWord(result.word);
        game.showToast('info', t('toast.already'));
        break;
      case 'bonus':
        setPicked([]);
        game.sound('bonus');
        game.haptic('success');
        game.showToast('bonus', t('toast.bonus', { n: ECONOMY.bonusWordReward }));
        break;
      case 'bonus-already':
        setPicked([]);
        game.sound('untap');
        game.showToast('info', t('toast.bonusAlready'));
        break;
      default:
        // Несуществующее слово: поле трясётся, штрафа нет.
        game.sound('error');
        game.haptic('error');
        setShake((n) => n + 1);
        if (result.kind === 'too-short') game.showToast('info', t('toast.short'));
        if (result.kind === 'source') game.showToast('info', t('toast.source'));
        later(() => setPicked([]), 380);
    }
  }, [afterFound, flashWord, game, inputLocked, tutorialStep, typed]);

  const hint = useCallback(() => {
    if (inputLocked || tutorialStep !== 0) return;
    const result = game.hint();
    if (!result) return;
    game.sound('bonus');
    if (result.completed && result.outcome) {
      revealWord(listRef.current, result.word, true);
      afterFound(result.outcome);
    } else {
      flashWord(result.word);
    }
  }, [afterFound, flashWord, game, inputLocked, tutorialStep]);

  // --- клавиатура (в любой раскладке) --------------------------------------------------
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || inputLocked) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        erase();
        return;
      }
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        shuffle();
        return;
      }
      const letter = keyToLetter(event.key, event.code)?.toUpperCase();
      if (!letter) return;
      const tile = order.find((i) => letters[i] === letter && !picked.includes(i));
      if (tile !== undefined) {
        event.preventDefault();
        pick(tile);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [erase, inputLocked, letters, order, pick, picked, shuffle, submit]);

  // --- долгое нажатие на «Стереть» очищает слово целиком -----------------------------
  const eraseDown = () => {
    longPress.current.fired = false;
    longPress.current.timer = window.setTimeout(() => {
      longPress.current.fired = true;
      clear();
    }, LONG_PRESS_MS);
  };
  const eraseUp = () => {
    if (longPress.current.timer !== null) window.clearTimeout(longPress.current.timer);
    longPress.current.timer = null;
  };
  const eraseClick = () => {
    if (longPress.current.fired) {
      longPress.current.fired = false;
      return;
    }
    erase();
  };

  const nextTutorialTile =
    tutorialStep === 1 ? order.find((i) => !picked.includes(i) && letters[i] === tutorialWord[picked.length]) : undefined;
  const listWidth = stage.compact ? stage.width * 0.5 : stage.width;

  return (
    <div class="screen game" data-testid="screen-game" data-level={level.id}>
      <TopBar title={t('game.level', { n: level.id })} onBack={() => void game.leaveGame()} />

      <div class="progress">
        <div class="progress-row">
          <span class="progress-text" data-testid="found-count" data-found={progress.found.length} data-total={total}>
            {t('game.found', { x: progress.found.length, y: total })}
          </span>
          <span style="display:flex;align-items:center">
            {progress.bonus.length > 0 && (
              <button type="button" class="chip" data-testid="bonus-chip" onClick={() => game.openModal({ type: 'bonusWords' })}>
                {t('game.bonus', { n: progress.bonus.length })}
              </button>
            )}
            {stars >= 1 && tutorialStep === 0 && (
              <button type="button" class="chip chip-next" data-testid="next-chip" onClick={() => void game.nextLevel()}>
                {t('game.next')}
                <IconNext />
              </button>
            )}
          </span>
        </div>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={progress.found.length}
          aria-label={t('game.found', { x: progress.found.length, y: total })}
        >
          <div
            class={`progress-fill${progress.found.length === 0 ? ' empty' : ''}`}
            style={{ width: `${(progress.found.length / total) * 100}%` }}
          />
          {targets.map((target, index) => (
            <span class="progress-star" key={index} style={{ left: `${(target / total) * 100}%` }}>
              <IconStar on={stars > index} />
            </span>
          ))}
        </div>
      </div>

      <div class="wordlist scroll" ref={listRef} data-testid="wordlist">
        <div class="groups">
          {groups.map(([length, words]) => {
            const wordWidth = (length * 1.34 + 0.44 + 0.45) * stage.rem;
            const fit = Math.max(1, Math.floor((listWidth - 2.6 * stage.rem) / wordWidth));
            const cols = Math.min(fit, Math.max(1, Math.ceil(words.length / 5)));
            return (
              <section class="panel group" key={length} style={{ '--cols': cols }}>
                <h2 class="group-head">{tn('letters', length)}</h2>
                <div class="group-words">
                  {words.map((word) => {
                    const isFound = found.has(word);
                    const hinted = progress.hints[word] ?? 0;
                    const classes = ['word'];
                    if (isFound) classes.push('found');
                    if (arriving === word) classes.push('arriving');
                    if (popWord === word) classes.push('pop');
                    if (flash?.word === word) classes.push('flash');
                    return (
                      <div
                        class={classes.join(' ')}
                        key={flash?.word === word ? `${word}-${flash.id}` : word}
                        data-word={word}
                        data-found={isFound ? '1' : '0'}
                      >
                        {Array.from(word).map((letter, index) => {
                          const visible = isFound || index < hinted;
                          return (
                            <span class={`cell${visible ? '' : ' empty'}`} key={index}>
                              {visible ? letter : ''}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {tutorialStep > 0 && (
        <div class="tutorial" role="status" data-testid="tutorial" data-step={tutorialStep}>
          {tutorialStep === 1 && t('tutorial.step1', { word: tutorialWord })}
          {tutorialStep === 2 && t('tutorial.step2')}
          {tutorialStep === 3 && t('tutorial.step3')}
          <div class="tutorial-actions">
            {tutorialStep === 3 ? (
              <button type="button" class="tutorial-btn primary" data-testid="tutorial-done" onClick={() => game.setTutorialStep(0)}>
                {t('common.ok')}
              </button>
            ) : (
              <button
                type="button"
                class="tutorial-btn"
                data-testid="tutorial-skip"
                onClick={() => {
                  setPicked([]);
                  game.setTutorialStep(0);
                }}
              >
                {t('tutorial.skip')}
              </button>
            )}
          </div>
        </div>
      )}

      <div class="game-controls" ref={controlsRef}>
        <div class="entry">
          <div
            class={`field${shake ? ' shake' : ''}${typed.length > 9 ? ' long' : ''}`}
            key={shake}
            ref={fieldRef}
            data-testid="field"
            data-value={typed}
            aria-live="polite"
          >
            {typed ? (
              <>
                {typed}
                <span class="caret" />
              </>
            ) : (
              <span class="field-placeholder">{t('game.placeholder')}</span>
            )}
          </div>
          <button
            type="button"
            class={`check-btn${tutorialStep === 2 ? ' target' : ''}`}
            data-testid="check"
            aria-label={t('game.check')}
            disabled={typed.length === 0}
            onClick={submit}
          >
            <IconCheck />
          </button>
        </div>

        <div
          class="tiles"
          ref={tilesRef}
          data-testid="tiles"
          style={{ maxWidth: `${layout.width}px`, '--tile': `${layout.size}px`, '--tile-gap': `${layout.gap / 2}px` }}
        >
          {order.map((tile) => {
            const used = picked.includes(tile);
            const isTarget = tile === nextTutorialTile;
            return (
              <button
                type="button"
                key={tile}
                data-tile={tile}
                data-letter={letters[tile]}
                data-used={used ? '1' : '0'}
                class={`tile${used ? ' used' : ''}${isTarget ? ' target' : ''}${tutorialStep === 1 && !isTarget && !used ? ' dim' : ''}`}
                aria-label={t('game.letter', { letter: letters[tile]! })}
                aria-pressed={used}
                onClick={() => pick(tile)}
              >
                {letters[tile]}
                {isTarget && <IconPointer class="pointer" />}
              </button>
            );
          })}
        </div>

        <div class="actions">
          <button type="button" class="action" data-testid="shuffle" onClick={shuffle}>
            <span class="action-icon">
              <IconShuffle />
            </span>
            <span class="action-label">{t('game.shuffle')}</span>
          </button>
          <button type="button" class="action" data-testid="hint" onClick={hint}>
            <span class="action-icon">
              <IconBulb />
              <span class="action-badge">
                <IconCoin />
                {ECONOMY.hintCost}
              </span>
            </span>
            <span class="action-label">{t('game.hint')}</span>
          </button>
          <button
            type="button"
            class="action"
            data-testid="erase"
            onPointerDown={eraseDown}
            onPointerUp={eraseUp}
            onPointerLeave={eraseUp}
            onPointerCancel={eraseUp}
            onClick={eraseClick}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span class="action-icon">
              <IconErase />
            </span>
            <span class="action-label">{t('game.erase')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
