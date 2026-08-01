# Proposal: Mobile-friendly phone browser support for Neon Drift

## Intent

Neon Drift's current 1280x960 base resolution with `Scale.FIT` collapses to ~375x281 on a phone, producing unreadable HUD text and no usable touch controls (no aim joystick, no fire button, no orientation lock). This change delivers a proper mobile play experience in a phone browser without degrading the desktop build.

## Scope

### In Scope

- Switch `src/main.ts` GameConfig from `Phaser.Scale.FIT` to `Phaser.Scale.RESIZE` with `width:'100%' / height:'100%'`.
- Add a right-side aim `VirtualJoystick` and a touch `FireButton` to `GameScene`, wired through the existing pointer-ID tracking pattern.
- Refactor `HUD`, `SettingsPanel`, `PowerUpSelect`, `MenuScene`, `GameOverScene` to recompute positions and font sizes from `scale.on('resize', ...)` instead of fixed pixel constants.
- `index.html`: add `touch-action: none`, orientation meta hint, and a first-tap fullscreen prompt (calls `this.scale.startFullscreen()` from `pointerup`).
- Lock orientation to `landscape` via `this.scale.lockOrientation('landscape')` on supported mobile browsers; show a rotate-device overlay otherwise.
- Update `test-game-load.spec.ts` to assert canvas content/existence rather than `canvas.width === 1280`.

### Out of Scope

- Smaller base resolution (480x360) or pixel-art rewrite — current 1280x960 art is preserved.
- Auto-aim toward nearest enemy as a fallback for right joystick — manual aim only.
- Native app packaging (PWA install, Capacitor) — browser only.
- Haptic feedback / vibration API integration.
- Pause-on-background for mobile browsers.

## Capabilities

### New Capabilities

- `mobile-touch-controls`: Touch input system covering movement joystick, aim joystick, and fire button, with explicit pointer-ID handling so the left/right joystick and fire button cannot conflict.
- `responsive-layout`: Dynamic scale and resize handling so HUD, settings panel, and scene overlays reposition and rescale fonts when the canvas resizes.
- `mobile-presentation`: Orientation lock, fullscreen-on-tap prompt, and `touch-action: none` browser-level settings that give a fullscreen, gesture-free mobile play surface.

### Modified Capabilities

- None at the spec level. The `audio-music-and-settings` capability is untouched. There is no existing `input` or `ui-layout` spec to amend; this change introduces them as new capabilities.

## Approach

Use `Phaser.Scale.RESIZE` so the canvas fills the device viewport (no letterboxing). Scenes subscribe to `scale.on('resize', ...)` and rebuild their UI relative to `this.scale.width / this.scale.height`. On phones, `GameScene` instantiates a left movement joystick (already exists), a right aim joystick (new), and a fire button (new), tracking each by `pointer.id` to prevent cross-talk. `index.html` opts out of browser gestures via `touch-action: none` and offers fullscreen on first `pointerup`. The Playwright boot smoke test is loosened from a fixed `canvas.width === 1280` check to an existence + aspect-ratio check, since the canvas now sizes to the viewport.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/main.ts` | Modified | `Phaser.Scale.FIT` -> `RESIZE`, percentage sizing, `input.activePointers` bumped for multi-touch. |
| `index.html` | Modified | `touch-action: none`, orientation meta, fullscreen-prompt container. |
| `src/core/Constants.ts` | Modified | Replace fixed HUD/font constants with helpers or keep constants as baselines scaled at render. |
| `src/scenes/GameScene.ts` | Modified | Add right aim joystick, fire button, pointer-ID bookkeeping, resize handler. |
| `src/scenes/MenuScene.ts`, `GameOverScene.ts` | Modified | Reposition cards/buttons/fonts on resize. |
| `src/ui/HUD.ts`, `SettingsPanel.ts`, `PowerUpSelect.ts` | Modified | Recompute positions and font sizes on `scale.resize`. |
| `src/systems/VirtualJoystick.ts` | Modified | Accept configurable side/radius; reuse for aim. |
| `src/systems/FireButton.ts` | New | Circular touch fire button with pressed state. |
| `src/entities/Player.ts` | Modified | Use aim-joystick vector when present, else `pointer.worldX/worldY`. |
| `test-game-load.spec.ts`, `playwright.config.ts` | Modified | Canvas assertion relaxed to existence + aspect ratio. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Playwright test currently asserts `canvas.width === 1280`; will fail with RESIZE. | High | Update assertion in same change to existence + non-zero size. |
| HUD refactor across 5 files risks desktop visual regression. | Medium | Keep fixed pixel constants as baseline; compute scale factor and apply proportionally. Manual desktop smoke after each file. |
| Dual touch pointers (left move + right aim + fire) conflict via shared `pointer.worldX`. | Low | Track each interactive element by its captured `pointer.id`; aim system reads only the right-side joystick's captured vector, not the active pointer. |
| iOS Safari fullscreen + dynamic viewport height quirks. | Low | Rely on Phaser 4's `GetInnerHeight` workaround; guard fullscreen call with `pointer.wasTouch` and a `FULLSCREEN_FAILED` handler. |
| Orientation lock is a no-op on unsupported browsers (iOS Safari < 16.4). | Medium | Fall back to soft prompt: detect portrait via `scale.isPortrait` and render a rotate-device overlay. |

## Rollback Plan

The change is local to `participantes/jpyunism/`. Revert the commit to restore FIT mode and the original input bindings; no shared code is touched. The new `FireButton.ts` is additive and can be deleted without affecting existing systems. If the RESIZE experiment regresses desktop play, a follow-up commit can revert `src/main.ts` and the HUD resize hooks while keeping `index.html` touch-action improvements.

## Dependencies

- Phaser 4 `Scale.RESIZE` (already in stack via `phaser@^4`).
- Existing `VirtualJoystick` system in `src/systems/`.
- Playwright boot smoke test is the only automated coverage; manual on-device QA (Chrome DevTools device emulator + a physical phone) is required.

## Success Criteria

- [ ] Loading the build on a 375x667 phone browser renders the canvas fullscreen with no letterboxing and readable HUD text.
- [ ] Player can move with the left joystick, aim with the right joystick, and fire with the touch button on a phone.
- [ ] Desktop build still passes `npx playwright test` and renders without visual regressions in the menu, game, pause, and game-over scenes.
- [ ] On portrait phones, a rotate-device overlay is shown instead of an unusable play area.
- [ ] First tap on a touch device triggers a fullscreen request without console errors.
