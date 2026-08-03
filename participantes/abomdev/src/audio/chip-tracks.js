// Tracks de BGM usando el motor generador soondmaker. Cada track es una
// funcion generadora que produce un loop completo (4 compases por yield).
//
// Convencion de tiempos:
//   - event.time en BEATS desde el inicio del loop.
//   - 4 beats por compas × 16 steps por compas = 0.25 beats por step.
//   - event.duration en SEGUNDOS (el scheduler lo deja pasar a WebAudio).
//   - swing se aplica al time de los steps impares.
//
// Mapeo de presets soondmaker a tracks del juego:
//   menu = lofi      (Pocket Lo-fi: C major, BPM 82, suave)
//   game = dungeon   (Dungeon Loop: D phrygian, BPM 118, tenso, seed aleatorio cada run)
//   boss = boss      (Boss Arena: A harmonicMinor, BPM 146, dramatico)

import { generateBar } from './soondmaker/pattern-engine.js';
import { PRESETS } from './soondmaker/presets.js';
import { createSeed } from './soondmaker/random.js';
import { generateLevelupStinger, generateGameoverStinger } from './stingers.js';

const LOOP_BARS = 4;
const BEATS_PER_BAR = 4;
const STEPS_PER_BAR = 16;
const STEP_TO_BEAT = BEATS_PER_BAR / STEPS_PER_BAR; // 0.25

// Wrappers que copian el preset (Object.freeze evita mutar el original)
function pickPreset(id) {
  return { ...PRESETS[id] };
}

function pushNote(events, time, midi, lengthFrac, velocity, track, wave, glide) {
  events.push({
    time,
    type: 'note',
    params: {
      note: midi,
      duration: lengthFrac,
      velocity,
      waveform: wave,
      glide: !!glide,
      track,
    },
  });
}

function pushDrum(events, time, hit) {
  events.push({
    time,
    type: 'drum',
    params: { type: hit.type === 'hat' ? 'hihat-c' : hit.type, volume: hit.velocity },
  });
}

// Convierte el output de generateBar (16 steps) a eventos en formato
// BugSurvivor (time en beats, duration en fracciones de beat que se
// convertiran a segundos en synth.js).
function* generateTrackEvents(config) {
  const bpm = config.tempo;
  let barIndex = 0;

  while (true) {
    const events = [];

    for (let bar = 0; bar < LOOP_BARS; bar++) {
      const pattern = generateBar(config, barIndex);
      const barBase = bar * BEATS_PER_BAR;
      const swing = config.swing ?? 0;

      pattern.lead.forEach((note, step) => {
        if (!note) return;
        const beatTime = barBase + step * STEP_TO_BEAT;
        const swungTime = step % 2 ? beatTime + STEP_TO_BEAT * 0.5 * swing : beatTime;
        pushNote(events, swungTime, note.midi, note.length, note.velocity, 'lead', config.wave, note.glide);
      });

      pattern.bass.forEach((note, step) => {
        if (!note) return;
        const beatTime = barBase + step * STEP_TO_BEAT;
        const swungTime = step % 2 ? beatTime + STEP_TO_BEAT * 0.5 * swing : beatTime;
        pushNote(events, swungTime, note.midi, note.length, note.velocity, 'bass', config.wave);
      });

      pattern.chord.forEach((note, step) => {
        if (!note) return;
        const beatTime = barBase + step * STEP_TO_BEAT;
        const swungTime = step % 2 ? beatTime + STEP_TO_BEAT * 0.5 * swing : beatTime;
        pushNote(events, swungTime, note.midi, note.length, note.velocity, 'chord', config.wave);
      });

      pattern.drums.forEach((drumEv, step) => {
        if (!drumEv) return;
        const beatTime = barBase + step * STEP_TO_BEAT;
        const swungTime = step % 2 ? beatTime + STEP_TO_BEAT * 0.5 * swing : beatTime;
        drumEv.hits.forEach((hit) => pushDrum(events, swungTime, hit));
      });

      barIndex++;
    }

    yield { events, length: LOOP_BARS, bpm, config };
  }
}

export function createMenuTrack() {
  return generateTrackEvents(pickPreset('lofi'));
}

export function createGameTrack() {
  // Dungeon Loop con seed aleatorio cada run: cada partida tiene una
  // melodia distinta sobre la misma progresion D phrygian.
  return generateTrackEvents({ ...pickPreset('bitpop'), seed: createSeed() });
}

export function createBossTrack() {
  return generateTrackEvents(pickPreset('boss'));
}

export { generateLevelupStinger, generateGameoverStinger };