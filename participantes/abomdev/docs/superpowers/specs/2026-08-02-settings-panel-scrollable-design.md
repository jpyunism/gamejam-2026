# SettingsPanel scrollable con toggle de pantalla completa

Fecha: 2026-08-02
Alcance: `participantes/abomdev/` (Fase 2)
Estado: implementación finalizada, pendiente de commit por el autor

## Resumen

`SettingsPanel` se transforma en un panel con scroll vertical para容纳 los
tres sliders de volumen, el toggle de lado del joystick y un nuevo toggle de
pantalla completa ON/OFF. En pantallas chicas (mobile portrait) el contenido
excede el alto del box, así que el viewport interno recorta con un **filter
de mask nativo de Phaser 4** (`Phaser.Filters.Mask` aplicado vía
`Container.filters.internal.addMask()`) y permite arrastrar / usar la rueda
del mouse / click en chevrons para navegar.

## Goals / Non-Goals

**Goals**
- El panel entero (3 sliders + 2 toggles + Volver) entra en mobile portrait
  con scroll vertical cuando excede el alto del viewport.
- Toggle fullscreen ON/OFF con highlight sutil cuando está apagado
  (label `#8888aa`, fill alpha 0.85, borde gris `0x444466`) y destacado
  cuando está prendido (label `#66ffcc`, borde cyan, fill `0x1a3a3a`).
- Sincronización automática con cambios de fullscreen externos: ESC, F11 o
  cualquier toggle fuera del panel actualiza el botón via listener
  `fullscreenchange` / `webkitfullscreenchange`.
- Indicador de overflow alineado con la scrollbar: chevron `↑` arriba del
  viewport cuando hay contenido arriba, chevron `↓` abajo cuando hay
  contenido abajo. Ambos pulsan alpha 0.3 ↔ 0.8 cada 600 ms. Click en
  cualquiera scrollea `±vpH * 0.8` instantáneamente.
- Layout mobile-first y desktop consistente: el toggle IZQ/DER y el toggle
  fullscreen quedan en línea (label a la izquierda, botones a la derecha).

**Non-Goals (este PR)**
- Scroll horizontal.
- Animación tween en el scroll por click en chevron (instantáneo a propósito).
- Persistencia de la posición de scroll entre shows.
- Soporte de trackpad inertia / momentum.

## Diseño

### Layout

```
┌─────────────────────────────────┐
│          CONFIGURACIÓN           │   <- fijo (header)
│  ─────────────────────────────  │
│  Volumen general      [====] 80% │   <- scrollable
│  Combate (...)        [====] 70% │
│  Hitos (...)          [====] 90% │
│  Lado del joystick   [IZQ][DER] │
│  Pantalla completa         [OFF]│   <- sutil cuando OFF
│                            ↓    │   <- chevron clickable (overflow)
│          [    Volver    ]       │   <- fijo (footer)
└─────────────────────────────────┘
```

`HEADER_H = 70` deja aire arriba del título. `FOOTER_H = 56` deja el botón
Volver a `bottomY − 36`. El viewport interno es `boxW − 18 × boxH − 126`.

### Filter mask del viewport

`Phaser 4` reemplazó el viejo `setMask()` (que no funcionaba en WebGL) por un
sistema de filters. El path correcto es:

```js
// 1. Container que contiene todos los elementos scrollables
this.scrollContainer = scene.add.container(0, 0)
  .setScrollFactor(0)
  .setDepth(DEPTH + 1);
scrollableElements.forEach((el) => {
  if (el) this.scrollContainer.add(el);
});

// 2. RenderTexture blanca del tamaño del viewport (fuente del mask)
this.maskTexture = scene.add.renderTexture(0, 0, 1, 1)
  .setOrigin(0).setScrollFactor(0).setVisible(false);
this.maskTexture.fill(0xFFFFFF, 1);
this.maskTexture.render();
this.maskTexture.setRenderMode('redraw'); // re-aplica fill cada frame, no se muestra

// 3. Habilitar filters en el Container y agregar el mask filter
this.scrollContainer.enableFilters();
const maskFilter = this.scrollContainer.filters.internal.addMask(
  this.maskTexture,
  false,                  // invert
  scene.cameras.main,     // viewCamera
  'world',                // viewTransform: evalúa el mask en world coords
);
maskFilter.autoUpdate = false;  // static, no re-render cada frame
maskFilter.needsUpdate = true;  // forzar update inicial
```

En `layout()` se regenera el `maskTexture` con el nuevo tamaño del viewport:

```js
this.maskTexture.setPosition(vpX, vpY);
this.maskTexture.setSize(vpW, vpH);
this.maskTexture.fill(0xFFFFFF, 1);
this.maskTexture.render();
this.maskFilter.needsUpdate = true;
```

