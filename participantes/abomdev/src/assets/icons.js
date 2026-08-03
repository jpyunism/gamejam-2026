// Iconos de lucide como texturas de Phaser.
//
// Los SVG de lucide vienen con stroke="currentColor", que fuera del DOM se resuelve a
// negro. Como el tint de Phaser es multiplicativo (negro x cualquier color = negro),
// los cargamos reemplazando currentColor por blanco: así una sola textura sirve para
// cualquier color con setTint().
//
// Cada icono se carga al tamaño final en el que se usa, en vez de escalarlo después,
// para que el sprite y su cuerpo de físicas coincidan sin ajustes extra.

import bugRaw from 'lucide-static/icons/bug.svg?raw';
import chevronDownRaw from 'lucide-static/icons/chevron-down.svg?raw';
import chevronUpRaw from 'lucide-static/icons/chevron-up.svg?raw';
import circleDotRaw from 'lucide-static/icons/circle-dot.svg?raw';
import crosshairRaw from 'lucide-static/icons/crosshair.svg?raw';
import dropletRaw from 'lucide-static/icons/droplet.svg?raw';
import footprintsRaw from 'lucide-static/icons/footprints.svg?raw';
import gaugeRaw from 'lucide-static/icons/gauge.svg?raw';
import ghostRaw from 'lucide-static/icons/ghost.svg?raw';
import heartRaw from 'lucide-static/icons/heart.svg?raw';
import heartPulseRaw from 'lucide-static/icons/heart-pulse.svg?raw';
import layersRaw from 'lucide-static/icons/layers.svg?raw';
import magnetRaw from 'lucide-static/icons/magnet.svg?raw';
import orbitRaw from 'lucide-static/icons/orbit.svg?raw';
import packageRaw from 'lucide-static/icons/package.svg?raw';
import pauseRaw from 'lucide-static/icons/pause.svg?raw';
import ratRaw from 'lucide-static/icons/rat.svg?raw';
import shieldRaw from 'lucide-static/icons/shield.svg?raw';
import skullRaw from 'lucide-static/icons/skull.svg?raw';
import swordsRaw from 'lucide-static/icons/swords.svg?raw';
import timerRaw from 'lucide-static/icons/timer.svg?raw';
import trophyRaw from 'lucide-static/icons/trophy.svg?raw';
import wavesRaw from 'lucide-static/icons/waves.svg?raw';
import windRaw from 'lucide-static/icons/wind.svg?raw';
import zapRaw from 'lucide-static/icons/zap.svg?raw';

const UI_SIZE = 32;

// key de textura -> { raw: contenido del SVG, size: px }
const ICONS = {
  // Entidades: cada una al tamaño con el que aparece en el mundo.
  'enemy-normal': { raw: bugRaw, size: 28 },
  'enemy-fast': { raw: ratRaw, size: 26 },
  'enemy-tank': { raw: shieldRaw, size: 34 },
  'enemy-boss': { raw: skullRaw, size: 48 },
  'enemy-bossRanged': { raw: ghostRaw, size: 48 },
  'pickup-chest': { raw: packageRaw, size: 30 },

  // UI: se escalan con setDisplaySize donde haga falta (sin físicas de por medio).
  'icon-heart': { raw: heartRaw, size: UI_SIZE },
  'icon-shield': { raw: shieldRaw, size: UI_SIZE },
  'icon-zap': { raw: zapRaw, size: UI_SIZE },
  'icon-timer': { raw: timerRaw, size: UI_SIZE },
  'icon-trophy': { raw: trophyRaw, size: UI_SIZE },
  'icon-skull': { raw: skullRaw, size: UI_SIZE },
  'icon-layers': { raw: layersRaw, size: UI_SIZE },
  'icon-swords': { raw: swordsRaw, size: UI_SIZE },
  'icon-gauge': { raw: gaugeRaw, size: UI_SIZE },
  'icon-footprints': { raw: footprintsRaw, size: UI_SIZE },
  'icon-magnet': { raw: magnetRaw, size: UI_SIZE },
  'icon-heart-pulse': { raw: heartPulseRaw, size: UI_SIZE },
  'icon-droplet': { raw: dropletRaw, size: UI_SIZE },
  'icon-wind': { raw: windRaw, size: UI_SIZE },
  'icon-orbit': { raw: orbitRaw, size: UI_SIZE },
  'icon-crosshair': { raw: crosshairRaw, size: UI_SIZE },
  'icon-waves': { raw: wavesRaw, size: UI_SIZE },
  'icon-circle-dot': { raw: circleDotRaw, size: UI_SIZE },
  'icon-pause': { raw: pauseRaw, size: UI_SIZE },
  'icon-chevron-up': { raw: chevronUpRaw, size: UI_SIZE },
  'icon-chevron-down': { raw: chevronDownRaw, size: UI_SIZE },
};

// btoa() falla con caracteres fuera de latin-1, así que pasamos por TextEncoder.
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

// El loader de Phaser decodifica el data URI con atob(), así que tiene que ser base64.
function toWhiteDataUri(raw) {
  const svg = raw.replace(/currentColor/g, '#ffffff');
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

export function preloadIcons(scene) {
  Object.entries(ICONS).forEach(([key, { raw, size }]) => {
    scene.load.svg(key, toWhiteDataUri(raw), { width: size, height: size });
  });
}
