// ─── Pause Overlay ──────────────────────────────────────────────────────────

export class PauseOverlay {
  private element: HTMLElement;
  private resumeButton: HTMLElement;
  private quitButton: HTMLElement;
  private onResume: () => void;
  private onQuit: () => void;

  constructor(private actions: { resume: () => void; quit: () => void }) {
    this.element = document.getElementById('pause-overlay') as HTMLElement;
    this.resumeButton = document.getElementById('resume-button') as HTMLElement;
    this.quitButton = document.getElementById('quit-button') as HTMLElement;

    this.onResume = () => this.actions.resume();
    this.onQuit = () => this.actions.quit();
    this.resumeButton.addEventListener('click', this.onResume);
    this.quitButton.addEventListener('click', this.onQuit);
  }

  show(): void {
    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  dispose(): void {
    this.resumeButton.removeEventListener('click', this.onResume);
    this.quitButton.removeEventListener('click', this.onQuit);
  }
}
