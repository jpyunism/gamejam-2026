const NOTE_TO_SEMITONE = Object.freeze({
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
});

const SCALE_INTERVALS = Object.freeze({
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 3, 5, 7, 10],
});

export function getScale(root, scaleName) {
  const base = NOTE_TO_SEMITONE[root];
  const intervals = SCALE_INTERVALS[scaleName];
  if (base === undefined || !intervals) throw new Error('Tonalidad o escala no válida');
  return intervals.map((interval) => base + interval);
}

export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function degreeToMidi(scale, degree, octave = 4) {
  const length = scale.length;
  const wrapped = ((degree % length) + length) % length;
  const octaveOffset = Math.floor(degree / length);
  return 12 * (octave + 1 + octaveOffset) + scale[wrapped];
}

export function chordDegrees(rootDegree, flavor = 'triad') {
  return flavor === 'seventh'
    ? [rootDegree, rootDegree + 2, rootDegree + 4, rootDegree + 6]
    : [rootDegree, rootDegree + 2, rootDegree + 4];
}

export function chordTonesToMidi(scale, degrees, octave = 4) {
  return degrees.map((degree) => degreeToMidi(scale, degree, octave));
}

export function isScaleTone(midi, scale) {
  const pitchClass = ((midi % 12) + 12) % 12;
  return scale.some((tone) => ((tone % 12) + 12) % 12 === pitchClass);
}

export { NOTE_TO_SEMITONE, SCALE_INTERVALS };