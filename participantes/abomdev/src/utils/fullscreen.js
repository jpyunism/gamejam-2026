// Wrapper sobre la Fullscreen API con cadena de fallback y retorno de estado.
// Phaser 4 a veces reporta `scale.fullscreenAvailable === false` en navegadores
// donde la API nativa del browser sí responde — lo que nos dejaba con un toast
// de "no disponible" en Android Chrome siendo probado directo. Por eso:
// 1. Intento Phaser primero (respeta Scale).
// 2. Si Phaser aborta, voy directo al browser API (requestFullscreen / webkit).
// 3. Si tampoco, retorno 'failed'.
//
// Devuelve 'on' si entró a fullscreen, 'off' si salió, 'failed' si no se pudo.

export function toggleFullscreen(scale) {
  if (scale.isFullscreen) {
    try { scale.stopFullscreen(); return 'off'; } catch (e) { return 'failed'; }
  }
  try {
    scale.startFullscreen();
    return 'on';
  } catch (e) {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) { el.requestFullscreen(); return 'on'; }
      if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return 'on'; }
    } catch {}
    return 'failed';
  }
}

// Fuente de verdad sobre el estado de fullscreen: la API del browser, no la
// cache de Phaser. Útil cuando F5 preserva el fullscreen en algunos browsers
// móviles y `scale.isFullscreen` queda desincronizado del estado real.
export function isBrowserFullscreen() {
  return Boolean(
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.msFullscreenElement,
  );
}
