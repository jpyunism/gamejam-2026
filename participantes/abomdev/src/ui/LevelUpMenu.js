// Menú de subida de nivel: grilla 2x2 con borde de color según rareza. En
// mobile (portrait o viewport chico) las cards se redimensionan para que las 4
// entren a la vez. Se elige con tap sobre la card o con las teclas 1-4.

import { FONT_SIZE, RARITY_COLOR, RARITY_COLOR_NUM, RARITY_LABEL, TEXT, UI } from '../config/theme.js';
import { UPGRADE_ICONS } from '../config/upgrades.js';
import { edgePadding, getSafeInsets, shouldUseCompactLevelUp } from './layout.js';
import { icon, panel, setVisible, text } from './widgets.js';

const DEPTH = 100;
const DEPTH_OPEN = 200;
const CARD_W_DESKTOP = 320;
const CARD_H_DESKTOP = 150;
const GAP_X_DESKTOP = 24;
const GAP_Y_DESKTOP = 20;
const GRID_TOP_DESKTOP = 150;

const PAD_COMPACT = 12;
const GAP_X_COMPACT = 14;
const GAP_Y_COMPACT = 10;
const GRID_TOP_COMPACT = 64;
const COMPACT_ASPECT = 0.48;
const COMPACT_MAX_H = 140;
const COMPACT_MIN_H = 70;

const ICON_SIZE = 34;
const ICON_SIZE_COMPACT = 20;

