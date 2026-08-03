// Pantalla final (game over o victoria) y persistencia del mejor tiempo.
// Se crea recién cuando la partida termina, así que no necesita layout ni hide.

import { BEST_TIME_KEY } from '../config/constants.js';
import { FONT_SIZE, TEXT, UI } from '../config/theme.js';
import { isTouchDevice } from '../utils/device.js';
import { edgePadding, getSafeInsets, isCompactMode } from './layout.js';
import { button, formatTime, icon, panel, text } from './widgets.js';

const DEPTH_OVERLAY = 290;
const DEPTH = 300;
const DEPTH_CONTENT = 301;

const PANEL_W = 520;
const PANEL_W_COMPACT = 320;

export function getBestTime() {
  try {
    return Number(localStorage.getItem(BEST_TIME_KEY)) || 0;
  } catch {
    return 0;
  }
}

// Devuelve true si este tiempo fue un récord nuevo.
export function saveBestTime(ms) {
  try {
    if (ms > getBestTime()) {
      localStorage.setItem(BEST_TIME_KEY, String(Math.floor(ms)));
      return true;
    }
  } catch {
    // Sin localStorage seguimos jugando, solo no se guarda el récord.
  }
  return false;
}

// Panel de fin de partida: overlay, textos y dos botones (Reiniciar / Salir al menú).
// En mobile se ocultan los atajos de teclado; en desktop R y Enter reinician, Esc sale.
export default class EndScreen {
  constructor(scene, { title, color, elapsed, level, onRestart, onQuit }) {
    this.scene = scene;
    this.title = title;
    this.color = color;
    this.elapsed = elapsed;
    this.level = level;
    this.onRestart = onRestart;
    this.onQuit = onQuit;
    this.isOpen = true;
    this.isNewBest = saveBestTime(elapsed);
    this.bestTime = getBestTime();

    this.touch = isTouchDevice();
    this.compact = this.touch || isCompactMode();

    const w = scene.scale.width;
    const h = scene.scale.height;
    const topInset = edgePadding('top', 0, getSafeInsets());

    this.overlay = scene.add.rectangle(0, 0, w, h, UI.overlay, this.compact ? 0.92 : UI.overlayAlpha)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_OVERLAY);

    const panelW = this.compact ? Math.min(PANEL_W_COMPACT, w - 40) : PANEL_W;
    const panelH = this.compact ? 280 : 320;
    const cx = w / 2;
    const cy = h / 2 + topInset / 2;

    this.panel = panel(scene, {
      width: panelW, height: panelH, depth: DEPTH, border: color, origin: 0.5, alpha: 0.97,
    }).setPosition(cx, cy);

    const centerX = this.panel.x;

    this.titleText = text(scene, title, {
      size: this.compact ? '28px' : '40px', color, depth: DEPTH_CONTENT, origin: 0.5,
    }).setPosition(centerX, cy - panelH / 2 + 56);

    this.subtitleText = text(scene, `Sobreviviste ${formatTime(elapsed)} - Nivel ${level}`, {
      size: this.compact ? '15px' : '18px', color: TEXT.primary, depth: DEPTH_CONTENT, origin: 0.5,
    }).setPosition(centerX, cy - panelH / 2 + 56 + 38);

    this.trophyIcon = icon(scene, 'icon-trophy', {
      size: this.compact ? 18 : 20, color: 0xffcc44, depth: DEPTH_CONTENT,
    });
    this.bestText = text(scene, this.bestLabel(), {
      size: this.compact ? '14px' : '16px', color: TEXT.gold, depth: DEPTH_CONTENT, origin: [0, 0.5],
      wordWrapWidth: panelW - 80,
    });

    // El ancho real del texto puede requerir un ciclo de layout; recentramos al
    // final del frame para que el par icono+etiqueta ya esté medido.
    this.bestRowY = cy - panelH / 2 + 56 + 38 + 28;
    scene.time.delayedCall(0, () => this.centerBestRow(centerX));

