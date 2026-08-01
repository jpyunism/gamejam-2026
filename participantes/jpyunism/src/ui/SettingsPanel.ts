import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { AudioSettings } from "../store/AudioSettings";
import { scaleFactor, scaledFont } from "../core/layout";

/**
 * Reusable settings overlay for `MenuScene` and the `GameScene` pause overlay.
 *
 * Renders a dark, cyan-stroked panel containing:
 *   - A horizontal volume slider (step 0.05, range 0–1) with a draggable
 *     knob and a live percentage label.
 *   - A mute toggle button that flips the global SoundManager mute.
 *
 * DRAG → `audio.setVolume(v, false)` for live volume updates (no tween, no
 * persistence). Persistence is debounced 100 ms via the panel's own timer
 * so dragging the knob at 60 fps doesn't thrash localStorage.
 *
 * MUTE → `audio.setMuted(b)` and an immediate `AudioSettings.save()` (the
 * boolean toggle is cheap to write every time).
 *
 * The panel does NOT register an ESC listener of its own — caller-supplied
 * `onClose` is invoked when the consumer closes the panel (typical flow:
 * scene owns the ESC handler and calls `panel.hide()`).
 *
 * Lifecycle:
 *   - `show()`   — adds the container to the scene display list
 *   - `hide()`   — removes the container and clears all listeners
 *   - `destroy()` — same as `hide()` but also releases the debounce timer
 */

const PANEL_BG_COLOR = 0x10102a;
const PANEL_BG_ALPHA = 0.95;
const PANEL_STROKE_COLOR = 0x00ffff;

const SLIDER_PADDING_X = 40;
const SLIDER_TRACK_HEIGHT = 6;
const SLIDER_KNOB_RADIUS = 10;
const SLIDER_Y = 24;
const SLIDER_STEP = 0.05;
const SLIDER_SAVE_DEBOUNCE_MS = 100;

const MUTE_BTN_WIDTH = 120;
const MUTE_BTN_HEIGHT = 36;
const MUTE_BTN_Y = 80;

const SAVE_DEBOUNCE_MS_DEFAULT = 100;

const VOLUME_LABEL_COLOR = "#00ffff";
const VALUE_LABEL_COLOR = "#ffffff";
const TITLE_COLOR = "#00ffff";
const MUTE_LABEL_COLOR = "#ffffff";

export interface SettingsPanelOptions {
  x?: number;
  y?: number;
  /**
   * Smaller version for the GameScene pause overlay (won't share a visual
   * background with the PAUSED text). Defaults to `false`.
   */
  compact?: boolean;
}

export class SettingsPanel {
  private scene: Phaser.Scene;
  private audio: AudioManager;
  private container: Phaser.GameObjects.Container | null = null;

  // Slider geometry — captured at construction so the drag handler can
  // compute ratios without re-querying positions.
  private trackX: number = 0;
  private trackWidth: number = 0;
  private knob!: Phaser.GameObjects.Arc;
  private trackFill!: Phaser.GameObjects.Rectangle;
  private valueLabel!: Phaser.GameObjects.Text;
  private muteLabel!: Phaser.GameObjects.Text;

  private debounceTimer: Phaser.Time.TimerEvent | null = null;
  private isDragging: boolean = false;

  // Listeners we own so we can detach them on hide().
  private pointerMoveHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private pointerUpHandler: ((p: Phaser.Input.Pointer) => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    audio: AudioManager,
    _opts?: SettingsPanelOptions,
  ) {
    this.scene = scene;
    this.audio = audio;
  }

