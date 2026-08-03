// Panel de configuración: volumen de audio (3 sliders), lado del joystick y
// pantalla completa. La misma clase la usan el menú principal y la pausa, para
// que no existan dos versiones que se desincronicen.
//
// Layout:
//   [título]      [fijo, fuera del scroll]
//   [divider]     [fijo, fuera del scroll]
//   [sliders]     [dentro del viewport, recortado por mask]
//   [toggles]     [dentro del viewport, recortado por mask]
//   [scrollbar]   [borde derecho del viewport]
//   [chevrons]    [arriba/abajo del viewport, clickeables]
//   [Volver]      [fijo, fuera del scroll]
//
// El viewport usa un filter de mask (Phaser.Filters.Mask) sobre un Container
// que contiene todos los elementos scrollables. La fuente del mask es una
// RenderTexture blanca que se regenera en layout() con el nuevo tamaño del
// viewport. Scroll mueve el Container en Y.

import Phaser from 'phaser';
import { FONT_SIZE, TEXT, UI } from '../config/theme.js';
import { getAudioSettings, setVolume } from '../audio/synth.js';
import { getTouchLayout, setTouchLayout } from '../utils/touchLayout.js';
import { isCompactMode } from './layout.js';
import { button, divider, icon, panel, setVisible, slider, text } from './widgets.js';
import { toggleFullscreen, isBrowserFullscreen } from '../utils/fullscreen.js';

const DEPTH_OVERLAY = 400;
const DEPTH = 410;
const DEPTH_CHROME = 413;
const BOX_W = 460;
const BOX_H = 460;
const PADDING = 28;
const PADDING_COMPACT = 16;
const SLIDER_W = 260;
const SLIDER_W_COMPACT = 220;
const TOGGLE_W = 80;
const TOGGLE_H = 40;
const TOGGLE_GAP = 8;
const SCROLLBAR_W = 4;
const SCROLLBAR_GAP = 20;
const SCROLL_DRAG_THRESHOLD = 6;

const HEADER_H = 70;
const FOOTER_H = 90;

export default class SettingsPanel {
  // onClose: lo provee quien lo abre. onLayoutChange: callback para invertir
  // joystick/minimap/PauseMenu en vivo (live update).
  constructor(scene, onClose, onLayoutChange = null) {
    this.scene = scene;
    this.onClose = onClose;
    this.onLayoutChange = onLayoutChange;

    this.scrollOffset = 0;
    this._maxScroll = 0;
    this._scrollDragStartY = null;
    this._scrollStartOffset = 0;
    this._hintTween = null;
    this.viewport = null;

    this.overlay = scene.add.rectangle(0, 0, 10, 10, UI.overlay, 0.75)
      .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_OVERLAY).setVisible(false);

    this.box = panel(scene, { width: BOX_W, height: BOX_H, depth: DEPTH, border: 0x66aaff, origin: 0.5 })
      .setVisible(false);
    this.title = text(scene, 'CONFIGURACIÓN', { size: '22px', color: TEXT.info, depth: DEPTH + 1, origin: 0.5 })
      .setVisible(false);
    this.divider = divider(scene, { width: BOX_W - PADDING * 2, depth: DEPTH + 1 }).setVisible(false);

    const settings = getAudioSettings();
    this.sliders = [
      { key: 'master', ui: slider(scene, { label: 'Volumen general', width: SLIDER_W, depth: DEPTH + 1, onChange: (v) => setVolume('master', v) }) },
      { key: 'combat', ui: slider(scene, { label: 'Combate (disparos, impactos)', width: SLIDER_W, depth: DEPTH + 1, onChange: (v) => setVolume('combat', v) }) },
      { key: 'events', ui: slider(scene, { label: 'Hitos (nivel, jefe, victoria)', width: SLIDER_W, depth: DEPTH + 1, onChange: (v) => setVolume('events', v) }) },
      { key: 'music', ui: slider(scene, { label: 'Música', width: SLIDER_W, depth: DEPTH + 1, onChange: (v) => setVolume('music', v) }) },
    ];
    this.sliders.forEach(({ key, ui }) => ui.setValue(settings[key]));

