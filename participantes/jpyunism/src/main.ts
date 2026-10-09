import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GAME } from "./core/Constants";
import Phaser from "phaser";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  backgroundColor: GAME.BG_COLOR,
  pixelArt: true,
  roundPixels: true,
  scene: [MenuScene, GameScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%",
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
  },
  input: {
    activePointers: 4,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
};

const game = new Phaser.Game(config);

/**
 * Expose the game instance for the automated tests (`test-*.spec.ts`).
 *
 * The Playwright suite needs to read and drive live scene state to assert on
 * gameplay regressions; without a handle it can only look at the canvas. This
 * is a test seam, not a public API — nothing in `src/` reads it.
 */
(window as unknown as { __game: Phaser.Game }).__game = game;
