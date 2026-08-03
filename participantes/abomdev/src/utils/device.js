// Detección de dispositivo touch y plataforma. Centralizado para que MenuScene
// y PauseMenu no dupliquen la lógica.

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const touchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return Boolean(coarse || touchPoints);
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
