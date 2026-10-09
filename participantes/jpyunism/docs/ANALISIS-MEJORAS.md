# Neon Drift — Auditoría técnica y propuesta de mejoras

> Fase 2 — análisis del juego `participantes/jpyunism` (Neon Drift).
> Todo lo marcado como **[verificado]** salió de instrumentar la partida real
> (Playwright + sondas al runtime de Phaser 4), no de leer el código.

## 0. Estado del proyecto al recibirlo

| Aspecto | Estado |
|---|---|
| Stack | Phaser 4.2 + TypeScript 5 + Vite 8, sin assets de sprites (todo `generateTexture`) |
| LOC | 5.972 líneas TS en 33 archivos |
| `npm install` / `npm run build` / `npx tsc --noEmit` | ✅ limpios |
| `npx playwright test` | ✅ 5/5 pasan |
| Indexación (`codegraph` + `graphify`) | ✅ inicializada y sincronizada |
| `git status` | limpio (se ignoran `.codegraph/` y `graphify-out/`) |
| Riesgo estructural | **`GameScene` no tiene ciclo de vida de salida** (ver B4) |

El juego es un roguelite de supervivencia en arena: elegís 2 de 5 armas, sobrevivís
oleadas, subís de nivel, gastás monedas en mejoras permanentes. La arquitectura está
bien separada (`core` / `entities` / `systems` / `ui` / `weapons` / `store`), con
`EventBus` y `GameState` previstos… pero hay una brecha grande entre lo que el código
declara y lo que el juego hace.

---

## 1. Bloqueantes — bugs verificados con evidencia

### B1. Te matan obstáculos, no enemigos

Los enemigos se atascan contra los pilares y, mientras empujan sin moverse, siguen
haciendo daño de contacto.

**[verificado]** Partida instrumentada, 56 enemigos vivos al minuto y medio; **28 de
ellos con velocidad completa (110 px/s) y menos de 6 px recorridos en 10 s**, todos
pegados a un pilar. Forzando el caso exacto (spawn alineado con un pilar):

```
pillar at 302,414 (30px) → spawned 302,440 → 12 s después sigue en 302,441
distancia al jugador: 2 px   velocity: 110 px/s   moved: 1 px
```

Cuando el jugador pasa cerca, 3-4 enemigos congelados drenan 10 HP por toque.
En una corrida de ~30 s se midieron **325 eventos de daño / 157,8 HP perdidos**.

Causa: `Phaser.Physics.Arcade.Body.blocked` marca el eje bloqueado, y
`body.velocity` sigue apuntando contra la pared (Phaser solo anula el vector de
posición en `postUpdate`; la velocidad se queda).

**Arreglo propuesto:** separación por ejes en `Enemy.update()` (probar X e Y por
separado, y si un eje está bloqueado, deslizar por el otro) + un timeout de atasco
que empuje al enemigo fuera del pilar. Es ~15 líneas en la clase base `Enemy`.

### B2. El pool de enemigos se desborda y deja enemigos fantasma

`this.enemies = this.physics.add.group({ maxSize: 80 })`.

**[verificado]** Spawneando 200 enemigos por la ruta real del juego:
**200 sprites existen en la escena, solo 80 están en el grupo**, `isFull() === true`.
Los 120 restantes son fantasmas: sprites con física, dibujados en pantalla, que
persiguen al jugador y hacen daño — y que **el juego no puede matar** (los overlaps
de proyectiles solo recorren el grupo) **ni limpiar nunca**.

Peor: con el grupo lleno, `waveManager.triggerHorde()` **igual incrementa el número de
oleada** (se verificó subiendo a oleada 2 sin añadir un solo enemigo). El HUD anuncia
una dificultad que no existe, y los fantasmas acumulados son los que te matan.

### B3. Los proyectiles enemigos atraviesan el muro perimetral y nunca se limpian

`ShooterEnemy.fire()` hace:

```ts
body.onWorldBounds = true;
projectile.once("worldbounds", () => projectile.destroy());
```

En Phaser 4 el evento `worldbounds` lo emite **`World`**, no el GameObject. El
listener del sprite nunca dispara.

**[verificado]** Proyectil en `(1200,100)` a 400 px/s hacia la derecha:
se detiene en `x = 1275` (el muro mide 8 px y empieza en 1272), el evento
`worldbounds` del sprite se emitió **0 veces**, el del mundo **1 vez**, y el
proyectil sigue `active: true` **indefinidamente**.

