# LevelUpMenu mobile + dev hotkey U

Fecha: 2026-08-02
Alcance: `participantes/abomdev/` (Fase 2)
Estado: propuesta validada con el usuario, pendiente de plan de implementación

## Resumen

Tres cambios al menú de level-up y al HUD para que el juego sea usable en
portrait/tablet y para que se pueda probar sin farmear XP:

1. **Hotkey `U` (debug temporal)** — abre y cierra el menú simulando un level-up
   con las mismas choices reales. Aislada detrás de un flag `LEVEL_UP_DEBUG_KEY`
   en `src/config/constants.js` para borrarla en una sola línea.
2. **Compact real** — la heurística `isCompactMode()` no se activa en portrait de
   tablet (ej. 768×1024), por lo que las cards 2×2 gigantes tapan al HUD. El
   branch compact pasa a usar una heurística explícita dentro de `LevelUpMenu`
   que captura portrait independientemente del ancho absoluto.
3. **Grilla 2×2 derivada del viewport en compact** — en lugar de los tamaños
   fijos del desktop (320×150), las cards se redimensionan para que las 4
   entren en pantalla respetando el ancho del viewport. Además el HUD se
   atenúa a 0.4 mientras el menú está abierto para legibilidad.
4. **Esconder pista WASD/Flechas en mobile** — el `hint` del menú principal
   (`MenuScene.js`) menciona controles de teclado que no aplican en táctil.
   Si `isTouchDevice()` es true, se reemplaza por una pista móvil
   (`Joystick para moverte · ESC: pausa`) o se oculta directamente.

## Goals / Non-Goals

**Goals**
- En portrait (incluido tablet 768×1024), el menú muestra 1 card por vez sin
  tapar el HUD.
- En landscape desktop, comportamiento actual intacto.
- Tecla `U` abre/cierra el menú con choices reales (rarity-weighted, no
  pre-seleccionadas a favor del tester).
- HUD atenuado a `0.4` mientras el menú está abierto, restaurado a `1.0` al
  cerrar.
- El cambio de la hotkey está aislado para retirada limpia.

**Non-Goals (este PR)**
- Animaciones de slide horizontal entre cards (queda para Fase 3 si se desea).
- Reordenar los `STAT_UPGRADES` o `WEAPON_UPGRADES`.
- Tocar el algoritmo de `pickWeighted` o `getAvailableUpgrades`.
- Soporte de mouse drag para el carrusel (swipe horizontal sí; mouse drag no).
- Internacionalización de la palabra "DEBUG" en consola.

## Diseño

### 1. Hotkey `U` (debug)

**Archivo nuevo:** `LEVEL_UP_DEBUG_KEY = true` en `src/config/constants.js`.

```js
// constants.js (extracto)
export const LEVEL_UP_DEBUG_KEY = true;
```

**Registro** en `GameScene.create()`:

```js
if (LEVEL_UP_DEBUG_KEY) {
  this.input.keyboard.on('keydown-U', () => this._debugToggleLevelUp());
}
```

**Nuevo método en `GameScene`:**

```js
_debugToggleLevelUp() {
  if (this.isPaused || this.endReason || this.isLevelingUp && !this._debugLevelUpOpen) {
    return;
  }
  if (!this.isLevelingUp) {
    this.startLevelUp();
    this._debugLevelUpOpen = true;
  } else {
    this.chooseUpgrade(0);
    this._debugLevelUpOpen = false;
  }
}
```

Decisiones:
- Solo se registra si `LEVEL_UP_DEBUG_KEY` es `true` (un solo lugar para quitar).
- Bloquea en pause, end screen, o level-up real ya en curso (la flag
  `_debugLevelUpOpen` distingue un level-up abierto por debug vs por XP/boss).