    const buttonW = this.compact ? panelW - 40 : 200;

    this.restartButton = button(scene, {
      label: 'Reintentar', width: buttonW, height: 46,
      depth: DEPTH_CONTENT, color: TEXT.gold, borderColor: color,
      onClick: () => this.fireRestart(),
    });
    this.quitButton = button(scene, {
      label: 'Salir al menú', width: buttonW, height: 46,
      depth: DEPTH_CONTENT, color: TEXT.danger, borderColor: color,
      onClick: () => this.fireQuit(),
    });

    this.buttonsBaseY = cy + panelH / 2 - (this.compact ? 70 : 56);
    if (this.compact) {
      this.restartButton.setPosition(centerX, this.buttonsBaseY);
      this.quitButton.setPosition(centerX, this.buttonsBaseY + 56);
    } else {
      const gap = 16;
      this.restartButton.setPosition(centerX - buttonW / 2 - gap / 2, this.buttonsBaseY);
      this.quitButton.setPosition(centerX + buttonW / 2 + gap / 2, this.buttonsBaseY);
    }

    if (!this.touch) {
      this.hint = text(scene, 'R o Enter: reiniciar · Esc: menú', {
        size: FONT_SIZE.tiny, color: TEXT.muted, depth: DEPTH_CONTENT, origin: 0.5,
      }).setPosition(centerX, cy + panelH / 2 - 16);
    }

    this._onRestartKey = () => this.fireRestart();
    this._onEnterKey = () => this.fireRestart();
    this._onQuitKey = () => this.fireQuit();
    scene.input.keyboard.on('keydown-R', this._onRestartKey);
    scene.input.keyboard.on('keydown-ENTER', this._onEnterKey);
    scene.input.keyboard.on('keydown-ESC', this._onQuitKey);

    scene.events.once('shutdown', () => this.destroy());
  }

  bestLabel() {
    return this.isNewBest
      ? `¡Nuevo mejor tiempo! ${formatTime(this.bestTime)}`
      : `Mejor tiempo: ${formatTime(this.bestTime)}`;
  }

  centerBestRow(cx) {
    const gap = 8;
    const iconW = this.trophyIcon.displayWidth || 20;
    // Re-medimos por si wordWrap cambió el ancho del texto.
    this.bestText.setText(this.bestLabel());
    const textW = this.bestText.width;
    const total = iconW + gap + textW;
    const startX = cx - total / 2;
    this.trophyIcon.setPosition(startX + iconW / 2, this.bestRowY);
    this.bestText.setPosition(startX + iconW + gap, this.bestRowY);
  }

  fireRestart() {
    if (!this.isOpen) return;
    this.close();
    this.onRestart?.();
  }

  fireQuit() {
    if (!this.isOpen) return;
    this.close();
    this.onQuit?.();
  }

  close() {
    this.isOpen = false;
    this.restartButton.parts[0].disableInteractive();
    this.quitButton.parts[0].disableInteractive();
  }

  destroy() {
    this.scene.input.keyboard.off('keydown-R', this._onRestartKey);
    this.scene.input.keyboard.off('keydown-ENTER', this._onEnterKey);
    this.scene.input.keyboard.off('keydown-ESC', this._onQuitKey);
    const parts = [
      this.overlay, this.panel, this.titleText, this.subtitleText,
      this.trophyIcon, this.bestText, this.hint,
    ];
    parts.forEach((p) => p?.destroy());
    this.restartButton?.parts.forEach((p) => p.destroy());
    this.quitButton?.parts.forEach((p) => p.destroy());
  }
}

// Wrapper retrocompatible: cualquier llamada `showEndScreen(scene, opts)` queda
// funcionando con botones por defecto (R reinicia, Esc sale al menú).
export function showEndScreen(scene, { title, color, elapsed, level }) {
  return new EndScreen(scene, {
    title, color, elapsed, level,
    onRestart: () => scene.scene.restart(),
    onQuit: () => scene.scene.start('menu'),
  });
}
