// HUD permanente: barras de escudo/vida/XP arriba a la izquierda, tiempo y cuenta
// regresiva del jefe arriba a la derecha, y la barra del jefe abajo al centro.
// Cada dato lleva su icono para que se lea de un vistazo sin depender del color solo.

import Phaser from 'phaser';
import { BAR, FONT_SIZE, TEXT } from '../config/theme.js';
import { edgePadding, getSafeInsets, isCompactMode } from './layout.js';
import { bar, formatTime, icon, text } from './widgets.js';
import { getTouchLayout } from '../utils/touchLayout.js';
import { isTouchDevice } from '../utils/device.js';

const DEPTH = 150;
const BAR_W_DESKTOP = 200;
const BOSS_BAR_W_DESKTOP = 300;
const BOSS_BAR_H = 16;

// Las barras arrancan después del icono, que va pegado al borde izquierdo.
const ICON_SIZE = 16;
const ICON_X = 20;
const ICON_X_COMPACT = 12;
// En compact reservamos la esquina superior izquierda para el botón de pausa
// mobile (TouchControls). El HUD arranca a la derecha del botón + un margen.
const PAUSE_RESERVED_W = 90;
const BAR_X = ICON_X + ICON_SIZE + 8;
const TEXT_X = BAR_X + BAR_W_DESKTOP + 8;
const HEADER_PAD = 18;
const HEADER_PAD_COMPACT = 12;

export default class Hud {
  constructor(scene) {
    this.scene = scene;

    this.shieldIcon = icon(scene, 'icon-shield', { size: ICON_SIZE, color: BAR.shield, depth: DEPTH + 1 });
    this.shieldBar = bar(scene, { width: BAR_W_DESKTOP, height: 8, color: BAR.shield, depth: DEPTH });
    this.shieldText = text(scene, '', { size: FONT_SIZE.tiny, color: TEXT.shield, depth: DEPTH + 1 });

    this.hpIcon = icon(scene, 'icon-heart', { size: ICON_SIZE + 2, color: BAR.hp, depth: DEPTH + 1 });
    this.hpBar = bar(scene, { width: BAR_W_DESKTOP, height: 18, color: BAR.hp, depth: DEPTH, inset: 2 });
    this.hpText = text(scene, '', { size: FONT_SIZE.small, color: TEXT.primary, depth: DEPTH + 1 });

    this.xpIcon = icon(scene, 'icon-zap', { size: ICON_SIZE, color: BAR.xp, depth: DEPTH + 1 });
    this.xpBar = bar(scene, { width: BAR_W_DESKTOP, height: 10, color: BAR.xp, depth: DEPTH });

    this.levelText = text(scene, '', { size: FONT_SIZE.small, color: TEXT.primary, depth: DEPTH + 1 });
    this.stageIcon = icon(scene, 'icon-layers', { size: ICON_SIZE - 2, color: 0xaa88ff, depth: DEPTH + 1 });
    this.stageText = text(scene, '', { size: FONT_SIZE.small, color: TEXT.stage, depth: DEPTH + 1 });

    this.timerIcon = icon(scene, 'icon-timer', { size: ICON_SIZE + 2, color: 0xffffff, depth: DEPTH + 1 });
    this.timerText = text(scene, '', { size: '18px', color: TEXT.primary, depth: DEPTH + 1, origin: [1, 0] });

    this.bossCountIcon = icon(scene, 'icon-skull', { size: ICON_SIZE, color: 0xff88cc, depth: DEPTH + 1 });
    this.nextBossText = text(scene, '', { size: FONT_SIZE.small, color: TEXT.boss, depth: DEPTH + 1, origin: [1, 0] });

    this.bossBarMaxWidth = BOSS_BAR_W_DESKTOP - 4;
    this.bossLabel = text(scene, 'JEFE', { size: FONT_SIZE.small, color: TEXT.boss, depth: DEPTH + 1, origin: 0.5 })
      .setVisible(false);
    this.bossBar = bar(scene, { width: BOSS_BAR_W_DESKTOP, height: BOSS_BAR_H, color: BAR.boss, depth: DEPTH, inset: 2 });
    this.bossBar.track.setVisible(false);
    this.bossBar.fill.setVisible(false);

    // Tracking de HP/shield previos para detectar subidas y disparar pulse.
    this._prevHp = null;
    this._prevShield = null;
    this._hpPulseTween = null;
    this._shieldPulseTween = null;
  }