- Al cerrar, elige el índice 0 (placeholder razonable). Esto **aplica** la
  primera choice, igual que si el jugador la hubiera elegido a mano. Si
  querés que el toggle sea puro (sin aplicar mejora), cambiamos a
  `this.chooseUpgrade` noop wrapper — pero el comportamiento actual es el más
  útil para probar el ciclo entero.
- La tecla funciona en landscape y portrait, no diferencia mobile.

**Riesgo y rollback:** poner `LEVEL_UP_DEBUG_KEY = false` borra la hotkey
sin tocar código de runtime. Cero impacto en bundle.

### 2. Compact real

**Heurística nueva** en `src/ui/layout.js`:

```js
export function shouldUseCompactLevelUp(w, h) {
  return w < 720 || h < 480 || h > w * 1.2;
}
```

- Portrait puro: `h > w * 1.2` se cumple sí o sí.
- Tablet 768×1024: `1024 > 768 × 1.2 = 921.6` → true → carrusel. Eso
  arregla la captura del bug que reportaste.
- Landscape desktop (1280×720): `1280 < 720` false, `720 < 480` false,
  `720 > 1280 × 1.2 = 1536` false → false → grilla 2×2 (intacto).
- Móvil portrait angosto (375×667): los tres true → carrusel.

**Uso en `LevelUpMenu.layout(w, h)`:**

```js
layout(w, h) {
  const compact = shouldUseCompactLevelUp(w, h);
  // ... resto del método, igual que ahora pero con esta señal.
}
```

No modificamos `isCompactMode()`: otros widgets ya pasan por ese helper y no
queremos acoplar su comportamiento.

### 3. Carrusel 1-card en compact

**Estado interno nuevo en `LevelUpMenu`:**

```js
this.mode = 'grid'; // | 'carousel'
this.activeIndex = 0;
this.leftArrow = ...;
this.rightArrow = ...;
this.dots = [...];
```

**Comportamiento:**

- En modo `grid` (current): 4 cards visibles en 2×2.
- En modo `carousel`: solo `cards[activeIndex]` visible, arrows y dots visibles.
- Tap en left/right arrow → `activeIndex = (activeIndex - 1 + 4) % 4`,
  re-render.
- Swipe horizontal (`pointermove` con delta > 60 px) → mismo efecto.
- Teclas `1`-`4` → elegir la card N-ésima (elegir implica ocultarla y aplicar
  el upgrade via `onChoose`).
- Tap directo sobre la card visible → elegirla.

**Switch de modo durante resize:**

- Si pasa de `grid → carousel` mientras el menú **no** está abierto: solo se
  reposicionan los elementos, no hay parpadeo.
- Si pasa de `carousel → grid` mientras el menú **está** abierto: las 4 cards
  vuelven a verse. `activeIndex` se reinicia a 0 para no dejar el cursor
  apuntando fuera.

**Render del card activo (carousel):**

- Una sola card, ancho = `w - 24`, alto = `min(CARD_H + 20, h * 0.22)`.
- Tag de rarity arriba a la derecha (igual que ahora).
- Número grande `2 / 4` arriba, en el centro (debajo del título).
- Icono a la izquierda, label (`describe()`) a la derecha, con `wordWrapWidth`
  adaptativo al ancho disponible.

**Atenuación del HUD:**

- En `startLevelUp()`: `this.hud.setAlpha(0.4)`.
- En `chooseUpgrade()` (cuando aplica la mejora): `this.hud.setAlpha(1)`.
- Si `chooseUpgrade` se invoca por cancelación (no aplica), restaurar igual
  a 1.

### 4. Esconder/adaptar la pista de teclado en mobile

**Estado actual:** `src/scenes/MenuScene.js:68` muestra
`'WASD / Flechas para moverte · ESC: pausa · F: pantalla completa'`. En un
dispositivo táctil sin teclado físico esa línea confunde: el jugador no tiene
forma de mover con WASD.

**Cambio en `MenuScene.create()`:**