Escala: cada shooter dispara cada 2,5 s (≈24/min). Con 6 shooters son ≈144
proyectiles/min de basura. El pool es de 30 → se satura en ~13 s. Con el pool lleno,
`group.add()` no hace nada y el círculo recién creado queda **otra vez como fantasma**
(mismo patrón que B2). **[verificado]:** 360 llamadas a `add()` sin efecto.

### B4. Cada partida nueva hereda la anterior (fuga acumulativa, medida)

`GameScene` define `shutdown()` pero **nunca lo registra**: es código muerto.
Al salir de la escena quedan vivos los 2 colliders, los listeners de teclado, el
grupo de obstáculos, la grilla de fondo, los timers de `spawnFireZone`, el
`Graphics` del haz eléctrico, el handler de `resize`, y **la `WaveManager` vieja
con su `spawnTimer` y su `hordeTimer` andando**.

**[verificado]** Contando listeners reales de `scale.on("resize")` a lo largo de
7 partidas encadenadas (debería ser constante):

```
run 1: 8   run 2: 11   run 3: 14   run 4: 17   run 5: 20   run 6: 23   run 7: 26
```

**Crece +3 por partida, monótonamente.** Cada listener viejo se ejecuta en cada
resize → el trabajo se multiplica.

**[verificado]** Tras morir, `run1.spawnTimer !== null` y `run1.hordeTimer !== null`:
la oleada de la partida anterior sigue spawneando enemigos en la nueva.

**[verificado]** Con input **idéntico** (mismo script de movimiento + disparo):
partida 1 → murió a los **24,9 s**; partida 2 → murió a los **14,2 s**.

**[verificado]** Los flags de power-ups en `scene.data` sobreviven a la muerte:
muriendo con `piercing-shots` y `explosion-on-kill` activos, la partida siguiente
arranca con `piercing-shots-active: true` y `explosion-on-kill-active: true`.

**[verificado]** El `Graphics` del haz eléctrico queda huérfano: en la partida 2 la
referencia sigue en `scene.data` con `active: false` y `scene: null`, y **ya no se
vuelve a dibujar aunque uses el arma eléctrica**.

### B5. La progresión no existe: no se puede pasar de ~30 s

Con meta-progresión **cero** (jugador nuevo, que es lo que verá el jurado):

**[verificado]** 4 corridas instrumentadas (incluida una con aimbot que apuntaba solo
al enemigo más cercano y huía cuando se acercaba):

| Corrida | Resultado |
|---|---|
| Aimbot + huida | HP 10/100 a los 30 s, 16 enemigos vivos |
| Aimbot + huida | murió a los 26,7 s |
| Circular + disparo continuo | murió a los 26,7 s |
| Disparo continuo | HP 2/100 a los 30 s |
| Scripted (mismo input que el test de B4) | murió a los 24,9 s |

Todas las corridas terminan con `wave: 1`, `level: 1` — o sea: **el jugador nunca
llega a ver el nivel 2 ni la oleada 2**. La oleada solo avanza a los 25 s **y solo
si seguís vivo**. El horde trae 6-10 enemigos mixtos + 1 tanque de golpe, encima
de los 6-8 que ya hay vagando.
El tanque tiene **80 HP / 20 de daño / 40 px/s**: con Plasma (15 de daño cada 300 ms)
son **5,3 s de disparo perfecto e ininterrumpido** solo para el tanque, mientras los
otros 8 enemigos te comen.

**Diagnóstico:** el juego no es "difícil", es **matemáticamente imposible** en la
configuración inicial. Y como el `waveNumber` solo cuenta hordas, el marcador de
progreso queda clavado en 0 — que es exactamente lo que se ve en las capturas.

### B6. En móvil, Game Over es un callejón sin salida

`GameOverScene` solo escucha teclas: `[R] Restart`, `[M] Menu`, `[S] Shop`
(`keydown-R/M/S`), y dentro de la tienda los hotkeys `1-5` + `ESC`. No hay un solo
botón táctil. **Un jugador de celular queda encerrado en la pantalla de Game Over**,
sin reiniciar, sin menú, sin tienda.

---

## 2. Jugabilidad — decisiones que no funcionan

### J1. La dificultad se calcula y se tira a la basura

`WaveManager.difficultyMultiplier` se asigna y **nunca se lee** (grep: 2
apariciones, ambas en la misma línea). Los enemigos no escalan HP, daño ni
velocidad: a la oleada 20 hay exactamente los mismos chasers de 15 HP que al
segundo 1. La única escalada real es bajar el intervalo de spawn hasta 1.200 ms
y subir el tamaño del horde.

