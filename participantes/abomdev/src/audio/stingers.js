// Stingers: piezas cortas que se reproducen una vez sobre la musica del juego
// sin pausarla. Cada stinger es un array de eventos en formato BugSurvivor
// (time en segundos, type note/drum, params).
// Se disparan via playStinger() en synth.js.

export function generateLevelupStinger() {
  return [
    { time: 0, type: 'note', params: { note: 64, duration: 0.08, waveform: 'square', volume: 0.18 } },
    { time: 0.08, type: 'note', params: { note: 67, duration: 0.08, waveform: 'square', volume: 0.18 } },
    { time: 0.16, type: 'note', params: { note: 71, duration: 0.08, waveform: 'square', volume: 0.2 } },
    { time: 0.24, type: 'note', params: { note: 76, duration: 0.5, waveform: 'square', vibrato: 8, volume: 0.22 } },
  ];
}

export function generateGameoverStinger() {
  return [
    { time: 0, type: 'note', params: { note: 69, duration: 0.4, waveform: 'triangle', volume: 0.2, vibrato: 6, slide: -1 } },
    { time: 0.4, type: 'note', params: { note: 64, duration: 0.4, waveform: 'triangle', volume: 0.2, vibrato: 6, slide: -1 } },
    { time: 0.8, type: 'note', params: { note: 60, duration: 0.4, waveform: 'triangle', volume: 0.2, vibrato: 6, slide: -1 } },
    { time: 1.2, type: 'note', params: { note: 56, duration: 1.2, waveform: 'triangle', volume: 0.22, vibrato: 8 } },
  ];
}