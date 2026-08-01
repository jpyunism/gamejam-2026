# Design: Mobile-friendly phone browser support for Neon Drift

## Technical Approach

Switch the game from `Phaser.Scale.FIT` (which letterboxes to 1280x960) to
`Phaser.Scale.RESIZE` (which lets the canvas fill the viewport), then
introduce a second aim joystick, a touch fire button, a portrait-rotate
overlay, and a fullscreen-on-tap prompt. HUD and menu scenes subscribe to
`scale.on('resize', ...)` and recompute positions/fonts against
`scale.width / scale.height` instead of fixed pixel constants. The world
stays 1280x960 and the camera keeps following the player, so the gameplay
arena is identical between desktop and mobile — only the viewport and
overlay chrome change. Single unified code path; nothing is
desktop-vs-mobile branched except the visible controls and the
rotate-overlay.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Scale mode | `Phaser.Scale.RESIZE` w/ `width:'100%'`, `height:'100%'` | FIT (letterbox), EXPAND, dual-base-resolution | RESIZE matches the proposal's "fill the viewport, no letterbox" requirement and is what every mobile browser game in the Phaser docs uses. FIT shrinks to 375x281 (unplayable). EXPAND is newer and less battle-tested. Dual-base means two art pipelines. |
| Aim input | Right-side virtual joystick (reuses `VirtualJoystick`) | Auto-aim toward nearest enemy, tap-to-aim | Spec requires manual aim ("manual aim only"). Reusing `VirtualJoystick` is cheap — already has pointer-id isolation. Auto-aim is rejected (out of scope) and tap-to-aim collides with fire button. |
| Fire input | Touch `FireButton` (single bullet per press) | Continuous fire while button held | Spec says "single bullet per press (not continuous hold)" so weapon cooldowns remain the cadence governor; no risk of spam-firing bypassing balance. |
| HUD reposition | Add `applyLayout(width, height)` on every UI class; keep baseline constants and multiply by `width / 1280` scale factor | Anchor-based layout, third-party UI plugin (rexBBCodeText, etc.) | Anchor rewriting would touch every per-pixel coordinate. A scale-factor helper (`scale.ts` math) is 1-line per usage and leaves the constants in `Constants.ts` readable. No new plugin dependency for a GameJam build. |
| Orientation lock | `this.scale.lockOrientation('landscape')` + rotate-overlay fallback when `isPortrait` | CSS-only, ignore portrait | JS API works on Android Chrome; iOS Safari < 16.4 ignores it, so the rotate-overlay is the universal fallback. CSS-only can't read `screen.orientation.lock()` without a user gesture. |
| Fullscreen entry | `this.scale.startFullscreen()` on first `pointerup` with `pointer.wasTouch === true` | Auto-request on boot | Browsers gate fullscreen behind user gesture; boot-time call is a no-op. First `pointerup` is the natural gesture. |
| World bounds | Stay `1280x960` with camera follow | Shrink to viewport size | Existing map, enemy spawn margins, and pillar layout all key off 1280x960. Shrinking would break `WAVE.SPAWN_MARGIN` and pillar placement. Camera-follow gives a "larger arena than viewport" feel that matches desktop. |
| Pointer slots | `input.activePointers: 4` (left, right, fire, spare) | Default `2` | Two-finger drag (move + aim) plus a third for fire requires ≥ 3 pointers; default 2 would drop the third and cause ghost-ups. |

## Data Flow

```
Browser pointer event
  → Phaser.Input.InputPlugin (split per pointer.id)
  ├─ left half  → VirtualJoystick  (movement)
  ├─ right half → VirtualJoystick  (aim, NEW)
  ├─ fire button rect → FireButton  (tap → emit `fire-pressed`)
  └─ HUD zone   → ignored (setInteractive on bars only)
       │
       ▼
GameScene.update(time, delta)
  ├─ joystick.getDirection() (left)  → cursors.{up,down,left,right}
  ├─ aimJoystick.getDirection() (right) → aim joystick vector
  └─ fireButton.consumePressed()  → player.tryFire(time)
       │
       ▼
Player.update(cursors, aimJoystickVec)
  └─ aimAngle = atan2(aimVec.y, aimVec.x)  (mobile)
     else   aimAngle = Angle.Between(player, pointer.worldXY)  (desktop)
```

