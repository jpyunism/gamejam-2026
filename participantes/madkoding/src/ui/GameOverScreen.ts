// ─── Game Over Screen ──────────────────────────────────────────────────────

import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';

export class GameOverScreen {
  private element: HTMLElement;
  private continueButton: HTMLElement;
  private menuButton: HTMLElement;
  private finalScoreElement: HTMLElement;
  private finalWaveElement: HTMLElement;
  private eventBus: EventBus;
  private onGameOver: (p: { score: number; wave: number }) => void;

  constructor(
    private onRestart: () => void,
    private onMenu: () => void,
  ) {
    this.eventBus = EventBus.getInstance();
    this.element = document.getElementById('gameover-screen') as HTMLElement;
    this.continueButton = document.getElementById('continue-button') as HTMLElement;
    this.menuButton = document.getElementById('gameover-menu-button') as HTMLElement;
    this.finalScoreElement = document.getElementById('final-score') as HTMLElement;
    this.finalWaveElement = document.getElementById('final-wave') as HTMLElement;

    this.onRestartRef();
    this.onMenuRef();
    this.continueButton.addEventListener('click', this.onRestartRef);
    this.menuButton.addEventListener('click', this.onMenuRef);

    this.onGameOver = (p) => {
      this.finalScoreElement.textContent = `Puntuación: ${p.score.toLocaleString()}`;
      this.finalWaveElement.textContent = `Oleada: ${p.wave}`;
      this.show();
    };
    this.eventBus.on(GameEvent.GAME_OVER, this.onGameOver);
  }

  private onRestartRef = () => this.onRestart();
  private onMenuRef = () => this.onMenu();

  show(): void {
    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  dispose(): void {
    this.continueButton.removeEventListener('click', this.onRestartRef);
    this.menuButton.removeEventListener('click', this.onMenuRef);
    this.eventBus.off(GameEvent.GAME_OVER, this.onGameOver);
  }
}