### J2. Un power-up no hace absolutamente nada

`triple-shot` ("Fire 3 projectiles in spread") escribe `triple-shot-active` en
`scene.data` y **nadie lo lee** (verificado por grep en todo `src/`). El jugador
gasta una elección de nivel en una mejora invisible.

`bouncing-shots` sí funciona (1 rebote), pero se ofrece con duración `-1` sin
registro de "ya aplicado": puede salir repetido en la misma partida y no acumula.

### J3. Los i-frames no protegen contra el enjambre

`Player.takeDamage` pone 500 ms de invulnerabilidad, pero el enemigo en contacto
aplica daño en **cada frame de colisión**.

**[verificado]** Tres chasers encima del jugador, 4 s de contacto:
**720 llamadas a `takeDamage` = 180 por segundo**. Con 500 ms de i-frames, una
ventana "correcta" debería dar 2 llamadas por segundo.

**[verificado]** En partida real: 82 eventos de daño (38 HP) en **1,9 s**; 81
eventos (30 HP) en 1,4 s. En una corrida de 30 s, **325 eventos / 157,8 HP**.
El escudo (50) se evapora en el primer contacto y el jugador no alcanza a reaccionar.

**Arreglo propuesto:** el overlap debe resolver el daño una vez por enemigo por
ventana de i-frame (marcar el enemigo como "ya cobrado" durante esa ventana) y
aplicar knockback al enemigo tras el impacto, para que no se quede encima.

### J4. No hay onboarding ni curva de entrada

Lo primero que ve el jugador es "SELECT 2 WEAPONS" con cinco tarjetas y ningún
contexto: nunca tocó el juego, no sabe qué es "Electric" ni "Fire zones". Tampoco
hay tutorial, ni oleada de calentamiento, ni pausa estratégica.

### J5. La progresión no se comunica

La oleada entra sin banner, sin cuenta atrás, sin sonido ni cambio de música. La
subida de nivel abre un panel, pero si el jugador no mira el HUD no hay ninguna
señal de que algo pasó. El único feedback de "estás progresando" es un texto de
11 px.

### J6. La pantalla de elegir armas no informa y filtra código

Las tarjetas muestran nombre + `DMG N` + una frase + **el `id` interno del arma**
(`PlasmaGun`), que el jugador ve escrito dentro de la tarjeta: es una fuga de
código a la UI. Y el dato es engañoso: `Pulse` muestra "DMG 8" cuando cada descarga
son 3 proyectiles = 24 de daño. No hay DPS, cadencia, alcance ni forma del proyectil.

### J7. En móvil, disparar es a toques — mantener el botón no hace nada

`FireButton.consumePressed()` devuelve `true` **una sola vez por pulsación** y
`GameScene.update()` lo consume en un `if`, con el fallback de puntero
(`activePointer.isDown`) en el `else`. En touch, entonces, **mantener el botón
apretado produce exactamente un disparo**; para fuego sostenido hay que tocar
repetidamente.

**[verificado]** Con input real (no sintético), 10 toques rápidos con el arma más
rápida (Pulse, cd 100 ms) → **5 disparos**. Con Grenade (cd 1500 ms) → 1 disparo.
El arma funciona, pero el jugador que "aprieta para disparar" cree que está roto.

**Hipótesis sin verificar:** `VirtualJoystick` reancla su base con cualquier
`pointerdown` de su mitad de pantalla y `FireButton` está en la mitad derecha, así
que apretar FIRE podría mover el joystick de apuntado. No pude reproducirlo con
eventos sintéticos (Phaser no los procesa igual); **hay que probarlo en un
dispositivo real** antes de tocar código.

Lo que sí está **verificado** (test del autor, que corre y pasa): 3 punteros
simultáneos no generan errores de consola.

**Arreglo propuesto:** fuego continuo mientras el botón esté apretado (respetando el
cooldown del arma), y exclusión mutua explícita entre el botón y el joystick
derecho por `pointer.id`.

### J8. En iOS el fullscreen nunca se recupera

`MobileBootstrap` oculta `#fs-prompt` en el primer `pointerup` e intenta
`startFullscreen()`. En iOS Safari esa llamada falla y el elemento HTML queda
oculto para siempre: no hay botón para reintentar y el juego se queda en viewport
(con la barra de Safari comiéndose pantalla).

---

## 3. Visuales

### V1. El HUD se pisa a sí mismo (medido)

