import Phaser from 'phaser';
import IntroScene from './scenes/IntroScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: '#111122',
  parent: 'game',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: [IntroScene, MenuScene, GameScene],
});

// Expuesto en window para que el smoke test automatizado (puppeteer) pueda
// inspeccionar el estado del juego (menus, scene activa, etc.). En produccion
// queda accesible pero no causa problemas.
if (typeof window !== 'undefined') window.game = game;
