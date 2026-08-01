import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Weapon } from "../weapons/Weapon";
import { WaveManager } from "../systems/WaveManager";
import { LevelUpManager } from "../systems/LevelUpManager";
import { scaleFactor, scaledFont } from "../core/layout";

/**
 * A simple horizontal bar (background + fill) with a label on top. Owns its
 * own GameObjects and exposes a `setPercent()` that just repaints the fill
 * without recreating anything per frame.
 */
class Bar {
  public readonly bg: Phaser.GameObjects.Graphics;
  public readonly fill: Phaser.GameObjects.Graphics;
  public readonly label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    bgColor: number,
    fillColor: number,
    labelText: string,
    labelColor: string,
    depth: number,
  ) {
    this.bg = scene.add.graphics();
    this.bg.fillStyle(bgColor, 1);
    this.bg.fillRect(x, y, width, height);
    this.bg.setScrollFactor(0);
    this.bg.setDepth(depth);

    this.fill = scene.add.graphics();
    this.fill.setScrollFactor(0);
    this.fill.setDepth(depth + 1);

    this.label = scene.add.text(x, y - 14, labelText, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: labelColor,
    });
    this.label.setScrollFactor(0);
    this.label.setDepth(depth + 2);

    // Cache geometry so repaint is allocation-free.
    (this.fill as unknown as { _barX: number })._barX = x;
    (this.fill as unknown as { _barY: number })._barY = y;
    (this.fill as unknown as { _barW: number })._barW = width;
    (this.fill as unknown as { _barH: number })._barH = height;
    (this.fill as unknown as { _color: number })._color = fillColor;
  }

  public setPercent(pct: number): void {
    const g = this.fill;
    g.clear();
    if (pct <= 0) {
      return;
    }
    const x = (g as unknown as { _barX: number })._barX;
    const y = (g as unknown as { _barY: number })._barY;
    const w = (g as unknown as { _barW: number })._barW;
    const h = (g as unknown as { _barH: number })._barH;
    const color = (g as unknown as { _color: number })._color;
    g.fillStyle(color, 1);
    g.fillRect(x, y, Math.max(1, Math.floor(w * pct)), h);
  }

  public setLabel(text: string): void {
    this.label.setText(text);
  }

  public destroy(): void {
    this.bg.destroy();
    this.fill.destroy();
    this.label.destroy();
  }
}

/**
 * One weapon slot in the bottom HUD. Renders the weapon's display name plus
 * a thin cooldown bar that fills as the cooldown progresses, so the player
 * can see at a glance when the gun will fire next.
 */
class WeaponSlot {
  private readonly x: number;
  private readonly y: number;
  private readonly width: number;
  private readonly height: number;

  private bg!: Phaser.GameObjects.Graphics;
  private border!: Phaser.GameObjects.Graphics;
  private nameLabel!: Phaser.GameObjects.Text;
  private emptyLabel!: Phaser.GameObjects.Text;
  private cooldownBar!: Bar;

  private lastWeaponName: string = "";
  private lastCooldownPct: number = -1;
  private lastActive: boolean | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    index: number,
  ) {
    void index;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.bg = scene.add.graphics();
    this.bg.fillStyle(0x000000, 0.6);
    this.bg.fillRect(x, y, width, height);
    this.bg.setScrollFactor(0);
    this.bg.setDepth(900);

    this.border = scene.add.graphics();
    this.border.setScrollFactor(0);
    this.border.setDepth(901);

    this.nameLabel = scene.add.text(x + width / 2, y + 14, "—", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#cccccc",
    });
    this.nameLabel.setOrigin(0.5, 0.5);
    this.nameLabel.setScrollFactor(0);
    this.nameLabel.setDepth(903);

    this.emptyLabel = scene.add.text(x + width / 2, y + height / 2, "—", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#555555",
    });
    this.emptyLabel.setOrigin(0.5, 0.5);
    this.emptyLabel.setScrollFactor(0);
    this.emptyLabel.setDepth(902);

    this.cooldownBar = new Bar(
      scene,
      x + 8,
      y + height - 8,
      width - 16,
      3,
      0x111122,
      0x00ffff,
      "",
      "#888888",
      902,
    );
  }

  /**
   * Refresh the slot. `active` toggles the border color so the player sees
   * which gun is firing. `forceRefresh` redraws even when nothing changed
   * (used when the active index flipped).
   */
  public update(
    weapon: Weapon | undefined,
    active: boolean,
    time: number,
    forceRefresh: boolean,
  ): void {
    if (active !== this.lastActive || forceRefresh) {
      this.lastActive = active;
      this.border.clear();
      this.border.lineStyle(active ? 3 : 2, active ? 0x00ffff : 0x444444, 1);
      this.border.strokeRect(this.x, this.y, this.width, this.height);
    }

    if (!weapon) {
      if (this.lastWeaponName !== "") {
        this.lastWeaponName = "";
        this.nameLabel.setText("");
        this.emptyLabel.setVisible(true);
        this.cooldownBar.setPercent(0);
        this.lastCooldownPct = -1;
      }
      return;
    }

    const displayName = weapon.getDisplayName();
    if (displayName !== this.lastWeaponName) {
      this.lastWeaponName = displayName;
      this.emptyLabel.setVisible(false);
      this.nameLabel.setText(displayName);
      this.nameLabel.setColor(active ? "#ffffff" : "#cccccc");
    }

    // Cooldown progress: 1.0 means "ready to fire", 0.0 means "just fired".
    let pct = 1;
    if (weapon.cooldown > 0) {
      pct = Math.max(
        0,
        Math.min(1, (time - weapon.lastFiredAt) / weapon.cooldown),
      );
    }
    if (Math.abs(pct - this.lastCooldownPct) > 0.01 || forceRefresh) {
      this.lastCooldownPct = pct;
      // Re-tint the cooldown bar to match the active state when it changes.
      const tint = active ? 0x00ffff : 0x888888;
      const g = this.cooldownBar.fill;
      (g as unknown as { _color: number })._color = tint;
      this.cooldownBar.setPercent(pct);
    }
  }

  public destroy(): void {
    this.bg.destroy();
    this.border.destroy();
    this.nameLabel.destroy();
    this.emptyLabel.destroy();
    this.cooldownBar.destroy();
  }
}