`[MUTE]` está anclado arriba a la derecha con `origin(1, 0)`; el contador de XP de
nivel (`killsLabel`) usa `RT_X + RT_W - 8` con `origin(1, 0)`: **la misma esquina**.

**[verificado, bounds reales de los `Text`]:**

| Canvas | `[MUTE]` (x–right) | `n/req` (x–right) | Solape |
|---|---|---|---|
| 1280×800 | 1230 – 1270 | 1242 – 1262 | **20 px** |
| 1920×1080 | 1843 – 1905 | 1862 – 1893 | **31 px** |
| 1024×768 | 983 – 1016 | 993 – 1010 | **17 px** |
| 667×375 (móvil) | 633 – 662 | 643 – 658 | **15 px** |

Siempre > 0: los dos textos se dibujan encima, en todas las resoluciones.

### V2. Los colores "de neón" casi no se ven

`GAME.BG_COLOR = #0a0a0f` con una grilla a **alpha 0,03**. Los "neones" del HUD
usan cyan `#00ffff` y magenta `#ff00ff` con strokes a alpha 0,6 sobre el mismo
fondo oscuro. En las capturas el resultado es un lienzo casi negro con bordes
tenues: la estética se lee como "prototipo vacío", no como "cyberpunk". El
contraste está, pero la **densidad de color** es mínima.

### V3. Los enemigos son tres círculos generados por código

`generateEnemyTextures()` produce: círculo rojo con triángulo blanco (chaser),
círculo amarillo (shooter), círculo magenta (tank). Sin animación, sin dirección
legible (el chaser rota, pero un círculo rotando no comunica nada), sin
telegrafía de disparo. Los tres comparten forma; solo cambia el color y 12 px de
tamaño. En el móvil (escala 0,45) eso los vuelve casi indistinguibles.

### V4. La arena no da sensación de espacio

El mundo es `max(1280, viewport) × max(960, viewport)`. En un canvas de 1280×800
el scroll es **`0,0` permanente**: no hay desplazamiento vertical, solo 160 px
ocultos. La cámara "que sigue al jugador" nunca se mueve. En 1920×1080 el mundo
crece al viewport exacto → **0 px de scroll**.

Los objetos son: borde magenta de 8 px, pilares de 24-32 px (relleno `#0a0a18` +
borde cyan + rombo magenta interior) y una grilla. Es literalmente un rectángulo
con cajas.

### V5. Cero juice

No hay: números de daño, flash al impactar, knockback, screen shake, partículas
de muerte, hitstop, ni sonido de impacto. La muerte de un enemigo es un fade de
200 ms. El único efecto es una estela de círculo por disparo. En un roguelite de
supervivencia, el "juice" **es** la recompensa; sin él matar no se siente.

### V6. El menú y el Game Over son pantallas de texto

Sin logo, sin animación, sin preview de armas, sin estadísticas de la corrida
(destruidos, tiempo, precisión), sin historial. El fondo es negro plano (captura
del menú: solo "NEON DRIFT" + "Tap to play").

---

## 4. Deuda técnica que hay que limpiar antes de tunear

| Hallazgo | Evidencia |
|---|---|
| **`Constants.ts` es un decorado**: exporta 21 bloques, solo `GAME` y `LAYOUT` se importan. Editar `PLAYER.HP` o `ENEMY.CHASER.hp` **no cambia nada** — los valores reales están hardcodeados en las clases | grep de imports: 19/21 bloques sin un solo consumidor |
| **`GameState.ts` es código muerto**: singleton con `reset()` que nadie usa | 0 referencias fuera de su propio archivo |
| **`EventBus` emite al vacío**: `SPECTACLE_ENTRANCE / ACTION / HIT` se emiten y **no hay un solo `on()`** | el sistema "spectacle" no existe |
| **`shutdown()` nunca se ejecuta** | B4 |
| **`Enemy.LOOT_COINS_*`, `HEAL_CHANCE`, `HEAL_AMOUNT`, `WEAPON.*`, `MAP.*`, `WAVE.*`** | duplicados de valores hardcodeados en `Enemy.dropLoot()`, `WaveManager`, `Gun.*` con **valores divergentes** (ej. `MAP.WALL_THICKNESS: 8` vs `MapGenerator.WALL_THICKNESS = 8` está bien, pero `WAVE.HORDE_INTERVAL_MS: 25_000` convive con `hordeIntervalMs = 25_000` como campo privado) |
| Bundle único de 1,44 MB (376 kB gzip) con warning de Vite | warning del build |
| Sin `lint` script en `package.json` | `npm run` solo tiene `dev/build/preview` |

