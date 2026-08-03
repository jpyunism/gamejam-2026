// Menu de pausa en tres columnas: inventario de armas a la izquierda, botones al
// centro y estadisticas a la derecha. El overlay atenua el juego de fondo.
// Cada stat y cada arma llevan su icono, con el mismo mapeo que las cards de level-up.
//
// En compact (mobile): layout en 3 columnas (armas | botones | stats),
// centradas horizontalmente en el viewport. El contenido de las cajas
// laterales se centra verticalmente.

import { FONT_SIZE, TEXT, UI } from '../config/theme.js';
import { WEAPON_KEYS } from '../config/upgrades.js';
import { isTouchDevice, isIOS } from '../utils/device.js';
import { toggleFullscreen } from '../utils/fullscreen.js';
import { lockLandscape, unlockOrientation } from '../utils/orientation.js';
import { getTouchLayout } from '../utils/touchLayout.js';
import { edgePadding, getSafeInsets, isCompactMode } from './layout.js';
import { button, divider, icon, panel, setVisible, text } from './widgets.js';

const DEPTH_OVERLAY = 290;
const DEPTH = 300;
const DEPTH_TITLE = 310;
const DEPTH_PANEL = 305;
const DEPTH_CONTENT = 306;
const DEPTH_TOOLTIP = 320;
const BOX_H_DESKTOP = 470;
const BOX_H_COMPACT = 220;
const STATS_W = 340;
const STATS_W_COMPACT = 280;
const INVENTORY_W = 280;
const INVENTORY_W_COMPACT = 240;
const TITLE_BOX_W = 260;
const TITLE_BOX_H = 60;
const PADDING = 16;
const PADDING_COMPACT = 10;
const ROW_H = 26;
const ROW_ICON = 17;
const MAX_ROWS = 15;
const SLOT_H = 54;
const SLOT_H_COMPACT = 28;
const SLOT_ICON = 26;
const SLOT_ICON_COMPACT = 18;
const COMPACT_BUTTON_W = 96;

// Nombre e icono de cada arma para el inventario. El orden es el de WEAPON_KEYS.
const WEAPON_INFO = {
  aura: { name: 'Aura de daño', icon: 'icon-circle-dot', color: 0x66ffcc,
    description: 'Daña a todos los enemigos en un radio a tu alrededor continuamente.' },
  orbit: { name: 'Orbe giratorio', icon: 'icon-orbit', color: 0x55ddff,
    description: 'Orbes que giran a tu alrededor y dañan a los enemigos que tocan.' },
  pierce: { name: 'Perforante', icon: 'icon-crosshair', color: 0x66ddff,
    description: 'Disparo que atraviesa multiples enemigos sin desaparecer.' },
  burst: { name: 'Rafaga', icon: 'icon-swords', color: 0xffee66,
    description: 'Dispara a varios enemigos cercanos al mismo tiempo.' },
  nova: { name: 'Onda expansiva', icon: 'icon-waves', color: 0xffaa00,
    description: 'Emite ondas de dano en un radio amplio periodicamente.' },
};

export default class PauseMenu {
  // actions: { onResume, onSettings, onRestart, onQuit }
  constructor(scene, actions, side) {
    this.scene = scene;
    this.side = side || getTouchLayout();

    this.overlay = scene.add.rectangle(0, 0, 10, 10, UI.overlay, UI.overlayAlpha)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_OVERLAY).setVisible(false);

    this.titleBox = panel(scene, { width: TITLE_BOX_W, height: TITLE_BOX_H, depth: DEPTH_TITLE, border: 0x66ffcc, origin: 0.5, alpha: 0.95 })
      .setVisible(false);
    this.title = text(scene, 'PAUSADO', { size: '32px', color: TEXT.primary, depth: DEPTH_TITLE + 1, origin: 0.5 })
      .setVisible(false);

    // La etapa va bajo el título y no en la lista de estadísticas: es contexto de
    // la partida, no una stat del personaje.
    this.stageIcon = icon(scene, 'icon-layers', { size: 18, color: 0xaa88ff, depth: DEPTH_TITLE + 1 }).setVisible(false);
    this.stageText = text(scene, '', { size: '18px', color: TEXT.stage, depth: DEPTH_TITLE + 1, origin: [0, 0.5] })
      .setVisible(false);

