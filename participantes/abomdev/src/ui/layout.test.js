// Tests de los helpers de layout responsive. No tocan Phaser: reciben tamano de
// viewport y devuelven datos, por eso se pueden testear directo.

import { describe, expect, it } from 'vitest';
import {
  edgePadding,
  getSafeInsets,
  getViewportScale,
  getViewportSize,
  isCompactMode,
  shouldUseCompactLevelUp,
} from './layout.js';

describe('isCompactMode', () => {
  it('true en viewports chicos (mobile landscape)', () => {
    expect(isCompactMode({ width: 640, height: 360 })).toBe(true);
    expect(isCompactMode({ width: 360, height: 640 })).toBe(true);
  });

  it('true si solo el alto es chico (foldable, tablet horizontal)', () => {
    expect(isCompactMode({ width: 1280, height: 400 })).toBe(true);
  });

  it('false en desktop tipico', () => {
    expect(isCompactMode({ width: 1280, height: 720 })).toBe(false);
    expect(isCompactMode({ width: 1920, height: 1080 })).toBe(false);
  });

  it('cubre el umbral exactamente en width', () => {
    expect(isCompactMode({ width: 720, height: 480 })).toBe(false);
    expect(isCompactMode({ width: 719, height: 480 })).toBe(true);
  });
});

describe('getViewportScale', () => {
  it('referencia 720 devuelve 1.0', () => {
    expect(getViewportScale({ width: 720, height: 720 })).toBe(1);
  });

  it('clampea hacia abajo en viewports chicos', () => {
    const scale = getViewportScale({ width: 360, height: 360 });
    expect(scale).toBeGreaterThanOrEqual(0.6);
    expect(scale).toBeLessThan(1);
  });

  it('clampea hacia arriba en 4K', () => {
    expect(getViewportScale({ width: 2160, height: 2160 })).toBe(1.2);
  });

  it('usa el lado mas chico del viewport', () => {
    const tall = getViewportScale({ width: 1920, height: 360 });
    expect(tall).toBe(getViewportScale({ width: 360, height: 360 }));
  });
});

describe('getViewportSize', () => {
  it('devuelve sanitizado cuando window no existe', () => {
    const size = getViewportSize();
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });
});

describe('getSafeInsets', () => {
  it('devuelve 0 si no hay CSS env vars', () => {
    const insets = getSafeInsets();
    expect(insets).toEqual(expect.objectContaining({ top: 0, right: 0, bottom: 0, left: 0 }));
  });
});

describe('edgePadding', () => {
  it('usa el fallback si no hay inset', () => {
    expect(edgePadding('top', 12, { top: 0, right: 0, bottom: 0, left: 0 })).toBe(12);
  });

  it('usa el inset si es mayor que el fallback', () => {
    expect(edgePadding('top', 12, { top: 44, right: 0, bottom: 0, left: 0 })).toBe(44);
  });
});

describe('shouldUseCompactLevelUp', () => {
  it('true en portrait de telefono (375x667)', () => {
    expect(shouldUseCompactLevelUp(375, 667)).toBe(true);
  });

  it('true en portrait de tablet (768x1024) aunque isCompactMode seria false', () => {
    expect(shouldUseCompactLevelUp(768, 1024)).toBe(true);
  });

  it('false en desktop landscape (1280x720)', () => {
    expect(shouldUseCompactLevelUp(1280, 720)).toBe(false);
  });

  it('false en 1080p desktop (1920x1080)', () => {
    expect(shouldUseCompactLevelUp(1920, 1080)).toBe(false);
  });

  it('true cuando el alto es chico aunque el ancho sea desktop', () => {
    expect(shouldUseCompactLevelUp(1280, 400)).toBe(true);
  });
});