---

## 5. Hoja de ruta propuesta

### Fase A — Correcciones (sin esto, lo demás no se puede evaluar)

| # | Cambio | Criterio de aceptación |
|---|---|---|
| A1 | Ciclo de vida de `GameScene`: registrar `shutdown` en `create()` | 2ª partida idéntica a la 1ª (mismo tiempo de supervivencia con mismo input) |
| A2 | Overlaps: resolver el daño una vez por enemigo por ventana de i-frame (y no 80 veces) | medir HP perdido/segundo con N enemigos encima y que sea ≈ N × daño / 0,5 s |
| A3 | Limpiar proyectiles enemigos con `worldbounds` del **mundo** (o culling por bounds) | 0 proyectiles `active` fuera del mundo tras 60 s |
| A4 | Nunca crear sprites fuera del pool: `if (group.isFull()) return;` antes de instanciar, o subir el pool y agregar despawn | 0 sprites de enemigo fuera del grupo tras 120 s |
| A5 | Anti-atasco de enemigos (separación por ejes + timeout) | ningún enemigo con `speed > 20` y `< 12 px` de desplazamiento en 5 s |
| A6 | Balance del arranque: primer horde más chico, tanque con menos HP o más tarde, HP/daño del jugador ajustados | un jugador nuevo (meta 0) llega **al menos a la oleada 3** con input razonable |
| A7 | Botones táctiles en `GameOverScene` (Restart / Menu / Shop) y pausa táctil en `GameScene` | jugar una partida completa solo con toques |

### Fase B — Jugabilidad

| # | Cambio |
|---|---|
| B1 | Aplicar de verdad `difficultyMultiplier`: HP, daño y velocidad escalan por oleada (+ telegrafía visual al escalar) |
| B2 | Arreglar `triple-shot` o reemplazarlo por un power-up real; evitar repetir `bouncing-shots` |
| B3 | Power-ups que cambien el *cómo* jugás, no solo números (cadena de explosiones, torreta, drenaje de escudo → daño) |
| B4 | Curva de entrada: oleada 0 de calentamiento (2-3 enemigos lentos) + banner de oleada + cuenta atrás |
| B5 | Tarjetas de arma con DPS real, cadencia, alcance y mini-preview del proyectil; sacar el `id` de la UI |
| B6 | Tienda fuera del Game Over (accesible desde el menú) + previsualización del efecto |
| B7 | Recompensas por oleada (elegir 1 de 3 al sobrevivir una oleada, no solo por kills) |

### Fase C — Visuales y juice

| # | Cambio |
|---|---|
| C1 | Arreglar el solape `[MUTE]` / contador XP (medido en V1) |
| C2 | Sprite sheet de sprites reales (o al menos siluetas direccionales: nave, dron, tanque hexagonal) con animación de 2-4 frames |
| C3 | Juice: números de daño, flash de impacto, knockback, screen shake proporcional al daño recibido, partículas de muerte, hitstop de 40 ms al matar al tanque |
| C4 | Arena con identidad: texturas de piso por zona, límites con vallas luminosas, props decorativos, segundo tipo de obstáculo (destructible) |
| C5 | Agrandar el mundo respecto del viewport (ej. 1,6×) para que la cámara realmente siga al jugador y haya exploración |
| C6 | Menú con logo animado, preview de arma, y Game Over con estadísticas de la corrida (tiempo, destruidos, mejor oleada, precisión) + historial de mejores corridas |
| C7 | Música reactiva a la intensidad (la base ya está: 4 tracks de batalla) y SFX de impacto/level-up |

### Fase D — Limpieza

| # | Cambio |
|---|---|
| D1 | Fuente única de verdad: mover `Constants.ts` a valores reales **o** consumirlo de verdad. Elegir una y no dejar las dos |
| D2 | Borrar `GameState.ts` (o usarlo) y el sistema `SPECTACLE_*` (o implementarlo) |
| D3 | Script `lint` + `typecheck` en `package.json`; agregar al CI |
| D4 | Code-split del bundle de Phaser para bajar el warning de 1,44 MB |

---

## 6. Lo que NO voy a tocar

Según las reglas de la Fase 2 (`FASE2.md`): no cambio la mecánica central
(roguelite de supervivencia en arena con 2 armas y meta-progresión), no borro ni
renombro archivos del autor, y trabajo **solo** dentro de `participantes/jpyunism/`.

Los archivos de `openspec/` y `.agents/skills/` del autor se respetan tal cual:
son su proceso, no código del juego.