    this.buildInventory(scene);
    this.buildStats(scene);
    this.buildButtons(scene, actions);

    this.chrome = [
      this.overlay, this.titleBox, this.title, this.stageIcon, this.stageText,
      this.invBox, this.invTitle, this.invDivider,
      this.box, this.boxTitle, this.boxDivider,
    ];

    this._clipCounts = { inv: Infinity, rows: Infinity };
    this._isCompact = false;

    // Tooltip para mostrar el nombre + descripcion de un arma en hover
    // (desktop) o long-press (mobile).
    this._buildTooltip(scene);
  }

  _buildTooltip(scene) {
    const w = 260;
    const h = 80;
    this.tooltipBox = panel(scene, { width: w, height: h, depth: DEPTH_TOOLTIP, border: 0x66ffcc, alpha: 0.96 })
      .setVisible(false);
    this.tooltipName = text(scene, '', { size: '15px', color: 0x66ffcc, depth: DEPTH_TOOLTIP + 1, origin: [0, 0] })
      .setVisible(false);
    this.tooltipDesc = text(scene, '', { size: '12px', color: TEXT.primary, depth: DEPTH_TOOLTIP + 1, origin: [0, 0],
      wordWrapWidth: w - 20 })
      .setVisible(false);
    this._tooltipTimer = null;
    this._tooltipLocked = false;
    this._tooltipParts = [this.tooltipBox, this.tooltipName, this.tooltipDesc];
  }

  _showTooltip(slot, screenX, screenY) {
    const info = WEAPON_INFO[slot.key];
    this.tooltipName.setText(info.name);
    this.tooltipName.setColor(`#${info.color.toString(16).padStart(6, '0')}`);
    this.tooltipDesc.setText(info.description);
    // El borde del box adopta el color del arma para reforzar la identidad.
    this.tooltipBox.setStrokeStyle(3, info.color);
    this.tooltipBox.setVisible(true);
    this.tooltipName.setVisible(true);
    this.tooltipDesc.setVisible(true);
    // Posicionar al lado del slot. Si el slot esta en la mitad izquierda,
    // el tooltip aparece a la derecha; si no, a la izquierda.
    const scene = this.scene;
    const w = scene.scale.width;
    const h = scene.scale.height;
    const tw = 260;
    const th = 80;
    // Tomamos el slot.x como referencia si esta disponible, sino el pointer.
    const slotX = slot.frame ? slot.frame.x + slot.frame.width / 2 : screenX;
    const slotY = slot.frame ? slot.frame.y + slot.frame.height / 2 : screenY;
    let x = slotX + 16;
    let y = slotY - th - 8;
    if (x + tw > w - 8) x = slotX - tw - 16;
    if (y < 8) y = slotY + 16;
    if (y + th > h - 8) y = h - th - 8;
    // tooltipBox: rect con origin top-left (0). Posicionar con (x, y) como top-left.
    this.tooltipBox.setPosition(x, y);
    this.tooltipName.setPosition(x + 12, y + 10);
    this.tooltipDesc.setPosition(x + 12, y + 30);
  }

  _hideTooltip() {
    this.tooltipBox.setVisible(false);
    this.tooltipName.setVisible(false);
    this.tooltipDesc.setVisible(false);
    if (this._tooltipTimer) {
      this._tooltipTimer.remove(false);
      this._tooltipTimer = null;
    }
    this._tooltipLocked = false;
  }

  buildInventory(scene) {
    this.invBox = panel(scene, { width: INVENTORY_W, height: BOX_H_DESKTOP, depth: DEPTH_PANEL, border: 0xffcc44 }).setVisible(false);
    this.invTitle = text(scene, 'ARMAS', { size: '17px', color: TEXT.gold, depth: DEPTH_CONTENT }).setVisible(false);
    this.invDivider = divider(scene, { width: INVENTORY_W - PADDING * 2, depth: DEPTH_CONTENT }).setVisible(false);

    // Un slot por arma del juego: las bloqueadas también se muestran, apagadas, para
    // que se vea qué queda por conseguir.
    this.slots = WEAPON_KEYS.map((key, i) => {
      const frame = scene.add.rectangle(0, 0, INVENTORY_W - PADDING * 2, SLOT_H - 8, 0x101024, 0.9)
        .setOrigin(0).setStrokeStyle(2, 0x333355).setScrollFactor(0).setVisible(false);
      const slot = {
        key,
        frame,
        icon: icon(scene, WEAPON_INFO[key].icon, { size: SLOT_ICON, color: 0xffffff, depth: DEPTH_CONTENT + 1 }).setVisible(false),
        name: text(scene, WEAPON_INFO[key].name, { size: FONT_SIZE.small, color: TEXT.secondary, depth: DEPTH_CONTENT + 1 }).setVisible(false),
        detail: text(scene, '', { size: FONT_SIZE.tiny, color: TEXT.dim, depth: DEPTH_CONTENT + 1 }).setVisible(false),
      };
      frame.setDepth(DEPTH_CONTENT);
      // Tooltip en hover (desktop) o long-press (mobile).
      frame.setInteractive({ useHandCursor: true });
      frame.on('pointerover', (p) => {
        if (this._isCompact) return;
        if (this._tooltipLocked) return;
        this._showTooltip(slot, p.x, p.y);
      });
      frame.on('pointerout', () => {
        if (this._isCompact) return;
        if (this._tooltipLocked) return;
        this._hideTooltip();
      });
      frame.on('pointerdown', (p) => {
        if (!this._isCompact) return;
        if (this._tooltipTimer) this._tooltipTimer.remove(false);
        this._tooltipTimer = scene.time.delayedCall(400, () => {
          this._tooltipLocked = true;
          this._showTooltip(slot, p.x, p.y);
        });
      });
      frame.on('pointerup', () => {
        if (this._tooltipTimer) {
          this._tooltipTimer.remove(false);
          this._tooltipTimer = null;
        }
        if (this._tooltipLocked) {
          this._hideTooltip();
        }
      });
      return slot;
    });
  }

  buildStats(scene) {
    this.box = panel(scene, { width: STATS_W, height: BOX_H_DESKTOP, depth: DEPTH_PANEL, border: 0x66aaff }).setVisible(false);
    this.boxTitle = text(scene, 'ESTADÍSTICAS', { size: '17px', color: TEXT.info, depth: DEPTH_CONTENT }).setVisible(false);
    this.boxDivider = divider(scene, { width: STATS_W - PADDING * 2, depth: DEPTH_CONTENT }).setVisible(false);

    // Filas reutilizables: se crean una vez y se rellenan al pausar, así no
    // generamos y destruimos objetos cada vez que se abre el menú.
    this.rows = Array.from({ length: MAX_ROWS }, () => ({
      icon: icon(scene, 'icon-swords', { size: ROW_ICON, color: 0xffffff, depth: DEPTH_CONTENT + 1 }).setVisible(false),
      label: text(scene, '', { size: FONT_SIZE.small, color: TEXT.secondary, depth: DEPTH_CONTENT + 1 }).setVisible(false),
    }));
  }

  buildButtons(scene, actions) {
    const touch = isTouchDevice();
    const compact = touch && isCompactMode();
    // En compact fullscreen no se ofrece en la pausa porque el jugador ya esta
    // en touch y el boton se controla desde el menu principal. Asi la lista
    // de botones queda corta y entra en pantallas de 360h.
    const fsButton = touch && !compact
      ? button(scene, { label: 'Pantalla completa', width: 210, height: 38, depth: DEPTH_CONTENT, color: TEXT.gold, onClick: () => this.tryFullscreen() })
      : null;

    this.buttons = [
      ...(fsButton ? [fsButton] : []),
      button(scene, { label: 'Continuar', width: 210, height: 46, depth: DEPTH_CONTENT, onClick: actions.onResume }),
      button(scene, { label: 'Configuración', width: 210, height: 46, depth: DEPTH_CONTENT, color: TEXT.info, onClick: actions.onSettings }),
      button(scene, { label: 'Reiniciar', width: 210, height: 46, depth: DEPTH_CONTENT, color: TEXT.gold, onClick: actions.onRestart }),
      button(scene, { label: 'Salir al menú', width: 210, height: 46, depth: DEPTH_CONTENT, color: TEXT.danger, onClick: actions.onQuit }),
    ];
    this.buttonParts = this.buttons.flatMap((b) => b.parts);
    setVisible(this.buttonParts, false);
  }

  tryFullscreen() {
    const result = toggleFullscreen(this.scene.scale);
    if (result === 'on') lockLandscape();
    else if (result === 'off') unlockOrientation();
    else if (result === 'failed') this.showFullscreenFallback();
  }

  showFullscreenFallback() {
    if (this.fsToast) return;
    const msg = isIOS()
      ? 'En iPhone: tocar compartir → Agregar a inicio'
      : 'Pantalla completa no disponible';
    const scene = this.scene;
    this.fsToast = panel(scene, { width: 360, height: 48, depth: DEPTH + 5, border: 0xffaa00, origin: 0.5 });
    this.fsToastText = text(scene, msg, { size: FONT_SIZE.small, color: 0xffaa00, depth: DEPTH + 6, origin: 0.5 });
    const w = scene.scale.width;
    const h = scene.scale.height;
    this.fsToast.setPosition(w / 2, h - 60);
    this.fsToastText.setPosition(w / 2, h - 60);
    scene.time.delayedCall(8000, () => {
      this.fsToast?.destroy();
      this.fsToastText?.destroy();
      this.fsToast = null;
      this.fsToastText = null;
    });
  }

  layout(w, h) {
    // Compact = el jugador esta en touch. Detectamos touch por heuristica:
    // o es touch device segun el browser, o el jugador configuro el lado del
    // joystick en algun momento (persiste en localStorage, lo cual solo
    // ocurre en touch). Sin importar el tamano del viewport: si el jugador
    // es touch, queremos el layout optimizado para touch.
    const touchConfigured = (() => {
      try { return localStorage.getItem('survivorsTouchLayout') !== null; } catch { return false; }
    })();
    // Compact solo cuando el navegador es touch, o cuando el viewport es chico
    // Y el jugador habia configurado el touchLayout. En desktop puro, no
    // forzamos el layout mobile aunque el localStorage diga touchConfigured.
    const compact = isTouchDevice() || (isCompactMode() && touchConfigured);
    this._isCompact = compact;
    const cx = w / 2;
    this.overlay.width = w;
    this.overlay.height = h;
    // Backdrop: en compact casi opaco para tapar el HUD del juego que queda
    // detras; en desktop semitransparente para mantener el contexto visual.
    this.overlay.setFillStyle(UI.overlay, compact ? 0.92 : UI.overlayAlpha);

    const insets = getSafeInsets();
    const topInset = edgePadding('top', 0, insets);
    const leftInset = edgePadding('left', 0, insets);
    const rightInset = edgePadding('right', 0, insets);

    // En compact el titulo va debajo del HUD del juego (que ocupa hasta
    // aprox y=80) para no quedar tapado por las barras de HP/escudo/XP.
    const titleY = compact ? topInset + 50 : topInset + 55;
    this.titleBox.setPosition(cx, titleY);
    this.title.setPosition(cx, titleY);
    this.stageCenterX = cx;
    this.positionStage();

    const padding = compact ? PADDING_COMPACT : PADDING;
    const statsW = compact ? Math.min(STATS_W_COMPACT, w - 2 * (padding + leftInset)) : STATS_W;
    const invW = compact ? Math.min(INVENTORY_W_COMPACT, w - 2 * (padding + leftInset)) : INVENTORY_W;
    const boxH = compact ? BOX_H_COMPACT : BOX_H_DESKTOP;
    const slotH = compact ? SLOT_H_COMPACT : SLOT_H;

    // El alto del bloque de pausa debe caber entre el titulo y el borde inferior.
    const usableTop = titleY + 50;
    const usableBottom = h - 20 - topInset;
    const maxBoxH = Math.max(120, usableBottom - usableTop);

    if (compact) {
      // Layout en 3 columnas: ARMAS a la izquierda, controles en el centro,
      // ESTADISTICAS a la derecha. Las 3 columnas se calculan centradas
      // respecto al centro del viewport (cx) para que el balance no cambie
      // con leftInset vs rightInset. Ademas capeamos sideColW a un ancho
      // razonable para que las cajas no se estiren en pantallas grandes.
      const colGap = 10;
      const usableW = w - 2 * padding - leftInset - rightInset;
      const sideColW = Math.max(140, Math.min(INVENTORY_W_COMPACT, (usableW - 2 * colGap) * 0.37, 280));
      const buttonsColW = Math.max(COMPACT_BUTTON_W, usableW - 2 * sideColW - 2 * colGap);
      const totalRowW = sideColW * 2 + buttonsColW + colGap * 2;
      const invX = cx - totalRowW / 2;
      const buttonsX = invX + sideColW + colGap;
      const statsX = buttonsX + buttonsColW + colGap;
      const columnsTop = titleY + 40;
      const compactButtonH = 36;
      const buttonGap = 6;
      const totalButtonsH = this.buttons.length * compactButtonH + (this.buttons.length - 1) * buttonGap;
      // Los botones arrancan debajo del titulo (no verticalmente centrados) para
      // mantener siempre el titlePAUSADO visible arriba.
      const buttonsTop = Math.max(columnsTop, topInset + 110);
      const columnsBottom = h - 8;
      const columnsH = Math.max(120, columnsBottom - columnsTop);

      this.invBox.setSize(sideColW, columnsH).setPosition(invX, columnsTop);
      this.invTitle.setPosition(invX + padding, columnsTop + padding);
      this.invDivider.setSize(sideColW - padding * 2, 2).setPosition(invX + padding, columnsTop + 36);

      const slotsClipY = columnsTop + 50;
      this._clipCounts.inv = Math.floor((columnsH - 60) / slotH);
      const slotStep = slotH;
      this.slots.forEach((slot, i) => {
        const y = slotsClipY + i * slotStep;
        if (i >= this._clipCounts.inv) return;
        slot.frame.setSize(sideColW - padding * 2, slotH - 4).setPosition(invX + padding, y);
        // Icono a la izquierda, nombre a la derecha (layout horizontal).
        slot.icon.setDisplaySize(18, 18).setPosition(invX + padding + 14, y + (slotH - 4) / 2);
        slot.name.setOrigin(0, 0.5).setStyle({ fontSize: '12px' }).setPosition(invX + padding + 28, y + (slotH - 4) / 2);
        // En compact no mostramos el detail del slot: el icono + name alcanzan
        // para identificar el arma y la columna ya es estrecha.
        slot.detail.setVisible(false);
      });

      this.box.setSize(sideColW, columnsH).setPosition(statsX, columnsTop);
      this.boxTitle.setPosition(statsX + padding, columnsTop + padding);
      this.boxDivider.setSize(sideColW - padding * 2, 2).setPosition(statsX + padding, columnsTop + 36);

      const rowsClipY = columnsTop + 50;
      this._clipCounts.rows = Math.floor((columnsH - 60) / ROW_H);
      this.rows.forEach((row, i) => {
        const y = rowsClipY + i * ROW_H;
        if (i >= this._clipCounts.rows) return;
        row.icon.setPosition(statsX + padding + ROW_ICON / 2, y + 8);
        row.label.setStyle({ fontSize: '13px' }).setPosition(statsX + padding + ROW_ICON + 10, y);
      });

      // Botones en columna central, mas altos y con texto mas grande.
      this.buttons.forEach((b) => b.setSize(buttonsColW, compactButtonH));
      this.buttons.forEach((b) => {
        // b.parts[1] es el labelText del button widget.
        if (b.parts[1]) b.parts[1].setStyle({ fontSize: '16px' });
      });
      const buttonsCx = buttonsX + buttonsColW / 2;
      this.buttons.forEach((b, i) => {
        const y = buttonsTop + i * (compactButtonH + buttonGap);
        b.setPosition(buttonsCx, y);
      });
    } else {
      // Layout desktop: las cajas se escalan segun el viewport. boxY arriba
      // (debajo del titulo), BOX_H_DESKTOP capeado para que no se extienda
      // mas alla del viewport. El contenido se centra verticalmente dentro
      // de las cajas (header + items + bottom).
      const boxY = Math.max(120, topInset + 90);
      const maxBoxH = Math.max(220, h - boxY - 60);
      const boxH = Math.min(BOX_H_DESKTOP, maxBoxH);
      const sideGap = 40;

      // Escalado responsivo: el ancho de cada columna crece con el viewport
      // sin superar el ancho "natural" de desktop.
      const w = cx * 2;
      const maxInvW = Math.min(INVENTORY_W, (w - sideGap * 3) * 0.28);
      const maxStatsW = Math.min(STATS_W, (w - sideGap * 3) * 0.32);
      const invW = Math.max(200, maxInvW);
      const statsW = Math.max(220, maxStatsW);

      let invX;
      let statsX;
      if (this.side === 'right') {
        // Joystick a la derecha: minimapa en bottom-left, ARMAS a la derecha.
        invX = w - invW - rightInset - sideGap;
        statsX = sideGap + leftInset;
      } else {
        invX = sideGap + leftInset;
        statsX = w - statsW - rightInset - sideGap;
      }

      const invSlotStart = boxY + 56;
      const statRowStart = boxY + 56;
      const slotsTotalH = this.slots.length * SLOT_H;
      const statsTotalH = MAX_ROWS * ROW_H;
      // Centrado vertical del contenido dentro de la caja.
      const invContentPad = Math.max(0, (boxH - slotsTotalH) / 2);
      const statsContentPad = Math.max(0, (boxH - statsTotalH) / 2);

      this.invBox.setPosition(invX, boxY);
      this.invTitle.setPosition(invX + PADDING, boxY + PADDING);
      this.invDivider.setPosition(invX + PADDING, boxY + 42);
      this.slots.forEach((slot, i) => {
        const y = invSlotStart + invContentPad + i * SLOT_H;
        slot.frame.setPosition(invX + PADDING, y);
        slot.icon.setPosition(invX + PADDING + 22, y + (SLOT_H - 8) / 2);
        slot.name.setPosition(invX + PADDING + 46, y + 7);
        slot.detail.setPosition(invX + PADDING + 46, y + 26);
      });

      const firstButtonY = boxY + 90;
      this.buttons.forEach((b, i) => b.setPosition(cx, firstButtonY + i * 62));

      this.box.setPosition(statsX, boxY);
      this.boxTitle.setPosition(statsX + PADDING, boxY + PADDING);
      this.boxDivider.setPosition(statsX + PADDING, boxY + 42);
      this.rows.forEach((row, i) => {
        const y = statRowStart + statsContentPad + i * ROW_H;
        row.icon.setPosition(statsX + PADDING + ROW_ICON / 2, y + 8);
        row.label.setPosition(statsX + PADDING + ROW_ICON + 10, y);
      });
    }

    this.positionStage();
  }

  setLayout(value) {
    this.side = value;
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }


  // El ancho del texto cambia con el número de etapa, así que el grupo icono+texto
  // se recentra cada vez en lugar de usar posiciones fijas.
  positionStage() {
    const gap = 8;
    const compact = this._isCompact;
    // En compact el stage label se oculta: ya esta el titulo PAUSADO y los
    // paneles de armas/stats hablan por si mismos. En desktop se mantiene
    // la posicion original.
    const groupW = 18 + gap + this.stageText.width;
    const left = (this.stageCenterX || 0) - groupW / 2;
    const y = compact ? 0 : edgePadding('top', 0, getSafeInsets()) + 104;
    if (compact) {
      this.stageIcon.setVisible(false);
      this.stageText.setVisible(false);
    } else {
      this.stageIcon.setVisible(true);
      this.stageText.setVisible(true);
      this.stageIcon.setPosition(left + 9, y);
      this.stageText.setPosition(left + 18 + gap, y);
    }
  }

  // stats: filas de buildStatRows(). weapons: estado de armas de buildWeaponSlots().
  // stageLabel: texto de etapa a mostrar bajo el título.
  show(stats, weapons, stageLabel) {
    this.rows.forEach((row, i) => {
      const data = stats[i];
      if (!data || i >= this._clipCounts.rows) {
        setVisible([row.icon, row.label], false);
        return;
      }
      row.icon.setTexture(data.icon).setDisplaySize(ROW_ICON, ROW_ICON).setTint(data.color).setVisible(true);
      row.label.setText(data.label).setVisible(true);
    });

    this.slots.forEach((slot, i) => {
      const info = WEAPON_INFO[slot.key];
      const state = weapons[slot.key];
      if (i >= this._clipCounts.inv) {
        setVisible([slot.frame, slot.icon, slot.name, slot.detail], false);
        return;
      }
      // Las armas bloqueadas quedan atenuadas, no ocultas.
      slot.frame.setStrokeStyle(2, state.unlocked ? info.color : 0x333355).setVisible(true);
      const iconSize = this._isCompact ? 22 : SLOT_ICON;
      slot.icon.setTint(state.unlocked ? info.color : 0x444455).setDisplaySize(iconSize, iconSize).setVisible(true);
      slot.name.setColor(state.unlocked ? TEXT.secondary : TEXT.dim).setVisible(true);
      // En compact el detail no se muestra: el icono y nombre son suficientes
      // y la columna es estrecha. Mantenerlo invisible incluso si el layout
      // lo dejo visible por una corrida previa.
      if (this._isCompact) {
        slot.detail.setVisible(false);
      } else {
        slot.detail.setText(state.unlocked ? state.detail : 'Sin desbloquear').setVisible(true);
      }
    });

    this.stageText.setText(stageLabel);
    setVisible(this.chrome, true);
    setVisible(this.buttonParts, true);
    // positionStage debe correr DESPUES de hacer visible el chrome para que
    // la ocultacion condicional (compact) no se sobreescriba.
    this.positionStage();
  }

  hide() {
    this._hideTooltip();
    setVisible(this.chrome, false);
    setVisible(this.buttonParts, false);
    this.rows.forEach((row) => setVisible([row.icon, row.label], false));
    this.slots.forEach((slot) => setVisible([slot.frame, slot.icon, slot.name, slot.detail], false));
  }

  // Oculta solo el contenido, dejando el overlay: se usa al abrir configuración
  // desde la pausa, para que el juego siga viéndose atenuado detrás.
  hideContent() {
    this._hideTooltip();
    setVisible(this.chrome.filter((o) => o !== this.overlay), false);
    setVisible(this.buttonParts, false);
    this.rows.forEach((row) => setVisible([row.icon, row.label], false));
    this.slots.forEach((slot) => setVisible([slot.frame, slot.icon, slot.name, slot.detail], false));
  }
}

