import Phaser from "phaser";
import { Enemy } from "./Enemy";

/**
 * Fast, fragile enemy that rushes straight at the player.
 */
export class ChaserEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "enemy-chaser", 15, 110, 10, 0xff0000);
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

    this.scene.physics.moveTo(this, playerX, playerY, this.speed);

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.x !== 0 || body.velocity.y !== 0) {
      this.rotation = Math.atan2(body.velocity.y, body.velocity.x);
    }
  }
}
