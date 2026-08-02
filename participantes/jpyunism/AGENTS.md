# Neon Drift — Agent Instructions

## Package Manager
Use **npm**: `npm install`, `npm run dev`, `npm run build`

## File-Scoped Commands
| Task | Command |
|------|---------|
| Typecheck | `npx tsc --noEmit path/to/file.ts` |
| Build | `npm run build` |
| Test (single) | `npx playwright test path/to/test.spec.ts` |
| Test (all) | `npx playwright test` |

## Project Structure
```
src/
├── core/        Constants, EventBus, GameState, layout
├── entities/    Player, Enemy (Chaser, Shooter, Tank)
├── scenes/      MenuScene, GameScene, GameOverScene
├── systems/     WaveManager, MapGenerator, LevelUpManager, VirtualJoystick, etc.
├── ui/          HUD, PowerUpSelect, SettingsPanel
├── weapons/     Weapon base + 5 weapon types
├── store/       MetaProgress, AudioSettings (localStorage)
├── audio/       AudioManager
└── main.ts      Phaser.Game config + bootstrap
```

## Key Conventions
- All magic numbers in `src/core/Constants.ts` — never hardcode in game logic
- Phaser 4 API (not v3). Use `Phaser.AUTO`, `Phaser.Scale.RESIZE`, arcade physics
- Scenes extend `Phaser.Scene` with `preload()`, `create()`, `update()`
- Weapons extend `Weapon` base class in `src/weapons/Weapon.ts`
- Enemies extend `Enemy` base class in `src/entities/Enemy.ts`
- Game state via `GameState` singleton in `src/core/GameState.ts`
- Event bus via `EventBus` in `src/core/EventBus.ts`
- Meta-progress persisted to `localStorage` key `neon-drift:meta`
- Audio settings persisted to `localStorage` key `neon-drift:audio`
- Mobile controls auto-activate on touch: VirtualJoystick (×2) + FireButton
- Tests use Playwright with `test-*.spec.ts` naming, headless, port 5173

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: (the agent's name and attribution byline)
```
