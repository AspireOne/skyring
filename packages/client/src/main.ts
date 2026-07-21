import { GameController } from './game/game-controller.js';

import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const game = new GameController(app);
game.start();

window.addEventListener('beforeunload', () => game.dispose());