  layout(w, h) {
    const compact = isCompactMode();
    const insets = getSafeInsets();
    const leftInset = edgePadding('left', 0, insets);
    const topInset = edgePadding('top', 0, insets);
    const rightInset = edgePadding('right', 0, insets);

    // Reservamos espacio para el boton de pausa mobile siempre que el dispositivo
    // sea touch (no solo en compact): tablets/desktop con touch tambien tienen
    // joystick virtual + boton de pausa que se monta con el HUD.
    // - joystick 'right' (default) => boton pausa en top-left => reserva izquierda
    // - joystick 'left'           => boton pausa en top-right => reserva derecha
    const touchSide = getTouchLayout();
    let leftReserved = 0;
    let rightReserved = 0;
    if (isTouchDevice()) {
      if (touchSide === 'left') {
        rightReserved = Math.max(PAUSE_RESERVED_W, rightInset + 60);
      } else {
        leftReserved = Math.max(PAUSE_RESERVED_W, leftInset + 60);
      }
    }

    // Ancho de barras: en compact, la barra ocupa una fraccion del ancho total
    // (no mas del 40% del viewport) para que el bloque derecho tenga lugar.
    const barW = compact
      ? Math.min(BAR_W_DESKTOP, (w - leftReserved - rightReserved) * 0.4)
      : BAR_W_DESKTOP;
    const iconX = (compact ? ICON_X_COMPACT : ICON_X) + leftInset;
    // En compact usamos la reserva maxima para que el bloque izquierdo no se
    // superponga con el boton de pausa.
    const effectiveIconX = compact ? Math.max(iconX, leftReserved) : iconX;
    const barX = effectiveIconX + ICON_SIZE + 8;
    const textX = barX + barW + 8;
    const headerPad = (compact ? HEADER_PAD_COMPACT : HEADER_PAD) + topInset;

    this.shieldBar.track.width = barW;
    this.shieldBar.fill.width = barW - 2;
    this.shieldBar.maxWidth = barW - 2;
    this.hpBar.track.width = barW;
    this.hpBar.fill.width = barW - 4;
    this.hpBar.maxWidth = barW - 4;
    this.xpBar.track.width = barW;
    this.xpBar.fill.width = barW - 2;
    this.xpBar.maxWidth = barW - 2;

    this.shieldIcon.setPosition(effectiveIconX + ICON_SIZE / 2, headerPad + 6);
    this.shieldBar.track.setPosition(barX, headerPad + 2);
    this.shieldBar.fill.setPosition(barX + 1, headerPad + 3);
    this.shieldText.setPosition(textX, headerPad);

    this.hpIcon.setPosition(effectiveIconX + ICON_SIZE / 2, headerPad + 23);
    this.hpBar.track.setPosition(barX, headerPad + 14);
    this.hpBar.fill.setPosition(barX + 2, headerPad + 16);
    this.hpText.setPosition(textX, headerPad + 14);

    this.xpIcon.setPosition(effectiveIconX + ICON_SIZE / 2, headerPad + 41);
    this.xpBar.track.setPosition(barX, headerPad + 36);
    this.xpBar.fill.setPosition(barX + 1, headerPad + 37);

    if (compact) {
      // En compact, nivel y etapa van inline al lado de la barra de XP para
      // no desperdiciar 2 filas mas (la pantalla ya esta apretada).
      this.levelText.setPosition(barX, headerPad + 50);
      this.stageIcon.setPosition(barX + 78, headerPad + 57);
      this.stageText.setPosition(barX + 92, headerPad + 50);
    } else {
      this.levelText.setPosition(barX, headerPad + 50);
      this.stageIcon.setPosition(barX + 92, headerPad + 57);
      this.stageText.setPosition(barX + 104, headerPad + 50);
    }

    const timerX = w - 20 - rightInset - rightReserved;
    this.timerText.setPosition(timerX, headerPad);
    // El timerText tiene originX=1 (borde derecho en timerX). El icono debe
    // quedar a la izquierda del texto con margen. Para que el icono arranque
    // x estable independiente del ancho del texto, lo posicionamos a una
    // distancia fija del borde derecho del texto segun el ancho del texto
    // actual (Phaser actualiza this.width al renderizar).
    const iconSize = 18;
    const textLeft = this.timerText.x - this.timerText.width;
    this.timerIcon.setPosition(textLeft - 8 - iconSize / 2, headerPad + 9);
    this.nextBossText.setPosition(timerX, headerPad + 24);
    this.positionBossCountIcon();

    // Boss bar: en compact ocupa 70% del ancho centrado, en desktop 300px.
    // Se sube para no chocar con el minimap (que vive a h - 20 - SIZE).
    const bossBarW = compact ? Math.min(w * 0.7, BOSS_BAR_W_DESKTOP) : BOSS_BAR_W_DESKTOP;
    this.bossBarMaxWidth = bossBarW - 4;
    this.bossBar.track.width = bossBarW;
    const barY = compact ? h - 28 : h - 48;
    const bossBarX = w / 2 - bossBarW / 2;
    this.bossBar.track.setPosition(bossBarX, barY);
    this.bossBar.fill.setPosition(bossBarX + 2, barY + 2);
    this.bossLabel.setPosition(w / 2, barY - 18);
  }