`scale.on('resize', w, h)`:

```
ScaleManager
  ├─ cameras.main.setSize(w, h)
  ├─ HUD.layoutFor(w, h)         → reposition panels + rescale fonts
  ├─ SettingsPanel.layoutFor(w, h)
  ├─ PowerUpSelect.layoutFor(w, h)
  ├─ MenuScene.layoutFor(w, h)   → cards / title / hint reflow
  ├─ GameOverScene.layoutFor(w, h)
  ├─ left/aim joystick.setPosition(...)  → bottom-left, bottom-right
  ├─ FireButton.setPosition(...)         → bottom-right
  └─ RotateOverlay.show/hide(isPortrait)
```

`first pointerup (wasTouch)` → `this.scale.startFullscreen()` once (latch flag).

## File Changes

| File | Action | Description |
|---|---|---|
| `src/main.ts` | Modify | `FIT` → `RESIZE`, `width:'100%'`, `height:'100%'`, `input.activePointers: 4`, `expandParent: true`. |
| `index.html` | Modify | Add `touch-action: none` to `#game`, `<meta name="viewport" ... user-scalable=no, viewport-fit=cover>`, fullscreen `<div id="fs-prompt">`. |
| `src/core/Constants.ts` | Modify | Add `LAYOUT = { BASELINE_W: 1280, BASELINE_H: 960, MIN_SCALE: 0.45, FONT_MIN_PX: 8 } as const`. Keep all existing pixel constants as baselines. |
| `src/core/layout.ts` | **New** | Helper: `scaleFactor(w) => max(MIN_SCALE, w/BASELINE_W)`, `scaledFont(px, scale) => max(FONT_MIN_PX, px*scale) + 'px'`. |
| `src/systems/VirtualJoystick.ts` | Modify | Add constructor `side: 'left' \| 'right'`; gate pointer-down by side zone; expose `setPosition(x,y)`. No change to `getDirection()`/`isActive()` API. |
| `src/systems/FireButton.ts` | **New** | Circular touch zone, tracks `pointer.id`, exposes `consumePressed(): boolean` (returns true once per press). |
| `src/systems/RotateOverlay.ts` | **New** | DOM-style Phaser overlay drawn via Graphics+Text on a dedicated scene or top-level container; shows "Please rotate" when `scale.isPortrait`, hides otherwise. |
| `src/systems/MobileBootstrap.ts` | **New** | One-shot per scene: fullscreen-on-first-touchup latch, `lockOrientation('landscape')` call, `FULLSCREEN_FAILED` handler. Injected by `GameScene.create()`. |
| `src/scenes/GameScene.ts` | Modify | Replace single `joystick` with `moveJoystick`, `aimJoystick`, `fireButton`. New `handleResize(w,h)` method bound to `scale.on('resize', ...)`. `Player.update()` gets a 5th arg `aimVector`. Fire driven by `fireButton.consumePressed()`, not `input.activePointer.isDown`. |
| `src/entities/Player.ts` | Modify | New `update(time, delta, cursors, pointer, aimVec?)`. If `aimVec` non-null use it; else fall back to `pointer.worldX/worldY`. Keep `tryFire()` signature unchanged. |
| `src/ui/HUD.ts` | Modify | Move all layout constants into private `layoutFor(w,h)`; subscribe to resize via the scene. Add `destroy()` to clean up listener. |
| `src/ui/SettingsPanel.ts` | Modify | Same `layoutFor(w,h)` pattern. |
| `src/ui/PowerUpSelect.ts` | Modify | Same. |
| `src/scenes/MenuScene.ts` | Modify | `layoutFor(w,h)` rebuilds card row + title; subscribes to resize. |
| `src/scenes/GameOverScene.ts` | Modify | Same. |
| `test-game-load.spec.ts` | Modify | Drop `canvasSize.width === 1280 / height === 960`. Assert non-zero box + aspect ratio `width/height ∈ [1.0, 2.5]` (mobile-portrait excluded). |
| `test-mobile-emulation.spec.ts` | **New** | Playwright `devices['iPhone 13']` + `Pixel 5` viewports; asserts canvas box matches viewport, no horizontal scroll, `<meta viewport>` present. |
| `test-touch-input.spec.ts` | **New** | Playwright `page.touchscreen.tap(x, y)` sequence; verifies joystick DOM/canvas is visible, fullscreen latch fires, no console errors. |

