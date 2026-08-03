import { describe, expect, it } from 'vitest';

import { createBgmEventTransport } from './synth.js';

function* batches() {
  yield {
    bpm: 120,
    length: 4,
    config: { id: 'first' },
    events: [
      { time: 0, type: 'drum', params: { type: 'kick' } },
      { time: 15.75, type: 'drum', params: { type: 'snare' } },
    ],
  };
  yield {
    bpm: 120,
    length: 4,
    config: { id: 'second' },
    events: [{ time: 0, type: 'drum', params: { type: 'kick' } }],
  };
}

describe('createBgmEventTransport', () => {
  it('continúa con el siguiente bloque sin reiniciar el reloj', () => {
    const transport = createBgmEventTransport(batches(), 10);

    const due = [
      ...transport.takeThrough(10.2),
      ...transport.takeThrough(18),
    ];

    expect(due.map(({ time }) => time)).toEqual([10, 17.875, 18]);
    expect(due.at(-1).config.id).toBe('second');
  });
});
