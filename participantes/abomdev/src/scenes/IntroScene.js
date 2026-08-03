// Pantalla de intro: aparece apenas carga el juego y espera el primer gesto
// del usuario para desbloquear el AudioContext del navegador. Sin este gesto,
// los navegadores modernos bloquean cualquier audio (incluida la musica del
// menu). Apenas el usuario toca/cliquea/press any key, hace fade-out a
// MenuScene que arranca la musica del menu.

import Phaser from 'phaser';

import { FONT_SIZE, TEXT } from '../config/theme.js';
import { text } from '../ui/widgets.js';
import { isTouchDevice } from '../utils/device.js';
import { unlockAudio, startBgm } from '../audio/synth.js';
import { createMenuTrack } from '../audio/chip-tracks.js';

const TRACK_GENERATORS = {
  menu: createMenuTrack,
};

const FADE_MS = 300;

export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('intro');
  }

  create() {
    this.cameras.main.setBackgroundColor('#111122');

    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const cy = h / 2;

    this.add.grid(0, 0, 4000, 4000, 64, 64, 0x1a1a2e, 1, 0x2a2a4e, 1).setDepth(-1);

    this.title = text(this, 'BUGSURVIVOR', {
      size: '64px', color: TEXT.accent, depth: 10, origin: 0.5,
    }).setPosition(cx, cy - 80);

    const prompt = isTouchDevice() ? 'TOCA LA PANTALLA' : 'PRESIONA CUALQUIER TECLA O HAZ CLICK';
    this.promptText = text(this, prompt, {
      size: FONT_SIZE.body, color: TEXT.secondary, depth: 10, origin: 0.5,
    }).setPosition(cx, cy + 40);

    this.hintText = text(this, 'para empezar', {
      size: FONT_SIZE.small, color: TEXT.muted, depth: 10, origin: 0.5,
    }).setPosition(cx, cy + 80);

    this.scale.on('resize', this.layout, this);

    this.tweens.add({
      targets: this.promptText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const advance = () => {
      if (this._advancing) return;
      this._advancing = true;
      unlockAudio();
      startBgm('menu', null, TRACK_GENERATORS);
      this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('menu');
      });
    };

    this.input.once('pointerdown', advance);
    this.input.keyboard.once('keydown', advance);
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const cy = h / 2;
    this.title.setPosition(cx, cy - 80);
    this.promptText.setPosition(cx, cy + 40);
    this.hintText.setPosition(cx, cy + 80);
  }
}