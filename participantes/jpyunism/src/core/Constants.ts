/**
 * Neon Drift — ALL magic numbers in one place.
 * Zero hardcoded values in game logic.
 */

// ─── Canvas / Arena ────────────────────────────────────────────────────
export const GAME = {
  WIDTH: 1280,
  HEIGHT: 960,
  BG_COLOR: "#0a0a0f",
} as const;

// ─── Responsive Layout ─────────────────────────────────────────────────
export const LAYOUT = {
  BASELINE_W: 1280,
  BASELINE_H: 960,
  MIN_SCALE: 0.45,
  FONT_MIN_PX: 8,
} as const;

// ─── Player ────────────────────────────────────────────────────────────
export const PLAYER = {
  HP: 100,
  MAX_HP: 100,
  SHIELD: 50,
  MAX_SHIELD: 50,
  SPEED: 200,
  SHIELD_RECHARGE_DELAY_MS: 2500,
  SHIELD_RECHARGE_RATE: 12, // per second
  INVULNERABILITY_MS: 500,
  TEXTURE_SIZE: 24,
  BODY_SIZE: 24,
  GLOW_RADIUS: 16,
  GLOW_ALPHA: 0.15,
  GLOW_TARGET_ALPHA: 0.25,
  GLOW_SCALE: 1.15,
  GLOW_TWEEN_DURATION_MS: 900,
} as const;

// ─── Enemy types ───────────────────────────────────────────────────────
export const ENEMY = {
  CHASER: { hp: 15, speed: 110, damage: 10, tint: 0xff0000, textureSize: 20 },
  SHOOTER: { hp: 12, speed: 60, damage: 8, tint: 0xffff00, textureSize: 20 },
  TANK: { hp: 80, speed: 40, damage: 20, tint: 0xff00ff, textureSize: 32 },

  DEFAULT_BODY_SIZE: 20,
  GLOW_ALPHA: 0.18,
  DEATH_FADE_DURATION_MS: 200,
  DEATH_SCALE: 0.5,

  LOOT_COINS_MIN: 1,
  LOOT_COINS_MAX: 3,
  HEAL_CHANCE: 0.15,
  HEAL_AMOUNT: 10,

  SHOOTER_PREFERRED_DISTANCE: 200,
  SHOOTER_FIRE_INTERVAL_MS: 2500,
  SHOOTER_PROJECTILE_SPEED: 200,
  SHOOTER_PROJECTILE_RADIUS: 5,
  SHOOTER_PROJECTILE_DAMAGE: 8,
} as const;

// ─── Weapons ────────────────────────────────────────────────────────────
export const WEAPON = {
  PLASMA: { damage: 15, cooldownMs: 300, range: 400, speed: 500 },
  PULSE: { damage: 8, cooldownMs: 100, range: 350, speed: 600, spreadDeg: 5 },
  GRENADE: { damage: 40, cooldownMs: 1500, range: 300, speed: 350, explosionRadius: 60, fuseMs: 500 },
  ELECTRIC: { damage: 5, cooldownMs: 50, range: 300, coneDeg: 10 },
  FLAMETHROWER: { damage: 12, cooldownMs: 800, range: 250, speed: 300, zoneRadius: 40, zoneDurationMs: 2000, tickIntervalMs: 500, tickDamage: 5 },

  TRAIL_ALPHA: 0.5,
  TRAIL_SCALE: 2,
  TRAIL_DURATION_MS: 180,
} as const;

// ─── Map / Arena ───────────────────────────────────────────────────────
export const MAP = {
  WALL_THICKNESS: 8,
  PILLAR_MIN_SIZE: 24,
  PILLAR_MAX_SIZE: 32,
  PILLAR_MIN_SEPARATION: 60,
  PILLAR_COUNT_MIN: 15,
  PILLAR_COUNT_MAX: 25,
  SAFE_CENTER_HALF: 200, // 400x400 safe spawn zone
  WALL_TEXTURE_SIZE: 4,
  PILLAR_TEXTURE_SIZE: 32,
  PILLAR_GLOW_ALPHA_MIN: 0.08,
  PILLAR_GLOW_ALPHA_MAX: 0.18,
  PILLAR_GLOW_DURATION_BASE_MS: 1500,
  PILLAR_GLOW_DURATION_JITTER_MS: 800,
} as const;

