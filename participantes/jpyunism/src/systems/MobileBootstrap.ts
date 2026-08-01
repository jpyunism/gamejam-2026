import Phaser from "phaser";

/**
 * Mobile bootstrap: fullscreen-on-first-touch latch, orientation lock,
 * and graceful FULLSCREEN_FAILED handling.
 *
 * Injected once per scene that needs it (GameScene, MenuScene).
 * Safe to instantiate on desktop — it's a no-op when touch is absent.
 */
export class MobileBootstrap {
  private scene: Phaser.Scene;
  private fullscreenLatched: boolean = false;
  private fullscreenFailedHandler: ((error: unknown) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!hasTouch) return;

    // Attempt orientation lock (best-effort, may fail silently)
    try {
      scene.scale.lockOrientation("landscape");
    } catch {
      // Orientation lock not supported — rotate overlay handles this.
    }

    // Listen for fullscreen failure — noop, just continue playing
    this.fullscreenFailedHandler = (): void => {
      // Fullscreen was denied (e.g. iOS Safari). Continue in viewport.
    };
    scene.scale.on(Phaser.Scale.Events.FULLSCREEN_FAILED, this.fullscreenFailedHandler);

    // First touch-up triggers fullscreen request
    scene.input.on("pointerup", this.onPointerUp, this);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.fullscreenLatched) return;
    if (!pointer.wasTouch) return;

    this.fullscreenLatched = true;

    // Hide the fullscreen prompt
    const promptEl = document.getElementById("fs-prompt");
    if (promptEl) {
      promptEl.classList.remove("visible");
    }

    try {
      this.scene.scale.startFullscreen();
    } catch {
      // startFullscreen may throw if not in user gesture context
    }
  }

  destroy(): void {
    this.scene.input.off("pointerup", this.onPointerUp, this);
    if (this.fullscreenFailedHandler) {
      this.scene.scale.off(Phaser.Scale.Events.FULLSCREEN_FAILED, this.fullscreenFailedHandler);
      this.fullscreenFailedHandler = null;
    }
  }
}