export default class LevelUpMenu {
  // onChoose(index) lo provee la escena: aplica la mejora y cierra el menú.
  constructor(scene, onChoose) {
    this.scene = scene;
    this.onChoose = onChoose;
    this.compact = false;

    this.title = text(scene, 'SUBISTE DE NIVEL', {
      size: FONT_SIZE.subheading, color: TEXT.primary, depth: DEPTH, origin: 0.5,
    }).setVisible(false);

    this.cards = [0, 1, 2, 3].map((i) => {
      const bg = panel(scene, { width: CARD_W_DESKTOP, height: CARD_H_DESKTOP, depth: DEPTH, border: UI.panelBorder })
        .setVisible(false)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.onChoose(i));
      bg.on('pointerover', () => bg.setStrokeStyle(4, bg.getData('rarityColor') || UI.panelBorder));
      bg.on('pointerout', () => bg.setStrokeStyle(3, bg.getData('rarityColor') || UI.panelBorder));

      const keyText = text(scene, `[${i + 1}]`, { size: '13px', color: TEXT.dim, depth: DEPTH + 1 }).setVisible(false);
      const rarityText = text(scene, '', { size: FONT_SIZE.tiny, color: TEXT.primary, depth: DEPTH + 1, origin: [1, 0] }).setVisible(false);
      const cardIcon = icon(scene, 'icon-swords', { size: ICON_SIZE, color: 0xffffff, depth: DEPTH + 1 }).setVisible(false);
      const label = text(scene, '', {
        size: FONT_SIZE.body, color: TEXT.accent, depth: DEPTH + 1, origin: 0.5,
        align: 'center', wordWrapWidth: CARD_W_DESKTOP - 36,
      }).setVisible(false);

      return { bg, keyText, rarityText, cardIcon, label };
    });

    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((keyName, i) => {
      scene.input.keyboard.on(`keydown-${keyName}`, () => this.onChoose(i));
    });
  }

  layout(w, h) {
    this.compact = shouldUseCompactLevelUp(w, h);

    const cx = w / 2;
    const topInset = edgePadding('top', 0, getSafeInsets());
    this.title.setPosition(cx, topInset + 50);

    if (this.compact) {
      const dims = this._computeCompactDims(w, h);
      const { cardW, cardH, gridStartX, gridTop } = dims;

      this.cards.forEach((card, i) => {
        const x = gridStartX + (i % 2) * (cardW + GAP_X_COMPACT);
        const y = gridTop + Math.floor(i / 2) * (cardH + GAP_Y_COMPACT);
        card.bg.setSize(cardW, cardH).setPosition(x, y);
      });
    } else {
      const gridStartX = cx - (CARD_W_DESKTOP * 2 + GAP_X_DESKTOP) / 2;
      this.cards.forEach((card, i) => {
        const x = gridStartX + (i % 2) * (CARD_W_DESKTOP + GAP_X_DESKTOP);
        const y = GRID_TOP_DESKTOP + Math.floor(i / 2) * (CARD_H_DESKTOP + GAP_Y_DESKTOP);
        card.bg.setSize(CARD_W_DESKTOP, CARD_H_DESKTOP).setPosition(x, y);
      });
    }

    this._positionCardChrome();
  }

  _computeCompactDims(w, h) {
    const topInset = edgePadding('top', 0, getSafeInsets());
    const innerW = w - PAD_COMPACT * 2;
    const cardW = (innerW - GAP_X_COMPACT) / 2;
    const topBudget = topInset + GRID_TOP_COMPACT;
    const bottomBudget = 24;
    const availableH = Math.max(120, h - topBudget - bottomBudget);
    const maxByHeight = (availableH - GAP_Y_COMPACT) / 2;
    const aspectH = cardW * COMPACT_ASPECT;
    const cardH = Math.max(COMPACT_MIN_H, Math.min(COMPACT_MAX_H, aspectH, maxByHeight));
    const innerH = cardH * 2 + GAP_Y_COMPACT;
    const gridTop = Math.max(topBudget, Math.min(topBudget, (h - innerH) / 2));
    const gridStartX = (w - (cardW * 2 + GAP_X_COMPACT)) / 2;
    return { cardW, cardH, gridStartX, gridTop };
  }

  // Posiciona textos/iconos dentro de cada card. Las cards usan origin 0
  // (top-left), asi que los hijos se anclan a las esquinas internas.
  _positionCardChrome() {
    this.cards.forEach((card) => {
      const { bg } = card;
      const x = bg.x;
      const y = bg.y;
      const cardW = bg.width;
      const cardH = bg.height;

      card.keyText.setPosition(x + 10, y + 8);
      card.rarityText.setPosition(x + cardW - 10, y + 8);

      if (this.compact) {
        const iconSize = ICON_SIZE_COMPACT;
        card.cardIcon.setDisplaySize(iconSize, iconSize);
        card.cardIcon.setPosition(x + 28, y + cardH / 2);
        card.label.setOrigin(0, 0.5).setPosition(x + 28 + iconSize + 12, y + cardH / 2);
        card.label.setWordWrapWidth(cardW - 28 - iconSize - 24);
        card.label.setStyle({ fontSize: FONT_SIZE.small });
      } else {
        card.cardIcon.setDisplaySize(ICON_SIZE, ICON_SIZE);
        card.cardIcon.setPosition(x + cardW / 2, y + 52);
        card.label.setOrigin(0.5).setPosition(x + cardW / 2, y + cardH - 42);
        card.label.setWordWrapWidth(cardW - 36);
        card.label.setStyle({ fontSize: FONT_SIZE.body });
      }
    });
  }

  // choices: las 4 mejoras sorteadas. stats: las stats actuales, para que cada card
  // pueda mostrar el antes→después sin que la escena arme los textos.
  show(choices, stats) {
    const compact = shouldUseCompactLevelUp(this.scene.scale.width, this.scene.scale.height);
    const iconSize = compact ? ICON_SIZE_COMPACT : ICON_SIZE;
    choices.forEach((choice, i) => {
      const after = { ...stats };
      choice.apply(after);

      const rarity = choice.rarity || 'common';
      const card = this.cards[i];
      card.bg.setData('rarityColor', RARITY_COLOR_NUM[rarity]).setStrokeStyle(3, RARITY_COLOR_NUM[rarity]).setVisible(true);
      card.keyText.setVisible(true);
      card.rarityText.setText(RARITY_LABEL[rarity]).setColor(RARITY_COLOR[rarity]).setVisible(true);
      card.cardIcon.setTexture(UPGRADE_ICONS[choice.key] || 'icon-swords')
        .setDisplaySize(iconSize, iconSize)
        .setTint(RARITY_COLOR_NUM[rarity])
        .setVisible(true);
      card.label.setText(choice.describe(stats, after)).setColor(RARITY_COLOR[rarity]).setVisible(true);
    });
    this._refreshSizes();
    this._positionCardChrome();
    this._setDepth(DEPTH_OPEN);
    this.title.setVisible(true);
  }

  // Bump depth en show/hide para que las cards queden sobre Minimap (150) y
  // HUD (150); el minimapa es dibujado con depth 150 igual que el HUD, así que
  // sin bump compite con el menú y se ve a través.
  _setDepth(depth) {
    this.title.setDepth(depth);
    this.cards.forEach((card) => {
      card.bg.setDepth(depth);
      card.keyText.setDepth(depth + 1);
      card.rarityText.setDepth(depth + 1);
      card.cardIcon.setDepth(depth + 1);
      card.label.setDepth(depth + 1);
    });
  }

  // Garantiza que cada card tenga el tamaño correcto segun el modo actual antes
  // de reposicionar hijos. Necesario porque setSize se aplica en layout() y un
  // show() que corre sin layout previo (ej. primer level-up) vería tamaños del
  // constructor.
  _refreshSizes() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const compact = shouldUseCompactLevelUp(w, h);
    if (compact) {
      const { cardW, cardH, gridStartX, gridTop } = this._computeCompactDims(w, h);
      this.cards.forEach((card, i) => {
        const x = gridStartX + (i % 2) * (cardW + GAP_X_COMPACT);
        const y = gridTop + Math.floor(i / 2) * (cardH + GAP_Y_COMPACT);
        card.bg.setSize(cardW, cardH).setPosition(x, y);
      });
    } else {
      const gridStartX = (w - (CARD_W_DESKTOP * 2 + GAP_X_DESKTOP)) / 2;
      this.cards.forEach((card, i) => {
        const x = gridStartX + (i % 2) * (CARD_W_DESKTOP + GAP_X_DESKTOP);
        const y = GRID_TOP_DESKTOP + Math.floor(i / 2) * (CARD_H_DESKTOP + GAP_Y_DESKTOP);
        card.bg.setSize(CARD_W_DESKTOP, CARD_H_DESKTOP).setPosition(x, y);
      });
    }
  }

  hide() {
    this.title.setVisible(false);
    this.cards.forEach((card) => setVisible([card.bg, card.keyText, card.rarityText, card.cardIcon, card.label], false));
    this._setDepth(DEPTH);
  }
}