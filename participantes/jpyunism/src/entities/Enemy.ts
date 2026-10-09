import Phaser from "phaser";
import { ENEMY } from "../core/Constants";

/** How long a knockback impulse suppresses the enemy's own steering. */
const KNOCKBACK_MS = ENEMY.KNOCKBACK_MS;

export interface LootDrop {
  coins: number;
  healChance: number;
}

export interface EnemyKilledPayload {
  x: number;
  y: number;
  enemy: Enemy;
}

/**
 * Base class for all enemy types. Handles HP, death, physics setup, tint,
 * and loot drop. Subclasses implement per-frame behavior via `update()`.
 */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  public hp: number;
  public maxHp: number;
  public speed: number;
  public damage: number;
  public isAlive: boolean = true;

  /**
   * Scene time until which this enemy is being pushed back and must NOT steer
   * itself. Subclasses call `isKnockedBack(time)` at the top of their update:
   * they re-set the velocity every frame with `physics.moveTo`, which would
   * otherwise overwrite the knockback impulse immediately.
   */
  public knockbackUntil: number = 0;

  /**
   * Ambient glow circle drawn behind the sprite. Owned by the enemy so it
   * dies with it — GameScene only repositions the glow each frame and
   * destroys it when `isAlive` flips false.
   */
  public glow: Phaser.GameObjects.Arc | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    hp: number,
    speed: number,
    damage: number,
    tintColor: number,
  ) {
    super(scene, x, y, texture);

    this.maxHp = hp;
    this.hp = hp;
    this.speed = speed;
    this.damage = damage;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 20);
    body.setCollideWorldBounds(true);

    this.setTint(tintColor);

    // Ambient colored glow. Sized by half the texture footprint so Tanks
    // don't end up looking like a tiny dot. Subtle (alpha 0.18) so it reads
    // as bloom without obscuring the silhouette of the enemy on top.
    const halfW = this.width > 0 ? this.width / 2 : 10;
    const halfH = this.height > 0 ? this.height / 2 : 10;
    const radius = Math.max(10, Math.max(halfW, halfH) + 4);
    this.glow = scene.add.circle(x, y, radius, tintColor, 0.18);
    this.glow.setDepth(this.depth - 1);
  }

  /**
   * Applies damage and triggers `die()` when HP drops to zero or below.
   */
  public takeDamage(amount: number): void {
    if (!this.isAlive) {
      return;
    }
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  /**
   * Marks the enemy dead, disables its physics body, emits the
   * `enemy-killed` event with its world position, then fades and destroys
   * itself.
   */
  protected die(): void {
    if (!this.isAlive) {
      return;
    }
    this.isAlive = false;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    const payload: EnemyKilledPayload = { x: this.x, y: this.y, enemy: this };
    this.scene.events.emit("enemy-killed", payload);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.5,
      duration: 200,
      onComplete: () => {
        if (this.active) {
          this.destroy();
        }
      },
    });
  }

  /**
   * Default loot drop for any enemy type. Override per-subclass if a
   * variant needs different rewards.
   */
  public dropLoot(): LootDrop {
    return {
      coins: Phaser.Math.Between(1, 3),
      healChance: 0.15,
    };
  }

  /**
   * Starts a knockback impulse away from the player.
   *
   * The enemy stops steering for `ENEMY.KNOCKBACK_MS` so the impulse is not
   * overwritten by the subclass's per-frame `physics.moveTo` call.
   */
  public startKnockback(speed: number, dx: number, dy: number, time: number): void {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.0001) {
      return;
    }
    this.knockbackUntil = time + KNOCKBACK_MS;
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.setVelocity((dx / len) * speed, (dy / len) * speed);
    }
  }

  /** True while the knockback impulse owns this enemy's velocity. */
  public isKnockedBack(time: number): boolean {
    return time < this.knockbackUntil;
  }

  /**
   * Signals that the knockback window is over. Subclasses do not need to do
   * anything: their update resumes steering on the next frame. Kept as a named
   * hook so the caller reads as intent rather than bookkeeping.
   */
  public resumeMovement(): void {
    this.knockbackUntil = 0;
  }

  public abstract update(
    time: number,
    delta: number,
    playerX: number,
    playerY: number,
  ): void;
}
