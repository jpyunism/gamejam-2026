# Tasks: Mobile-friendly version for phone browser play

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~480 (4 new + 12 modified) |
| 400-line budget risk | High |
| Chained PRs | No (size:exception accepted by maintainer) |
| Delivery strategy | ask-on-risk → size:exception |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|----|----------------------|-----------------|-------------------|
| 1 | RESIZE + viewport + layout + HUD | PR 1 | `npx playwright test test-game-load.spec.ts` | desktop 1280x960 | revert `main.ts`, `index.html`, `core/layout.ts`, `core/Constants.ts` |
| 2 | Dual joystick + fire + Player aimVec | PR 2 | `npx playwright test test-touch-input.spec.ts` | phone landscape touch | revert `VirtualJoystick.ts`, `FireButton.ts`, `Player.ts`, `GameScene.ts` |
| 3 | MobileBootstrap + RotateOverlay + resize + tests | PR 3 | `npx playwright test test-mobile-emulation.spec.ts` | iPhone 13 / Pixel 5 | revert `MobileBootstrap.ts`, `RotateOverlay.ts`, `MenuScene.ts`, `GameOverScene.ts` |

## Phase 1: Foundation (PR 1)

- [x] 1.1 `index.html` — `touch-action:none` + viewport `user-scalable=no`
- [x] 1.2 `src/core/layout.ts` (new) — `scaleFactor(w)` + `scaledFont(baseline, w)` from 1280
- [x] 1.3 `src/core/Constants.ts` — `LAYOUT` block (BASELINE_W=1280, HUD_FONT=14, TITLE_FONT=44)
- [x] 1.4 `src/main.ts` — `Scale.FIT`→`Scale.RESIZE`, `width/height:'100%'`, `activePointers:4`
- [x] 1.5 `src/ui/HUD.ts` — `layoutFor(w,h)` via `scaledFont`; subscribe `scale.on('resize')`
- [x] 1.6 `test-game-load.spec.ts` — relax `canvas.width===1280` to `>=1280`

## Phase 2: Core Touch Controls (PR 2)

- [x] 2.1 `src/systems/VirtualJoystick.ts` — `side:'left'|'right'` opt; `setPosition(x,y)`
- [x] 2.2 `src/systems/FireButton.ts` (new) — circular Graphics, `consumePressed()` once per pointerdown, pointer-id tracked
- [x] 2.3 `src/entities/Player.ts` — `update(t, dt, moveVec, enemies, aimVec?)`; fallback to `pointer.worldX/Y` when null
- [x] 2.4 `src/scenes/GameScene.ts` — `moveJoystick('left')`, `aimJoystick('right')`, `fireButton`; `handleResize(w,h)` calls `setPosition`; pass `aimVec`
- [x] 2.5 `test-touch-input.spec.ts` (new) — 3 simultaneous touches iPhone 13; assert pointer-id isolation

## Phase 3: Mobile Presentation (PR 3)

- [x] 3.1 `src/systems/MobileBootstrap.ts` (new) — first-touch latch `scale.startFullscreen`; `lockOrientation('landscape')`; `FULLSCREEN_FAILED` noop
- [x] 3.2 `src/systems/RotateOverlay.ts` (new) — overlay when `scale.isPortrait===true`
- [x] 3.3 `src/scenes/MenuScene.ts` — `layoutFor(w,h)` + resize sub
- [x] 3.4 `src/scenes/GameOverScene.ts` — `layoutFor(w,h)` + resize sub
- [x] 3.5 `src/ui/SettingsPanel.ts` — `layoutFor(w,h)` + resize sub
- [x] 3.6 `src/ui/PowerUpSelect.ts` — `layoutFor(w,h)` + resize sub
- [x] 3.7 `test-mobile-emulation.spec.ts` (new) — iPhone 13 + Pixel 5; canvas fills, rotate toggles

## Phase 4: Verification

- [x] 4.1 Boot desktop 1280x960 — HUD matches baseline (visual regression) — `scaleFactor===1` at 1280px, same layout
- [x] 4.2 Boot iPhone 13 (Playwright) — canvas fills, HUD scaled, joystick + fire visible
- [x] 4.3 Verify spec scenarios: dual-joystick isolation, fire-once-per-press, fullscreen deny fallback, rotate overlay
- [x] 4.4 `npx playwright test` — full suite green (5/5 passed)
- [x] 4.5 `git diff --stat` — 13 modified + 6 new files, ~494+229 lines (size:exception approved)

## Phase 5: Cleanup

- [x] 5.1 Remove dead FIT-mode paths in `main.ts` — replaced with RESIZE
- [x] 5.2 Update `README.md` mobile section (devices, quirks)
- [ ] 5.3 Commit per-PR (`feat(mobile):` prefix) — orchestrator responsibility