// Estado de cada arma para el inventario: si está desbloqueada y su resumen.
export function buildWeaponSlots(s) {
  return {
    aura: { unlocked: s.hasAura, detail: s.hasAura ? `${Math.round(s.auraDamage)} dmg · radio ${Math.round(s.auraRadius)}` : '' },
    orbit: { unlocked: s.hasOrbit, detail: s.hasOrbit ? `${Math.round(s.orbitDamage)} dmg · x${s.orbitCount}` : '' },
    pierce: { unlocked: s.hasPierce, detail: s.hasPierce ? `${Math.round(s.pierceDamage)} dmg · ${(1000 / s.pierceRate).toFixed(1)}/s` : '' },
    burst: { unlocked: s.hasBurst, detail: s.hasBurst ? `${Math.round(s.burstDamage)} dmg · x${s.burstCount}` : '' },
    nova: { unlocked: s.hasNova, detail: s.hasNova ? `${Math.round(s.novaDamage)} dmg · radio ${Math.round(s.novaRadius)}` : '' },
  };
}

// Arma las filas de estadísticas a mostrar. Las que arrancan en cero (o dependen de
// un arma no desbloqueada) se omiten para no llenar el panel de ruido.
// La etapa no está acá: se muestra bajo el título, como contexto de la partida.
export function buildStatRows(stats) {
  const s = stats;
  const rows = [
    { icon: 'icon-swords', color: 0xff8866, label: `Daño: ${Math.round(s.damage)}` },
    { icon: 'icon-gauge', color: 0xffcc44, label: `Cadencia: ${(1000 / s.fireRate).toFixed(1)}/s` },
    { icon: 'icon-footprints', color: 0x66ffcc, label: `Velocidad: ${Math.round(s.moveSpeed)}` },
    { icon: 'icon-heart', color: 0xff5566, label: `HP máximo: ${Math.round(s.maxHp)}` },
    { icon: 'icon-magnet', color: 0xaa88ff, label: `Radio de imán: ${Math.round(s.magnetRadius)}` },
  ];

  if (s.hpRegen > 0) rows.push({ icon: 'icon-heart-pulse', color: 0xff88aa, label: `Regeneración: ${s.hpRegen.toFixed(1)}/s` });
  if (s.lifesteal > 0) rows.push({ icon: 'icon-droplet', color: 0xff5566, label: `Robo de vida: ${(s.lifesteal * 100).toFixed(0)}%` });
  if (s.dodge > 0) rows.push({ icon: 'icon-wind', color: 0x88ddff, label: `Esquivar: ${(s.dodge * 100).toFixed(0)}%` });
  if (s.shieldMax > 0) rows.push({ icon: 'icon-shield', color: 0x66ddff, label: `Escudo: ${Math.ceil(s.shield)}/${Math.round(s.shieldMax)}` });

  return rows;
}
