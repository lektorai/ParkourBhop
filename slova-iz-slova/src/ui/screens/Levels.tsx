import { useEffect, useRef } from 'preact/hooks';
import { t } from '../../i18n';
import { countBits } from '../../state/save';
import { Stars, TopBar } from '../components';
import { useAppState, useGame } from '../context';
import { IconLock, IconStar } from '../icons';

export function Levels() {
  const game = useGame();
  const chapters = useAppState((s) => s.chapters);
  const save = useAppState((s) => s.save);
  const currentRef = useRef<HTMLElement>(null);

  // Открываем список на главе текущего уровня.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  const chapterSize = chapters[0]?.levels ?? 20;
  const currentChapter = Math.ceil(save.unlocked / chapterSize);

  return (
    <div class="screen" data-testid="screen-levels">
      <TopBar title={t('levels.title')} onBack={() => game.go('menu')} />
      <div class="scroll">
        {chapters.map((chapter) => {
          const first = (chapter.chapter - 1) * chapterSize + 1;
          const ids = Array.from({ length: chapter.levels }, (_, i) => first + i);
          const stars = ids.reduce((sum, id) => sum + (save.levels[String(id)]?.s ?? 0), 0);
          return (
            <section class="panel chapter" key={chapter.chapter} ref={chapter.chapter === currentChapter ? currentRef : undefined}>
              <div class="chapter-head">
                <h2 class="chapter-title">
                  <span class="chapter-number">{t('levels.chapter', { n: chapter.chapter })}</span>
                  {chapter.title}
                </h2>
                <span class="chapter-stars">
                  {stars}/{chapter.levels * 3}
                  <IconStar on />
                </span>
              </div>
              <div class="level-grid">
                {ids.map((id) => {
                  const saved = save.levels[String(id)];
                  const locked = id > save.unlocked;
                  if (locked) {
                    return (
                      <button type="button" class="level-btn locked" key={id} disabled aria-label={t('levels.locked', { n: id })}>
                        <IconLock />
                      </button>
                    );
                  }
                  const levelStars = saved && countBits(saved.f) > 0 ? saved.s : 0;
                  return (
                    <button
                      type="button"
                      class={`level-btn${id === save.unlocked ? ' current' : ''}`}
                      key={id}
                      data-testid={`level-${id}`}
                      aria-label={t('levels.open', { n: id, stars: levelStars })}
                      onClick={() => {
                        game.sound('tap');
                        void game.openLevel(id);
                      }}
                    >
                      {id}
                      <Stars count={levelStars} class="level-stars" />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
