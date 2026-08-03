// Minimapa que reposiciona según el lado del joystick: 'right' lo lleva al
// bottom-left, 'left' al bottom-right (default histórico). Se redibuja entero
// cada frame con un Graphics (son pocos puntos, no compensa mantener sprites
// vivos por entidad).

import { MINIMAP } from '../config/theme.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { WORLD_SIZE } from '../config/constants.js';
import { getTouchLayout } from '../utils/touchLayout.js';
import { edgePadding, getSafeInsets, isCompactMode } from './layout.js';

const DEPTH = 150;
const SIZE_DESKTOP = 150;
const SIZE_COMPACT = 90;
const MARGIN = 20;

export default class Minimap {
  constructor(scene, side) {
    this.scene = scene;
    this.size = isCompactMode() ? SIZE_COMPACT : SIZE_DESKTOP;
    this.x = 0;
    this.y = 0;
    this.side = side || getTouchLayout();
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
  }

  layout(w, h) {
    this.size = isCompactMode() ? SIZE_COMPACT : SIZE_DESKTOP;
    const insets = getSafeInsets();
    const leftInset = edgePadding('left', 0, insets);
    const rightInset = edgePadding('right', 0, insets);
    const bottomInset = edgePadding('bottom', 0, insets);
    const margin = MARGIN + bottomInset;
    if (this.side === 'right') {
      // Joystick a la derecha: minimapa en la otra esquina.
      this.x = MARGIN + leftInset;
    } else {
      this.x = w - MARGIN - rightInset - this.size;
    }
    this.y = h - margin - this.size;
  }

  setLayout(value) {
    this.side = value;
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  // Escala una posición del mundo a coordenadas dentro del recuadro del minimapa.
  toMinimap(worldX, worldY) {
    return {
      x: this.x + (worldX / WORLD_SIZE) * this.size,
      y: this.y + (worldY / WORLD_SIZE) * this.size,
    };
  }

  draw({ enemies, chest, player }) {
    const gfx = this.gfx;
    gfx.clear();
    gfx.fillStyle(MINIMAP.bg, MINIMAP.bgAlpha);
    gfx.fillRect(this.x, this.y, this.size, this.size);
    gfx.lineStyle(2, MINIMAP.border, 1);
    gfx.strokeRect(this.x, this.y, this.size, this.size);

    const compact = this.size <= SIZE_COMPACT + 1;
    const enemyR = compact ? 1.5 : 2;
    const bossR = compact ? 3 : 4;
    const specialR = compact ? 2 : 3;

    enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      const p = this.toMinimap(e.x, e.y);
      gfx.fillStyle(ENEMY_TYPES[e.getData('type')].color, 1);
      gfx.fillCircle(p.x, p.y, e.getData('isBoss') ? bossR : enemyR);
    });

    if (chest) {
      const cp = this.toMinimap(chest.x, chest.y);
      gfx.fillStyle(MINIMAP.chest, 1);
      gfx.fillCircle(cp.x, cp.y, specialR);
    }

    const pp = this.toMinimap(player.x, player.y);
    gfx.fillStyle(MINIMAP.player, 1);
    gfx.fillCircle(pp.x, pp.y, specialR);
  }
}
