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

### B1. Los enemigos NO se atascan en los pilares (hipótesis propia, refutada)

Mi primera medición sugería enemigos congelados con velocidad completa. **La
verifiqué mejor y era falsa**, y lo dejo escrito porque es más importante decirlo
que salvar la hipótesis.

La medición original contaba 28 enemigos "con velocidad 110 px/s y menos de 6 px
recorridos en 10 s". Al revisar los datos crudos, esos 28 estaban a **0-4 px del
jugador** (no en un pilar) y a **220 px del obstáculo más cercano**: eran cuerpos
apilados sobre el jugador, que el `setVelocity` re-resuelve cada frame.

Test dirigido después: **72 enemigos sembrados contra 24 pilares** (en arco denso del
lado del jugador, a 14/22/34 px del borde, con el jugador inmóvil al otro lado),
16 muestras a lo largo de 8 s:

```
totalTested: 72   stuckOnPillar: 0   reachedPlayer: 42
```

**Cero atascos.** `physics.moveTo()` re-fija la velocidad en cada frame, así que
Phaser desliza al enemigo por el borde del pilar y lo rodea. El desplazamiento por
ejes que iba a implementar **no hace falta**: no arreglaría nada.

Descartado. No entra en la Fase A.

### B2. El pool de enemigos se desborda y deja sprites fantasma (real, pero cosmético/perf)

`this.enemies = this.physics.add.group({ maxSize: 80 })`. **[verificado]** Usando la
ruta real de spawn: **200 sprites en escena, 80 en el grupo**, `isFull() === true`.
Los 120 extra quedan creados y dibujados, pero fuera del grupo.

**Corrección a mi informe anterior:** dije que esos fantasmas "te persiguen, te hacen
daño y el juego no puede matarlos". Lo medí y **el daño es 0**: el overlap
`player ↔ enemies` recorre el **grupo**, así que un sprite fuera del grupo no puede
colisionar.

**[verificado]** Puse un fantasma exactamente encima del jugador durante 4 s:
`damageFromGhost: 0`, HP 100 → 100.

Lo que sí queda en pie:

- Los fantasmas **sí se dibujan y sí ejecutan su `update()`** (persiguen) porque siguen
  en la display list. El jugador ve enemigos que no puede matar: confuso, y son
  sprites y física gratis cada frame (~120 objetos).
- `triggerHorde()` **incrementa el número de oleada aunque no pueda añadir nada**: el
  HUD anuncia dificultad inexistente.
- Con una partida real **competente** el grupo se mantiene en 6-14 de 80: **no se
  satura en juego normal**. Solo se dispara con spawns fuera de rango.

**Reclasificado a calidad**: no es un bug de gameplay, es basura visual + deuda. Va a
Fase B, no a Fase A. El arreglo sigue siendo barato: `if (group.isFull()) return;`
**antes** de instanciar.

### B3. Los proyectiles enemigos se congelan en el muro y nunca se liberan (el peor de todos)

`ShooterEnemy.fire()` hace:

```ts
body.onWorldBounds = true;
projectile.once("worldbounds", () => projectile.destroy());
```

En Phaser 4 el evento `worldbounds` lo emite **`World`**, no el GameObject. El
listener del sprite nunca dispara.

**[verificado]** Proyectil a 400 px/s hacia la derecha: se detiene en `x = 1275` (el
muro empieza en 1272) con `vx = 0` y **sigue `active: true` durante los 12,5 s del
test**, sin desaparecer nunca. El evento del sprite se emitió 0 veces; el del mundo, 1.

**[verificado] Este es el hallazgo con consecuencia de gameplay real, y es peor de lo
que escribí:**

| Medición (70 s de juego con un jugador inmortal) | Valor |
|---|---|
| Disparos que entraron al grupo | 100 |
| Proyectiles vivos al terminar | **19** |
| De esos, congelados en el muro | **16** |
| Tamaño del pool | 30 |

Es decir: **el ~84 % de los proyectiles vivos están pegados al muro acumulando basura**,
y en 70 s el pool quedó al 63 % (19/30) solo porque el jugador estaba quieto. El pool
es de 30: con un jugador que se mueve por la arena la saturación llega antes.

Y cuando el pool se llena, `group.add()` **no hace nada** y el círculo recién creado
queda como sprite huérfano (mismo patrón que B2). **[verificado]:** 360 llamadas a
`add()` sin efecto.

**Arreglo:** escuchar `worldbounds` en `this.physics.world` (que sí emite) o, más
robusto, culling por bounds en el `update()` de la escena. Va en Fase A.

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

**Diagnóstico (corregido):** no sé si el juego es "matemáticamente imposible". Cinco
corridas todas en `wave 1` es un resultado consistente y preocupante, pero **no medí
cuántas de esas corridas fallaron por balance y cuántas por los bugs de la sección 1**
(B3 acumulando proyectiles trabados, B4 filtrando estado). Las dos hipótesis siguen
abiertas:

1. **Falta de margen de reacción**: 6-10 enemigos + 1 tanque caen de golpe a los 25 s
   sobre un jugador con 100 HP y 50 de escudo.
2. **Los bugs dominan**: el pool de proyectiles se satura y el estado filtrado degrada
   la partida antes de que el balance importe.

**No se puede decidir con los bugs puestos.** Por eso la Fase A no trae cambios de
balance: trae los arreglos, y **después** se vuelve a medir. Si con los bugs corregidos
las corridas siguen terminando en `wave 1`, entonces sí es balance.

### B6. En móvil, Game Over es un callejón sin salida

