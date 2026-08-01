/**
 * Layout helpers for responsive scaling.
 *
 * All UI elements use baseline pixel constants from Constants.ts and scale
 * them by `width / BASELINE_W`. At 1280px wide the scale factor is 1.0,
 * producing the exact same layout as the pre-mobile code.
 */

import { LAYOUT } from "./Constants";

/**
 * Returns a scale factor in [MIN_SCALE, 1] based on the current canvas width.
 * At BASELINE_W (1280) the factor is 1.0.
 */
export function scaleFactor(w: number): number {
  return Math.max(LAYOUT.MIN_SCALE, w / LAYOUT.BASELINE_W);
}

/**
 * Returns a CSS font-size string scaled from a baseline pixel value.
 * Clamped to FONT_MIN_PX so text never becomes illegible.
 */
export function scaledFont(px: number, scale: number): string {
  return `${Math.max(LAYOUT.FONT_MIN_PX, Math.round(px * scale))}px`;
}