// ─── Wave Manager ──────────────────────────────────────────────────────
export const WAVE = {
  HORDE_DURATION_MS: 10_000,
  HORDE_INTERVAL_MS: 25_000,
  SPAWN_INTERVAL_MIN_MS: 1200,
  SPAWN_INTERVAL_MAX_MS: 3000,
  SPAWN_MARGIN: 100,
  CHASER_WEIGHT: 60, // percent
  HORDE_MIXED_MIN: 6,
  HORDE_MIXED_MAX: 10,
  HORDE_TANK_COUNT: 1,
  DIFFICULTY_WAVE_CAP: 6,
  DIFFICULTY_MULTIPLIER_PER_WAVE: 0.1,
} as const;

// ─── Level-up / Power-ups ──────────────────────────────────────────────
export const LEVEL_UP = {
  KILLS_REQUIRED_BASE: 8,
  KILLS_INCREMENT: 4,
  OFFER_COUNT: 3,
  SPEED_BOOST_PCT: 0.15,
  DAMAGE_BOOST_PCT: 0.2,
  CADENCE_BOOST_PCT: 0.3, // cooldown multiplier
  SHIELD_SURGE_AMOUNT: 50,
  TIMED_DURATION_MS: 30_000,
  SHORT_DURATION_MS: 15_000,
  EXPLOSION_RADIUS: 40,
  EXPLOSION_DAMAGE: 10,
  EXPLOSION_FX_DURATION_MS: 250,
} as const;

// ─── Meta-progression ──────────────────────────────────────────────────
export const META = {
  STORAGE_KEY: "neon-drift:meta",
  COST_BASE: 100,
  COST_MULTIPLIER: 2,
  DAMAGE_PCT_PER_LV: 10,
  SPEED_PCT_PER_LV: 8,
  SHIELD_PER_LV: 20,
  REGEN_PCT_PER_LV: 15,
  CADENCE_PCT_PER_LV: 8,
  MAX_DAMAGE_LV: 5,
  MAX_SPEED_LV: 3,
  MAX_SHIELD_LV: 5,
  MAX_REGEN_LV: 3,
  MAX_CADENCE_LV: 5,
  MIN_SHIELD_DELAY_MS: 1000,
  MIN_WEAPON_COOLDOWN_MS: 50,
} as const;

// ─── Audio ──────────────────────────────────────────────────────────────
export const AUDIO = {
  DEFAULT_VOLUME: 0.5,
  DEFAULT_MUTED: false,
  STORAGE_KEY: "neon-drift:audio",
  FADE_IN_MS: 1000,
  MENU_MUSIC_KEY: "menu-music",
  BATTLE_TRACK_KEYS: ["battle-1", "battle-2", "battle-3", "battle-4"] as const,
} as const;

