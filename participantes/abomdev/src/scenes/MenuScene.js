// Menú principal. Es una escena propia (no un panel dentro del juego) para que
// "Salir al menú" desde la pausa sea simplemente volver acá con el estado limpio.

import Phaser from 'phaser';

import { FONT_SIZE, TEXT } from '../config/theme.js';
import { getBestTime } from '../ui/EndScreen.js';
import SettingsPanel from '../ui/SettingsPanel.js';
import { button, formatTime, panel, setVisible, text } from '../ui/widgets.js';
import { unlockAudio, startBgm, stopBgm, isAudioReady } from '../audio/synth.js';
import { createMenuTrack } from '../audio/chip-tracks.js';

const TRACK_GENERATORS = {
  menu: createMenuTrack,
};
import { isTouchDevice, isIOS } from '../utils/device.js';
import { toggleFullscreen, isBrowserFullscreen } from '../utils/fullscreen.js';
import { lockLandscape } from '../utils/orientation.js';
import { edgePadding, getSafeInsets, isCompactMode } from '../ui/layout.js';

const DEPTH = 10;
const PANEL_W = 640;
const PANEL_H = 380;
const PANEL_W_COMPACT = 320;
const PANEL_H_COMPACT = 340;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create() {
    this.cameras.main.setBackgroundColor('#111122');

    // Si un F5 preservó el fullscreen (algunos browsers móviles lo hacen),
    // forzamos salida para normalizar el estado. Sin esto, scale.isFullscreen
    // queda en true y startGame salta el auto-fullscreen.
    if (isBrowserFullscreen()) {
      try { this.scale.stopFullscreen(); } catch (e) {}
    }

    // Fondo con la misma grilla que el juego, para que el menú no se sienta ajeno.
    this.add.grid(0, 0, 4000, 4000, 64, 64, 0x1a1a2e, 1, 0x2a2a4e, 1).setDepth(-1);

    this.panel = panel(this, { width: PANEL_W, height: PANEL_H, depth: DEPTH, border: 0x66ffcc, origin: 0.5 });
    this.title = text(this, 'BUGSURVIVOR', { size: '46px', color: TEXT.accent, depth: DEPTH + 1, origin: 0.5 });
    this.subtitle = text(this, 'Sobrevive, sube de nivel y cruza los portales', {
      size: FONT_SIZE.small, color: TEXT.secondary, depth: DEPTH + 1, origin: 0.5, wordWrapWidth: PANEL_W - 80,
    });

    const bestTime = getBestTime();
    this.bestText = text(this, bestTime > 0 ? `Mejor tiempo: ${formatTime(bestTime)}` : '', {
      size: FONT_SIZE.small, color: TEXT.gold, depth: DEPTH + 1, origin: 0.5,
    });

    this.playButton = button(this, {
      label: 'JUGAR', width: 220, height: 52, depth: DEPTH + 1,
      onClick: () => this.startGame(),
    });
    this.settingsButton = button(this, {
      label: 'CONFIGURACIÓN', width: 220, height: 44, depth: DEPTH + 1, color: TEXT.info,
      onClick: () => this.openSettings(),
    });

    this.fsButton = null;
    if (isTouchDevice()) {
      this.fsButton = button(this, {
        label: 'PANTALLA COMPLETA', width: 200, height: 44, depth: DEPTH + 1, color: TEXT.gold,
        onClick: () => this.tryFullscreen(),
      });
    }

    this.hint = text(this, isTouchDevice()
      ? 'Joystick para moverte · ESC: pausa'
      : 'WASD / Flechas para moverte · ESC: pausa · F: pantalla completa', {
      size: FONT_SIZE.tiny, color: TEXT.muted, depth: DEPTH + 1, origin: 0.5, wordWrapWidth: PANEL_W - 60,
    });

    this.mainParts = [
      this.panel, this.title, this.subtitle, this.bestText, this.hint,
      ...this.playButton.parts, ...this.settingsButton.parts,
      ...(this.fsButton ? this.fsButton.parts : []),
    ];

    this.settingsPanel = new SettingsPanel(this, () => setVisible(this.mainParts, true));

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      stopBgm();
    });

    // Cualquier interacción sirve para desbloquear el audio: el navegador lo mantiene
    // bloqueado hasta que el usuario toca algo. IntroScene ya capturó el primer
    // gesto, asi que normalmente el audio ya esta running cuando MenuScene
    // arranca. Pero por si alguien navega directo al menu (refresh dentro del
    // juego, deep-link, etc.) cubrimos el caso suspended con el listener.
    const unlockAndStartBgm = () => {
      unlockAudio();
      startBgm('menu', null, TRACK_GENERATORS);
    };
    this.input.once('pointerdown', unlockAndStartBgm);
    this.input.keyboard.once('keydown', unlockAndStartBgm);
    // Si el AudioContext ya esta running (caso normal: IntroScene lo desbloqueo),
    // arrancamos la musica de inmediato sin esperar otro gesto.
    if (isAudioReady()) {
      startBgm('menu', null, TRACK_GENERATORS);
    }
    this.input.keyboard.on('keydown-ENTER', () => this.startGame());
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const cy = h / 2;
    const compact = isCompactMode();
    const topInset = edgePadding('top', 0, getSafeInsets());

    this.cameras.main.centerOn(0, 0);

    const panelW = compact ? Math.min(PANEL_W_COMPACT, w - 40) : PANEL_W;
    const panelH = compact ? Math.min(PANEL_H_COMPACT, h - 40) : PANEL_H;
    this.panel.setSize(panelW, panelH).setPosition(cx, cy);

    const titleSize = compact ? '32px' : '46px';
    this.title.setStyle({ fontSize: titleSize }).setPosition(cx, cy - panelH / 2 + (compact ? 32 : 62));

    const subtitleSize = compact ? FONT_SIZE.tiny : FONT_SIZE.small;
    this.subtitle.setStyle({ fontSize: subtitleSize }).setPosition(cx, cy - panelH / 2 + (compact ? 60 : 104));

    const bestSize = compact ? FONT_SIZE.tiny : FONT_SIZE.small;
    this.bestText.setStyle({ fontSize: bestSize }).setPosition(cx, cy - panelH / 2 + (compact ? 82 : 134));

    this.playButton.setPosition(cx, cy + (compact ? 0 : 10));
    this.settingsButton.setPosition(cx, cy + (compact ? 56 : 76));
    if (this.fsButton) {
      this.fsButton.setPosition(cx, cy + (compact ? 112 : 76 + 44));
    }
    const hintSize = compact ? FONT_SIZE.tiny : FONT_SIZE.tiny;
    this.hint.setStyle({ fontSize: hintSize }).setPosition(cx, cy + panelH / 2 - 22);

    this.settingsPanel.layout(w, h);
  }

  openSettings() {
    setVisible(this.mainParts, false);
    this.settingsPanel.show();
  }

  tryFullscreen() {
    const result = toggleFullscreen(this.scale);
    if (result === 'on') lockLandscape();
    else if (result === 'failed') this.showFullscreenFallback();
  }

  showFullscreenFallback() {
    if (this.fsToast) return;
    const msg = isIOS()
      ? 'En iPhone: tocar compartir → Agregar a inicio'
      : 'Pantalla completa no disponible';
    this.fsToast = panel(this, { width: 360, height: 48, depth: 60, border: 0xffaa00, origin: 0.5 });
    this.fsToastText = text(this, msg, { size: FONT_SIZE.small, color: 0xffaa00, depth: 61, origin: 0.5 });
    const cx = this.scale.width / 2;
    const cy = this.scale.height - 60;
    this.fsToast.setPosition(cx, cy);
    this.fsToastText.setPosition(cx, cy);
    this.time.delayedCall(8000, () => {
      this.fsToast?.destroy();
      this.fsToastText?.destroy();
      this.fsToast = null;
      this.fsToastText = null;
    });
  }

  startGame() {
    if (this.settingsPanel.isOpen) return;
    unlockAudio();
    if (isTouchDevice() && !isBrowserFullscreen()) {
      const result = toggleFullscreen(this.scale);
      if (result === 'on') lockLandscape();
    }
    stopBgm();
    this.scene.start('game');
  }
}
