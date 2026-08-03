import { chordDegrees, chordTonesToMidi, degreeToMidi, getScale } from './music-theory.js';
import { createRng } from './random.js';

const STEPS = 16;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const STRONG_STEPS = new Set([0, 4, 8, 12]);

const LEAD_RHYTHMS = Object.freeze({
  straight: [0, 2, 4, 6, 8, 10, 12, 14],
  syncopated: [0, 3, 6, 7, 8, 10, 12, 15],
  cascade: [0, 2, 3, 5, 7, 8, 10, 11, 13, 15],
  sparse: [0, 4, 8, 12],
  call: [0, 2, 3, 8, 10, 11, 14],
  march: [0, 2, 4, 8, 10, 12, 14],
});

const BASS_RHYTHMS = Object.freeze({
  roots: [0, 4, 8, 12],
  drive: [0, 2, 4, 6, 8, 10, 12, 14],
  march: [0, 4, 6, 8, 12, 14],
  pulse: [0, 3, 8, 11, 12],
});

const DRUM_PATTERNS = Object.freeze({
  four: { kick: [0, 4, 8, 12], snare: [4, 12], hats: [0, 2, 4, 6, 8, 10, 12, 14] },
  break: { kick: [0, 3, 8, 11], snare: [4, 12], hats: [0, 2, 3, 6, 8, 10, 11, 14] },
  march: { kick: [0, 6, 8, 14], snare: [4, 12], hats: [0, 4, 8, 12] },
  halftime: { kick: [0, 7, 10], snare: [8], hats: [0, 2, 4, 6, 8, 10, 12, 14] },
  bounce: { kick: [0, 5, 8, 11], snare: [4, 12], hats: [0, 2, 4, 7, 8, 10, 12, 15] },
});

function event(midi, velocity = 0.7, length = 0.7, extra = {}) {
  return { midi, velocity, length, ...extra };
}

function getChord(config, barIndex) {
  const degree = config.progression[barIndex % config.progression.length];
  return chordDegrees(degree, config.complexity > 0.72 ? 'seventh' : 'triad');
}

function pickFrom(items, index) {
  return items[index % items.length];
}

export function describeVariation(config, barIndex = 0) {
  const phase = barIndex % 4;
  const rng = createRng(`${config.seed}:variation:${Math.floor(barIndex / 4)}`);
  const leadPatterns = config.leadPatterns ?? ['straight'];
  const bassPatterns = config.bassPatterns ?? ['roots'];
  const leadPattern = phase === 0 ? leadPatterns[0] : phase === 1 ? pickFrom(leadPatterns, 0) : phase === 2 ? rng.pick(leadPatterns) : leadPatterns[leadPatterns.length - 1];
  return {
    phase,
    leadPattern,
    bassPattern: phase === 2 ? rng.pick(bassPatterns) : pickFrom(bassPatterns, phase),
    drumPattern: config.drumPattern ?? 'four',
    fill: phase === 3,
    ornamentChance: phase === 2 ? 0.38 : phase === 3 ? 0.22 : 0.12,
  };
}

function makeBass(config, scale, chord, variation) {
  const notes = Array(STEPS).fill(null);
  const rhythm = BASS_RHYTHMS[variation.bassPattern] ?? BASS_RHYTHMS.roots;
  rhythm.forEach((step, index) => {
    const role = variation.bassPattern === 'drive' && index % 4 === 3 ? 7 : (index % 3 === 2 ? 2 : 0);
    const degree = chord[0] + role;
    notes[step] = event(degreeToMidi(scale, degree, 2), 0.65 + config.energy * 0.25, variation.bassPattern === 'pulse' ? 0.46 : 0.78, { degree, chordRoot: chord[0] });
  });
  return notes;
}

