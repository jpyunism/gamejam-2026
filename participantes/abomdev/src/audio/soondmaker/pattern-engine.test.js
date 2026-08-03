import { describe, expect, it } from 'vitest';
import { describeVariation, generateBar } from './pattern-engine.js';
import { PRESETS } from './presets.js';
import { getScale, isScaleTone } from './music-theory.js';

describe('pattern-engine (motor soondmaker)', () => {
  it('genera compases reproducibles de dieciséis pasos', () => {
    const first = generateBar(PRESETS.arcade, 0);
    const second = generateBar(PRESETS.arcade, 0);
    expect(first).toEqual(second);
    expect(first.drums.length).toBe(16);
  });

  it('las voces musicales tienen eventos o silencios válidos', () => {
    const bar = generateBar({ ...PRESETS.dungeon, density: 0.65, complexity: 0.7 }, 3);
    for (const voice of [bar.lead, bar.bass, bar.chord, bar.drums]) {
      expect(voice.length).toBe(16);
    }
    expect(bar.bass.some(Boolean)).toBe(true);
    expect(bar.drums.some(Boolean)).toBe(true);
  });

  it('mantiene lead y bajo dentro de escala, registro y función armónica', () => {
    const bar = generateBar(PRESETS.boss, 3);
    const scale = getScale(PRESETS.boss.root, PRESETS.boss.scale);
    const strongSteps = [0, 4, 8, 12];
    for (const note of [...bar.lead, ...bar.bass].filter(Boolean)) {
      expect(isScaleTone(note.midi, scale)).toBe(true);
      expect(note.degree >= note.chordRoot - 1 && note.degree <= note.chordRoot + 7).toBe(true);
    }
    for (const step of strongSteps) {
      const lead = bar.lead[step];
      if (lead) expect(bar.harmony.chordMidi.includes(lead.midi)).toBe(true);
    }
  });

  it('cambia de forma controlada a lo largo del ciclo de cuatro compases', () => {
    expect(describeVariation(PRESETS.arcade, 0)).not.toEqual(describeVariation(PRESETS.arcade, 2));
    expect(describeVariation(PRESETS.arcade, 3).fill).toBe(true);
  });

  it('incluye nueve presets que generan compases válidos', () => {
    expect(Object.keys(PRESETS).length).toBe(9);
    for (const preset of Object.values(PRESETS)) {
      expect(() => generateBar(preset, 0)).not.toThrow();
    }
  });
});