    this.layoutToggle = this._buildLayoutToggle(scene);
    this.fullscreenToggle = this._buildFullscreenToggle(scene);

    this.closeButton = button(scene, {
      label: 'Volver', width: 160, height: 40, depth: DEPTH + 1,
      onClick: () => this.hide(),
    });

    this.scrollbar = scene.add.rectangle(0, 0, SCROLLBAR_W, 1, 0x66aaff, 0.6)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH_CHROME).setVisible(false);

    // Chevrons dibujados con Graphics (no dependemos de SVG para evitar
    // problemas de carga asincrona). Triangulo de 16 px de alto, color cyan.
    // El Graphics tiene un hit-area rectangular de 40x40 para click comodo.
    this.overflowHintUp = this._buildChevron(scene, 'up');
    this.overflowHintDown = this._buildChevron(scene, 'down');

    // Convencion: direction +1 = hacia abajo (scrollOffset aumenta),
    // direction -1 = hacia arriba (scrollOffset disminuye).
    this.overflowHintUp.on('pointerdown', () => this._scrollByDelta(-1));
    this.overflowHintDown.on('pointerdown', () => this._scrollByDelta(1));

    // Container que agrupa todos los elementos scrollables. Se mueve en Y para
    // hacer scroll. El filter mask recorta lo que sale del viewport.
    // Importante: el Container necesita width/height propios, sino
    // enableFilters() setea filtersFocusContext=true y el mask se evalua mal.
    this.scrollContainer = scene.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);

    const scrollableElements = [
      ...this.sliders.flatMap(({ ui }) => ui.parts),
      this.layoutToggle.label,
      ...this.layoutToggle.options.flatMap((o) => o.parts),
      this.fullscreenToggle.label,
      ...this.fullscreenToggle.btn.parts,
    ];
    scrollableElements.forEach((el) => {
      if (el) this.scrollContainer.add(el);
    });

    // Graphics rectangle blanco del tamaño del viewport. Sirve como fuente
    // del mask filter. Graphics tiene glTexture directo que el filter sabe
    // consumir sin re-renderizar cada frame cuando autoUpdate=false.
    this.maskShape = scene.add.graphics()
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(DEPTH_CHROME - 1);
    this.maskShape.fillStyle(0xFFFFFF, 1);
    this.maskShape.fillRect(0, 0, 1, 1);

    // Habilitar filters en el Container y agregar el mask filter.
    this.scrollContainer.enableFilters();
    this.scrollContainer.width = BOX_W;
    this.scrollContainer.height = BOX_H;
    const maskFilter = this.scrollContainer.filters.internal.addMask(
      this.maskShape,
      false,
      scene.cameras.main,
      'world',
    );
    maskFilter.autoUpdate = false;
    maskFilter.needsUpdate = true;
    this.maskFilter = maskFilter;

    this.parts = [
      this.overlay, this.box, this.title, this.divider,
      ...this.closeButton.parts,
      this.scrollbar,
      this.overflowHintUp,
      this.overflowHintDown,
      // Incluimos los elementos scrollables tambien para que setVisible()
      // los oculte cuando el panel esta cerrado (sino quedan visibles en el
      // menu principal y en el juego porque viven dentro del scrollContainer
      // pero Container.add() no hereda la visibilidad del panel).
      ...scrollableElements.filter((el) => el !== undefined && el !== null),
    ];
    setVisible(this.parts, false);

    scene.input.on('pointerdown', this._onPointerDown, this);
    scene.input.on('pointermove', this._onPointerMove, this);
    scene.input.on('pointerup', this._onPointerUp, this);
    scene.input.on('pointerupoutside', this._onPointerUp, this);
    scene.input.on('wheel', this._onWheel, this);

    this._onFullscreenChangeHandler = () => this._onFullscreenChange();
    document.addEventListener('fullscreenchange', this._onFullscreenChangeHandler);
    document.addEventListener('webkitfullscreenchange', this._onFullscreenChangeHandler);

    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this._onPointerDown, this);
      scene.input.off('pointermove', this._onPointerMove, this);
      scene.input.off('pointerup', this._onPointerUp, this);
      scene.input.off('pointerupoutside', this._onPointerUp, this);
      scene.input.off('wheel', this._onWheel, this);
      document.removeEventListener('fullscreenchange', this._onFullscreenChangeHandler);
      document.removeEventListener('webkitfullscreenchange', this._onFullscreenChangeHandler);
      this._stopHintTween();
      this.maskShape.destroy();
    });
  }

  _buildChevron(scene, direction) {
    // El Graphics representa el area clickeable + dibuja el chevron.
    const gfx = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH_CHROME)
      .setVisible(false);
    gfx.fillStyle(0x66aaff, 0.001); // casi invisible, pero permite hit-test
    gfx.fillRect(-20, -20, 40, 40);
    gfx.lineStyle(2, 0x66aaff, 1);
    if (direction === 'up') {
      // Chevron up: ^ shape
      gfx.beginPath();
      gfx.moveTo(-8, 4);
      gfx.lineTo(0, -4);
      gfx.lineTo(8, 4);
      gfx.strokePath();
    } else {
      // Chevron down: v shape
      gfx.beginPath();
      gfx.moveTo(-8, -4);
      gfx.lineTo(0, 4);
      gfx.lineTo(8, -4);
      gfx.strokePath();
    }
    gfx.setInteractive(
      new Phaser.Geom.Rectangle(-20, -20, 40, 40),
      Phaser.Geom.Rectangle.Contains,
    );
    gfx.input.cursor = 'pointer';
    return gfx;
  }

  _buildLayoutToggle(scene) {
    const label = text(scene, 'Lado del joystick', {
      size: FONT_SIZE.small, color: TEXT.secondary, depth: DEPTH + 1,
    });
    const makeOption = (value, caption) => {
      const btn = button(scene, {
        label: caption, width: TOGGLE_W, height: TOGGLE_H, depth: DEPTH + 1,
        onClick: () => this._selectLayout(value),
      });
      return { value, btn, parts: btn.parts };
    };
    return {
      label,
      left: makeOption('left', 'IZQ'),
      right: makeOption('right', 'DER'),
      get options() { return [this.left, this.right]; },
    };
  }

  _buildFullscreenToggle(scene) {
    const label = text(scene, 'Pantalla completa', {
      size: FONT_SIZE.small, color: TEXT.secondary, depth: DEPTH + 1,
    });
    const bg = scene.add.rectangle(0, 0, TOGGLE_W, TOGGLE_H, UI.panelBg, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x444466)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    const labelText = scene.add.text(0, 0, 'OFF', { fontFamily: 'monospace', fontSize: FONT_SIZE.label, color: '#8888aa' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 2);
    const btn = {
      parts: [bg, labelText],
      setPosition(x, y) {
        bg.setPosition(x, y);
        labelText.setPosition(x, y);
        return this;
      },
      setLabel(newLabel) {
        labelText.setText(newLabel);
        return this;
      },
      _applyHighlight() {
        const on = isBrowserFullscreen();
        if (on) {
          bg.setStrokeStyle(2, 0x66ffcc);
          labelText.setColor('#66ffcc');
          bg.setFillStyle(0x1a3a3a, 0.97);
        } else {
          bg.setStrokeStyle(2, 0x444466);
          labelText.setColor('#8888aa');
          bg.setFillStyle(UI.panelBg, 0.85);
        }
      },
    };
    bg.on('pointerover', () => {
      const on = isBrowserFullscreen();
      if (!on) bg.setFillStyle(UI.panelBg, 0.95);
    });
    bg.on('pointerout', () => {
      const on = isBrowserFullscreen();
      bg.setFillStyle(on ? 0x1a3a3a : UI.panelBg, on ? 0.97 : 0.85);
    });
    bg.on('pointerdown', () => bg.setFillStyle(0x101024, 1));
    bg.on('pointerup', () => {
      btn._applyHighlight();
      this._toggleFullscreen();
    });
    return { label, btn, parts: btn.parts };
  }

  _toggleFullscreen() {
    const result = toggleFullscreen(this.scene.scale);
    if (result === 'failed') {
      this._showFullscreenFailedToast();
    }
    this._refreshFullscreenLabel();
    this.scene.time.delayedCall(150, () => this._refreshFullscreenLabel());
  }

  _refreshFullscreenLabel() {
    const on = isBrowserFullscreen();
    this.fullscreenToggle.btn.setLabel(on ? 'ON' : 'OFF');
    this.fullscreenToggle.btn._applyHighlight();
  }

  _onFullscreenChange() {
    this._refreshFullscreenLabel();
  }

  _showFullscreenFailedToast() {
    if (this.fsToast) return;
    this.fsToast = this.scene.add.rectangle(0, 0, 360, 48, 0x111122, 0.95)
      .setOrigin(0.5).setStrokeStyle(2, 0xffaa00).setScrollFactor(0).setDepth(DEPTH_CHROME + 3);
    this.fsToastText = text(this.scene, 'Pantalla completa no disponible', {
      size: FONT_SIZE.small, color: 0xffaa00, depth: DEPTH_CHROME + 4, origin: 0.5,
    });
    const cx = this.scene.scale.width / 2;
    const cy = this.scene.scale.height - 60;
    this.fsToast.setPosition(cx, cy);
    this.fsToastText.setPosition(cx, cy);
    this.scene.time.delayedCall(3000, () => {
      this.fsToast?.destroy();
      this.fsToastText?.destroy();
      this.fsToast = null;
      this.fsToastText = null;
    });
  }

  _selectLayout(value) {
    setTouchLayout(value);
    this._refreshLayoutHighlight();
    if (this.onLayoutChange) this.onLayoutChange(value);
  }

  _refreshLayoutHighlight() {
    const current = getTouchLayout();
    [this.layoutToggle.left, this.layoutToggle.right].forEach((opt) => {
      const active = opt.value === current;
      opt.btn.parts[0].setStrokeStyle(2, active ? 0x66ffcc : 0x444466);
      opt.btn.parts[1].setColor(active ? '#66ffcc' : '#cceeff');
    });
  }

  _isInsideScrollArea(pointer) {
    if (!this.viewport) return false;
    const v = this.viewport;
    return pointer.x >= v.x && pointer.x <= v.x + v.w
      && pointer.y >= v.y && pointer.y <= v.y + v.h;
  }

  _onPointerDown(pointer) {
    if (!this.isOpen) return;
    if (!this._isInsideScrollArea(pointer)) return;
    if (this._maxScroll <= 0) return;
    this._scrollDragStartY = pointer.y;
    this._scrollStartOffset = this.scrollOffset;
  }

  _onPointerMove(pointer) {
    if (this._scrollDragStartY === null) return;
    if (!pointer.isDown) {
      this._scrollDragStartY = null;
      return;
    }
    const dy = pointer.y - this._scrollDragStartY;
    if (Math.abs(dy) < SCROLL_DRAG_THRESHOLD) return;
    // Convencion mobile: arrastrar el dedo hacia abajo (dy positivo) debe
    // revelar el contenido de abajo, o sea aumentar el scrollOffset.
    this._scrollStartOffset -= dy;
    this._scrollDragStartY = pointer.y;
    this._setScroll(this._scrollStartOffset);
  }

  _onPointerUp() {
    this._scrollDragStartY = null;
  }

  _onWheel(pointer, _gameObjects, _dx, dy) {
    if (!this.isOpen) return;
    if (!this._isInsideScrollArea(pointer)) return;
    if (this._maxScroll <= 0) return;
    // dy positivo = rueda hacia abajo = scrollOffset aumenta.
    this._setScroll(this.scrollOffset + dy * 0.5);
  }

  _setScroll(value) {
    this.scrollOffset = Phaser.Math.Clamp(value, 0, this._maxScroll);
    this._applyScrollToContent();
    this._updateOverflowIndicators();
  }

  _scrollByDelta(direction) {
    if (!this.viewport || this._maxScroll <= 0) return;
    const step = this.viewport.h * 0.8;
    this._setScroll(this.scrollOffset + direction * step);
  }

  _applyScrollToContent() {
    this.scrollContainer.y = -this.scrollOffset;
  }

  _updateOverflowIndicators() {
    if (!this.viewport) return;
    if (!this.isOpen) {
      this.scrollbar.setVisible(false);
      this.overflowHintUp.setVisible(false);
      this.overflowHintDown.setVisible(false);
      this._stopHintTween();
      return;
    }
    const v = this.viewport;
    const hasOverflow = this._maxScroll > 0;
    const atTop = this.scrollOffset <= 0;
    const atBottom = this.scrollOffset >= this._maxScroll;

    if (hasOverflow) {
      const ratio = v.h / (v.h + this._maxScroll);
      const barH = Math.max(24, v.h * ratio);
      const travel = v.h - barH;
      const progress = this.scrollOffset / this._maxScroll;
      this.scrollbar.setSize(SCROLLBAR_W, barH);
      this.scrollbar.setPosition(v.x + v.w - SCROLLBAR_W - 8, v.y + travel * progress);
      this.scrollbar.setVisible(true);
    } else {
      this.scrollbar.setVisible(false);
    }

    const upVisible = hasOverflow && !atTop;
    const downVisible = hasOverflow && !atBottom;
    this.overflowHintUp.setVisible(upVisible);
    this.overflowHintDown.setVisible(downVisible);
    // Chevrons dentro del viewport, alineados con la scrollbar al borde
    // derecho. Margen generoso desde los bordes superior/inferior.
    const chevX = v.x + v.w - SCROLLBAR_W - 8;
    this.overflowHintUp.setPosition(chevX, v.y + 30);
    this.overflowHintDown.setPosition(chevX, v.y + v.h - 30);

    const anyVisible = upVisible || downVisible;
    if (anyVisible && !this._hintTween) {
      this.overflowHintUp.setAlpha(0.3);
      this.overflowHintDown.setAlpha(0.3);
      this._hintTween = this.scene.tweens.add({
        targets: [this.overflowHintUp, this.overflowHintDown],
        alpha: 0.8,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    } else if (!anyVisible && this._hintTween) {
      this._stopHintTween();
    }
  }

  _stopHintTween() {
    if (this._hintTween) {
      this._hintTween.stop();
      this._hintTween = null;
    }
    if (this.overflowHintUp) this.overflowHintUp.setAlpha(0.7);
    if (this.overflowHintDown) this.overflowHintDown.setAlpha(0.7);
  }

  layout(w, h) {
    const compact = isCompactMode();
    const cx = w / 2;
    const cy = h / 2;
    this.overlay.width = w;
    this.overlay.height = h;

    const padding = compact ? PADDING_COMPACT : PADDING;
    const boxW = compact ? Math.min(BOX_W, w - 2 * padding) : BOX_W;
    const boxH = compact ? Math.min(BOX_H, h - 2 * padding) : BOX_H;

    this.box.setSize(boxW, boxH).setPosition(cx, cy);
    const topY = cy - boxH / 2;
    const bottomY = cy + boxH / 2;

    // Header fijo.
    this.title.setPosition(cx, topY + 30);
    this.divider.setSize(boxW - padding * 2, 2)
      .setPosition(cx - (boxW - padding * 2) / 2, topY + 56);

    // Viewport: reservamos 30 px al borde derecho para scrollbar + chevrons
    // con gap generoso entre el toggle DER y la barra.
    const vpX = cx - boxW / 2 + 6;
    const vpY = topY + HEADER_H;
    const vpW = boxW - 30;
    const vpH = boxH - HEADER_H - FOOTER_H;
    this.viewport = { x: vpX, y: vpY, w: vpW, h: vpH };

    const sliderW = compact ? Math.min(SLIDER_W_COMPACT, vpW - 80) : SLIDER_W;

    const rowH = compact ? 60 : 64;
    const contentStartY = vpY + 16;

    this.sliders.forEach(({ ui }, i) => {
      const y = contentStartY + i * rowH + 30;
      ui.setPosition(cx - sliderW / 2, y);
    });

    const sliderBottomY = contentStartY + (this.sliders.length - 1) * rowH + 60;
    // Layout vertical para los toggles: label arriba, botones abajo. Asi no
    // hay solapamiento horizontal entre el label largo y los botones IZQ/DER.
    const toggleLabelY = sliderBottomY + (compact ? 32 : 36);
    const toggleBtnY = toggleLabelY + (compact ? 38 : 40);
    // Label alineado con el inicio del slider (mismo X que la barra).
    const labelX = cx - sliderW / 2;
    this.layoutToggle.label.setOrigin(0, 0.5).setPosition(labelX, toggleLabelY);

    // Botones centrados horizontalmente (par IZQ/DER y un solo boton OFF).
    const toggleTotalW = TOGGLE_W * 2 + TOGGLE_GAP;
    const rightX = cx + toggleTotalW / 2 - TOGGLE_W / 2;
    const leftX = rightX - TOGGLE_W - TOGGLE_GAP;
    this.layoutToggle.left.btn.setPosition(leftX, toggleBtnY);
    this.layoutToggle.right.btn.setPosition(rightX, toggleBtnY);

    const fsLabelY = toggleBtnY + (compact ? 44 : 46);
    const fsBtnY = fsLabelY + (compact ? 38 : 40);
    this.fullscreenToggle.label.setOrigin(0, 0.5).setPosition(labelX, fsLabelY);
    // Boton OFF centrado en cx, alineado con el centro de IZQ/DER.
    this.fullscreenToggle.btn.setPosition(cx, fsBtnY);

    const contentEndY = fsBtnY + TOGGLE_H / 2 + 16;
    this._maxScroll = Math.max(0, contentEndY - (vpY + vpH));
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this._maxScroll);
    this._applyScrollToContent();

    // Footer fijo: Volver con margen generoso respecto al viewport (22 px).
    this.closeButton.setPosition(cx, bottomY - 28);

    // Regenerar maskShape con el nuevo viewport. autoUpdate=false en el filter,
    // así que necesitamos needsUpdate=true para que tome el cambio.
    this.maskShape.clear();
    this.maskShape.fillStyle(0xFFFFFF, 1);
    this.maskShape.fillRect(0, 0, vpW, vpH);
    this.maskShape.setPosition(vpX, vpY);
    this.scrollContainer.width = vpW;
    this.scrollContainer.height = vpH;
    this.maskFilter.needsUpdate = true;

    this._updateOverflowIndicators();
  }

  get isOpen() {
    return this.box.visible;
  }

  show() {
    const settings = getAudioSettings();
    this.sliders.forEach(({ key, ui }) => ui.setValue(settings[key]));
    this._refreshLayoutHighlight();
    this._refreshFullscreenLabel();
    this.scrollOffset = 0;
    this._applyScrollToContent();
    setVisible(this.parts, true);
    this._updateOverflowIndicators();
  }

  hide() {
    setVisible(this.parts, false);
    this._scrollDragStartY = null;
    this._stopHintTween();
    if (this.onClose) this.onClose();
  }
}