  /**
   * Mount the panel to the scene. Idempotent — calling `show()` when
   * already visible is a no-op.
   */
  public show(): void {
    if (this.container) {
      return;
    }

    const { width, height } = this.scene.scale;
    const s = scaleFactor(width);
    const x = width / 2;
    const y = height / 2;

    const PANEL_WIDTH = Math.round(360 * s);
    const PANEL_HEIGHT = Math.round(220 * s);

    const container = this.scene.add.container(x, y);
    container.setDepth(2100);
    container.setScrollFactor(0);

    // Background.
    const bg = this.scene.add.rectangle(
      0,
      0,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      PANEL_BG_COLOR,
      PANEL_BG_ALPHA,
    );
    bg.setStrokeStyle(2, PANEL_STROKE_COLOR, 1);
    container.add(bg);

    // Title.
    const title = this.scene.add.text(0, -PANEL_HEIGHT / 2 + Math.round(28 * s), "SETTINGS", {
      fontFamily: "monospace",
      fontSize: scaledFont(18, s),
      color: TITLE_COLOR,
    });
    title.setOrigin(0.5);
    container.add(title);

    // ---------- Slider ----------
    const trackXStart = -PANEL_WIDTH / 2 + Math.round(SLIDER_PADDING_X * s);
    this.trackX = trackXStart;
    this.trackWidth = PANEL_WIDTH - Math.round(SLIDER_PADDING_X * s) * 2;

    const trackBg = this.scene.add.rectangle(
      0,
      Math.round(SLIDER_Y * s),
      this.trackWidth,
      Math.round(SLIDER_TRACK_HEIGHT * s),
      0x222244,
      1,
    );
    trackBg.setStrokeStyle(1, 0x446688, 1);
    container.add(trackBg);

    const initialVol = this.audio.getTargetVolume();
    const fillW = Math.round(this.trackWidth * initialVol);
    const trackFill = this.scene.add.rectangle(
      trackXStart + fillW / 2,
      Math.round(SLIDER_Y * s),
      Math.max(1, fillW),
      Math.round(SLIDER_TRACK_HEIGHT * s),
      0x00ffff,
      1,
    );
    container.add(trackFill);
    this.trackFill = trackFill;

    const knob = this.scene.add.circle(
      trackXStart + fillW,
      Math.round(SLIDER_Y * s),
      Math.round(SLIDER_KNOB_RADIUS * s),
      0xffffff,
      1,
    );
    knob.setStrokeStyle(2, 0x00ffff, 1);
    knob.setInteractive({ useHandCursor: true, draggable: false });
    container.add(knob);
    this.knob = knob;

    // "VOLUME" label, left of the track.
    const volumeLabel = this.scene.add.text(
      trackXStart,
      Math.round(SLIDER_Y * s) - Math.round(26 * s),
      "VOLUME",
      {
        fontFamily: "monospace",
        fontSize: scaledFont(12, s),
        color: VOLUME_LABEL_COLOR,
      },
    );
    volumeLabel.setOrigin(0, 0.5);
    container.add(volumeLabel);

    // Live percentage label, right of the track.
    const valueLabel = this.scene.add.text(
      PANEL_WIDTH / 2 - Math.round(SLIDER_PADDING_X * s),
      Math.round(SLIDER_Y * s) - Math.round(26 * s),
      `${Math.round(initialVol * 100)}%`,
      {
        fontFamily: "monospace",
        fontSize: scaledFont(12, s),
        color: VALUE_LABEL_COLOR,
      },
    );
    valueLabel.setOrigin(1, 0.5);
    container.add(valueLabel);
    this.valueLabel = valueLabel;

    // Make the entire track + knob area interactive for drag.
    const sliderHit = this.scene.add.rectangle(
      0,
      Math.round(SLIDER_Y * s),
      this.trackWidth,
      Math.round(SLIDER_KNOB_RADIUS * s) * 2,
      0xffffff,
      0,
    );
    sliderHit.setInteractive({ useHandCursor: true });
    container.add(sliderHit);

    knob.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.beginDrag(pointer);
    });
    sliderHit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.jumpToPointer(pointer);
      this.beginDrag(pointer);
    });

    // ---------- Mute toggle ----------
    const muteBtn = this.scene.add.rectangle(
      0,
      Math.round(MUTE_BTN_Y * s),
      Math.round(MUTE_BTN_WIDTH * s),
      Math.round(MUTE_BTN_HEIGHT * s),
      0x1a1a3a,
      1,
    );
    muteBtn.setStrokeStyle(2, PANEL_STROKE_COLOR, 1);
    muteBtn.setInteractive({ useHandCursor: true });
    container.add(muteBtn);

    const muteLabel = this.scene.add.text(0, Math.round(MUTE_BTN_Y * s), "[ MUTE ]", {
      fontFamily: "monospace",
      fontSize: scaledFont(14, s),
      color: MUTE_LABEL_COLOR,
    });
    muteLabel.setOrigin(0.5);
    container.add(muteLabel);
    this.muteLabel = muteLabel;

    this.refreshMuteLabel();

    muteBtn.on("pointerdown", () => {
      const next = !this.scene.sound.mute;
      this.audio.setMuted(next);
      this.refreshMuteLabel();
    });
    muteLabel.on("pointerdown", () => {
      const next = !this.scene.sound.mute;
      this.audio.setMuted(next);
      this.refreshMuteLabel();
    });

    // ---------- Hint ----------
    const hint = this.scene.add.text(0, PANEL_HEIGHT / 2 - Math.round(28 * s), "Press ESC to close", {
      fontFamily: "monospace",
      fontSize: scaledFont(11, s),
      color: "#888888",
    });
    hint.setOrigin(0.5);
    container.add(hint);

    this.container = container;
  }

  /**
   * Remove the panel from the scene display list. Idempotent.
   */
  public hide(): void {
    if (!this.container) {
      return;
    }
    this.detachDragHandlers();
    this.clearDebounceTimer();
    this.container.destroy(true);
    this.container = null;
  }

  /**
   * Alias for `hide()` — useful when the caller wants a stable teardown
   * point regardless of "show state" semantics.
   */
  public destroy(): void {
    this.hide();
  }

  /**
   * Whether the panel is currently mounted.
   */
  public isVisible(): boolean {
    return this.container !== null;
  }

  // ---------------------------------------------------------------------
  // Internal: slider drag
  // ---------------------------------------------------------------------

  private beginDrag(pointer: Phaser.Input.Pointer): void {
    this.isDragging = true;
    const dragId = pointer.id;

    const onMove = (p: Phaser.Input.Pointer): void => {
      if (!this.isDragging) return;
      if (p.id !== dragId) return;
      this.applyPointerToVolume(p);
    };
    const onUp = (): void => {
      this.isDragging = false;
      this.detachDragHandlers();
      this.flushSave();
    };

    this.pointerMoveHandler = onMove;
    this.pointerUpHandler = onUp;
    this.scene.input.on("pointermove", onMove);
    this.scene.input.on("pointerup", onUp);
    this.scene.input.on("pointerupoutside", onUp);
  }

  private detachDragHandlers(): void {
    if (this.pointerMoveHandler) {
      this.scene.input.off("pointermove", this.pointerMoveHandler);
      this.pointerMoveHandler = null;
    }
    if (this.pointerUpHandler) {
      this.scene.input.off("pointerup", this.pointerUpHandler);
      this.scene.input.off("pointerupoutside", this.pointerUpHandler);
      this.pointerUpHandler = null;
    }
  }

  private jumpToPointer(pointer: Phaser.Input.Pointer): void {
    this.applyPointerToVolume(pointer);
  }

  private applyPointerToVolume(pointer: Phaser.Input.Pointer): void {
    const localX = pointer.worldX - (this.container?.x ?? 0);
    const ratio = Phaser.Math.Clamp(
      (localX - this.trackX) / this.trackWidth,
      0,
      1,
    );
    const snapped = Math.round(ratio / SLIDER_STEP) * SLIDER_STEP;
    const clamped = Math.max(0, Math.min(1, snapped));

    this.applyVolumeToVisuals(clamped);
    this.audio.setVolume(clamped, false);
    this.scheduleSave();
  }

  private applyVolumeToVisuals(volume: number): void {
    if (!this.container) {
      return;
    }
    const fillW = Math.round(this.trackWidth * volume);
    const knobX = this.trackX + fillW;

    this.knob.setPosition(knobX, this.knob.y);

    const fillCx = this.trackX + fillW / 2;
    this.trackFill.setPosition(fillCx, this.trackFill.y);
    this.trackFill.setSize(Math.max(1, fillW), Math.round(SLIDER_TRACK_HEIGHT * scaleFactor(this.scene.scale.width)));

    if (this.valueLabel) {
      this.valueLabel.setText(`${Math.round(volume * 100)}%`);
    }
  }

  private refreshMuteLabel(): void {
    if (!this.muteLabel) return;
    this.muteLabel.setText(this.scene.sound.mute ? "[ UNMUTE ]" : "[ MUTE ]");
  }

  // ---------------------------------------------------------------------
  // Internal: debounced persistence
  // ---------------------------------------------------------------------

  private scheduleSave(): void {
    this.clearDebounceTimer();
    this.debounceTimer = this.scene.time.delayedCall(
      SLIDER_SAVE_DEBOUNCE_MS,
      () => {
        AudioSettings.save(AudioSettings.getSettings());
        this.debounceTimer = null;
      },
    );
  }

  private flushSave(): void {
    this.clearDebounceTimer();
    AudioSettings.save(AudioSettings.getSettings());
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      this.debounceTimer.remove(false);
      this.debounceTimer = null;
    }
  }
}

// Silence the unused-parameter lint on the alias.
void SAVE_DEBOUNCE_MS_DEFAULT;
