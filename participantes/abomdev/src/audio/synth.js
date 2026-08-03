// Mini-sintetizador sobre WebAudio, sin dependencias ni archivos de audio.
// Expone dos primitivas (tono y ruido) que alcanzan para todos los efectos del juego:
// los tonos sirven para disparos, avisos y melodías cortas; el ruido para impactos y
// explosiones, que con osciladores solos suenan pobres.
//
// El volumen se controla en tres niveles: uno maestro y dos categorías, para poder
// bajar el ruido constante del combate sin perder los momentos importantes.

const STORAGE_KEY = 'survivorsAudio';

export const CATEGORIES = ['combat', 'events', 'music'];

const DEFAULTS = { master: 1.0, combat: 1.0, events: 1.0, music: 0.1, muted: false };

let ctx = null;
let masterGain = null;
const categoryGains = {};
const settings = loadSettings();

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Solo aceptamos claves conocidas: si el formato guardado cambió, ignoramos el resto.
    if (saved && typeof saved === 'object') {
      return {
        master: clamp01(saved.master ?? DEFAULTS.master),
        combat: clamp01(saved.combat ?? DEFAULTS.combat),
        events: clamp01(saved.events ?? DEFAULTS.events),
        music: clamp01(saved.music ?? DEFAULTS.music),
        muted: Boolean(saved.muted),
      };
    }
  } catch {
    // Sin localStorage o con datos corruptos arrancamos con los valores por defecto.
  }
  return { ...DEFAULTS };
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Si no se puede guardar, los ajustes igual valen para esta partida.
  }
}

function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0));
}

function applyGains() {
  if (masterGain) masterGain.gain.value = settings.muted ? 0 : settings.master;
  CATEGORIES.forEach((cat) => {
    if (categoryGains[cat]) categoryGains[cat].gain.value = settings[cat];
  });
}

// El AudioContext se crea perezosamente: los navegadores lo bloquean hasta que hay
// una interacción del usuario, así que no tiene sentido crearlo antes de tiempo.
function getContext() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  ctx = new AudioCtx();
  masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  // Cada categoría cuelga del maestro, así el volumen general escala a todas.
  CATEGORIES.forEach((cat) => {
    const gain = ctx.createGain();
    gain.connect(masterGain);
    categoryGains[cat] = gain;
  });

  applyGains();
  return ctx;
}

// Se llama con la primera interacción del jugador (el menú), que es cuando el
// navegador permite arrancar el audio.
export function unlockAudio() {
  const context = getContext();
  if (context && context.state === 'suspended') context.resume();
}

export function getAudioSettings() {
  return { ...settings };
}

export function setVolume(key, value) {
  if (key !== 'master' && !CATEGORIES.includes(key)) return;
  settings[key] = clamp01(value);
  applyGains();
  saveSettings();
}

export function toggleMute() {
  settings.muted = !settings.muted;
  applyGains();
  saveSettings();
  return settings.muted;
}

// Envelope de ataque y caída, para que ninguna nota arranque o corte de golpe
// (un corte seco produce un "click" audible).
function envelope(gain, startAt, duration, volume) {
  const attack = Math.min(0.01, duration * 0.2);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
}

// Devuelve el nodo al que conectar según la categoría del efecto.
function outputFor(category) {
  return categoryGains[category] || masterGain;
}

// freqTo opcional: la frecuencia barre de `freq` a `freqTo` durante toda la nota,
// que es lo que da los sonidos que suben (level-up) o caen (daño recibido).
export function playTone({ freq, freqTo, type = 'square', duration = 0.1, volume = 0.2, delay = 0, category = 'events' }) {
  if (settings.muted) return;
  const context = getContext();
  if (!context) return;

  const startAt = context.currentTime + delay;
  const osc = context.createOscillator();
  const gain = context.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  if (freqTo && freqTo !== freq) {
    osc.frequency.exponentialRampToValueAtTime(freqTo, startAt + duration);
  }

  envelope(gain, startAt, duration, volume);

  osc.connect(gain);
  gain.connect(outputFor(category));
  osc.start(startAt);
  osc.stop(startAt + duration);
}