/**
 * Heads-up display rendered on top of the play area. Every element uses
 * `setScrollFactor(0)` so the HUD stays fixed in screen space while the
 * camera follows the player through the 1280x960 arena.
 *
 * Layout:
 *   - Top-left  : HP + Shield bars with labels
 *   - Top-center: Coins (gold)
 *   - Top-right : Wave / Level info
 *   - Bottom    : Weapon slots (up to 2)
 *
 * Update flow: `update(player, wave, level, time)` is called once per frame
 * from `GameScene.update()`. We mutate existing GameObjects (no per-frame
 * allocations) to keep the HUD cheap.
 */
export class HUD {
  private scene: Phaser.Scene;
  private leftPanel!: Phaser.GameObjects.Graphics;
  private hpBar!: Bar;
  private shieldBar!: Bar;

  private coinsLabel!: Phaser.GameObjects.Text;

  private rightPanel!: Phaser.GameObjects.Graphics;
  private waveLabel!: Phaser.GameObjects.Text;
  private levelLabel!: Phaser.GameObjects.Text;
  private killsLabel!: Phaser.GameObjects.Text;
  private xpBar!: Bar;

  private weaponPanel!: Phaser.GameObjects.Graphics;
  private weaponSlots: WeaponSlot[] = [];

  // Cached previous values so the HUD only repaints what changed.
  private lastHp: number = -1;
  private lastShield: number = -1;
  private lastCoins: number = -1;
  private lastWave: number = -1;
  private lastLevel: number = -1;
  private lastKillsRequired: number = -1;
  private lastKillsThisLevel: number = -1;
  private lastActiveWeaponIndex: number = -1;

  /** Coin count the scene pokes when loot drops. HUD re-reads this. */
  public coins: number = 0;

  /** Mute toggle button. */
  private muteBtn!: Phaser.GameObjects.Text;

  /** Resize handler reference for cleanup. */
  private resizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildLayout(scene.scale.width, scene.scale.height);

