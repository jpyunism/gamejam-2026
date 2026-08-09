#!/usr/bin/env node
// Captura screenshots de gameplay real (no menú) para cada juego participante.
// Los juegos Phaser dibujan el texto en canvas => NO usar locator('text=...').
// Se interactúa con teclado y coordenadas (mapeando lógica→página por el scale).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'assets/screenshots');
const BASE = 'http://localhost:8890/participantes';
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const GAMES = {
  // BugSurvivor: intro (Enter) -> menu (Enter inicia partida)
  abomdev: async (page) => {
    await page.waitForTimeout(1800);
    await page.keyboard.press('Enter'); // avanza intro -> menu
    await page.waitForTimeout(1800); // fade-out de la intro
    await page.keyboard.press('Enter'); // JUGAR
    await page.waitForTimeout(3000); // gameplay en curso
  },
  // FoxStar (three.js, DOM text real)
  madkoding: async (page) => {
    await page.waitForTimeout(1500);
    await page.keyboard.press('Enter'); // iniciar partida
    await page.waitForTimeout(2500);
    await page.keyboard.down('Space');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(400);
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(600);
  },
  // DAFTRUN: ?level=...&play=1 entra al modo juego pero el mundo arranca
  // congelado en t=0 hasta el primer gesto (click/SPACE arranca la música).
  pabloprx: async (page) => {
    // esperar a que el nivel cargue (window.__dbg expuesto por core.js)
    for (let i = 0; i < 20; i++) {
      const ready = await page.evaluate(() => !!window.__dbg);
      if (ready) break;
      await wait(400);
    }
    await page.mouse.click(640, 360); // arranca la música / el mundo
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__dbg.started = true;  // quita el cartel "click o SPACE"
      window.__dbg.godmode = true;  // evita el game over en el screenshot
    });
    await page.waitForTimeout(2500); // el rail avanza solo
    await page.keyboard.press('ArrowRight'); // cambio de carril para variedad
    await page.waitForTimeout(500);
  },
  // Neon Drift: click en 2 tarjetas de armas + ENTER para arrancar
  // (cards en rowY = height*0.55; cardW=180 gap=18, centradas en 1280)
  jpyunism: async (page) => {
    await page.waitForTimeout(1800);
    await page.mouse.click(300, 396); // card 1
    await wait(300);
    await page.mouse.click(500, 396); // card 2
    await wait(400);
    await page.keyboard.press('Enter'); // start
    await page.waitForTimeout(2600);
  },
  // Timbiriche: ENTER inicia con defaults (LOCAL 5x5)
  axes: async (page) => {
    await page.waitForTimeout(1800);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2200);
  },
  // Tapa'o: Enter inicia
  felipe: async (page) => {
    await page.waitForTimeout(1800);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1600);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
  },
  // Deckstiny: ?tutorial=0 evita overlay; CAMPAÑA -> deck -> COMBATIR
  fr4j4: async (page) => {
    await page.waitForTimeout(1800);
    // canvas 640x360 FIT -> scale 2 en 1280x720
    await page.mouse.click(640, 300); // CAMPAÑA
    await page.waitForTimeout(1200);
    await page.mouse.click(828, 116); // primer deck
    await page.waitForTimeout(600);
    await page.mouse.click(1020, 688); // COMBATIR
    await page.waitForTimeout(2600);
  },
  // Mr Lastre: Enter confirma -> movimiento
  gabogabucho: async (page) => {
    await page.waitForTimeout(1800);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2600);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
  },
  // Skateboard 3D: ?testMode=1 auto-entra a la arena
  yhozen: async (page) => {
    await page.waitForTimeout(3500);
    await page.keyboard.down('Space');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(400);
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(600);
  },
};

async function shoot(name, url, enterFn) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const log = [];
  page.on('pageerror', (e) => log.push('PAGEERROR: ' + String(e).slice(0, 120)));
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await enterFn(page);
    const target = resolve(OUT, `${name}.png`);
    await page.screenshot({ path: target, clip: { x: 0, y: 0, width: 1280, height: 720 } });
    console.log(`[OK] ${name} -> ${target}`);
    return { name, ok: true, log };
  } catch (e) {
    console.log(`[FAIL] ${name}: ${String(e).slice(0, 200)}`);
    const target = resolve(OUT, `${name}.png`);
    try { await page.screenshot({ path: target, clip: { x: 0, y: 0, width: 1280, height: 720 } }); } catch {}
    return { name, ok: false, log };
  } finally {
    await browser.close();
  }
}

(async () => {
  const results = [];
  for (const [name, fn] of Object.entries(GAMES)) {
    const url = BASE + '/' + name + '/' +
      (name === 'pabloprx' ? '?level=insomnia-drop&play=1'
        : name === 'yhozen' ? '?testMode=1'
        : name === 'fr4j4' ? '?tutorial=0' : '');
    results.push(await shoot(name, url, fn));
  }
  console.log('\n===== RESUMEN =====');
  let ok = 0;
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.log.length ? '  [' + r.log.slice(0,2).join(' | ') + ']' : ''}`);
    if (r.ok) ok++;
  }
  console.log(`\n${ok}/${results.length} capturas tomadas.`);
})();