export function playNoise({ duration = 0.1, volume = 0.2, filterFreq = 1200, delay = 0, category = 'events' }) {
  if (settings.muted) return;
  const context = getContext();
  if (!context) return;

  const startAt = context.currentTime + delay;
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;

  const source = context.createBufferSource();
  source.buffer = buffer;

  // Filtro pasa-bajos: sin él el ruido blanco suena a estática de TV.
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, startAt);

  const gain = context.createGain();
  envelope(gain, startAt, duration, volume);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(outputFor(category));
  source.start(startAt);
  source.stop(startAt + duration);
}

// MIDI note number → frecuencia en Hz. A4 = MIDI 69 = 440 Hz.
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Cache de PeriodicWave para duty cycles (NES-style pulse). Reusamos el
// mismo wave por duty para no allocar en cada nota.
const pulseWaveCache = new Map();
function getPulseWave(context, duty) {
  const key = `${context.sampleRate}:${duty}`;
  if (pulseWaveCache.has(key)) return pulseWaveCache.get(key);
  const real = new Float32Array(32);
  const imag = new Float32Array(32);
  for (let n = 0; n < 32; n++) {
    const phase = n / 32;
    real[n] = phase < duty ? 1 : -1;
    imag[n] = 0;
  }
  const wave = context.createPeriodicWave(real, imag);
  pulseWaveCache.set(key, wave);
  return wave;
}

// Nota chiptune con soporte para vibrato, slide y filter envelope.
// waveform: 'square' | 'triangle' | 'sawtooth' | 'pulse'.
// duty: 0-1, solo aplica si waveform === 'pulse' (NES-style).
// vibrato: 0-12 Hz de modulacion de frequencia (tipicamente 4-6 Hz).
// slide: semitonos de portamento hacia arriba desde la nota.
// filterFreq + filterSweep: BiquadFilter lowpass con envolvente FM (abre
// el cutoff al inicio de la nota, decae).
export function playChipNote({
  note,
  duration = 0.15,
  waveform = 'square',
  duty = 0.5,
  vibrato = 0,
  slide = 0,
  filterFreq = null,
  filterSweep = false,
  volume = 0.15,
  velocity,
  glide = false,
  track,
  bpm,
  character = 0.5,
  energy = 0.5,
  delay = 0,
  category = 'music',
}) {
  if (settings.muted) return;
  const context = getContext();
  if (!context) return;

  // Modo voice (motor soondmaker): duracion llega como fraccion de beat,
  // hay track, character y energy para dar forma al filtro/ADSR.
  if (track) {
    playVoiceNote({
      note, duration, waveform, volume, velocity, glide, track,
      character, energy, bpm, delay, category,
    });
    return;
  }

  // Modo sfx/stinger: comportamiento legacy (vibrato, slide, filter opcional).
  const startAt = context.currentTime + delay;
  const freq = midiToFreq(note);
  const freqTo = slide > 0 ? freq * Math.pow(2, slide / 12) : null;

  const osc = context.createOscillator();
  const gain = context.createGain();
  const filter = filterFreq ? context.createBiquadFilter() : null;

  if (waveform === 'pulse') {
    osc.setPeriodicWave(getPulseWave(context, duty));
  } else {
    osc.type = waveform;
  }
  osc.frequency.setValueAtTime(freq, startAt);
  if (freqTo) {
    osc.frequency.exponentialRampToValueAtTime(freqTo, startAt + Math.min(0.05, duration / 4));
  }

  if (vibrato > 0) {
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.setValueAtTime(6, startAt);
    lfoGain.gain.setValueAtTime(vibrato, startAt);
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(startAt);
    lfo.stop(startAt + duration);
  }

  if (filter) {
    filter.type = 'lowpass';
    filter.Q.value = 4;
    if (filterSweep) {
      filter.frequency.setValueAtTime(filterFreq * 0.3, startAt);
      filter.frequency.exponentialRampToValueAtTime(filterFreq, startAt + 0.02);
      filter.frequency.exponentialRampToValueAtTime(filterFreq * 0.4, startAt + duration);
    } else {
      filter.frequency.setValueAtTime(filterFreq, startAt);
    }
  }

  envelope(gain, startAt, duration, volume);
  osc.connect(filter || gain);
  (filter || gain).connect(outputFor(category));
  osc.start(startAt);
  osc.stop(startAt + duration);
}

