// Wrapper sobre screen.orientation API. En iOS Safari la implementación es
// errática (especialmente dentro de fullscreen o iframe) — los try/catch
// silenciosos degradan limpio cuando la API no está o rechaza.

export function lockLandscape() {
  try {
    const lock = screen.orientation?.lock;
    if (typeof lock !== 'function') return false;
    const result = lock.call(screen.orientation, 'landscape');
    if (result && typeof result.then === 'function') {
      result.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation() {
  try {
    const unlock = screen.orientation?.unlock;
    if (typeof unlock !== 'function') return false;
    unlock.call(screen.orientation);
    return true;
  } catch {
    return false;
  }
}
