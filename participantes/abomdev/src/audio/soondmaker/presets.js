export const PRESETS = Object.freeze({
  arcade: Object.freeze({
    id: 'arcade', name: 'Arcade Rush', tag: 'BRILLO / IMPULSO', icon: '↗',
    description: 'Pulso veloz, arpegios luminosos y una melodía que no se queda quieta.',
    tempo: 154, root: 'A', scale: 'major', energy: 0.84, density: 0.68, complexity: 0.58, character: 0.82,
    progression: [0, 4, 5, 3], seed: 'ARCADE-88', wave: 'square', swing: 0, leadPatterns: ['straight', 'cascade', 'syncopated'], bassPatterns: ['drive', 'roots'], drumPattern: 'four',
  }),
  neon: Object.freeze({
    id: 'neon', name: 'Neon Drift', tag: 'NOCTURNO / SINTÉTICO', icon: '◌',
    description: 'Bajo profundo, acordes suspendidos y un neón que respira despacio.',
    tempo: 104, root: 'F#', scale: 'dorian', energy: 0.55, density: 0.52, complexity: 0.42, character: 0.44,
    progression: [0, 5, 3, 4], seed: 'NEON-04', wave: 'triangle', swing: 0.08, leadPatterns: ['sparse', 'call', 'syncopated'], bassPatterns: ['pulse', 'roots'], drumPattern: 'halftime',
  }),
  dungeon: Object.freeze({
    id: 'dungeon', name: 'Dungeon Loop', tag: 'OSCURA / RITUAL', icon: '✦',
    description: 'Una marcha de pasadizo: intervalos tensos, piedra, ecos y peligro.',
    tempo: 118, root: 'D', scale: 'phrygian', energy: 0.7, density: 0.5, complexity: 0.64, character: 0.65,
    progression: [0, 1, 6, 4], seed: 'CRYPT-16', wave: 'sawtooth', swing: 0.02, leadPatterns: ['march', 'call', 'cascade'], bassPatterns: ['march', 'roots'], drumPattern: 'march',
  }),
  lofi: Object.freeze({
    id: 'lofi', name: 'Pocket Lo-fi', tag: 'SUAVE / DESGASTADO', icon: '≈',
    description: 'Batería mínima, armonía tibia y una melodía de sobremesa.',
    tempo: 82, root: 'C', scale: 'major', energy: 0.35, density: 0.48, complexity: 0.34, character: 0.22,
    progression: [0, 5, 3, 4], seed: 'POCKET-5', wave: 'triangle', swing: 0.12, leadPatterns: ['sparse', 'call'], bassPatterns: ['roots', 'pulse'], drumPattern: 'break',
  }),
  bitpop: Object.freeze({
    id: 'bitpop', name: 'Bit Pop', tag: 'DULCE / ELÉCTRICO', icon: '♥',
    description: 'Ganchos de bolsillo, percusión brillante y azúcar digital.',
    tempo: 132, root: 'E', scale: 'major', energy: 0.76, density: 0.74, complexity: 0.48, character: 0.9,
    progression: [0, 5, 3, 4], seed: 'POP-120', wave: 'square', swing: 0.04, leadPatterns: ['straight', 'call', 'syncopated'], bassPatterns: ['drive', 'pulse'], drumPattern: 'bounce',
  }),
  skyline: Object.freeze({
    id: 'skyline', name: 'Skyline Circuit', tag: 'AÉREO / LUMINOSO', icon: '⌁',
    description: 'Horizonte lidio, arpegios que ascienden y una sensación de despegue.',
    tempo: 126, root: 'B', scale: 'lydian', energy: 0.62, density: 0.6, complexity: 0.67, character: 0.7,
    progression: [0, 1, 4, 0], seed: 'SKY-404', wave: 'triangle', swing: 0.03, leadPatterns: ['cascade', 'straight', 'syncopated'], bassPatterns: ['pulse', 'drive'], drumPattern: 'four',
  }),
  boss: Object.freeze({
    id: 'boss', name: 'Boss Arena', tag: 'INTENSO / DRAMÁTICO', icon: '⚔',
    description: 'Menor armónica, marcha de combate y una resolución que exige volver.',
    tempo: 146, root: 'A', scale: 'harmonicMinor', energy: 0.9, density: 0.72, complexity: 0.7, character: 0.77,
    progression: [0, 5, 4, 0], seed: 'BOSS-7F', wave: 'sawtooth', swing: 0, leadPatterns: ['march', 'cascade', 'syncopated'], bassPatterns: ['march', 'drive'], drumPattern: 'march',
  }),
  moonlit: Object.freeze({
    id: 'moonlit', name: 'Moonlit Route', tag: 'ÍNTIMO / ERRANTE', icon: '☾',
    description: 'Menor natural, breakbeat delicado y frases que contestan al silencio.',
    tempo: 96, root: 'G', scale: 'minor', energy: 0.43, density: 0.55, complexity: 0.53, character: 0.34,
    progression: [0, 5, 2, 6], seed: 'MOON-2A', wave: 'triangle', swing: 0.1, leadPatterns: ['call', 'sparse', 'syncopated'], bassPatterns: ['pulse', 'roots'], drumPattern: 'break',
  }),
  forest: Object.freeze({
    id: 'forest', name: 'Forest Cartridge', tag: 'ORGÁNICO / AMABLE', icon: '❋',
    description: 'Mayor pastoral, pulso suave y pequeñas rutas entre ramas de ocho bits.',
    tempo: 112, root: 'G', scale: 'major', energy: 0.48, density: 0.58, complexity: 0.46, character: 0.5,
    progression: [0, 3, 5, 4], seed: 'FOREST-3', wave: 'square', swing: 0.07, leadPatterns: ['call', 'straight', 'sparse'], bassPatterns: ['roots', 'pulse'], drumPattern: 'bounce',
  }),
});