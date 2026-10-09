import Phaser from "phaser";
import { Enemy } from "./Enemy";

/**
 * Ranged enemy. Maintains a preferred distance from the player and
 * periodically fires a yellow projectile at them.
 */
export class ShooterEnemy extends Enemy {
  public preferredDistance: number = 200;
  public fireInterval: number = 2500;
  public lastFiredAt: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "enemy-shooter", 12, 60, 8, 0xffff00);
  }

  public update(
    time: number,
    _delta: number,
    playerX: number,
    playerY: number,
  ): void {
    if (!this.isAlive) {
      return;
    }

    // Knockback owns the velocity for a few frames after a landed hit; skip
    // steering so `physics.moveTo` doesn't cancel the impulse immediately.
    if (this.isKnockedBack(time)) {
      return;
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Keep at preferredDistance: back off if too close, push in if too far.
    if (distance < this.preferredDistance - 20) {
      this.scene.physics.moveTo(this, this.x - dx, this.y - dy, this.speed);
    } else if (distance > this.preferredDistance + 20) {
      this.scene.physics.moveTo(this, playerX, playerY, this.speed);
    } else {
      body.setVelocity(0, 0);
    }

    // Always face the player.
    this.rotation = Math.atan2(dy, dx);

    // Fire on cadence. Suppressed during knockback (handled above) so a pushed
    // shooter doesn't get a free point-blank shot.
    if (time - this.lastFiredAt >= this.fireInterval) {
      this.fire(playerX, playerY);
      this.lastFiredAt = time;
    }
  }

  private fire(playerX: number, playerY: number): void {
    const group = this.scene.data.get("enemyProjectiles") as Phaser.Physics.Arcade.Group | undefined;
    // Check the pool BEFORE creating anything. Creating first and relying on
    // `group.add()` to reject the overflow leaves an orphan sprite with a
    // physics body loose in the scene (the group returns early when full).
    if (!group || group.isFull()) {
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
    const vx = Math.cos(angle) * 200;
    const vy = Math.sin(angle) * 200;

    const projectile = this.scene.add.circle(this.x, this.y, 5, 0xffff00);
    group.add(projectile);

    const body = projectile.body as Phaser.Physics.Arcade.Body;
    // Do NOT enable collideWorldBounds: it only zeroes the velocity once the
    // body reaches the border, leaving an inert projectile parked against the
    // wall. We cull by bounds instead (see GameScene.cullOutOfBounds).
    body.setVelocity(vx, vy);
  }
}