```js
const isMobile = isTouchDevice();
const hintText = isMobile
  ? 'Joystick para moverte · ESC: pausa'
  : 'WASD / Flechas para moverte · ESC: pausa · F: pantalla completa';
this.hint = text(this, hintText, { ... });
```

Decisiones:
- Usar el `isTouchDevice()` existente (`src/utils/device.js`), mismo helper
  que ya decide mostrar el botón "Pantalla completa".
- Mantener `ESC: pausa` en ambas pistas: muchos móviles aceptan teclado
  bluetooth y no queremos perder esa pista.
- Quitamos `F: pantalla completa` en móvil porque en touch ya se ofrece el
  botón dorado dedicado.
- No tocar el `hint` dentro de `LevelUpMenu` (las teclas `1-4` siguen siendo
  válidas — son atajos extra al carrusel/tap).

**Riesgo y rollback:** cambiar el ternario a la versión desktop-only
restaura el comportamiento previo. Cero impacto en bundle.

### Archivos a tocar

| Archivo | Cambio |
|---|---|
| `src/config/constants.js` | Agregar `LEVEL_UP_DEBUG_KEY = true` |
| `src/scenes/GameScene.js` | Registrar `keydown-U`, agregar `_debugToggleLevelUp`, atenuar HUD en `startLevelUp` / restaurar en `chooseUpgrade` |
| `src/scenes/MenuScene.js` | Branch de `hint` con `isTouchDevice()` (mobile vs desktop) |
| `src/ui/layout.js` | Agregar y exportar `shouldUseCompactLevelUp(w, h)` |
| `src/ui/LevelUpMenu.js` | Refactor `layout()` con modo carousel/grid, flechas, dots, swipe |
| `src/ui/Hud.js` | Exponer `setAlpha(value)` (probablemente ya existe vía Phaser Container; confirmar) |

### Tests

- `src/ui/layout.test.js`: extender con casos de `shouldUseCompactLevelUp`
  (portrait, landscape, tablet, angosto).
- `src/ui/panels.test.js`: agregar test que verifica que el renderer del
  carrusel produce las strings correctas (`'2 / 4'`) en modo compact.
- Si `setAlpha` no existe en `Hud`, agregarlo sin test (es trivial set de una
  property de Container).

Para el cambio #4 (`hint`), no agrego test nuevo: `MenuScene` requiere Phaser
y la guía actual del repo desaconseja tests E2E con Phaser. La verificación
queda en manual.

### Verificación manual

1. `npm run dev`, abrir `http://localhost:5173/participantes/abomdev/`.
2. Iniciar juego, mover al personaje, apretar `U`. Aparece el menú 2×2.
3. Cambiar a mobile en DevTools (iPhone SE: 375×667). Apretar `U`. Aparece
   el carrusel con flechas y dots. Tocar flechas o swipe. Elegir una card.
4. Verificar que el HUD se atenúa al abrir y se restaura al cerrar.
5. Resize de mobile → desktop con el menú abierto: las 4 cards reaparecen.

### Riesgos y notas para Fase 3

- El swipe horizontal puede chocar con el joystick virtual (cubre la mitad
  izquierda o derecha según `touchLayout`). En Fase 3 se puede excluir el
  área del hot zone del swipe.
- Si el ancho del viewport es muy chico (< 360 px), el `wordWrapWidth` del
  label puede seguir apretado. Validar visualmente y bajar el `FONT_SIZE.body`
  para mobile compacto (queda fuera de este PR).
- Esta hotkey **no está pensada para producción**. Dejarla activa es
  intencional por ahora; cuando se retire, basta con `LEVEL_UP_DEBUG_KEY = false`.

### Cómo revertir

- Hotkey: cambiar `LEVEL_UP_DEBUG_KEY` a `false`.
- Compact real: borrar la rama `if (mode === 'carousel')` en `LevelUpMenu`
  y la función `shouldUseCompactLevelUp`.
- HUD atenuado: borrar las dos llamadas `setAlpha` en `GameScene`.