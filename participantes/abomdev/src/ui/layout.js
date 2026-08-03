// Helpers de layout responsive. Una sola fuente de verdad para escalas,
// deteccion de modo compact/desktop y safe-area insets.
//
// `isCompactMode` y `getViewportScale` se derivan del viewport actual, no del
// tamano del canvas. Phaser expone `scale.width/height` pero ambos vienen de
// `window.innerWidth/Height` (mode RESIZE), asi que las dos Fuentes son
// equivalentes; este modulo elige el viewport directamente para que pueda
// importarse desde tests sin tocar Phaser.

const BREAKPOINT_W = 720;
const BREAKPOINT_H = 480;
const MAX_SCALE = 1.2;
const MIN_SCALE = 0.6;
const SCALE_REFERENCE = 720;

export function getViewportSize() {
  if (typeof window === 'undefined') return { width: 1280, height: 720 };
  return { width: window.innerWidth, height: window.innerHeight };
}

export function isCompactMode(size = getViewportSize()) {
  return size.width < BREAKPOINT_W || size.height < BREAKPOINT_H;
}

export function getViewportScale(size = getViewportSize()) {
  const base = Math.min(size.width, size.height) / SCALE_REFERENCE;
  if (base < MIN_SCALE) return MIN_SCALE;
  if (base > MAX_SCALE) return MAX_SCALE;
  return base;
}

export function getSafeInsets() {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const parse = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    top: parse(cs.getPropertyValue('--sai-top')),
    right: parse(cs.getPropertyValue('--sai-right')),
    bottom: parse(cs.getPropertyValue('--sai-bottom')),
    left: parse(cs.getPropertyValue('--sai-left')),
  };
}

// Padding lateral unificado: respeta safe area y nunca es menos de `fallback`.
// Pensado paraHUD y pause: cualquier widget anclado a un borde usa esto.
export function edgePadding(side, fallback, insets = getSafeInsets()) {
  return Math.max(fallback, insets[side]);
}

// Heuristica para decidir si el menu de level-up debe usar el carrusel 1-card
// en vez de la grilla 2x2. Mas agresiva que `isCompactMode()` para capturar
// portrait de tablet (ej. 768x1024), donde el breakpoint absoluto no dispara
// pero el viewport claramente no admite 4 cards grandes.
export function shouldUseCompactLevelUp(w, h) {
  return w < 720 || h < 480 || h > w * 1.2;
}
