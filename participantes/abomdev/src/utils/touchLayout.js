// Preferencia de lado del joystick: 'right' (default, diestros) o 'left'.
// Persistida en localStorage porque es una elección del usuario, no estado
// de sesión. Mismo patrón defensivo que audio/synth.js (silencioso si
// localStorage no está disponible, ej. modo privado).

const STORAGE_KEY = 'survivorsTouchLayout';

export function getTouchLayout() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'left' || v === 'right' ? v : 'right';
  } catch {
    return 'right';
  }
}

export function setTouchLayout(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {}
}