  update({ stats, xp, xpToNext, level, stage, elapsed }) {
    const hpRatio = Phaser.Math.Clamp(stats.hp / stats.maxHp, 0, 1);
    this.hpBar.fill.width = this.hpBar.maxWidth * hpRatio;
    this.hpText.setText(`${Math.ceil(stats.hp)}/${Math.round(stats.maxHp)}`);

    const shieldRatio = stats.shieldMax > 0 ? Phaser.Math.Clamp(stats.shield / stats.shieldMax, 0, 1) : 0;
    this.shieldBar.fill.width = this.shieldBar.maxWidth * shieldRatio;
    this.shieldText.setText(`${Math.ceil(stats.shield)}/${Math.round(stats.shieldMax)}`);

    const xpRatio = Phaser.Math.Clamp(xp / xpToNext, 0, 1);
    this.xpBar.fill.width = this.xpBar.maxWidth * xpRatio;
    this.levelText.setText(`Nivel ${level}`);
    this.stageText.setText(`Etapa ${stage}`);

    // Detectar cambios en hp/shield y disparar pulse del icono. Anima tanto
    // al subir (regen, lifesteal, shield regenerado) como al bajar (daño).
    // Throttle por icono: si ya hay un pulse activo, ignora.
    if (this._prevHp !== null && stats.hp !== this._prevHp) {
      this._pulseIcon(this.hpIcon, '_hpPulseTween');
    }
    if (this._prevShield !== null && stats.shield !== this._prevShield) {
      this._pulseIcon(this.shieldIcon, '_shieldPulseTween');
    }
    this._prevHp = stats.hp;
    this._prevShield = stats.shield;

    this.timerText.setText(formatTime(elapsed));
    this._repositionTimerIcon();
  }

  // El timerText tiene originX=1, por lo que su x es el borde derecho. El icono
  // debe quedar a la izquierda del texto con un margen. Se llama despues de
  // setText porque this.width se actualiza al renderizar.
  _repositionTimerIcon() {
    const iconSize = 18;
    const textLeft = this.timerText.x - this.timerText.width;
    this.timerIcon.setPosition(textLeft - 8 - iconSize / 2, this.timerIcon.y);
  }