// ─── UI / HUD ──────────────────────────────────────────────────────────
export const HUD = {
  LEFT_PANEL_X: 10,
  LEFT_PANEL_Y: 10,
  LEFT_PANEL_W: 200,
  LEFT_PANEL_H: 70,
  BAR_PAD_X: 10,
  BAR_W: 180,
  HP_BAR_Y: 32,
  SHIELD_BAR_Y: 56,
  BAR_HEIGHT: 14,

  HP_BAR_BG: 0x220000,
  HP_BAR_FILL: 0xff3344,
  SHIELD_BAR_BG: 0x001a33,
  SHIELD_BAR_FILL: 0x44aaff,

  COINS_FONT_SIZE: "14px",
  COINS_COLOR: "#ffd700",

  RIGHT_PANEL_W: 180,
  RIGHT_PANEL_H: 50,
  RIGHT_PANEL_MARGIN: 10,

  WAVE_FONT_SIZE: "12px",
  LEVEL_FONT_SIZE: "12px",
  KILLS_FONT_SIZE: "11px",

  XP_BAR_HEIGHT: 6,
  XP_BAR_BG: 0x222244,
  XP_BAR_FILL: 0x00ff66,

  SLOT_W: 100,
  SLOT_H: 40,
  SLOT_GAP: 10,
  SLOT_BOTTOM_MARGIN: 50,
  SLOT_NAME_FONT_SIZE: "12px",
  SLOT_EMPTY_FONT_SIZE: "16px",
  COOLDOWN_BAR_H: 3,
  COOLDOWN_BAR_BG: 0x111122,
  COOLDOWN_BAR_FILL: 0x00ffff,

  DEPTH_BG: 900,
  DEPTH_BORDER: 901,
  DEPTH_LABEL: 903,
} as const;

export const MENU = {
  TITLE_FONT_SIZE: "44px",
  SUBTITLE_FONT_SIZE: "14px",
  TITLE_Y_PCT: 0.18,
  SUBTITLE_OFFSET_Y: 32,
  ROW_Y_PCT: 0.55,
  INSTRUCTION_Y_PCT: 0.78,
  START_HINT_Y_PCT: 0.85,
  COINS_Y_OFFSET: 40,
  SETTINGS_BTN_X_OFFSET: 90,
  SETTINGS_BTN_Y_OFFSET: 30,
  START_HINT_FONT_SIZE: "20px",
  SETTINGS_FONT_SIZE: "14px",
  TITLE_SHADOW_SIZE: 16,
  HINT_SHADOW_SIZE: 8,

  CARD_W: 180,
  CARD_H: 160,
  CARD_GAP: 18,
  CARD_BORDER_DEFAULT: 0x00ffff,
  CARD_BORDER_SELECTED: 0x00ff66,
  CARD_BG: 0x101830,
  CARD_BORDER_HOVER: 0x66ddff,
  CARD_NAME_FONT_SIZE: "18px",
  CARD_DMG_FONT_SIZE: "13px",
  CARD_DESC_FONT_SIZE: "11px",
  CARD_ID_FONT_SIZE: "9px",
  CARD_NAME_Y_OFFSET: -50,
  CARD_DMG_Y_OFFSET: -20,
  CARD_DESC_Y_OFFSET: 18,
  CARD_ID_Y_OFFSET: 56,
  CARD_DESC_WORD_WRAP_PAD: 16,

  REQUIRED_PICKS: 2,
} as const;

export const GAME_OVER = {
  TITLE_FONT_SIZE: "56px",
  TITLE_Y: 100,
  TITLE_SHADOW: 18,
  SUMMARY_FONT_SIZE: "20px",
  SUMMARY_Y_START: 200,
  SUMMARY_Y_STEP: 32,
  COINS_FONT_SIZE: "18px",
  COINS_Y: 296,
  HINT_FONT_SIZE: "16px",
  HINT_Y_START: 360,
  HINT_Y_STEP: 28,
  TIP_FONT_SIZE: "12px",
  TIP_BOTTOM_MARGIN: 40,

  SHOP_W: 520,
  SHOP_H: 360,
  SHOP_BG: 0x10102a,
  SHOP_BG_ALPHA: 0.92,
  SHOP_BORDER: 0x00ffff,
  SHOP_HEADER_FONT_SIZE: "16px",
  SHOP_HEADER_Y: -150,
  SHOP_LINE_FONT_SIZE: "14px",
  SHOP_LINE_Y_START: -110,
  SHOP_LINE_Y_STEP: 38,
  SHOP_STATUS_FONT_SIZE: "12px",
  SHOP_STATUS_Y: 110,
} as const;