// Voice synthesis estilo soondmaker: filter lowpass con cutoff por
// character+energy, ADSR por track, glide como exponentialRamp a freq*1.12.
// Usado por chip-tracks.js (los 3 tracks del juego).
function playVoiceNote({
  note, duration, waveform, volume, velocity, glide, track,
  character, energy, bpm, delay, category,
}) {
  const context = getContext();
  if (!context) return;

  const safeChar = Math.max(0, Math.min(1, character));
  const safeEnergy = Math.max(0, Math.min(1, energy));

  // duracion viene como fraccion de beat; convertir a segundos.
  const safeBpm = bpm || 120;
  const durationSec = duration * (60 / safeBpm);

  // soondmaker aplica multipliers por track:
  //   chord: 1.3 (notas mas largas), bass/lead: 0.76 (notas mas cortas).
  const trackMultiplier = track === 'chord' ? 1.3 : 0.76;
  const finalDuration = durationSec * trackMultiplier;

  const startAt = context.currentTime + delay;
  const freq = midiToFreq(note);

  const osc = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  // Bass usa triangle si character es bajo, square si no.
  if (track === 'bass') {
    osc.type = safeChar < 0.38 ? 'triangle' : 'square';
  } else if (waveform === 'pulse') {
    osc.setPeriodicWave(getPulseWave(context, 0.5));
  } else {
    osc.type = waveform;
  }

  osc.frequency.setValueAtTime(freq, startAt);
  if (glide) {
    osc.frequency.exponentialRampToValueAtTime(freq * 1.12, startAt + finalDuration * 0.48);
  }

  // Filter lowpass con cutoff derivado de character y energy.
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700 + safeChar * 6000 + safeEnergy * 1700, startAt);
  filter.Q.value = 0.8 + safeChar * 4;

  // ADSR: attack corto, sustain level, release.
  const attack = track === 'chord' ? 0.012 : 0.004;
  const release = track === 'chord' ? 0.085 : 0.045;
  const vel = velocity != null ? velocity : 0.7;
  const peak = Math.max(0.015, Math.min(0.32, vel * (track === 'bass' ? 0.34 : 0.22)));

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + attack);
  gain.gain.setValueAtTime(peak * 0.72, startAt + Math.max(attack, finalDuration * 0.45));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + finalDuration + release);

  osc.connect(filter).connect(gain).connect(outputFor(category));
  osc.start(startAt);
  osc.stop(startAt + finalDuration + release + 0.02);
}

// Percusion FM-style: kick profundo, snare con cuerpo tonal, hi-hat
// cerrado y abierto. Cada uno con envelope caracteristico.
export function playDrumHit({ type = 'kick', volume = 0.3, delay = 0, category = 'music' }) {
  if (settings.muted) return;
  const context = getContext();
  if (!context) return;

  const startAt = context.currentTime + delay;
  const frameCount = Math.max(1, Math.floor(context.sampleRate * 0.25));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  switch (type) {
    case 'kick':
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, startAt);
      filter.frequency.exponentialRampToValueAtTime(50, startAt + 0.1);
      gain.gain.setValueAtTime(volume, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.15);
      break;
    case 'snare': {
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000, startAt);
      gain.gain.setValueAtTime(volume * 0.7, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.12);
      const tone = context.createOscillator();
      const toneGain = context.createGain();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(200, startAt);
      tone.frequency.exponentialRampToValueAtTime(80, startAt + 0.1);
      toneGain.gain.setValueAtTime(volume * 0.4, startAt);
      toneGain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.12);
      tone.connect(toneGain).connect(gain);
      tone.start(startAt);
      tone.stop(startAt + 0.15);
      break;
    }
    case 'hihat-c':
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, startAt);
      gain.gain.setValueAtTime(volume * 0.3, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.04);
      break;
    case 'hihat-o':
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(6000, startAt);
      gain.gain.setValueAtTime(volume * 0.25, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.2);
      break;
    default:
      return;
  }

  source.connect(filter);
  filter.connect(gain);
  gain.connect(outputFor(category));
  source.start(startAt);
  source.stop(startAt + 0.25);
}

// Scheduler de BGM. A diferencia del primer port, este transporte no calcula
// el tiempo con modulo: cada evento recibe una hora absoluta de AudioContext.
// Así el límite entre los bloques de cuatro compases no puede perder notas.
let bgmScheduler = null;
let bgmCurrentTrack = null;
let bgmGenerator = null;
let bgmBpm = 0;
let bgmStarted = false;
let bgmCurrentConfig = null;
let bgmTransport = null;

