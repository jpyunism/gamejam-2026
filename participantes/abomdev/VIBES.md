# VIBES — cambios de Fase 2

## Resumen
Reescritura completa del motor de música: adopción del motor soondmaker (BIT//BLOOM) con 9 presets, 16-step grid rítmico, variación cada 4 compases y filtros/ADSR por track. Música ahora suena apenas carga el juego (pantalla IntroScreen con desbloqueo de audio). Mobile/UX: fullscreen + lock landscape + hint portrait, layout responsivo con safe-areas, menú de level-up 2×2, SettingsPanel scrollable, controles táctiles (joystick + pausa). Feedback visual al recoger XP (partículas + texto + pulse) y al cambiar HP/shield. EndScreen refactor con panel ancho. 18 tests nuevos.

## Cambios realizados

### Motor de música procedural (soondmaker)
- **`src/audio/soondmaker/`** (4 módulos + 1 test) — port del motor BIT//BLOOM: teoría musical (escalas mayor/menor/dórica/frigia/.../pentatónica), Mulberry32 RNG con `createSeed()`, `generateBar` con 16-step grid, 6 lead rhythms + 4 bass + 5 drum patterns, `describeVariation` que rota entre fases (presentación/repetición/variación/cierre con fill) cada 4 compases.
- **9 presets**: arcade, neon, dungeon, lofi, bitpop, skyline, boss, moonlit, forest — cada uno con progresión, escala, BPM, swing, character/energy/density/complexity.
- **`src/audio/chip-tracks.js`** (reescrito, archivo nuevo) — wrappers sobre soondmaker: `createMenuTrack=lofi`, `createGameTrack=dungeon+createSeed()` (cada run melodía distinta), `createBossTrack=boss`. Convierte output de `generateBar` a eventos en formato BugSurvivor (time en beats, swing por step).
- **`src/audio/stingers.js`** (nuevo) — `generateLevelupStinger` y `generateGameoverStinger` (movidos de chip-tracks.js, sin cambios lógicos).
- **`src/audio/synth.js::playVoiceNote`** — voice synthesis con filter lowpass cutoff `700 + character*6000 + energy*1700`, Q `0.8 + character*4`, ADSR por track (chord: 12ms/85ms; lead/bass: 4ms/45ms), glide como `freq*1.12`, multipliers (chord: 1.3; lead/bass: 0.76).
- **`src/audio/synth.js::createBgmEventTransport`** — scheduler con tiempo absoluto monotónico. Sin modulo, sin wrap-around frágil. `takeThrough(endTime)` devuelve eventos cuyo tiempo absoluto ya pasó o está dentro del lookahead (140ms).
- **`src/audio/synth.js::playChipNote`** — refactor: detecta modo voice (`track` presente) vs modo sfx/stinger, ambos con category `music`.
- **`src/audio/synth.js::bgmStarted`** — lazy init del scheduler: espera a que `AudioContext.state === 'running'` antes de capturar `bgmStartTime`. Evita desfase al desbloquear.
- **DEFAULTS de audio** (`src/audio/synth.js:13`) — agregada categoría `music: 0.3`, `master/combat/events: 1.0`. Antes la música tapaba el resto.
- **Categoría `music`** agregada a `CATEGORIES` (`src/audio/synth.js:11`) — slider en SettingsPanel.
- **5 tests nuevos** (`src/audio/soondmaker/pattern-engine.test.js`) — portados de soondmaker: reproducibilidad, voces válidas, escala/registro, variación de 4 compases, 9 presets válidos.
- **1 test nuevo** (`src/audio/synth.test.js`) — valida que el transporte continúa con el siguiente bloque sin reiniciar el reloj (caso snare final de un batch + kick inicial del siguiente).

### IntroScene + desbloqueo de audio
- **`src/scenes/IntroScene.js`** (nuevo) — pantalla de arranque con fondo oscuro + título "BUGSURVIVOR" + texto pulsante "TOCA LA PANTALLA" (mobile) / "PRESIONA CUALQUIER TECLA O HAZ CLICK" (desktop). Cualquier `pointerdown`/`keydown`: `unlockAudio()` + `startBgm('menu', null, TRACK_GENERATORS)` + `cameras.main.fadeOut(300ms)` → `MenuScene`.
- **`src/main.js`** — `IntroScene` agregada al array `[IntroScene, MenuScene, GameScene]`. Variable `game` expuesta a `window` para smoke tests.

### Fullscreen + orientación + mobile
- **`src/utils/fullscreen.js`** (nuevo) — `toggleFullscreen` con cadena de fallback (Phaser → browser API), `isBrowserFullscreen` consultando `document.fullscreenElement`.
- **`src/utils/orientation.js`** (nuevo) — `lockLandscape`/`unlockOrientation` con silent fail en iOS.
- **`src/utils/device.js`** (nuevo) — `isTouchDevice` (matchMedia `(pointer: coarse)` OR `navigator.maxTouchPoints > 0`), `isIOS`.
- **`src/utils/touchLayout.js`** (nuevo) — lado del joystick IZQ/DER persistido en `localStorage` con clave `survivorsTouchLayout`.
- **`src/ui/TouchControls.js`** (nuevo) — joystick virtual con base de anillos concéntricos (Graphics, no cuadrado), thumb con highlight blanco, botón de pausa dedicado top-right con `icon-pause`. Hot zone configurable. Hooks de visibilidad (ocultar en level-up/pausa/game-over/victory/menú, mostrar en `resumeGame`/`chooseUpgrade`).
- **`src/scenes/MenuScene.js`** — botón "PANTALLA COMPLETA" en touch, hint mobile (`'Joystick para moverte · ESC: pausa'`), `startBgm('menu')` condicional a `isAudioReady()`, normalización post-F5 (`if (isBrowserFullscreen()) try { stopFullscreen }`).
- **`src/scenes/GameScene.js`** — hint "↻ Rotá el celular para jugar" si queda en portrait, fullscreen auto en tap de touch.

### Layout responsivo + safe-areas
- **`src/ui/layout.js`** (nuevo) — `isCompactMode()` (`w < 720 || h < 480`), `shouldUseCompactLevelUp(w, h)` (más agresivo: `w < 720 || h < 480 || h > w * 1.2` para tablet portrait), `getSafeInsets()` lee CSS vars `--sai-*`, `edgePadding(side, default, insets)`.
- **`index.html`** — meta tags PWA (`apple-mobile-web-app-capable`, `mobile-web-app-capable`, `theme-color`), `viewport-fit=cover`, body con `padding: env(safe-area-inset-*)`, `:root { --sai-top/right/bottom/left: env(safe-area-inset-*) }`.
- **`src/ui/Hud.js`** — compact layout (ancho de barras `w * 0.4`, boss bar a `h - 28`, fuentes reducidas), `setAlpha` para atenuar durante level-up, `pulseXpIcon()` público + `_pulseIcon(icon, tweenKey, factor)` privado.
- **`src/ui/PauseMenu.js`** — 3 columnas desktop (STATS | INVENTORY | BOTONES), vertical en compact, inventario y stats apilados. Botón fullscreen touch como primer item. Inversión de columnas según lado del joystick.
- **`src/ui/Minimap.js`** — 150×150 → 90×90 en compact, enemigos con menor radio.
- **`src/ui/widgets.js`** — agregados helpers usados por scrollable panels.
- **`src/config/theme.js`** — `MINIMAP` con `bg: 0x000000`, `bgAlpha: 0.55`, `border: 0x66ffcc` (cyan accent).

### SettingsPanel scrollable
- **`src/ui/SettingsPanel.js`** — viewport con `Phaser.Filters.Mask` nativo de Phaser 4 sobre Container. RenderTexture como fuente del mask. `Container.width/height` explícitos (si son 0, Phaser setea `filtersFocusContext=true` y rompe el mask). Drag vertical con threshold 6px, wheel con factor 0.5. Scrollbar azul (`0x66aaff`, ancho 4px, alpha 0.6). Chevrons de overflow con `Graphics` (no SVG) y tween de alpha yoyo. Toggle fullscreen ON/OFF custom (cyan cuando ON). Layout vertical: label arriba, botones IZQ/DER y OFF centrados abajo. Slider Música agregado. Sincronización `fullscreenchange` con `delayedCall(150)`.
- **`src/ui/layout.test.js`** (nuevo) — 12 tests del sistema de layout (isCompactMode, shouldUseCompactLevelUp, getSafeInsets, edgePadding).

### LevelUpMenu mobile
- **`src/ui/LevelUpMenu.js`** — grilla 2×2 derivada del viewport: `cardW = (w − 24 − 16) / 2`, `cardH = min(140, cardW * 0.48)`. Icon compact 20px, label inline a la derecha. Depth 200 para quedar sobre Minimap/HUD.
- **`src/config/constants.js`** — `LEVEL_UP_DEBUG_KEY = true`. Registra `keydown-U` en GameScene para abrir el menú de level-up (debug, removible).

### Feedback visual (XP / HP / Shield)
- **`src/scenes/GameScene.js::onPlayerPickupXp`** — partículas violetas (`deathEmitter.setParticleTint(0xaa88ff)`, `emitParticleAt(orb.x, orb.y, value >= 5 ? 8 : 4)`), texto flotante `'+value'` con throttle 100ms, `hud.pulseXpIcon()`.
- **`src/ui/Hud.js::update`** — `_prevHp`/`_prevShield` tracking, dispara `_pulseIcon` en cualquier cambio. Throttle independiente por icono.

### EndScreen refactor
- **`src/ui/EndScreen.js`** — panel ancho (`PANEL_W = 720` en desktop), `getBestTime`/`saveBestTime` (localStorage `'survivorsBestTimeMs'`) extraídos como exports separados (testeables). Compact: fontes reducidas, tiempo y personaje con wrapeado.

### Vite + dev server
- **`vite.config.js`** — `server.host: '0.0.0.0'` + `server.allowedHosts: true` para exponer el dev server en LAN y probar desde celular. `allowedHosts: true` saltea el filtro de Vite 7+ que rechaza Host headers desconocidos (IP local).
- **`.gitignore`** — `dev-notes/`, `dist/`, `node_modules/` excluidos.

## Lo que quedó frágil
- **Scheduler lazy-init**: si el AudioContext se desbloquea muy tarde (>50ms después del primer tick), el primer compás puede tener drift. Mitigado por `bgmStarted` que captura el `currentTime` real en el primer tick válido.
- **Seed aleatorio del gameplay**: cada run tiene una melodía distinta sobre D phrygian, pero no hay UI para mostrar/elegir el seed. Runs no son reproducibles por el usuario.
- **DEFAULTS de audio**: cambios futuros no se aplican a usuarios con localStorage guardada. Hay que limpiar `survivorsAudio` manualmente o agregar `schemaVersion` que invalide el storage.
- **`LEVEL_UP_DEBUG_KEY = true`**: hotkey `U` abre el menú de level-up en partida. Removible con el flag, pero queda activa.
- **Filtros del SettingsPanel**: `Phaser.Filters.Mask` con `Container.enableFilters()`. Si en el futuro alguien llama `setMask` desde fuera sin `clearMask`,叠加. El panel lo limpia en cada `layout()`.
- **Mask pre-update**: `maskFilter.needsUpdate = true` se llama en cada `layout()` para que el filter tome el nuevo viewport tras resize. Edge case: si el panel se oculta durante un resize, queda con la última máscara válida.
- **Chevrons de overflow**: `tween.yoyo` infinito. Si el panel se cierra en medio, `_stopHintTween()` la corta; si no se llama (caso edge), leak.
- **Code muerto eliminado en este flujo**: `repeatStaticTrack`, rama `else if (tracks && tracks[trackName])` en `startBgm`, `getCurrentTrackConfig`, `getCurrentBgmTrack`, `isMuted`, `TRACKS` (const), `copyPreset`, `chip-progressions.js`. Ninguno tenía callers vivos.

## Ideas no implementadas
- **Selector visual de preset musical** — los 9 presets de soondmaker están disponibles en el motor, pero el usuario solo escucha lofi/dungeon/boss según el contexto. Un dropdown en SettingsPanel permitiría probar arcade/skyline/etc.
- **UI para mostrar/elegir seed** de la run actual (útil para compartir runs reproducibles).
- **Migración de schema en `loadSettings()`** que invalide el storage viejo cuando cambien los defaults.
- **PWA completa**: meta tags quedan como zero-cost, pero no hay manifest ni service worker. Si el deploy cambia a PWA, retomar.
- **Indicador sutil de hot zone del joystick** antes del primer touch (discoverability).
- **Slider de "reducción de movimiento"** en SettingsPanel — la infraestructura de toggles ya está lista.
- **SFX de "fullscreen denied"** cuando el toast de fallback aparece (audio procedural).
- **Listener `fullscreenchange`** que llame `unlockOrientation` si el browser sale de fullscreen por motivo externo.