## Interfaces / Contracts

```ts
// src/systems/VirtualJoystick.ts (modified)
constructor(scene, x: number, y: number, radius: number,
            opts?: { side?: "left" | "right" })
getDirection(): { x: number; y: number }  // [-1,1]
isActive(): boolean
setPosition(x: number, y: number): void  // NEW — for resize
destroy(): void

// src/systems/FireButton.ts (new)
constructor(scene, x: number, y: number, radius: number)
consumePressed(): boolean  // true once per pointerdown→up cycle
setPosition(x: number, y: number): void
destroy(): void

// src/systems/MobileBootstrap.ts (new)
constructor(scene: Phaser.Scene)
destroy(): void
// Internally: latches first-tap fullscreen, calls lockOrientation,
// hooks FULLSCREEN_FAILED → noop.

// src/core/layout.ts (new)
export const LAYOUT = { BASELINE_W: 1280, BASELINE_H: 960,
                         MIN_SCALE: 0.45, FONT_MIN_PX: 8 } as const;
export function scaleFactor(w: number): number;
export function scaledFont(px: number, scale: number): string;

// src/entities/Player.ts (modified)
update(time: number, delta: number, cursors: MovementKeys,
       pointer: Phaser.Input.Pointer,
       aimVec?: { x: number; y: number } | null): void;
```

## Testing Strategy

| Layer | What | How |
|---|---|---|
| E2E (Playwright) | Boot smoke | `test-game-load.spec.ts`: canvas exists, non-zero box, WebGL context, aspect ratio within `[1.0, 2.5]`. |
| E2E | Mobile emulation | `test-mobile-emulation.spec.ts`: `devices['iPhone 13 landscape']` + `Pixel 5`. Assert canvas fills viewport (`box.width ≈ viewport.width`), no horizontal scrollbar, viewport meta present. |
| E2E | Touch input | `test-touch-input.spec.ts`: `await page.touchscreen.tap(x, y)` three times (left zone, right zone, fire). Assert no console errors, fullscreen latch emitted, joystick `isActive()` flipped true (verified via window flag). |
| Manual | Real device QA | Chrome DevTools device emulation + a physical phone, per proposal success criteria. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary. Pure browser-side Phaser
config + DOM event suppression.

## Migration / Rollout

- World bounds, physics, and map generation **unchanged** — same 1280x960 arena on every device.
- Existing desktop WASD + mouse aim code path preserved as the `aimVec === null` branch of `Player.update`. No regression risk for keyboard users.
- HUD constants stay in `Constants.ts` as baselines. `layoutFor` is a thin multiplicative wrapper, not a rewrite. Old visual layout (1280x960 desktop) is mathematically identical to the new layout at `scaleFactor === 1`.
- Rollback: revert the commit. The change is local to `participantes/jpyunism/`. New `FireButton.ts`, `MobileBootstrap.ts`, `RotateOverlay.ts`, `layout.ts` are additive and removable without affecting existing systems.

## Open Questions

None. All design choices follow the proposal and the three delta specs
(`mobile-touch-controls`, `responsive-layout`, `mobile-presentation`).