function makeChords(config, scale, chord, rng, variation) {
  const notes = Array(STEPS).fill(null);
  const chordNotes = chord.map((degree) => degreeToMidi(scale, degree, 4));
  const interval = variation.leadPattern === 'sparse' ? 4 : config.complexity > 0.45 ? 2 : 4;
  for (let step = 0; step < STEPS; step += interval) {
    if (step === 0 || rng.chance(0.25 + config.density * 0.58)) {
      const arpeggio = config.character > 0.55 || config.complexity > 0.62;
      notes[step] = event(arpeggio ? chordNotes[(step / interval) % chordNotes.length] : chordNotes[0], 0.38 + config.energy * 0.22, arpeggio ? 0.62 : 1.7, { chord: arpeggio ? null : chordNotes });
    }
  }
  return notes;
}

function boundedDegree(degree, chordRoot) {
  return clamp(degree, chordRoot - 1, chordRoot + 7);
}

function makeLead(config, scale, chord, rng, variation) {
  const notes = Array(STEPS).fill(null);
  const motif = [0, 1, 2, 4, 2, 5, 4, 1];
  const rhythm = LEAD_RHYTHMS[variation.leadPattern] ?? LEAD_RHYTHMS.straight;
  rhythm.forEach((step, index) => {
    const isStrong = STRONG_STEPS.has(step);
    const chordDegree = rng.pick(chord);
    const target = chord[0] + motif[index % motif.length];
    const neighbor = rng.pick([-1, 0, 0, 1]);
    const degree = boundedDegree(isStrong ? chordDegree : target + neighbor, chord[0]);
    notes[step] = event(degreeToMidi(scale, degree, 5), 0.4 + config.energy * 0.33, variation.leadPattern === 'sparse' ? 1.25 : 0.52, {
      degree, chordRoot: chord[0], glide: config.character > 0.72 && !isStrong && rng.chance(variation.ornamentChance * 0.45),
    });
    if (!isStrong && config.complexity > 0.62 && rng.chance(variation.ornamentChance) && step < 15 && !STRONG_STEPS.has(step + 1) && !notes[step + 1]) {
      const ornament = boundedDegree(degree + rng.pick([-1, 1]), chord[0]);
      notes[step + 1] = event(degreeToMidi(scale, ornament, 5), 0.3 + config.energy * 0.18, 0.2, { degree: ornament, chordRoot: chord[0] });
    }
  });
  return notes;
}

function makeDrums(config, rng, variation) {
  const notes = Array(STEPS).fill(null);
  const add = (step, type, velocity, length = 0.35) => {
    if (step < STEPS) notes[step] = notes[step] ? { ...notes[step], hits: [...notes[step].hits, { type, velocity, length }] } : { hits: [{ type, velocity, length }] };
  };
  const rhythm = DRUM_PATTERNS[variation.drumPattern] ?? DRUM_PATTERNS.four;
  rhythm.kick.forEach((step, index) => add(step, 'kick', index === 0 ? 0.92 : 0.58 + config.energy * 0.28));
  rhythm.snare.forEach((step) => add(step, 'snare', 0.62 + config.energy * 0.26));
  rhythm.hats.forEach((step) => {
    if (step % 2 === 0 || rng.chance(0.22 + config.density * 0.58)) add(step, 'hat', 0.2 + config.energy * 0.22, 0.12);
  });
  if (variation.fill) {
    [13, 14, 15].forEach((step, index) => add(step, index === 2 ? 'snare' : 'hat', 0.28 + index * 0.12, 0.09));
  }
  return notes;
}

export function generateBar(inputConfig, barIndex = 0) {
  const config = { ...inputConfig, density: clamp(inputConfig.density, 0, 1), complexity: clamp(inputConfig.complexity, 0, 1), energy: clamp(inputConfig.energy, 0, 1), character: clamp(inputConfig.character, 0, 1) };
  const rng = createRng(`${config.seed}:${barIndex}`);
  const scale = getScale(config.root, config.scale);
  const chord = getChord(config, barIndex);
  const variation = describeVariation(config, barIndex);
  return {
    lead: makeLead(config, scale, chord, rng, variation),
    bass: makeBass(config, scale, chord, variation),
    chord: makeChords(config, scale, chord, rng, variation),
    drums: makeDrums(config, rng, variation),
    harmony: { chordDegrees: chord, chordMidi: chordTonesToMidi(scale, chord, 5), variation },
  };
}

export const STEP_COUNT = STEPS;