import Phaser from "phaser";

/**
 * Circular touch fire button for mobile.
 *
 * Tracks its own pointer.id so it doesn't conflict with joysticks.
 * Exposes `consumePressed()` which returns `true` exactly once per
 * pointerdown→up cycle (single bullet per press, not continuous hold).
 */
export class FireButton {
  private bg: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private x: number;
  private y: number;
  private readonly radius: number;
  private pressed: boolean = false;
  private touchId: number = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, radius: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;

    this.bg = scene.add.circle(x, y, radius, 0xff0000, 0.15);
    this.bg.setStrokeStyle(2, 0xff0000, 0.4);
    this.bg.setScrollFactor(0);
    this.bg.setDepth(2000);

    this.label = scene.add.text(x, y, "FIRE", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ff4444",
    });
    this.label.setOrigin(0.5);
    this.label.setScrollFactor(0);
    this.label.setDepth(2001);

    // Only show on touch-capable devices
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this.bg.setVisible(hasTouch);
    this.label.setVisible(hasTouch);

    if (hasTouch) {
      scene.input.on("pointerdown", this.onPointerDown, this);
      scene.input.on("pointerup", this.onPointerUp, this);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Only activate if the touch is within the button radius
    const dx = pointer.x - this.x;
    const dy = pointer.y - this.y;
    if (dx * dx + dy * dy > this.radius * this.radius) return;

    this.pressed = true;
    this.touchId = pointer.id;
    this.bg.setFillStyle(0xff0000, 0.35);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.touchId) return;
    this.touchId = -1;
    this.bg.setFillStyle(0xff0000, 0.15);
  }

  /**
   * Returns `true` exactly once per press cycle.
   * Call once per frame from GameScene.update().
   */
  consumePressed(): boolean {
    if (this.pressed) {
      this.pressed = false;
      return true;
    }
    return false;
  }

  /** Reposition the button (used on resize). */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.bg.setPosition(x, y);
    this.label.setPosition(x, y);
  }

  destroy(): void {
    this.bg.destroy();
    this.label.destroy();
  }
}