// Transporte puro para poder verificar el paso entre bloques sin Web Audio.
// `takeThrough` devuelve los eventos hasta `endTime`, siempre ordenados por su
// tiempo absoluto. El generador puede crear un bloque distinto al terminar el
// anterior, pero el reloj nunca vuelve a cero.
export function createBgmEventTransport(generator, startTime) {
  const first = generator.next();
  if (first.done || !first.value) throw new Error('El generador de BGM no produjo un bloque inicial.');

  let batch = first.value;
  let batchStartTime = startTime;
  let events = [...batch.events].sort((a, b) => a.time - b.time);
  let eventIndex = 0;

  const advanceBatch = () => {
    batchStartTime += (batch.length * 4) / (batch.bpm / 60);
    const next = generator.next();
    if (next.done || !next.value) return false;
    batch = next.value;
    events = [...batch.events].sort((a, b) => a.time - b.time);
    eventIndex = 0;
    return true;
  };

  return {
    get bpm() { return batch.bpm; },
    get config() { return batch.config; },
    takeThrough(endTime) {
      const due = [];
      while (true) {
        if (eventIndex === events.length) {
          if (!advanceBatch()) return due;
          continue;
        }
        const event = events[eventIndex];
        const eventTime = batchStartTime + event.time / (batch.bpm / 60);
        if (eventTime > endTime) return due;
        due.push({ event, time: eventTime, bpm: batch.bpm, config: batch.config });
        eventIndex += 1;
      }
    },
  };
}

export function startBgm(trackName, tracks, generators) {
  stopBgm();
  const context = getContext();
  if (!context) return;
  if (!generators || !generators[trackName]) return;
  bgmGenerator = generators[trackName]();
  bgmCurrentTrack = trackName;
  bgmScheduler = setInterval(scheduleGeneratorStep, 25);
}

function scheduleGeneratorStep() {
  const context = getContext();
  if (!context) return;
  if (!bgmGenerator) return;

  // Si el contexto se creó antes del gesto del usuario esperamos aquí. El
  // transporte se crea recién al estar running para no acumular eventos viejos.
  if (!bgmStarted) {
    if (context.state !== 'running') return;
    try {
      bgmTransport = createBgmEventTransport(bgmGenerator, context.currentTime + 0.05);
    } catch {
      stopBgm();
      return;
    }
    bgmBpm = bgmTransport.bpm;
    bgmCurrentConfig = bgmTransport.config;
    bgmStarted = true;
  }

  const due = bgmTransport.takeThrough(context.currentTime + 0.14);
  due.forEach(({ event, time, bpm, config }) => {
    bgmBpm = bpm;
    bgmCurrentConfig = config;
    playEvent(event, Math.max(0, time - context.currentTime));
  });
}

function playEvent(ev, delay) {
  if (ev.type === 'note') {
    const c = bgmCurrentConfig;
    playChipNote({
      ...ev.params,
      delay,
      bpm: bgmBpm,
      character: c?.character,
      energy: c?.energy,
    });
  } else if (ev.type === 'drum') {
    playDrumHit({ ...ev.params, delay });
  }
}

// Stingers: piezas cortas que suenan una vez sobre la musica actual sin
// pausarla. Los eventos se agendan via delay relativo a currentTime, asi
// se reproducen en paralelo con el loop.
export function playStinger(events) {
  if (events.length === 0) return;
  const context = getContext();
  if (!context) return;
  // Reproducir cada evento con su offset absoluto desde el momento presente.
  events.forEach((ev) => {
    const delay = ev.time;
    if (ev.type === 'note') {
      playChipNote({ ...ev.params, delay });
    } else if (ev.type === 'drum') {
      playDrumHit({ ...ev.params, delay });
    }
  });
}

export function stopBgm() {
  if (bgmScheduler) clearInterval(bgmScheduler);
  bgmScheduler = null;
  bgmCurrentTrack = null;
  bgmGenerator = null;
  bgmBpm = 0;
  bgmStarted = false;
  bgmCurrentConfig = null;
  bgmTransport = null;
}

export function isAudioReady() {
  if (!ctx) return false;
  return ctx.state === 'running';
}
