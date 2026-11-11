import { render } from 'preact';
import './ui/styles/themes.css';
import './ui/styles/base.css';
import './ui/styles/game.css';
import './ui/styles/screens.css';
import { createPlatform } from './platform';
import { Game } from './state/game';
import { App } from './ui/App';

const boot = document.getElementById('boot');
const bootFill = document.getElementById('boot-fill');
const setProgress = (value: number) => {
  if (bootFill) bootFill.style.width = `${Math.round(Math.min(1, Math.max(0.06, value)) * 100)}%`;
};

// Пункты 1.6.1.8 и 1.6.2.7 требований Яндекс Игр: нет контекстного меню и выделения по долгому нажатию.
document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('selectstart', (event) => event.preventDefault());
document.addEventListener('dragstart', (event) => event.preventDefault());
// Жесты масштабирования в Safari.
document.addEventListener('gesturestart', (event) => event.preventDefault());

async function main(): Promise<void> {
  const platform = await createPlatform();
  const game = new Game(platform);

  // Аудиоконтекст можно запускать только по жесту пользователя.
  const unlock = () => {
    // Игрок нажал на игру — значит, фокус снова у неё (событие focus во встроенном окне приходит не всегда).
    game.audio.setSuspended('blur', false);
    game.audio.unlock();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  await game.start(setProgress);

  const root = document.getElementById('app');
  if (!root) throw new Error('Нет корневого элемента #app');
  render(<App game={game} />, root);

  // Сообщаем площадке о готовности, когда экран отрисован и кнопки работают.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      boot?.classList.add('done');
      window.setTimeout(() => boot?.remove(), 300);
      game.notifyReady();
    });
  });
}

main().catch((error) => {
  console.error('Игра не запустилась', error);
  if (boot) {
    const title = document.getElementById('boot-title');
    if (title) title.textContent = 'Не удалось загрузить игру. Обновите страницу.';
  }
});
