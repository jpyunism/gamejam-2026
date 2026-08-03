import Phaser from 'phaser';

import {
  BOSS_COUNTDOWN_MS, BOSS_FIGHT_LIMIT_MS, BOSS_OVERSTAY_MULTIPLIER, BOSS_PROJECTILE_LIFETIME,
  BOSS_PROJECTILE_SPEED, BOSS_RANGED_PREFERRED_DIST, BOSS_SHOT_COOLDOWN_MS, BOSS_TELEGRAPH_MS,
  BOSS_WARNING_MS, CHEST_DELAY_MS, CHEST_TRIGGER_RADIUS, DIFFICULTY_RAMP_MS, ENEMY_KNOCKBACK_MS,
  ENEMY_KNOCKBACK_SPEED, HIT_INVULN_MS, LEVEL_UP_DEBUG_KEY, MAX_ENEMIES, MAX_SPAWN_PER_TICK, ORBIT_HIT_COOLDOWN_MS,
  ORBIT_HIT_RADIUS, PIERCE_LIFETIME, PLAYER_KNOCKBACK_MS, PLAYER_KNOCKBACK_SPEED, PLAYER_MAX_HP,
  PORTAL_TRIGGER_RADIUS, PROJECTILE_LIFETIME, PROJECTILE_SPEED, SHIELD_REGEN_DELAY_MS,
  SPAWN_DELAY_MIN, SPAWN_RADIUS_MARGIN, STAGE_BOSS_MULTIPLIER, STAGE_PORTAL_MULTIPLIER,
  VICTORY_STAGE, WORLD_SIZE, XP_PICKUP_SPEED,
} from '../config/constants.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import {
  COOLDOWN_STATS, GROWTH_STATS, LEVEL_SCALE_DOWN, LEVEL_SCALE_UP,
  STAT_UPGRADES, WEAPON_KEYS, WEAPON_UPGRADES,
} from '../config/upgrades.js';
import { FONT_SIZE, RARITY_WEIGHT, STAGE_THEMES, TEXT } from '../config/theme.js';
import { generateTextures } from '../assets/textures.js';
import { preloadIcons } from '../assets/icons.js';
import Hud from '../ui/Hud.js';
import Minimap from '../ui/Minimap.js';
import PauseMenu, { buildStatRows, buildWeaponSlots } from '../ui/PauseMenu.js';
import SettingsPanel from '../ui/SettingsPanel.js';
import LevelUpMenu from '../ui/LevelUpMenu.js';
import TouchControls from '../ui/TouchControls.js';
import EndScreen from '../ui/EndScreen.js';
import { playSfx } from '../audio/sfx.js';
import { toggleMute, unlockAudio, startBgm, stopBgm, playStinger } from '../audio/synth.js';
import { createGameTrack, createBossTrack } from '../audio/chip-tracks.js';
import { generateLevelupStinger, generateGameoverStinger } from '../audio/stingers.js';

