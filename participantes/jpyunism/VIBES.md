# VIBES — Fase 2 sobre Neon Drift

Lo que pide `FASE2.md`: qué cambié, qué quedó frágil y qué no alcancé a hacer.

## Cómo llegué

Recibí Neon Drift y, antes de tocar una línea, lo instrumenté: monté sondas sobre el
runtime de Phaser 4 (Playwright + evaluación dentro del juego) y medí. El informe
completo, con cada medición, está en `docs/ANALISIS-MEJORAS.md`.

Ese documento incluye **una hipótesis mía que resultó falsa** (B1: "los enemigos se
atascan en los pilares" — probé 72 enemigos contra 24 pilares y ninguno se atascó). Lo
dejé escrito porque corregirme a mí mismo vale más que defender el diagnóstico.

## Qué cambié (Fase A — correcciones, sin tocar el balance)

Solo arreglé bugs. **No moví una sola cifra de dificultad, velocidad, HP o daño.**

1. **Controles táctiles** (`src/ui/TouchButton.ts`, nuevo). Game Over solo escuchaba
   teclas `R`/`M`/`S`: en un teléfono el juego quedaba **encerrado** después de la
   primera partida. Ahora hay botones RESTART / MAIN MENU / SHOP, las filas de la
   tienda son tocables, hay un CLOSE explícito y un botón `II` para pausar.
2. **Ciclo de vida de las escenas.** `GameScene` / `MenuScene` / `GameOverScene`
   tenían un `shutdown()` que **Phaser nunca llamaba** (Phaser 4 no invoca `shutdown`
   por nombre: solo emite el evento `SHUTDOWN`). Cada partida filtraba +3 listeners de
   `resize`, sus colliders, la `WaveManager` vieja con sus timers, y los flags de
   power-ups en `scene.data` (muriendo con `piercing-shots` activo, la partida
   siguiente arrancaba con el buff).
3. **Proyectiles enemigos** (`ShooterEnemy`). Dependían de un evento `worldbounds` que
   en Phaser 4 emite el **mundo**, no el sprite — nunca disparaba. El proyectil se
   quedaba congelado contra el muro para siempre (medido: 16 de 19 vivos, trabados en
   la pared, llenando un pool de 30). Ahora se limpian por bounds en `update()`.
4. **Sprites fuera del pool.** `group.add()` sale sin hacer nada cuando el grupo está
   lleno, así que crear primero y agregar después dejaba enemigos fantasma. Ahora se
   chequea `isFull()` **antes** de instanciar. También: la oleada ya no incrementa su
   contador si no pudo aportar enemigos.
5. **Daño de contacto con i-frames reales + knockback.** El overlap llamaba a
   `takeDamage` en cada frame de contacto y cada llamada renovaba la invulnerabilidad:
   3 enemigos encima producían **720 llamadas en 4 s** (180/s) y daño continuo. Ahora
   el golpe se resuelve una vez por ventana de i-frame (8 golpes reales en 4 s) y el
   enemigo recibe un empujón de 180 ms que las subclases respetan.

### El resultado que importa

Re-medí el balance con los bugs corregidos, **sin cambiar dificultad**:

| | Supervivencia | Oleada máx. | Nivel máx. |
|---|---|---|---|
| Antes | 24,9 / 26,7 / 26,7 / ~30 / ~30 s | 1 | 1 |
| Después | 67,6 / 116,1 / 45,0 / 120,1 s | 4 | 8 |

El juego sigue matándote (todas las corridas terminan en Game Over con 2-6 HP), pero
**ahora la progresión existe**. El problema nunca fue el balance: eran los bugs.

## Tests

`test-phase-a.spec.ts` — 4 tests de regresión, uno por bug arreglado. Suite completa:
**9/9 en verde** (5 tests originales del autor + 4 nuevos).

`src/main.ts` ahora expone `window.__game`. Es una costura para los tests: sin eso,
Playwright solo puede mirar el canvas y no puede afirmar nada sobre el gameplay.

## Qué quedó frágil

- **El knockback es una supresión por tiempo, no física.** `Enemy.startKnockback()`
  apaga el steering durante 180 ms. Funciona, pero si en el futuro una subclase deja de
  llamar a `isKnockedBack(time)` en su `update()`, el empujón se pierde sin error.
- **El botón FIRE sigue siendo de un disparo por toque** (`consumePressed()`), así que
  mantenerlo apretado no da fuego sostenido. No lo cambié porque no pude reproducir en
  emulación si además mueve el joystick de apuntado, y no quise arreglar a ciegas algo
  que no verifiqué en un dispositivo real. **Es lo primero que probaría en un teléfono.**
- **El pool de enemigos sigue en 80** con el culling arreglado. Con juego competente
  nunca pasa de 14, así que el techo no molesta, pero sigue ahí.
- **No agregué tests para el botón de pausa `II`** ni para las filas de la tienda:
  cubrí Game Over (el caso que dejaba el juego muerto) y me faltó el resto del flujo
  táctil.
- **Música/audio**: `AudioManager` se destruye bien en `shutdown`, pero no verifiqué el
  cross-fade entre escenas con audio real (el entorno de test no reproduce sonido).

## Qué sueños no alcancé

Todo esto es Fase B/C, y está detallado en `docs/ANALISIS-MEJORAS.md`:

- **`difficultyMultiplier` no hace nada.** Se calcula y nunca se lee: a la oleada 20
  hay exactamente los mismos chasers de 15 HP que al segundo 1.
- **`triple-shot` es una mejora invisible**: escribe una flag en `scene.data` que nadie
  lee. Quien la elige gasta una subida de nivel en nada.
- **Cero *juice*.** Sin números de daño, flash de impacto, screen shake, partículas de
  muerte ni sonido de impacto. En un roguelite de supervivencia, el juice **es** la
  recompensa.
- **La arena no da sensación de espacio**: en 1280×800 el scroll es `0,0` permanente.
- **Cero onboarding**: lo primero que ves es "SELECT 2 WEAPONS" sin haber jugado nunca.
- **`Constants.ts` es decorado**: exporta 21 bloques, solo 2 se importan. Editar
  `PLAYER.HP` no cambia nada — los valores reales están hardcodeados en las clases.
  (Parcialmente abordado: `ENEMY.KNOCKBACK_*` sí se usa.)
- **Tarjetas de arma que filtran código**: muestran el `id` interno (`PlasmaGun`) al
  jugador y un "DMG 8" que ignora que Pulse dispara 3 proyectiles.

## Reglas de la Fase 2

- Trabajé **solo** dentro de `participantes/jpyunism/`.
- **No borré ni renombré** nada del autor. Todo lo nuevo es aditivo.
- **No cambié la mecánica central** ni una sola cifra de balance.
- Leí su `AGENTS.md`, respeté su convención de `Constants.ts` (los números nuevos van
  ahí), su estilo de comentarios y su estructura de carpetas.
- `openspec/` y `.agents/skills/` del autor quedaron intactos.