    // Subscribe to resize events
    this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
      this.buildLayout(gameSize.width, gameSize.height);
    };
    scene.scale.on("resize", this.resizeHandler);
  }

  /**
   * Rebuilds all HUD elements for the given dimensions.
   * Called on construction and on every scale.resize event.
   */
  private buildLayout(width: number, height: number): void {
    const s = scaleFactor(width);

    // Destroy existing elements if this is a rebuild
    if (this.leftPanel) {
      this.leftPanel.destroy();
      this.hpBar.destroy();
      this.shieldBar.destroy();
      this.coinsLabel.destroy();
      this.rightPanel.destroy();
      this.waveLabel.destroy();
      this.levelLabel.destroy();
      this.killsLabel.destroy();
      this.xpBar.destroy();
      this.weaponPanel.destroy();
      for (const slot of this.weaponSlots) {
        slot.destroy();
      }
      this.weaponSlots = [];
      this.muteBtn.destroy();
    }

    // ---------- Top-left HP + Shield ----------
    const PANEL_X = Math.round(10 * s);
    const PANEL_Y = Math.round(10 * s);
    const PANEL_W = Math.round(200 * s);
    const PANEL_H = Math.round(70 * s);
    const BAR_X = PANEL_X + Math.round(10 * s);
    const BAR_W = PANEL_W - Math.round(20 * s);
    const HP_BAR_Y = PANEL_Y + Math.round(22 * s);
    const SHIELD_BAR_Y = PANEL_Y + Math.round(46 * s);
    const BAR_HEIGHT = Math.max(6, Math.round(14 * s));

    this.leftPanel = this.scene.add.graphics();
    this.leftPanel.fillStyle(0x000000, 0.55);
    this.leftPanel.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    this.leftPanel.lineStyle(1, 0x00ffff, 0.6);
    this.leftPanel.strokeRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    this.leftPanel.setScrollFactor(0);
    this.leftPanel.setDepth(900);

    this.hpBar = new Bar(
      this.scene,
      BAR_X,
      HP_BAR_Y,
      BAR_W,
      BAR_HEIGHT,
      0x220000,
      0xff3344,
      "HP 100/100",
      "#ff4444",
      901,
    );
    this.shieldBar = new Bar(
      this.scene,
      BAR_X,
      SHIELD_BAR_Y,
      BAR_W,
      BAR_HEIGHT,
      0x001a33,
      0x44aaff,
      "SHIELD 50/50",
      "#44aaff",
      901,
    );

    // ---------- Top-center Coins ----------
    this.coinsLabel = this.scene.add.text(width / 2, Math.round(14 * s), "Coins: 0", {
      fontFamily: "monospace",
      fontSize: scaledFont(14, s),
      color: "#ffd700",
      stroke: "#553300",
      strokeThickness: 2,
    });
    this.coinsLabel.setOrigin(0.5, 0);
    this.coinsLabel.setScrollFactor(0);
    this.coinsLabel.setDepth(903);

    // ---------- Top-right Wave / Level ----------
    const RT_W = Math.round(180 * s);
    const RT_H = Math.round(50 * s);
    const RT_X = width - RT_W - Math.round(10 * s);
    const RT_Y = Math.round(10 * s);

    this.rightPanel = this.scene.add.graphics();
    this.rightPanel.fillStyle(0x000000, 0.55);
    this.rightPanel.fillRect(RT_X, RT_Y, RT_W, RT_H);
    this.rightPanel.lineStyle(1, 0xff00ff, 0.6);
    this.rightPanel.strokeRect(RT_X, RT_Y, RT_W, RT_H);
    this.rightPanel.setScrollFactor(0);
    this.rightPanel.setDepth(900);

    this.waveLabel = this.scene.add.text(RT_X + Math.round(8 * s), RT_Y + Math.round(6 * s), "Wave: 0", {
      fontFamily: "monospace",
      fontSize: scaledFont(12, s),
      color: "#ff00ff",
    });
    this.waveLabel.setScrollFactor(0);
    this.waveLabel.setDepth(903);

    this.levelLabel = this.scene.add.text(RT_X + Math.round(8 * s), RT_Y + Math.round(22 * s), "Level: 1", {
      fontFamily: "monospace",
      fontSize: scaledFont(12, s),
      color: "#00ffff",
    });
    this.levelLabel.setScrollFactor(0);
    this.levelLabel.setDepth(903);

    this.killsLabel = this.scene.add.text(RT_X + RT_W - Math.round(8 * s), RT_Y + Math.round(6 * s), "0/10", {
      fontFamily: "monospace",
      fontSize: scaledFont(11, s),
      color: "#cccccc",
    });
    this.killsLabel.setOrigin(1, 0);
    this.killsLabel.setScrollFactor(0);
    this.killsLabel.setDepth(903);

    // XP bar
    this.xpBar = new Bar(
      this.scene,
      RT_X + Math.round(8 * s),
      RT_Y + Math.round(38 * s),
      RT_W - Math.round(16 * s),
      Math.max(3, Math.round(6 * s)),
      0x222244,
      0x00ff66,
      "",
      "#00ff66",
      903,
    );
    this.xpBar.bg.setScrollFactor(0);
    this.xpBar.fill.setScrollFactor(0);

    // ---------- Bottom weapon slots ----------
    const SLOT_W = Math.round(100 * s);
    const SLOT_H = Math.round(40 * s);
    const SLOT_GAP = Math.round(10 * s);
    const SLOTS_TOTAL_W = SLOT_W * 2 + SLOT_GAP;
    const SLOTS_X = (width - SLOTS_TOTAL_W) / 2;
    const SLOTS_Y = height - Math.round(50 * s);

    this.weaponPanel = this.scene.add.graphics();
    this.weaponPanel.fillStyle(0x000000, 0.4);
    this.weaponPanel.fillRect(
      SLOTS_X - Math.round(6 * s),
      SLOTS_Y - Math.round(6 * s),
      SLOTS_TOTAL_W + Math.round(12 * s),
      SLOT_H + Math.round(12 * s),
    );
    this.weaponPanel.setScrollFactor(0);
    this.weaponPanel.setDepth(900);

    for (let i = 0; i < 2; i++) {
      const slotX = SLOTS_X + i * (SLOT_W + SLOT_GAP);
      const slot = new WeaponSlot(this.scene, slotX, SLOTS_Y, SLOT_W, SLOT_H, i);
      this.weaponSlots.push(slot);
    }

    // ── Mute toggle (top-right corner, above wave panel) ──
    this.muteBtn = this.scene.add
      .text(width - Math.round(10 * s), RT_Y, this.scene.sound.mute ? "[UNMUTE]" : "[MUTE]", {
        fontFamily: "monospace",
        fontSize: scaledFont(11, s),
        color: "#888888",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(903)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on("pointerdown", () => {
      this.scene.sound.mute = !this.scene.sound.mute;
      this.muteBtn.setText(this.scene.sound.mute ? "[UNMUTE]" : "[MUTE]");
    });
  }

  /**
   * Per-frame HUD refresh. Only rewrites the underlying Graphics/Text
   * objects whose source values have actually changed since the last frame,
   * so the common "nothing changed" frame is effectively a no-op.
   */
  public update(
    player: Player,
    waveManager: WaveManager,
    levelUpManager: LevelUpManager,
    time: number,
  ): void {
    // ---- HP ----
    const hpInt = Math.round(player.hp);
    if (hpInt !== this.lastHp) {
      this.lastHp = hpInt;
      const pct = Math.max(0, Math.min(1, player.hpPercent));
      this.hpBar.setPercent(pct);
      this.hpBar.setLabel(`HP ${hpInt}/${player.maxHp}`);
    }

    // ---- Shield ----
    const shieldInt = Math.round(player.shield);
    if (shieldInt !== this.lastShield) {
      this.lastShield = shieldInt;
      const pct = Math.max(0, Math.min(1, player.shieldPercent));
      this.shieldBar.setPercent(pct);
      this.shieldBar.setLabel(`SHIELD ${shieldInt}/${player.maxShield}`);
    }

    // ---- Coins ----
    if (this.coins !== this.lastCoins) {
      this.lastCoins = this.coins;
      this.coinsLabel.setText(`Coins: ${this.coins}`);
    }

    // ---- Wave / Level ----
    if (waveManager.waveNumber !== this.lastWave) {
      this.lastWave = waveManager.waveNumber;
      this.waveLabel.setText(`Wave: ${waveManager.waveNumber}`);
    }
    if (levelUpManager.level !== this.lastLevel) {
      this.lastLevel = levelUpManager.level;
      this.levelLabel.setText(`Level: ${levelUpManager.level}`);
    }
    if (
      levelUpManager.killsThisLevel !== this.lastKillsThisLevel ||
      levelUpManager.killsRequired !== this.lastKillsRequired
    ) {
      this.lastKillsThisLevel = levelUpManager.killsThisLevel;
      this.lastKillsRequired = levelUpManager.killsRequired;
      this.killsLabel.setText(
        `${levelUpManager.killsThisLevel}/${levelUpManager.killsRequired}`,
      );
      // XP bar fill
      const xpPct = levelUpManager.killsRequired > 0
        ? levelUpManager.killsThisLevel / levelUpManager.killsRequired
        : 0;
      this.xpBar.setPercent(Math.min(1, xpPct));
    }

    // ---- Weapon slots ----
    const activeIdx = player.activeWeaponIndex;
    const activeChanged = activeIdx !== this.lastActiveWeaponIndex;
    if (activeChanged) {
      this.lastActiveWeaponIndex = activeIdx;
    }
    for (let i = 0; i < this.weaponSlots.length; i++) {
      const slot = this.weaponSlots[i];
      const weapon: Weapon | undefined = player.weapons[i];
      slot.update(weapon, i === activeIdx, time, activeChanged);
    }
  }

  /**
   * Tear-down. The HUD owns several GameObjects; the scene's `shutdown`
   * event normally destroys its children for us, but we expose destroy
   * in case the caller wants it.
   */
  public destroy(): void {
    if (this.resizeHandler) {
      this.scene.scale.off("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    this.leftPanel?.destroy();
    this.hpBar?.destroy();
    this.shieldBar?.destroy();
    this.coinsLabel?.destroy();
    this.rightPanel?.destroy();
    this.waveLabel?.destroy();
    this.levelLabel?.destroy();
    this.killsLabel?.destroy();
    this.xpBar?.destroy();
    this.weaponPanel?.destroy();
    for (const slot of this.weaponSlots) {
      slot.destroy();
    }
    this.weaponSlots = [];
    this.muteBtn?.destroy();
  }
}