const TRACK_GENERATORS = {
  game: createGameTrack,
  boss: createBossTrack,
};
import { toggleFullscreen } from '../utils/fullscreen.js';
import { lockLandscape, unlockOrientation } from '../utils/orientation.js';
import { isTouchDevice } from '../utils/device.js';
import { panel, text } from '../ui/widgets.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  preload() {
    preloadIcons(this);
  }

  create() {
    this.initState();

    this.physics.world.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.worldGrid = this.add.grid(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE, 64, 64, 0x1a1a2e, 1, 0x2a2a4e, 1);
    this.worldGrid.setDepth(-1);

    generateTextures(this);
    this.createPlayer();
    this.createGroups();
    this.createTimers();
    this.createEmitter();
    this.createUI();
    this.bindInput();
    // Por si se entra directo a esta escena sin pasar por el menú.
    unlockAudio();
    startBgm('game', null, TRACK_GENERATORS);

    if (isTouchDevice() && this.isPortrait()) {
      this.showPortraitHint();
    }
    this.scale.on('resize', this.onResizePortrait, this);
    this.events.once('shutdown', () => stopBgm());
  }

  isPortrait() {
    return window.innerHeight > window.innerWidth;
  }

  onResizePortrait() {
    if (this.isPortrait()) {
      if (!this.portraitHint) this.showPortraitHint();
    } else {
      this.hidePortraitHint();
    }
  }

  showPortraitHint() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.portraitHint = panel(this, {
      width: 320, height: 56, depth: 500, border: 0xffaa00, origin: 0.5,
    });
    this.portraitHintText = text(this, '↻ Rotá el celular para jugar', {
      size: '16px', color: 0xffaa00, depth: 501, origin: 0.5,
    });
    this.portraitHint.setPosition(cx, cy);
    this.portraitHintText.setPosition(cx, cy);
  }

  hidePortraitHint() {
    this.portraitHint?.destroy();
    this.portraitHintText?.destroy();
    this.portraitHint = null;
    this.portraitHintText = null;
  }

  initState() {
    this.stats = {
      damage: 20,
      fireRate: 600,
      moveSpeed: 220,
      maxHp: PLAYER_MAX_HP,
      hp: PLAYER_MAX_HP,
      magnetRadius: 90,
      hasAura: false,
      hasOrbit: false,
      hasPierce: false,
      hasBurst: false,
      hasNova: false,
      hpRegen: 0,
      lifesteal: 0,
      dodge: 0,
      shieldMax: 0,
      shield: 0,
    };
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 10;
    this.elapsed = 0;
    this.isLevelingUp = false;
    this.isGameOver = false;
    this.hasWon = false;
    this.isPaused = false;
    this.endScreen = null;
    this.lastHitAt = -Infinity;
    this.lastDamageTakenAt = -Infinity;
    this.playerKnockbackUntil = 0;
    this.chest = null;
    this.portal = null;
    this.auraGfx = null;
    this.auraTickAt = 0;
    this.orbitOrbs = [];
    this.isBossAlive = false;
    this.currentBoss = null;
    this.bossCountdown = BOSS_COUNTDOWN_MS;
    this.bossFightCountdown = null;
    this.stage = 1;
    this.stageMultiplier = 1;
    this.computeSpawnRadius();
  }

  createPlayer() {
    this.player = this.physics.add.sprite(WORLD_SIZE / 2, WORLD_SIZE / 2, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
  }

  createGroups() {
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.pierceProjectiles = this.physics.add.group();
    this.bossProjectiles = this.physics.add.group();
    this.xpOrbs = this.physics.add.group();

    this.physics.add.overlap(this.projectiles, this.enemies, this.onProjectileHitEnemy, null, this);
    this.physics.add.overlap(this.pierceProjectiles, this.enemies, this.onPierceHitEnemy, null, this);
    this.physics.add.overlap(this.player, this.bossProjectiles, this.onBossProjectileHitPlayer, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitEnemy, null, this);
    this.physics.add.overlap(this.player, this.xpOrbs, this.onPlayerPickupXp, null, this);
  }

  createTimers() {
    this.spawnTimer = this.time.addEvent({ delay: 1000, loop: true, callback: this.spawnEnemy, callbackScope: this });
    this.attackTimer = this.time.addEvent({ delay: this.stats.fireRate, loop: true, callback: this.fireAtNearest, callbackScope: this });
    this.pierceTimer = this.time.addEvent({ delay: 1200, loop: true, callback: this.firePierce, callbackScope: this });
    this.burstTimer = this.time.addEvent({ delay: 1500, loop: true, callback: this.fireBurst, callbackScope: this });
    this.novaTimer = this.time.addEvent({ delay: 2500, loop: true, callback: this.fireNova, callbackScope: this });
    this.difficultyTimer = this.time.addEvent({ delay: DIFFICULTY_RAMP_MS, loop: true, callback: this.rampDifficulty, callbackScope: this });
    this.chestTimer = this.time.addEvent({ delay: CHEST_DELAY_MS, loop: true, callback: this.spawnChest, callbackScope: this });

    this.gameplayTimers = [
      this.spawnTimer, this.attackTimer, this.pierceTimer, this.burstTimer,
      this.novaTimer, this.difficultyTimer, this.chestTimer,
    ];
    // Se entra a esta escena desde el menú, así que la partida arranca de una.
  }

  createEmitter() {
    this.deathEmitter = this.add.particles(0, 0, 'spark', {
      speed: { min: 80, max: 220 },
      lifespan: 350,
      scale: { start: 1.4, end: 0 },
      quantity: 0,
      emitting: false,
    });
    this.deathEmitter.setDepth(20);
  }

  createUI() {
    this.hud = new Hud(this);
    this.minimap = new Minimap(this);
    this.levelUpMenu = new LevelUpMenu(this, (i) => this.chooseUpgrade(i));

    this.touchControls = isTouchDevice() ? new TouchControls(this) : null;

    this.pauseMenu = new PauseMenu(this, {
      onResume: () => this.resumeGame(),
      onSettings: () => this.openSettings(),
      onRestart: () => this.restartGame(),
      onQuit: () => this.quitToMenu(),
    });
    // Al cerrar configuración volvemos a la pausa, que es desde donde se abrió.
    this.settingsPanel = new SettingsPanel(
      this,
      () => this.showPauseContent(),
      (value) => {
        this.touchControls?.setLayout(value);
        this.minimap?.setLayout(value);
        this.pauseMenu?.setLayout(value);
        // Forzar relayout del HUD: la reserva para el boton de pausa cambia
        // de lado segun el joystick, y el HUD no escucha el evento de resize
        // porque el viewport no cambia.
        this.hud?.layout(this.scale.width, this.scale.height);
      },
    );

    this.layoutUI();
    this.updateHud();
  }

  layoutUI() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.hud.layout(w, h);
    this.minimap.layout(w, h);
    this.pauseMenu.layout(w, h);
    this.levelUpMenu.layout(w, h);
    this.settingsPanel.layout(w, h);
    if (this.touchControls) {
      this.touchControls.layout(w, h);
      this.touchControls.setVisible(!this.isPortrait());
    }
  }

  bindInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-M', () => {
      if (this.endScreen?.isOpen) return;
      toggleMute();
    });
    this.input.keyboard.on('keydown-F', () => {
      if (this.endScreen?.isOpen) return;
      const result = toggleFullscreen(this.scale);
      if (result === 'on') lockLandscape();
      else if (result === 'off') unlockOrientation();
    });
    if (LEVEL_UP_DEBUG_KEY) {
      this.input.keyboard.on('keydown-U', () => this._debugToggleLevelUp());
    }
    this._debugLevelUpOpen = false;

    this.onResize = () => {
      this.cameras.main.setSize(this.scale.width, this.scale.height);
      this.computeSpawnRadius();
      this.layoutUI();
    };
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize));
    this.events.once('shutdown', () => this.scale.off('resize', this.onResizePortrait, this));
    this.events.once('shutdown', () => this.hidePortraitHint());
  }

  // Los enemigos y el portal aparecen justo afuera de lo que se ve, sea cual sea la
  // resolución, así que el radio se deriva de la diagonal de pantalla.
  computeSpawnRadius() {
    this.spawnRadius = Math.hypot(this.scale.width, this.scale.height) / 2 + SPAWN_RADIUS_MARGIN;
    this.portalSpawnRadius = this.spawnRadius * 0.7;
    this.chestSpawnRadius = this.spawnRadius * 0.5;
  }

  setTimersPaused(paused) {
    this.gameplayTimers.forEach((t) => { t.paused = paused; });
  }

  togglePause() {
    if (this.isGameOver || this.hasWon || this.isLevelingUp) return;
    // Con configuración abierta, ESC la cierra y vuelve a la pausa.
    if (this.settingsPanel.isOpen) {
      this.settingsPanel.hide();
      return;
    }
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  pauseGame() {
    this.isPaused = true;
    this.player.setVelocity(0, 0);
    this.physics.world.pause();
    this.setTimersPaused(true);
    this.touchControls?.setVisible(false);
    this.showPauseContent();
  }

  showPauseContent() {
    this.pauseMenu.show(
      buildStatRows(this.stats),
      buildWeaponSlots(this.stats),
      `Etapa ${this.stage}  (x${this.stageMultiplier.toFixed(2)})`,
    );
  }

  resumeGame() {
    this.isPaused = false;
    this.physics.world.resume();
    this.setTimersPaused(false);
    this.pauseMenu.hide();
    this.touchControls?.setVisible(!this.isPortrait());
  }

  openSettings() {
    // El overlay de la pausa se queda: el juego sigue viéndose atenuado detrás.
    this.pauseMenu.hideContent();
    this.settingsPanel.show();
  }

  // La física quedó pausada por pauseGame() y ese estado sobrevive al cambio de
  // escena, así que hay que reanudarla antes de salir o el juego arranca congelado.
  restartGame() {
    this.physics.world.resume();
    this.scene.restart();
  }

  quitToMenu() {
    this.physics.world.resume();
    this.touchControls?.setVisible(false);
    this.scene.start('menu');
  }

  updateHud() {
    this.hud.update({
      stats: this.stats,
      xp: this.xp,
      xpToNext: this.xpToNext,
      level: this.level,
      stage: this.stage,
      elapsed: this.elapsed,
    });
  }

  update(time, delta) {
    if (this.isGameOver || this.hasWon || this.isLevelingUp || this.isPaused) {
      this.player.setVelocity(0, 0);
      return;
    }

    this.elapsed += delta;
    this.updateHud();

    this.updatePlayerMovement(time);
    this.updateEnemies(time);
    this.updateXpOrbs();
    this.expireProjectiles(time);
    this.updateWeapons(time);
    this.minimap.draw({ enemies: this.enemies, chest: this.chest, player: this.player });
    this.checkPickups();
    this.updateRegen(time, delta);
    this.updateBossCycle(delta);
  }

  updatePlayerMovement(time) {
    // Mientras dura el empuje por golpe, el input no pisa la velocidad.
    if (time < this.playerKnockbackUntil) return;

    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    const dir = new Phaser.Math.Vector2((right ? 1 : 0) - (left ? 1 : 0), (down ? 1 : 0) - (up ? 1 : 0));

    // Touch gana sobre teclado si está activo. Copiamos los componentes (no la
    // referencia) porque getVector() devuelve un vector compartido que escala
    // acá mismo cada frame — mutarlo lo corrompería para llamadas siguientes.
    const touchDir = this.touchControls?.getVector();
    if (touchDir) {
      dir.x = touchDir.x;
      dir.y = touchDir.y;
    }

    if (dir.lengthSq() > 0) {
      dir.normalize().scale(this.stats.moveSpeed);
      this.player.setVelocity(dir.x, dir.y);
    } else {
      this.player.setVelocity(0, 0);
    }
  }

  updateEnemies(time) {
    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      if (time < (e.getData('knockbackUntil') || 0)) return;
      if (e.getData('type') === 'bossRanged') {
        this.updateRangedBoss(e, time);
      } else {
        this.physics.moveToObject(e, this.player, e.getData('speed'));
      }
    });
  }

  updateXpOrbs() {
    this.xpOrbs.getChildren().forEach((orb) => {
      if (!orb.active) return;
      const d = Phaser.Math.Distance.Between(orb.x, orb.y, this.player.x, this.player.y);
      if (d < this.stats.magnetRadius) {
        this.physics.moveToObject(orb, this.player, XP_PICKUP_SPEED);
      } else {
        orb.setVelocity(0, 0);
      }
    });
  }

  expireProjectiles(time) {
    const expire = (group, lifetime) => {
      group.getChildren().forEach((p) => {
        if (!p.active) return;
        if (time - p.getData('bornAt') > lifetime) p.destroy();
      });
    };
    expire(this.projectiles, PROJECTILE_LIFETIME);
    expire(this.pierceProjectiles, PIERCE_LIFETIME);
    expire(this.bossProjectiles, BOSS_PROJECTILE_LIFETIME);
  }

  checkPickups() {
    if (this.portal) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.portal.x, this.portal.y);
      if (d < PORTAL_TRIGGER_RADIUS) this.enterPortal();
    }

    if (this.chest) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.chest.x, this.chest.y);
      if (d < CHEST_TRIGGER_RADIUS) this.openChest();
    }
  }

  updateRegen(time, delta) {
    if (this.stats.hpRegen > 0 && this.stats.hp < this.stats.maxHp) {
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.hpRegen * (delta / 1000));
    }

    if (this.stats.shieldMax > 0 && this.stats.shield < this.stats.shieldMax
      && time - this.lastDamageTakenAt > SHIELD_REGEN_DELAY_MS) {
      this.stats.shield = this.stats.shieldMax;
    }
  }

  // Cuenta regresiva al próximo jefe y, mientras hay uno vivo, el límite de tiempo
  // antes de que suba la presión de dificultad.
  updateBossCycle(delta) {
    if (this.bossCountdown !== null) {
      this.bossCountdown = Math.max(0, this.bossCountdown - delta);
      this.hud.setNextBossCountdown(this.bossCountdown);
      if (this.bossCountdown <= 0) {
        this.bossCountdown = null;
        this.hud.setNextBossCountdown(null);
        this.warnBoss();
      }
    } else {
      this.hud.setNextBossCountdown(null);
    }

    if (this.bossFightCountdown !== null) {
      this.bossFightCountdown -= delta;
      if (this.bossFightCountdown <= 0) {
        this.bossFightCountdown = BOSS_FIGHT_LIMIT_MS;
        this.applyBossOverstayPenalty();
      }
      this.hud.setBossFightCountdown(Math.max(0, this.bossFightCountdown));
    }

    if (this.isBossAlive && this.currentBoss && this.currentBoss.active) {
      const ratio = Phaser.Math.Clamp(this.currentBoss.getData('hp') / this.currentBoss.getData('maxHp'), 0, 1);
      this.hud.setBossHealthRatio(ratio);
    }
  }

  updateWeapons(time) {
    if (this.stats.hasAura && this.auraGfx) {
      this.auraGfx.setPosition(this.player.x, this.player.y);
      this.auraGfx.setRadius(this.stats.auraRadius);

      if (time >= this.auraTickAt) {
        this.auraTickAt = time + this.stats.auraTickMs;
        this.enemies.getChildren().forEach((e) => {
          if (!e.active) return;
          const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
          if (d <= this.stats.auraRadius) this.damageEnemy(e, this.stats.auraDamage);
        });
      }
    }

    if (this.stats.hasOrbit && this.orbitOrbs.length > 0) {
      this.orbitOrbs.forEach((orb, i) => {
        const angle = (time / 1000) * this.stats.orbitSpeed + (i * (Math.PI * 2 / this.orbitOrbs.length));
        orb.x = this.player.x + Math.cos(angle) * this.stats.orbitRadius;
        orb.y = this.player.y + Math.sin(angle) * this.stats.orbitRadius;

        this.enemies.getChildren().forEach((e) => {
          if (!e.active) return;
          const d = Phaser.Math.Distance.Between(orb.x, orb.y, e.x, e.y);
          if (d > ORBIT_HIT_RADIUS) return;
          // Cooldown por enemigo, si no el orbe lo mataría en un solo frame de contacto.
          const lastHit = e.getData('lastOrbitHit') || 0;
          if (time - lastHit < ORBIT_HIT_COOLDOWN_MS) return;
          e.setData('lastOrbitHit', time);
          this.damageEnemy(e, this.stats.orbitDamage);
        });
      });
    }
  }

  randomPointNear(radius) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    return {
      x: Phaser.Math.Clamp(this.player.x + Math.cos(angle) * radius, 20, WORLD_SIZE - 20),
      y: Phaser.Math.Clamp(this.player.y + Math.sin(angle) * radius, 20, WORLD_SIZE - 20),
    };
  }

  spawnEnemy() {
    if (this.isGameOver || this.hasWon || this.isLevelingUp) return;
    if (this.enemies.countActive(true) >= MAX_ENEMIES) return;

    const minutes = this.elapsed / 60000;
    const spawnCount = Math.min(MAX_SPAWN_PER_TICK, 1 + Math.floor(minutes / 1.5) + (this.stage - 1));
    for (let i = 0; i < spawnCount && this.enemies.countActive(true) < MAX_ENEMIES; i++) {
      this.spawnOneEnemy(minutes);
    }
  }

  spawnOneEnemy(minutes) {
    const { x, y } = this.randomPointNear(this.spawnRadius);
    const fastChance = Math.min(0.4, minutes * 0.12);
    const tankChance = Math.min(0.2, minutes * 0.05);
    const roll = Math.random();
    const typeKey = roll < tankChance ? 'tank' : (roll < tankChance + fastChance ? 'fast' : 'normal');
    const type = ENEMY_TYPES[typeKey];

    const enemy = this.enemies.create(x, y, type.texture);
    // Los iconos se cargan en blanco: el color de cada tipo se aplica por tint.
    enemy.setTint(type.color);
    enemy.setData('type', typeKey);
    enemy.setData('hp', Math.round((type.baseHp + minutes * type.hpPerMin) * this.stageMultiplier));
    enemy.setData('speed', Math.round(type.baseSpeed + minutes * type.speedPerMin));
    enemy.setData('damage', Math.round(type.damage * this.stageMultiplier));
  }

  warnBoss() {
    if (this.isGameOver || this.isLevelingUp || this.isBossAlive) return;
    playSfx('bossWarn');

    const warning = this.add.text(this.scale.width / 2, this.scale.height / 2, '¡EL JEFE SE ACERCA!', {
      fontFamily: 'monospace', fontSize: '28px', color: '#ff33aa',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    this.tweens.add({
      targets: warning,
      alpha: 0.2,
      duration: 300,
      yoyo: true,
      repeat: 3,
      onComplete: () => warning.destroy(),
    });

    this.time.delayedCall(BOSS_WARNING_MS, () => this.spawnBoss());
  }

  spawnBoss() {
    if (this.isGameOver || this.isLevelingUp || this.isBossAlive) return;

    const { x, y } = this.randomPointNear(this.spawnRadius);
    const minutes = this.elapsed / 60000;
    const bossTypeKey = Math.random() < 0.5 ? 'boss' : 'bossRanged';
    const type = ENEMY_TYPES[bossTypeKey];
    const maxHp = Math.round((type.baseHp + minutes * type.hpPerMin) * this.stageMultiplier);

    const boss = this.enemies.create(x, y, type.texture);
    boss.setTint(type.color);
    boss.setData('type', bossTypeKey);
    boss.setData('isBoss', true);
    boss.setData('hp', maxHp);
    boss.setData('maxHp', maxHp);
    boss.setData('speed', Math.round(type.baseSpeed + minutes * type.speedPerMin));
    boss.setData('damage', Math.round(type.damage * this.stageMultiplier));
    boss.setData('nextShotAt', this.time.now + 1000);
    boss.setDepth(11);

    this.isBossAlive = true;
    this.currentBoss = boss;
    this.bossFightCountdown = BOSS_FIGHT_LIMIT_MS;
    startBgm('boss', null, TRACK_GENERATORS);
    this.hud.showBossBar();
  }

  applyBossOverstayPenalty() {
    this.stageMultiplier *= BOSS_OVERSTAY_MULTIPLIER;
    this.showFloatingText(this.scale.width / 2, this.scale.height / 2 - 80, '¡Los enemigos se hacen más fuertes!', TEXT.danger);
  }

  // El jefe a distancia mantiene su rango preferido en vez de perseguir de cerca.
  updateRangedBoss(boss, time) {
    const d = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
    const speed = boss.getData('speed');

    if (d > BOSS_RANGED_PREFERRED_DIST + 40) {
      this.physics.moveToObject(boss, this.player, speed);
    } else if (d < BOSS_RANGED_PREFERRED_DIST - 40) {
      this.physics.moveToObject(boss, this.player, -speed);
    } else {
      boss.setVelocity(0, 0);
    }

    if (time >= (boss.getData('nextShotAt') || 0)) {
      boss.setData('nextShotAt', time + BOSS_SHOT_COOLDOWN_MS);
      this.fireBossProjectile(boss);
    }
  }

  fireBossProjectile(boss) {
    // Aviso visual antes del disparo, para que sea esquivable.
    const marker = this.add.circle(boss.x, boss.y, 10, 0xff3333, 0.6).setDepth(9);
    this.tweens.add({
      targets: marker,
      scale: 2,
      alpha: 0,
      duration: BOSS_TELEGRAPH_MS,
      onComplete: () => marker.destroy(),
    });

    this.time.delayedCall(BOSS_TELEGRAPH_MS, () => {
      if (!boss.active || this.isGameOver) return;
      const proj = this.bossProjectiles.create(boss.x, boss.y, 'bossBolt');
      proj.setData('damage', boss.getData('damage'));
      proj.setData('bornAt', this.time.now);
      this.physics.moveToObject(proj, this.player, BOSS_PROJECTILE_SPEED);
    });
  }

  rampDifficulty() {
    this.spawnTimer.delay = Math.max(SPAWN_DELAY_MIN, Math.round(this.spawnTimer.delay * 0.85));
  }

  getNearestEnemy() {
    return this.getNearestEnemies(1)[0] || null;
  }

  getNearestEnemies(n) {
    return this.enemies.getChildren()
      .filter((e) => e.active)
      .map((e) => ({ e, d: Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n)
      .map((item) => item.e);
  }

  fireAtNearest() {
    if (this.isGameOver || this.isLevelingUp) return;
    const target = this.getNearestEnemy();
    if (!target) return;

    const proj = this.projectiles.create(this.player.x, this.player.y, 'projectile');
    proj.setData('damage', this.stats.damage);
    proj.setData('bornAt', this.time.now);
    this.physics.moveToObject(proj, target, PROJECTILE_SPEED);
    playSfx('shoot');
  }

  onProjectileHitEnemy(proj, enemy) {
    const damage = proj.getData('damage');
    proj.destroy();
    this.damageEnemy(enemy, damage);
  }

  firePierce() {
    if (this.isGameOver || this.isLevelingUp || !this.stats.hasPierce) return;
    const target = this.getNearestEnemy();
    if (!target) return;

    const proj = this.pierceProjectiles.create(this.player.x, this.player.y, 'pierce');
    proj.setData('damage', this.stats.pierceDamage);
    proj.setData('bornAt', this.time.now);
    // Set de enemigos ya golpeados: el perforante no se destruye al impactar, así que
    // sin esto le pegaría al mismo enemigo en cada frame que lo atraviesa.
    proj.setData('hitSet', new Set());
    proj.setRotation(Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y));
    this.physics.moveToObject(proj, target, this.stats.pierceSpeed);
  }

  onPierceHitEnemy(proj, enemy) {
    if (!proj.active || !enemy.active) return;
    const hitSet = proj.getData('hitSet');
    if (hitSet.has(enemy)) return;
    hitSet.add(enemy);
    this.damageEnemy(enemy, proj.getData('damage'));
  }

  fireBurst() {
    if (this.isGameOver || this.isLevelingUp || !this.stats.hasBurst) return;
    const targets = this.getNearestEnemies(this.stats.burstCount);
    targets.forEach((target) => {
      const proj = this.projectiles.create(this.player.x, this.player.y, 'projectile');
      proj.setData('damage', this.stats.burstDamage);
      proj.setData('bornAt', this.time.now);
      this.physics.moveToObject(proj, target, PROJECTILE_SPEED);
    });
    // Un solo sonido por ráfaga, no uno por proyectil.
    if (targets.length > 0) playSfx('burst');
  }

  fireNova() {
    if (this.isGameOver || this.isLevelingUp || !this.stats.hasNova) return;

    const ring = this.add.circle(this.player.x, this.player.y, this.stats.novaRadius, 0xffaa00, 0.3)
      .setDepth(4).setScale(0.1);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    playSfx('nova');

    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d <= this.stats.novaRadius) this.damageEnemy(e, this.stats.novaDamage);
    });
  }

  // Punto único por donde pasa todo el daño a enemigos, sea de proyectil, aura,
  // orbe, perforante, ráfaga u onda.
  damageEnemy(enemy, rawDamage) {
    if (!enemy.active) return;
    const damage = Math.max(1, Math.round(rawDamage));

    this.showDamageNumber(enemy.x, enemy.y, damage);

    if (this.stats.lifesteal > 0) {
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + damage * this.stats.lifesteal);
    }

    const hp = enemy.getData('hp') - damage;
    if (hp > 0) {
      enemy.setData('hp', hp);
      this.flashEnemy(enemy);
      this.knockbackEnemy(enemy);
      playSfx('hit');
      return;
    }

    const isBoss = enemy.getData('isBoss');
    this.deathEmitter.setParticleTint(ENEMY_TYPES[enemy.getData('type')].color);
    this.deathEmitter.emitParticleAt(enemy.x, enemy.y, isBoss ? 30 : 10);

    if (isBoss) {
      playSfx('bossDie');
      this.onBossDefeated();
    } else {
      playSfx('enemyDie');
      this.spawnXpOrb(enemy.x, enemy.y, ENEMY_TYPES[enemy.getData('type')].xpValue);
    }
    enemy.destroy();
  }

  // Flash blanco al recibir daño. Al terminar restaura el tint del tipo en vez de
  // limpiarlo, porque ese tint es lo que le da color al icono.
  flashEnemy(enemy) {
    enemy.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(60, () => {
      if (!enemy.active) return;
      enemy.setTintMode(Phaser.TintModes.MULTIPLY);
      enemy.setTint(ENEMY_TYPES[enemy.getData('type')].color);
    });
  }

  knockbackEnemy(enemy) {
    const push = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y);
    if (push.lengthSq() === 0) return;
    push.normalize().scale(ENEMY_KNOCKBACK_SPEED);
    enemy.setVelocity(push.x, push.y);
    enemy.setData('knockbackUntil', this.time.now + ENEMY_KNOCKBACK_MS);
  }

  onBossDefeated() {
    this.isBossAlive = false;
    this.currentBoss = null;
    this.bossFightCountdown = null;
    this.bossCountdown = BOSS_COUNTDOWN_MS;
    this.hud.hideBossBar();

    // Volver a la musica del juego cuando muere el boss.
    startBgm('game', null, TRACK_GENERATORS);

    this.stageMultiplier *= STAGE_BOSS_MULTIPLIER;
    this.spawnPortal();
    // El level-up que sigue tapa toda la pantalla con sus cards, así que el aviso
    // del portal se muestra recién al cerrarlo (ver chooseUpgrade), no ahora.
    this.pendingPortalHint = true;
    // Stinger breve de level-up sobre la musica actual.
    playStinger(generateLevelupStinger());
    this.levelUp();
  }

  showDamageNumber(x, y, amount) {
    this.showFloatingText(x, y, String(amount), TEXT.primary);
  }

  showFloatingText(x, y, message, color) {
    const label = this.add.text(x, y - 10, message, {
      fontFamily: 'monospace', fontSize: FONT_SIZE.small, color,
    }).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: label,
      y: y - 40,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  spawnXpOrb(x, y, value = 1) {
    const orb = this.xpOrbs.create(x, y, 'xp');
    orb.setData('value', value);
  }

  spawnPortal() {
    if (this.portal) this.portal.destroy();

    const { x, y } = this.randomPointNear(this.portalSpawnRadius);
    this.portal = this.add.image(x, y, 'portal').setDepth(6);
    this.tweens.add({ targets: this.portal, angle: 360, duration: 3000, repeat: -1 });
  }

  spawnChest() {
    if (this.isGameOver || this.isLevelingUp || this.chest) return;

    const { x, y } = this.randomPointNear(this.chestSpawnRadius);
    this.chest = this.add.image(x, y, 'pickup-chest').setTint(0xffcc44).setDepth(6);
    this.tweens.add({ targets: this.chest, y: y - 6, duration: 500, yoyo: true, repeat: -1 });
  }

  openChest() {
    const { x, y } = this.chest;
    this.chest.destroy();
    this.chest = null;

    this.deathEmitter.setParticleTint(0xffcc44);
    this.deathEmitter.emitParticleAt(x, y, 15);
    playSfx('chest');

    this.levelUp();
  }

  applyStageTheme() {
    const theme = STAGE_THEMES[this.stage] || STAGE_THEMES[1];
    this.worldGrid.setFillStyle(theme.fill, 1);
    this.worldGrid.setStrokeStyle(1, theme.line, 1);
    this.cameras.main.setBackgroundColor(theme.bg);
  }

  enterPortal() {
    this.stage += 1;
    this.stageMultiplier *= STAGE_PORTAL_MULTIPLIER;
    this.portal.destroy();
    this.portal = null;

    if (this.stage >= VICTORY_STAGE) {
      this.onVictory();
      return;
    }

    // Etapa nueva: al centro del mapa y con la pantalla despejada.
    this.player.setPosition(WORLD_SIZE / 2, WORLD_SIZE / 2);
    this.player.setVelocity(0, 0);
    this.cameras.main.centerOn(this.player.x, this.player.y);
    this.applyStageTheme();
    // No destruyo un jefe si justo hay uno vivo (pudo aparecer otro por el cronometro
    // mientras este portal seguia sin cruzarse) - solo despejo la oleada comun.
    this.enemies.getChildren().slice().forEach((e) => {
      if (!e.getData('isBoss')) e.destroy();
    });

    this.showStageBanner();
  }

  showStageBanner() {
    playSfx('stage');
    const cy = this.scale.height / 2;
    const label = this.add.text(this.scale.width / 2, cy, `ETAPA ${this.stage}`, {
      fontFamily: 'monospace', fontSize: '32px', color: TEXT.stage,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    this.tweens.add({
      targets: label,
      alpha: 0,
      y: cy - 40,
      duration: 1200,
      delay: 400,
      onComplete: () => label.destroy(),
    });
  }

  onPlayerPickupXp(player, orb) {
    const value = orb.getData('value') || 1;
    const { x, y } = orb;
    orb.destroy();

    // Feedback visual: partículas violetas + texto +value + pulse del
    // icono XP del HUD. Reusamos deathEmitter para las partículas (no
    // creamos un emiter nuevo). El text tiene throttle 100ms para no saturar
    // cuando el aura recoge muchos orbes en cadena.
    this.deathEmitter.setParticleTint(0xaa88ff);
    this.deathEmitter.emitParticleAt(x, y, value >= 5 ? 8 : 4);
    if (!this._lastXpTextAt || this.time.now - this._lastXpTextAt > 100) {
      this.showFloatingText(x, y, `+${value}`, '#aa88ff');
      this._lastXpTextAt = this.time.now;
    }
    this.hud?.pulseXpIcon();

    playSfx('xp');
    this.xp += value;
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.xpToNext = Math.round(this.xpToNext * 1.25);
      this.levelUp();
    }
  }

  onPlayerHitEnemy(player, enemy) {
    if (this.isGameOver || this.isLevelingUp) return;
    this.damagePlayer(enemy.getData('damage'), enemy.x, enemy.y);
  }

  onBossProjectileHitPlayer(player, proj) {
    if (this.isGameOver || this.isLevelingUp) return;
    const damage = proj.getData('damage');
    const sx = proj.x;
    const sy = proj.y;
    proj.destroy();
    this.damagePlayer(damage, sx, sy);
  }

  // Punto único por donde pasa todo el daño al jugador: contacto con enemigo o
  // proyectil de jefe.
  damagePlayer(amount, sourceX, sourceY) {
    const now = this.time.now;
    if (now - this.lastHitAt < HIT_INVULN_MS) return;
    this.lastHitAt = now;

    if (Math.random() < this.stats.dodge) {
      this.showFloatingText(this.player.x, this.player.y, '¡ESQUIVÉ!', '#88ddff');
      playSfx('dodge');
      return;
    }

    this.lastDamageTakenAt = now;

    // El escudo absorbe primero; solo lo que sobra baja el HP.
    let remaining = amount;
    if (this.stats.shield > 0) {
      const absorbed = Math.min(this.stats.shield, remaining);
      this.stats.shield -= absorbed;
      remaining -= absorbed;
    }
    this.stats.hp -= remaining;

    playSfx('playerHurt');
    this.cameras.main.shake(150, 0.008);
    this.player.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(80, () => this.player.active && this.player.clearTint());

    const push = new Phaser.Math.Vector2(this.player.x - sourceX, this.player.y - sourceY);
    if (push.lengthSq() > 0) {
      push.normalize().scale(PLAYER_KNOCKBACK_SPEED);
      this.player.setVelocity(push.x, push.y);
      this.playerKnockbackUntil = now + PLAYER_KNOCKBACK_MS;
    }

    if (this.stats.hp <= 0) {
      this.stats.hp = 0;
      this.onGameOver();
    }
  }

  onGameOver() {
    this.isGameOver = true;
    this.setTimersPaused(true);
    this.touchControls?.setVisible(false);
    playSfx('gameOver');
    // Stinger triste de game over sobre la musica actual.
    playStinger(generateGameoverStinger());
    this.endScreen = new EndScreen(this, {
      title: 'GAME OVER',
      color: TEXT.danger,
      elapsed: this.elapsed,
      level: this.level,
      onRestart: () => this.restartGame(),
      onQuit: () => this.quitToMenu(),
    });
  }

  onVictory() {
    this.hasWon = true;
    this.setTimersPaused(true);
    this.touchControls?.setVisible(false);
    playSfx('victory');
    // Stinger triste de victoria (mismo feeling que gameover, contraste con
    // la musica agresiva del juego).
    playStinger(generateGameoverStinger());
    this.endScreen = new EndScreen(this, {
      title: '¡VICTORIA!',
      color: TEXT.gold,
      elapsed: this.elapsed,
      level: this.level,
      onRestart: () => this.restartGame(),
      onQuit: () => this.quitToMenu(),
    });
  }

  // Arma el pool de mejoras a ofrecer: las stats no maxeadas, más un slot por arma
  // (su desbloqueo si no la tenés, o una de sus mejoras no maxeadas si ya la tenés).
  getAvailableUpgrades() {
    const notMaxed = (u) => !u.isMaxed || !u.isMaxed(this.stats);
    const pool = STAT_UPGRADES.filter(notMaxed);

    WEAPON_KEYS.forEach((key) => {
      const flag = `has${key[0].toUpperCase()}${key.slice(1)}`;
      const weapon = WEAPON_UPGRADES[key];
      if (!this.stats[flag]) {
        pool.push(weapon.unlock);
        return;
      }
      const available = weapon.upgrades.filter(notMaxed);
      if (available.length > 0) pool.push(Phaser.Utils.Array.GetRandom(available));
    });

    return pool;
  }

  // Sorteo sin reemplazo ponderado por rareza: común sale más seguido que épica.
  pickWeighted(pool, count) {
    const remaining = [...pool];
    const picked = [];
    while (picked.length < count && remaining.length > 0) {
      const totalWeight = remaining.reduce((sum, c) => sum + RARITY_WEIGHT[c.rarity || 'common'], 0);
      let roll = Math.random() * totalWeight;
      let idx = 0;
      for (; idx < remaining.length - 1; idx++) {
        roll -= RARITY_WEIGHT[remaining[idx].rarity || 'common'];
        if (roll <= 0) break;
      }
      picked.push(remaining.splice(idx, 1)[0]);
    }
    return picked;
  }

  syncTimerDelays() {
    this.attackTimer.delay = this.stats.fireRate;
    if (this.stats.hasPierce) this.pierceTimer.delay = this.stats.pierceRate;
    if (this.stats.hasBurst) this.burstTimer.delay = this.stats.burstRate;
    if (this.stats.hasNova) this.novaTimer.delay = this.stats.novaRate;
  }

  // Escalado pasivo que se aplica en cada nivel, además de la mejora elegida.
  applyLevelScaling() {
    const s = this.stats;

    GROWTH_STATS.forEach(({ key, cap, requires }) => {
      if (requires && !s[requires]) return;
      const value = s[key] * LEVEL_SCALE_UP;
      s[key] = cap != null ? Math.min(cap, value) : value;
    });

    COOLDOWN_STATS.forEach(({ key, floor, requires }) => {
      if (requires && !s[requires]) return;
      s[key] = Math.max(floor, s[key] * LEVEL_SCALE_DOWN);
    });

    const hpGain = s.maxHp * (LEVEL_SCALE_UP - 1);
    s.maxHp += hpGain;
    s.hp += hpGain;

    this.syncTimerDelays();
  }

  levelUp() {
    this.level += 1;
    this.applyLevelScaling();
    playSfx('levelUp');
    this.startLevelUp();
  }

  startLevelUp() {
    this.isLevelingUp = true;
    this.player.setVelocity(0, 0);
    this.physics.world.pause();
    this.touchControls?.setVisible(false);
    this.hud.setAlpha(0.4);

    this.levelUpChoices = this.pickWeighted(this.getAvailableUpgrades(), 4);
    this.levelUpMenu.show(this.levelUpChoices, this.stats);
  }

  chooseUpgrade(i) {
    if (!this.isLevelingUp) return;
    const choice = this.levelUpChoices[i];
    if (!choice) return;

    choice.apply(this.stats);
    playSfx('upgradePick');
    this.syncTimerDelays();
    this.syncWeapons();

    this.levelUpMenu.hide();
    this.isLevelingUp = false;
    this._debugLevelUpOpen = false;
    this.physics.world.resume();
    this.touchControls?.setVisible(!this.isPortrait());
    this.hud.setAlpha(1);
    // Respiro de invulnerabilidad al volver, para no comer un golpe al cerrar el menú.
    this.lastHitAt = this.time.now;

    if (this.pendingPortalHint) {
      this.pendingPortalHint = false;
      this.showPortalHint();
    }
  }

  _debugToggleLevelUp() {
    if (this.isPaused || this.isGameOver || this.hasWon) return;
    if (!this.isLevelingUp) {
      this.startLevelUp();
      this._debugLevelUpOpen = true;
    } else if (this._debugLevelUpOpen) {
      this.chooseUpgrade(0);
    }
  }

  // Guía al jugador hacia el portal recién abierto tras derrotar al jefe: sin esto,
  // fácilmente pasa desapercibido entre la lluvia de números de daño y partículas.
  showPortalHint() {
    const cy = this.scale.height / 2;
    const label = this.add.text(this.scale.width / 2, cy + 90, 'Busca el portal para pasar a la siguiente etapa', {
      fontFamily: 'monospace', fontSize: FONT_SIZE.body, color: TEXT.gold,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(60);

    this.tweens.add({
      targets: label,
      alpha: 0,
      y: cy + 50,
      duration: 1200,
      delay: 2200,
      onComplete: () => label.destroy(),
    });
  }

  // Crea los objetos visuales de las armas recién desbloqueadas o ampliadas.
  syncWeapons() {
    if (this.stats.hasAura && !this.auraGfx) {
      this.auraGfx = this.add.circle(this.player.x, this.player.y, this.stats.auraRadius, 0x66ffcc, 0.15);
      this.auraGfx.setDepth(5);
      this.auraTickAt = 0;
    }

    if (this.stats.hasOrbit) {
      while (this.orbitOrbs.length < this.stats.orbitCount) {
        const orb = this.add.image(this.player.x, this.player.y, 'orbit');
        orb.setDepth(12);
        this.orbitOrbs.push(orb);
      }
    }
  }
}