### Toggle fullscreen custom

No usa `button()` genérico porque sus handlers `pointerover/out` pisan el
stroke. Wrapper inline con:
- `bg`: rectangle `TOGGLE_W × TOGGLE_H` con stroke.
- `labelText`: text "ON"/"OFF".
- `_applyHighlight()` consulta `isBrowserFullscreen()` y aplica los colores.
- `pointerup` llama `_toggleFullscreen()`.

### Sincronización fullscreenchange

```js
document.addEventListener('fullscreenchange', this._onFullscreenChangeHandler);
document.addEventListener('webkitfullscreenchange', this._onFullscreenChangeHandler);
```

Cleanup en `shutdown`. Además, `_toggleFullscreen` corre `delayedCall(150)` y
re-aplica el label/highlight para cubrir la carrera entre el `requestFullscreen`
y el evento del browser.

### Scroll

- `scrollOffset ∈ [-maxScroll, 0]`. `maxScroll = max(0, contentEndY − vpBottom)`.
- El scroll mueve el **Container** en Y: `_applyScrollToContent()` hace
  `this.scrollContainer.y = this.scrollOffset`. Los elementos mantienen sus
  posiciones relativas dentro del container.
- Drag vertical (`pointermove` con `pointer.isDown`), threshold 6 px.
- Rueda del mouse: `dy * 0.5`.
- Click en chevron `_scrollByDelta(±1)` → `_setScroll(offset + vpH * 0.8)`.

### Indicadores de overflow

`_updateOverflowIndicators()`:
- Scrollbar: `visible = hasOverflow && isOpen`. Posición proporcional a
  `−scrollOffset / maxScroll`, alto proporcional a `vpH / (vpH + maxScroll)`.
- Chevron up: visible si `hasOverflow && !atTop`, en `(vpX + vpW − SCROLLBAR_W − 8, vpY + 18)`.
- Chevron down: visible si `hasOverflow && !atBottom`, en `(vpX + vpW − SCROLLBAR_W − 8, vpY + vpH − 18)`.
- Tween de alpha `0.3 → 0.8`, 600 ms, yoyo, infinito. Aplicado a ambos
  chevrons como targets simultáneos (Phaser soporta array).
- `_stopHintTween()` cleanup en `hide()` y `shutdown`.

### Archivos a tocar

| Archivo | Cambio |
|---|---|
| `src/ui/SettingsPanel.js` | Reescritura completa con scroll, chevrons, toggle fullscreen sutil |
| `src/assets/icons.js` | Importar `chevron-down` y `chevron-up` de lucide-static, agregar al catálogo |

### Tests

`npm test` (vitest) corre los tests puros de `layout.js` y `upgrades.js`. No
hay tests específicos para `SettingsPanel` (regla del proyecto: no mockear
Phaser). La verificación queda en manual.

### Verificación manual

1. `npm run dev`, mobile portrait (375×667), entrar a Configuración.
2. Los 3 sliders, el toggle IZQ/DER inline y el toggle fullscreen OFF sutil
   deben verse dentro del viewport.
3. Scrollbar azul info 4 px en el borde derecho del viewport.
4. Chevron `↓` pulsando abajo. Click → scroll instantáneo `vpH * 0.8`.
5. Drag vertical → contenido se mueve, scrollbar avanza, chevron `↑`
   aparece arriba.
6. OFF → click → browser entra a fullscreen, label "ON", borde cyan.
7. ESC → browser sale de fullscreen, label vuelve a "OFF" automáticamente
   (listener `fullscreenchange`).
8. Volver fuera del scroll, siempre visible.
9. Desktop (1280×720): si todo entra sin overflow, scrollbar y chevrons
   ocultos.
10. `npm test` + `npm run build` pasan limpios.

### Riesgos y notas

- **Tween leak**: `_stopHintTween` se llama en `hide()` y `shutdown`.
- **Mask叠加**: `clearMask` antes de `setMask` en cada layout.
- **Slider overflow**: `sliderW = Math.min(SLIDER_W_COMPACT, vpW − 80)` para
  que caption + barra + flechas + valor entren en viewport ultra-angosto.
- **Reentry de fullscreen**: el `delayedCall(150)` cubre la carrera entre
  `requestFullscreen` y el evento del browser.

## Cómo revertir

- Chevron overflow: borrar `overflowHintUp`/`overflowHintDown` y sus referencias.
- Scroll: volver al layout estático anterior (sin `_baseY`, sin mask, sin
  `scrollOffset`).
- Toggle fullscreen: quitar `_buildFullscreenToggle` y su fila en `layout()`.