export const POWERUP_SELECT = {
  DEPTH: 2000,
  TITLE_FONT_SIZE: "26px",
  TITLE_Y_OFFSET: -200,
  HINT_FONT_SIZE: "12px",
  HINT_Y_OFFSET: -165,
  CARD_W: 420,
  CARD_H: 90,
  CARD_GAP: 18,
  CARD_BG: 0x0a0a1a,
  CARD_BG_ALPHA: 0.92,
  CARD_BORDER_W: 2,
  CARD_HIGHLIGHT_BORDER_W: 3,
  CARD_HIGHLIGHT_BG: 0x112233,
  CARD_HIGHLIGHT_ALPHA: 0.95,
  KEY_FONT_SIZE: "22px",
  KEY_X_OFFSET: 16,
  NAME_FONT_SIZE: "18px",
  NAME_X_OFFSET: 80,
  NAME_Y_OFFSET: 28,
  DESC_FONT_SIZE: "12px",
  DESC_Y_OFFSET: 58,
  PALETTE: [0x00ffff, 0xff00ff, 0xffd700] as readonly number[],
} as const;

export const SETTINGS = {
  PANEL_W: 360,
  PANEL_H: 220,
  PANEL_BG: 0x10102a,
  PANEL_ALPHA: 0.95,
  PANEL_BORDER: 0x00ffff,
  DEPTH: 2100,
  TITLE_FONT_SIZE: "18px",
  SLIDER_PAD_X: 40,
  SLIDER_TRACK_H: 6,
  SLIDER_KNOB_RADIUS: 10,
  SLIDER_Y: 24,
  SLIDER_STEP: 0.05,
  SLIDER_SAVE_DEBOUNCE_MS: 100,
  VOLUME_LABEL_FONT_SIZE: "12px",
  VALUE_LABEL_FONT_SIZE: "12px",
  MUTE_BTN_W: 120,
  MUTE_BTN_H: 36,
  MUTE_BTN_Y: 80,
  MUTE_LABEL_FONT_SIZE: "14px",
  HINT_FONT_SIZE: "11px",
} as const;

// ─── Background grid ────────────────────────────────────────────────────
export const GRID = {
  STEP: 40,
  COLOR: 0x00ffff,
  ALPHA: 0.03,
  DEPTH: -10,
} as const;

// ─── Coin drop visual ───────────────────────────────────────────────────
export const COIN_DROP = {
  RADIUS: 4,
  COLOR: 0xffd700,
  FLOAT_Y: -20,
  FADE_DURATION_MS: 600,
} as const;

// ─── Trail (shared projectile trail) ───────────────────────────────────
export const TRAIL = {
  RADIUS: 4,
  ALPHA: 0.5,
  SCALE: 2,
  DURATION_MS: 180,
} as const;

// ─── Pause overlay ──────────────────────────────────────────────────────
export const PAUSE = {
  DEPTH: 2000,
  BACKDROP_ALPHA: 0.55,
  TEXT_FONT_SIZE: "32px",
  TEXT_Y_OFFSET: -130,
} as const;

// ─── Camera ─────────────────────────────────────────────────────────────
export const CAMERA = {
  FOLLOW_LERP_X: 0.1,
  FOLLOW_LERP_Y: 0.1,
} as const;

// ─── Colors (shared) ────────────────────────────────────────────────────
export const COLOR = {
  CYAN: "#00ffff",
  MAGENTA: "#ff00ff",
  GOLD: "#ffd700",
  WHITE: "#ffffff",
  DIM: "#888888",
  DARK: "#446688",
  ORANGE: "#ff5500",
  RED: "#ff0000",
  YELLOW: "#ffff00",
  GREEN: "#00ff66",
  ERROR: "#ff4444",
  SUCCESS: "#00ff00",
  WARNING: "#ffaa00",
} as const;
