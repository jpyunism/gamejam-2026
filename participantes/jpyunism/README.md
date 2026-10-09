# Neon Drift

Roguelite cyberpunk de supervivencia con oleadas de enemigos.

**Stack**: Phaser 4 + TypeScript + Vite

## Cómo jugar

```bash
npm install
npm run dev
```

Abrir http://localhost:5173 en el navegador.

## Controles

| Tecla | Acción |
|-------|--------|
| WASD | Moverse |
| Mouse | Apuntar |
| Click izquierdo | Disparar |
| Q | Cambiar arma |
| ESC | Pausa |
| R | Reiniciar (en Game Over) |
| M | Menú principal (en Game Over) |
| S | Tienda (en Game Over) |

## Controles táctiles (móvil)

En un teléfono, los controles aparecen automáticamente al tocar la pantalla:

| Control | Acción |
|---------|--------|
| Joystick izquierdo | Moverse |
| Joystick derecho | Apuntar |
| Botón rojo FIRE | Disparar (un disparo por toque) |
| Botón `II` (arriba a la derecha) | Pausar / ajustes |
| Tap inicial | Solicita pantalla completa |

En la pantalla de Game Over los botones **RESTART**, **MAIN MENU** y **SHOP** se
tocan directamente, igual que las filas de la tienda (para comprar) y su botón
**CLOSE**. Antes esas acciones solo existían como teclas `R`/`M`/`S` e `1-5`, así que
un jugador de teléfono quedaba encerrado al morir.

El juego funciona en landscape (horizontal). Si el dispositivo está en vertical,
aparece un overlay pidiendo rotar el dispositivo.

**Dispositivos probados:** iPhone 13, Pixel 5 (Playwright emulation).
**Navegadores:** Chrome Android, Safari iOS.

## Cómo se juega

1. En el menú, elegí 2 armas de las 5 disponibles
2. Sobreviví oleadas de enemigos en una arena procedural
3. Matá enemigos para ganar monedas y experiencia
4. Al subir de nivel, elegí un power-up
5. Cada ~25s llega una horda más grande
6. Cuando morís, gastá tus monedas en mejoras permanentes
7. Repetí

## Build

```bash
npm run build
```

Los archivos compilados quedan en `dist/`.
