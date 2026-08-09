// ─── Victory Screen ─────────────────────────────────────────────────────────

import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';

export class VictoryScreen {
  private element: HTMLElement;
  private continueButton: HTMLElement;
  private scoreElement: HTMLElement;
  private eventBus: EventBus;
  private onContinueRef: () => void;
  private onVictory: (p: { score: number }) => void;

  constructor(private onContinue: () => void) {
    this.eventBus = EventBus.getInstance();
    this.element = document.getElementById('victory-screen') as HTMLElement;
    this.continueButton = document.getElementById('victory-continue-button') as HTMLElement;
    this.scoreElement = document.getElementById('victory-score') as HTMLElement;

    this.onContinueRef = () => this.onContinue();
    this.continueButton.addEventListener('click', this.onContinueRef);

    this.onVictory = (p) => {
      this.scoreElement.textContent = `Puntuación: ${p.score.toLocaleString()}`;
      this.show();
    };
    this.eventBus.on(GameEvent.VICTORY, this.onVictory);
  }

  show(): void {
    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  dispose(): void {
    this.continueButton.removeEventListener('click', this.onContinueRef);
    this.eventBus.off(GameEvent.VICTORY, this.onVictory);
  }
}
