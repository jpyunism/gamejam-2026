import Phaser from "phaser";
import { scaleFactor, scaledFont } from "../core/layout";

/**
 * Reusable neon action button for touch (and mouse) input.
 *
 * Neon Drift was keyboard-only on every screen except the arena: `GameOverScene`
 * listened to `keydown-R/M/S` and the shop to `1-5`/`ESC`, so a phone player was
 * locked out. This widget gives those actions a real hit target.
 *
 * Design notes:
 * - The hit area is the rectangle itself (`setInteractive`), so the same button
 *   answers to a mouse click and to a finger tap with no branching.
 * - `pointerdown` (not `pointerup`) is used so the action fires on press even if
 *   the finger slides slightly before lifting — the usual expectation on mobile.
 * - A minimum visual size is enforced through the callers passing scaled
 *   geometry; the button itself never decides its own size.
 */
export interface TouchButtonOptions {
  /** Fill colour of the panel. */
  bgColor?: number;
  /** Fill alpha of the panel. */
  bgAlpha?: number;
  /** Border colour. */
  borderColor?: number;
  /** Label colour (CSS string). */
  textColor?: string;
  /** Hover/press highlight border colour. */
  hoverBorderColor?: number;
  /** Hover/press label colour (CSS string). */
  hoverTextColor?: string;
  /** Depth of the button's GameObjects (default: none — scene order). */
  depth?: number;
  /** Called on pointerdown when the button is enabled. */
  onClick: () => void;
}

export class TouchButton {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  private readonly opts: Omit<Required<TouchButtonOptions>, "depth"> & {
    depth?: number;
  };
  private enabled = true;
  private hovered = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    opts: TouchButtonOptions,
  ) {
    this.opts = {
      bgColor: opts.bgColor ?? 0x101830,
      bgAlpha: opts.bgAlpha ?? 0.85,
      borderColor: opts.borderColor ?? 0x00ffff,
      textColor: opts.textColor ?? "#00ffff",
      hoverBorderColor: opts.hoverBorderColor ?? 0xffffff,
      hoverTextColor: opts.hoverTextColor ?? "#ffffff",
      depth: opts.depth,
      onClick: opts.onClick,
    };

    this.bg = scene.add
      .rectangle(x, y, width, height, this.opts.bgColor, this.opts.bgAlpha)
      .setStrokeStyle(2, this.opts.borderColor, 1)
      .setInteractive({ useHandCursor: true });

    this.text = scene.add
      .text(x, y, label, {
        fontFamily: "monospace",
        fontSize: scaledFont(15, scaleFactor(scene.scale.width)),
        color: this.opts.textColor,
      })
      .setOrigin(0.5);

    // Depth is opt-in: buttons placed relative to a Container must inherit the
    // container's depth, so only set it when the caller asks for it.
    if (this.opts.depth !== undefined) {
      this.bg.setDepth(this.opts.depth);
      this.text.setDepth(this.opts.depth + 1);
    }

    this.bg.on("pointerover", () => {
      this.hovered = true;
      this.applyVisual();
    });
    this.bg.on("pointerout", () => {
      this.hovered = false;
      this.applyVisual();
    });
    this.bg.on("pointerdown", () => {
      if (!this.enabled) {
        return;
      }
      this.opts.onClick();
    });

    this.applyVisual();
  }

  /** Enable or disable the button without destroying it (e.g. not affordable). */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyVisual();
  }

  public setLabel(label: string): void {
    this.text.setText(label);
  }

  public get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * The button's GameObjects, so a caller can re-parent them into a Container
   * (a container-relative layout) instead of leaving them loose on the scene.
   * Coordinates are interpreted relative to the container once added.
   */
  public objects(): Phaser.GameObjects.GameObject[] {
    return [this.bg, this.text];
  }

  /** Show or hide the whole button without destroying it. */
  public setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.text.setVisible(visible);
  }

  private applyVisual(): void {
    const active = this.enabled && this.hovered;
    this.bg.setStrokeStyle(2, active ? this.opts.hoverBorderColor : this.opts.borderColor, 1);
    this.bg.setFillStyle(this.opts.bgColor, this.enabled ? this.opts.bgAlpha : 0.4);
    this.text.setColor(active ? this.opts.hoverTextColor : this.opts.textColor);
    this.text.setAlpha(this.enabled ? 1 : 0.5);
  }

  public destroy(): void {
    this.bg.destroy();
    this.text.destroy();
  }

  /** True when the device reports touch support — used to add on-screen hints. */
  public static hasTouch(): boolean {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }
}
