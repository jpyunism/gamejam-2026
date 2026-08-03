// Helpers de UI: piezas que se repiten en varios paneles (fondo con borde, barras,
// textos, separadores). Todas fijan scrollFactor 0 porque la UI no se mueve con la cámara.

import { FONT, FONT_SIZE, TEXT, UI } from '../config/theme.js';

// mm:ss a partir de milisegundos.
export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// Caja de panel con borde. `origin` 0 para anclar arriba-izquierda, 0.5 para centrar.
export function panel(scene, { width, height, depth, border, origin = 0, alpha = UI.panelAlpha }) {
  return scene.add.rectangle(0, 0, width, height, UI.panelBg, alpha)
    .setOrigin(origin)
    .setStrokeStyle(3, border)
    .setScrollFactor(0)
    .setDepth(depth);
}

export function text(scene, content, { size, color, depth, origin = 0, align, lineSpacing, wordWrapWidth }) {
  const style = { fontFamily: FONT, fontSize: size, color };
  if (align) style.align = align;
  if (lineSpacing) style.lineSpacing = lineSpacing;
  if (wordWrapWidth) style.wordWrap = { width: wordWrapWidth };

  const obj = scene.add.text(0, 0, content, style).setScrollFactor(0).setDepth(depth);
  return Array.isArray(origin) ? obj.setOrigin(origin[0], origin[1]) : obj.setOrigin(origin);
}

// Barra de progreso: devuelve { track, fill, maxWidth }. El ancho del fill se ajusta
// después con `fill.width = maxWidth * ratio`.
export function bar(scene, { width, height, color, depth, inset = 1 }) {
  const track = scene.add.rectangle(0, 0, width, height, UI.barTrack)
    .setOrigin(0).setScrollFactor(0).setDepth(depth);
  const maxWidth = width - inset * 2;
  const fill = scene.add.rectangle(0, 0, maxWidth, height - inset * 2, color)
    .setOrigin(0).setScrollFactor(0).setDepth(depth + 1);
  return { track, fill, maxWidth, inset };
}

// Icono de lucide. Las texturas se cargan en blanco, así que el color se da por tint.
export function icon(scene, key, { size, color, depth, origin = 0.5 }) {
  return scene.add.image(0, 0, key)
    .setDisplaySize(size, size)
    .setTint(color)
    .setOrigin(origin)
    .setScrollFactor(0)
    .setDepth(depth);
}

export function divider(scene, { width, depth }) {
  return scene.add.rectangle(0, 0, width, 2, UI.divider)
    .setOrigin(0).setScrollFactor(0).setDepth(depth);
}

// Muestra/oculta varios objetos de una, que es el patrón de todos los paneles.
export function setVisible(objects, visible) {
  objects.forEach((o) => o.setVisible(visible));
}

// Botón: caja + etiqueta que se mueven juntas. Devuelve { parts, setPosition, setLabel }
// para que el panel que lo use no tenga que conocer sus piezas internas.
export function button(scene, { label, width, height, depth, color = TEXT.accent, borderColor = UI.panelBorder, onClick }) {
  const bg = scene.add.rectangle(0, 0, width, height, UI.panelBg, 0.95)
    .setOrigin(0.5)
    .setStrokeStyle(2, borderColor)
    .setScrollFactor(0)
    .setDepth(depth)
    .setInteractive({ useHandCursor: true });

  const labelText = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: FONT_SIZE.label, color })
    .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

  bg.on('pointerover', () => bg.setFillStyle(0x252545, 0.97).setStrokeStyle(2, color));
  bg.on('pointerout', () => bg.setFillStyle(UI.panelBg, 0.95).setStrokeStyle(2, borderColor));
  bg.on('pointerdown', () => bg.setFillStyle(0x101024, 1));
  bg.on('pointerup', () => {
    bg.setFillStyle(0x252545, 0.97);
    if (onClick) onClick();
  });

  return {
    parts: [bg, labelText],
    setPosition(x, y) {
      bg.setPosition(x, y);
      labelText.setPosition(x, y);
      return this;
    },
    setSize(width, height) {
      bg.setSize(width, height);
      return this;
    },
    setLabel(newLabel) {
      labelText.setText(newLabel);
      return this;
    },
  };
}

// Deslizador de 0 a 1: se hace clic en cualquier punto de la pista para fijar el
// nivel, y las flechas ajustan de a poco. `onChange(value)` se llama en cada cambio.
export function slider(scene, { label, width, depth, step = 0.1, onChange }) {
  const trackH = 12;
  const arrowW = 24;

  const caption = text(scene, label, {
    size: FONT_SIZE.small, color: TEXT.secondary, depth: depth + 1,
    wordWrapWidth: width, align: 'left',
  });
  const valueText = text(scene, '', { size: FONT_SIZE.small, color: TEXT.accent, depth: depth + 1, origin: [1, 0] });

  const track = scene.add.rectangle(0, 0, width, trackH, UI.barTrack)
    .setOrigin(0, 0.5).setScrollFactor(0).setDepth(depth)
    .setInteractive({ useHandCursor: true });
  const fill = scene.add.rectangle(0, 0, 0, trackH - 4, 0x66ffcc)
    .setOrigin(0, 0.5).setScrollFactor(0).setDepth(depth + 1);

  let value = 0;

  const api = {
    parts: [caption, valueText, track, fill],
    get value() { return value; },

    setValue(v, notify = false) {
      value = Math.min(1, Math.max(0, v));
      fill.width = (width - 4) * value;
      valueText.setText(`${Math.round(value * 100)}%`);
      if (notify && onChange) onChange(value);
      return api;
    },

    setPosition(x, y) {
      caption.setPosition(x, y - 30);
      track.setPosition(x, y);
      fill.setPosition(x + 2, y);
      // Las flechas van pegadas a cada extremo de la pista.
      api.left.setPosition(x - arrowW / 2 - 8, y);
      api.right.setPosition(x + width + arrowW / 2 + 8, y);
      // El valor se muestra a la derecha del caption en la misma Y para que
      // no se superponga con etiquetas largas.
      valueText.setPosition(x + width, y - 30);
      return api;
    },
  };

  // Clic en la pista: el nivel sale de dónde cayó el clic dentro de su ancho.
  track.on('pointerdown', (pointer) => {
    api.setValue((pointer.x - track.x) / width, true);
  });

  api.left = button(scene, {
    label: '◀', width: arrowW, height: trackH + 10, depth,
    onClick: () => api.setValue(value - step, true),
  });
  api.right = button(scene, {
    label: '▶', width: arrowW, height: trackH + 10, depth,
    onClick: () => api.setValue(value + step, true),
  });
  api.parts.push(...api.left.parts, ...api.right.parts);

  return api;
}