  // El texto está anclado a la derecha y su ancho cambia, así que el icono se
  // recoloca a partir del borde izquierdo real del texto.
  positionBossCountIcon() {
    const topInset = edgePadding('top', 0, getSafeInsets());
    const y = topInset + HEADER_PAD + 24;
    this.bossCountIcon.setPosition(this.nextBossText.x - this.nextBossText.width - 12, y + 8);
  }

  // ms restantes hasta el próximo jefe, o null si ya hay uno en curso.
  setNextBossCountdown(ms) {
    const visible = ms !== null;
    this.nextBossText.setVisible(visible);
    this.bossCountIcon.setVisible(visible);
    if (!visible) return;
    this.nextBossText.setText(`Próximo jefe: ${formatTime(ms)}`);
    this.positionBossCountIcon();
  }

  showBossBar() {
    this.bossLabel.setVisible(true);
    this.bossBar.track.setVisible(true);
    this.bossBar.fill.setVisible(true);
  }

  hideBossBar() {
    this.bossLabel.setText('JEFE').setVisible(false);
    this.bossBar.track.setVisible(false);
    this.bossBar.fill.setVisible(false);
  }

  // Tiempo que le queda al jugador antes de que suba la presión de dificultad.
  setBossFightCountdown(ms) {
    this.bossLabel.setText(`JEFE - ${formatTime(ms)}`);
  }

  setBossHealthRatio(ratio) {
    this.bossBar.fill.width = this.bossBarMaxWidth * ratio;
  }

  // Atenua/restaurar la visibilidad del HUD entero (para menus modales encima).
  // Acepta cualquier alpha entre 0 y 1. Aplicamos sobre cada elemento porque
  // Hud no usa un Container.
  setAlpha(value) {
    const a = Phaser.Math.Clamp(value, 0, 1);
    const parts = [
      this.shieldIcon, this.shieldBar.track, this.shieldBar.fill, this.shieldText,
      this.hpIcon, this.hpBar.track, this.hpBar.fill, this.hpText,
      this.xpIcon, this.xpBar.track, this.xpBar.fill,
      this.levelText, this.stageIcon, this.stageText,
      this.timerIcon, this.timerText,
      this.bossCountIcon, this.nextBossText,
      this.bossLabel, this.bossBar.track, this.bossBar.fill,
    ];
    parts.forEach((p) => p.setAlpha(a));
  }

  // Pulse generico de un icono. Escala relativa al scale actual (que puede
  // ser 0.5 si la textura es 32px renderizada a 16px via setDisplaySize).
  // Throttle: si ya hay un pulse activo para este icono, ignora el call.
  //
  // tweenKey: nombre del campo en this donde se guarda la referencia al
  // tween activo (ej: '_xpPulseTween'). Permite varios pulsers simultaneos
  // en el mismo Hud sin pisarse.
  _pulseIcon(icon, tweenKey, factor = 1.5) {
    if (this[tweenKey]) return;
    const baseScaleX = icon.scaleX;
    const baseScaleY = icon.scaleY;
    this[tweenKey] = this.scene.tweens.add({
      targets: icon,
      scaleX: baseScaleX * factor,
      scaleY: baseScaleY * factor,
      duration: 140,
      yoyo: true,
      ease: 'Sine.Out',
      onComplete: () => {
        // Restaurar al scale original para que el icono vuelva a su tamaño.
        icon.scaleX = baseScaleX;
        icon.scaleY = baseScaleY;
        this[tweenKey] = null;
      },
    });
  }

  // API publica: pulse del icono XP al recoger un orbe.
  pulseXpIcon() {
    this._pulseIcon(this.xpIcon, '_xpPulseTween');
  }
}