`GameOverScene` solo escucha teclas: `keydown-R`, `keydown-M`, `keydown-S`, más los
hotkeys `1-5` y `ESC` dentro de la tienda. No hay un solo elemento `setInteractive()`.

**[verificado]** En un contexto táctil, leyendo los `Text` reales de la escena y
tocándolos en sus coordenadas:

```
labels: ["GAME OVER", "Wave reached: 0", "Level reached: 1", "Coins this run: 0",
         "Total coins: 0", "[R] Restart", "[M] Menu", "[S] Shop", "Tip: ..."]
tap "[R] Restart" → interactive: false → GameOverScene → GameOverScene  (sin cambio)
tap "[M] Menu"    → interactive: false → GameOverScene → GameOverScene  (sin cambio)
tap "[S] Shop"    → interactive: false → GameOverScene → GameOverScene  (sin cambio)
```

**Un jugador de celular queda encerrado en la pantalla de Game Over**: sin reiniciar,
sin menú, sin tienda. Es el único hallazgo que deja el juego **injugable** en móvil,
y por eso va primero en la Fase A.

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

### J3. El daño por contacto no respeta los i-frames como debería

`Player.takeDamage` pone 500 ms de invulnerabilidad, pero el enemigo en contacto
llama a `takeDamage` en **cada frame de colisión**.

**[verificado]** Tres chasers apilados encima del jugador durante 4 s:
**720 llamadas a `takeDamage` = 180 por segundo**. Con 500 ms de i-frames, la cuenta
de *llamadas* correcta sería 2 por segundo (8 en 4 s), no 180.

El guard de invulnerabilidad sí descarta la mayoría de esas 720 llamadas, así que el
daño neto no es 30× lo esperado — pero la arquitectura es la equivocada: en vez de
"un golpe por enemigo cada 500 ms", el juego hace 720 chequeos para aplicar ~2 golpes.
Y cuando hay un enjambre encima, las ventanas se solapan entre enemigos y el jugador
recibe daño continuo en lugar de en pulsos discretos.

**Arreglo propuesto:** resolver el daño por **enemigo** (una vez por enemigo por
ventana de i-frame, con marca de "ya cobrado" en el propio enemigo) y aplicar
knockback tras el impacto, para que no se quede encima. Eso convierte 720 llamadas en
las 2/s correctas y hace el daño legible.

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

### Fase A — Correcciones (COMPLETADA)

Sin esto, cualquier medición de dificultad estaba contaminada. El orden fue por
gravedad, y al terminar se re-midió el balance (A6) — con un resultado que cierra la
pregunta que había quedado abierta en B5.

| # | Cambio | Criterio de aceptación | Estado |
|---|---|---|---|
| A1 | **Botones táctiles en `GameOverScene`** (RESTART / MAIN MENU / SHOP) + filas de tienda tocables + botón CLOSE + pausa táctil `II` en `GameScene` | los 3 botones son interactivos y el tap cambia de escena | ✅ verificado por test |
| A2 | Ciclo de vida: registrar `Phaser.Scenes.Events.SHUTDOWN` en las **3 escenas** | listeners de `resize` constantes entre partidas; flags de power-ups limpios; colliders estables | ✅ verificado por test |
| A3 | Proyectiles: culling por bounds en `update()` | 0 proyectiles trabados en el muro | ✅ verificado por test |
| A4 | `if (group.isFull()) return;` **antes** de instanciar (enemigos y proyectiles) | 0 sprites fuera de su grupo | ✅ aplicado |
| A5 | Overlaps: daño una vez por ventana de i-frame + knockback de 180 ms con deslizamiento por ejes | ~8 golpes reales en 4 s (antes 720 llamadas) | ✅ verificado por test |
| A6 | Re-medición del balance con los bugs corregidos | ver la tabla de abajo | ✅ medido |

**Descartado de la Fase A:** el anti-atasco de enemigos (B1) — no existía el problema
(0 de 72 enemigos contra 24 pilares).

#### A6 — El balance NO era el problema (medición pre/post)

Corridas con **perfil limpio** (meta-progresión cero, como un jurado que abre el juego
por primera vez) y el mismo input scripted competente (apunta al enemigo más cercano,
dispara sostenido, kitea cuando algo se acerca a 190 px):

| | Supervivencia | Oleada máx. | Nivel máx. | ¿Llegó a Game Over? |
|---|---|---|---|---|
| **Antes** (5 corridas) | 24,9 / 26,7 / 26,7 / ~30 / ~30 s | **1** | **1** | sí, todas |
| **Después** (4 corridas) | 67,6 / 116,1 / 45,0 / 120,1 s | **4** | **8** | sí, todas |

Todas las corridas post-fix terminan en Game Over con 2-6 HP: el juego sigue siendo
exigente, pero ahora **la progresión existe** (nivel 8, oleada 4) en vez de estar
clavada en `wave 1 / level 1`.

Poder de juego medido: **2,6× más supervivencia promedio** (27,7 s → 87,2 s) y el tope
de progresión pasó de nivel 1 a nivel 8, de oleada 1 a oleada 4. **Sin tocar una sola
cifra de balance**: los únicos cambios fueron los arreglos de A1-A5.

La hipótesis 2 de B5 ("los bugs dominan") queda **confirmada**: los power-ups
invisibles de B4 (buffos heredados de la partida anterior), los proyectiles trabados de
B3 y el daño continuo de J3 eran lo que hacía imposible progresar.

**Por eso la Fase B puede empezar por el contenido (J1-J8) y no por el balance.** Si en
el futuro hace falta subir o bajar dificultad, ahora hay una línea base medible.

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
