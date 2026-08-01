## Exploration: Mobile-friendly phone browser support for Neon Drift

### Current State

Neon Drift is a 1280×960 (4:3) Phaser 4 game using `Phaser.Scale.FIT` + `CENTER_BOTH`. On a phone (375×667 portrait), the canvas scales down to ~375×281 with massive letterboxing. All UI elements use fixed pixel positions and font sizes (11–14px for HUD, 44px for title) — they become unreadable at phone scale. Input is WASD + mouse pointer for aiming, with a VirtualJoystick already implemented for left-side touch movement. There is **no touch aim** (right-side joystick or auto-aim) and **no touch fire button** — the game fires on `pointer.isDown` which works on touch but the aim direction is based on `pointer.worldX/worldY` which is the touch position, so the player would aim at wherever they're touching the screen (conflicting with movement).

The `index.html` has a viewport meta tag but no `touch-action: none` CSS, no orientation lock, and no fullscreen prompt.

### Affected Areas

- `src/main.ts` — GameConfig: scale mode, base resolution, input config
- `index.html` — viewport meta, touch-action CSS, orientation hints
- `src/core/Constants.ts` — GAME.WIDTH/HEIGHT, HUD font sizes, layout constants
- `src/scenes/GameScene.ts` — input handling, joystick creation, pointer aim, fire-on-touch logic
- `src/scenes/MenuScene.ts` — card layout, font sizes, button positions
- `src/scenes/GameOverScene.ts` — layout, font sizes, shop panel
- `src/ui/HUD.ts` — all fixed-position elements, font sizes, bar widths
- `src/ui/SettingsPanel.ts` — panel dimensions, slider geometry
- `src/ui/PowerUpSelect.ts` — card dimensions, font sizes, layout
- `src/systems/VirtualJoystick.ts` — already exists, may need position/radius adjustments
- `src/entities/Player.ts` — aim logic (currently uses pointer.worldX/worldY)
- `test-game-load.spec.ts` — asserts `canvas.width === 1280` (will break)
- `playwright.config.ts` — viewport size for tests

### Approaches

1. **Minimal — FIT mode + touch aim overlay**
   - Keep 1280×960 base resolution, add a right-side aim joystick and a fire button
   - Pros: Minimal code changes, preserves all existing layout math
   - Cons: UI text still tiny on phone, letterboxing wastes screen space, poor experience
   - Effort: Low (~2–3 hours)

2. **Responsive — RESIZE mode + dynamic HUD**
   - Switch to `Phaser.Scale.RESIZE`, listen for `resize` events, reposition HUD elements proportionally, scale font sizes based on viewport
   - Add right-side aim joystick + fire button for touch
   - Add orientation lock + fullscreen prompt
   - Pros: Looks good on any screen size, no letterboxing, proper mobile experience
   - Cons: More code changes, HUD needs refactoring to be dynamic, Playwright test needs updating
   - Effort: Medium (~6–8 hours)

3. **Full mobile — smaller base resolution + dual joystick**
   - Change base resolution to 480×360 (or similar phone-friendly), use `Phaser.Scale.FIT` with `MAX_ZOOM`
   - Rewrite all layout constants proportionally
   - Dual joystick (left = move, right = aim) + auto-fire or tap-to-fire
   - Pros: Crisp pixel art on phone, no HUD refactoring needed (just rescale constants)
   - Cons: Desktop experience degrades (smaller viewport), all constants need re-audit, may need separate desktop/mobile configs
   - Effort: Medium-High (~8–12 hours)

### Recommendation

**Approach 2 (Responsive)** is the right call. The game already has a VirtualJoystick for movement — the missing pieces are:
1. A right-side aim joystick (or auto-aim toward nearest enemy)
2. A touch fire button
3. Dynamic HUD that repositions on resize
4. Orientation lock to landscape
5. Fullscreen prompt on first tap
6. `touch-action: none` CSS to prevent browser gestures

This gives a proper mobile experience without degrading desktop. The HUD refactoring is the bulk of the work but it's a one-time cost that makes the game future-proof.

### Risks

- **Medium**: Playwright test asserts `canvas.width === 1280` — will fail with RESIZE mode. Must update test to check aspect ratio or existence of canvas with content.
- **Medium**: HUD refactoring touches 5 files (HUD, SettingsPanel, PowerUpSelect, MenuScene, GameOverScene) — risk of visual regressions on desktop.
- **Low**: Dual touch input (left joystick + right joystick + fire button) may conflict with Phaser's pointer system — need to track pointer IDs carefully.
- **Low**: iOS Safari has known quirks with fullscreen and viewport height (dynamic toolbar). The existing `GetInnerHeight` workaround in Phaser 4 should handle it, but needs testing.

### Ready for Proposal

Yes — the scope is clear, the approaches are well-understood, and the codebase already has a VirtualJoystick foundation. The orchestrator should tell the user: "Ready for proposal. Recommended approach: responsive RESIZE mode + dual joystick + dynamic HUD. ~6–8 hours of work across ~12 files. Playwright test needs updating."
