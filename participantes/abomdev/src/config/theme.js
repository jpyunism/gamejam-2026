// Paleta y tipografía centralizadas. Todo color que se vea en pantalla sale de acá,
// para que la UI se lea como un solo sistema y cambiar un tono sea un solo edit.
// Phaser pide números (0x...) para formas y strings ('#...') para texto, así que
// donde hace falta están las dos formas del mismo color.

export const FONT = 'monospace';

export const FONT_SIZE = {
  title: '42px',
  heading: '30px',
  subheading: '26px',
  body: '17px',
  label: '15px',
  small: '14px',
  tiny: '12px',
};

export const UI = {
  panelBg: 0x181830,
  panelAlpha: 0.97,
  panelBorder: 0x444466,
  overlay: 0x05050a,
  overlayAlpha: 0.6,
  barTrack: 0x222244,
  divider: 0x444466,
};

export const TEXT = {
  primary: '#ffffff',
  secondary: '#cceeff',
  muted: '#aaaaaa',
  dim: '#888899',
  accent: '#66ffcc',
  info: '#66aaff',
  gold: '#ffcc44',
  danger: '#ff5566',
  boss: '#ff88cc',
  stage: '#aa88ff',
  shield: '#66ddff',
};

// Colores de las barras del HUD y de la barra de jefe.
export const BAR = {
  hp: 0xff5566,
  shield: 0x66ddff,
  xp: 0xaa88ff,
  boss: 0xff33aa,
};

export const MINIMAP = {
  bg: 0x000000,
  bgAlpha: 0.55,
  border: 0x66ffcc,
  player: 0x66ffcc,
  chest: 0xffcc44,
};

export const RARITY_WEIGHT = { common: 3, rare: 2, epic: 1 };
export const RARITY_COLOR = { common: '#66ffcc', rare: '#66aaff', epic: '#ffcc44' };
export const RARITY_COLOR_NUM = { common: 0x66ffcc, rare: 0x66aaff, epic: 0xffcc44 };
export const RARITY_LABEL = { common: 'COMÚN', rare: 'RARA', epic: 'ÉPICA' };

// Cada etapa recolorea el grid del mundo y el fondo de cámara, para que se note
// que cambiaste de escenario y no solo el número en el HUD.
export const STAGE_THEMES = {
  1: { fill: 0x1a1a2e, line: 0x2a2a4e, bg: '#111122' },
  2: { fill: 0x2a1414, line: 0x4e2424, bg: '#1a0e0e' },
  3: { fill: 0x1a0e2a, line: 0x36204e, bg: '#120a1a' },
};
