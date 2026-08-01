import Phaser from "phaser";

/**
 * Portrait-rotate overlay.
 *
 * Shows a "Please rotate your device" message when the device is in portrait
 * orientation. Hides when landscape. Uses a full-screen container with a dark
 * backdrop so the game canvas is not visible underneath.
 *
 * Safe to instantiate on desktop — it's a no-op when the device is landscape.
 */
export class RotateOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private orientationHandler: ((orientation: string) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Check initial orientation
    this.updateVisibility(scene.scale.isPortrait);

    // Subscribe to orientation changes
    this.orientationHandler = (): void => {
      this.updateVisibility(this.scene.scale.isPortrait);
    };
    scene.scale.on(Phaser.Scale.Events.ORIENTATION_CHANGE, this.orientationHandler);
  }

  private updateVisibility(isPortrait: boolean): void {
    if (isPortrait) {
      this.show();
    } else {
      this.hide();
    }
  }

  private show(): void {
    if (this.container) return;

    const { width, height } = this.scene.scale;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(9999);
    this.container.setScrollFactor(0);

    // Full-screen dark backdrop
    const backdrop = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.95,
    );
    backdrop.setScrollFactor(0);
    this.container.add(backdrop);

    // Rotate icon (simple text-based)
    const icon = this.scene.add.text(width / 2, height / 2 - 60, "⟳", {
      fontFamily: "monospace",
      fontSize: "64px",
      color: "#00ffff",
    });
    icon.setOrigin(0.5);
    icon.setScrollFactor(0);
    this.container.add(icon);

    // Message
    const msg = this.scene.add.text(width / 2, height / 2 + 20, "Please rotate your device", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      align: "center",
    });
    msg.setOrigin(0.5);
    msg.setScrollFactor(0);
    this.container.add(msg);

    const sub = this.scene.add.text(width / 2, height / 2 + 50, "Landscape mode required", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#888888",
      align: "center",
    });
    sub.setOrigin(0.5);
    sub.setScrollFactor(0);
    this.container.add(sub);
  }

  private hide(): void {
    if (!this.container) return;
    this.container.destroy(true);
    this.container = null;
  }

  destroy(): void {
    this.hide();
    if (this.orientationHandler) {
      this.scene.scale.off(Phaser.Scale.Events.ORIENTATION_CHANGE, this.orientationHandler);
      this.orientationHandler = null;
    }
  }
}
