import { test, expect } from "@playwright/test";

/**
 * Regression suite for the Phase A fixes.
 *
 * Every test here pins a bug that was reproduced and measured on the real
 * runtime (see docs/ANALISIS-MEJORAS.md). The game is driven through the dev
 * server; assertions read live scene state via the `window.__game` handle
 * exposed by src/main.ts.
 */

/** Boot the menu, lock in two weapons and enter the arena. */
async function startRun(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForTimeout(1800);
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("canvas not found");
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.55);
  await page.waitForTimeout(150);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55);
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  return box;
}

test.describe("Neon Drift — Phase A regressions", () => {
  test("scene shutdown clears per-run state (no leak across runs)", async ({ page }) => {
    await startRun(page);

    const readState = () =>
      page.evaluate(() => {
        const g = window.__game;
        const s = g.scene.getScene("GameScene");
        return {
          active: g.scene.isActive("GameScene"),
          scaleResizeListeners: g.scale.listenerCount("resize"),
          piercing: s.data.get("piercing-shots-active") === true,
          chainReaction: s.data.get("explosion-on-kill-active") === true,
          beamRef: !!s.data.get("electricBeamGraphics"),
          colliders: s.physics.world ? s.physics.world.colliders.length : -1,
          waveTimers: !!(s.waveManager && s.waveManager.spawnTimer),
        };
      });

    const run1 = await readState();
    expect(run1.scaleResizeListeners).toBeGreaterThan(0);

    // Poison this run with power-up flags, then die.
    await page.evaluate(() => {
      const s = window.__game.scene.getScene("GameScene");
      s.levelUpManager.applyPowerUp("piercing-shots");
      s.levelUpManager.applyPowerUp("explosion-on-kill");
      s.player.takeDamage(9999, s.time.now);
    });
    await page.waitForTimeout(1500);

    const afterDeath = await readState();
    expect(afterDeath.active).toBe(false);
    // The old run's wave timers must be torn down on shutdown.
    expect(afterDeath.waveTimers).toBe(false);

    await page.keyboard.press("r");
    await page.waitForTimeout(2200);

    const run2 = await readState();
    expect(run2.active).toBe(true);
    // The leak: these used to grow by +3 per run.
    expect(run2.scaleResizeListeners).toBe(run1.scaleResizeListeners);
    // Per-run state must not survive.
    expect(run2.piercing).toBe(false);
    expect(run2.chainReaction).toBe(false);
    expect(run2.colliders).toBe(run1.colliders);
    expect(run2.beamRef).toBe(false);
  });

  test("enemy projectiles are culled instead of parking against the wall", async ({ page }) => {
    await startRun(page);

    const setup = await page.evaluate(async () => {
      const mod = await import("/src/entities/ShooterEnemy.ts");
      const s = window.__game.scene.getScene("GameScene");
      s.waveManager.stop();
      s.waveManager.spawnTimer = null;
      s.waveManager.hordeTimer = null;
      s.enemies.clear(true, true);
      s.enemyProjectiles.clear(true, true);
      s.player.takeDamage = () => {};
      s.player.setPosition(120, 900);
      s.player.body.moves = false;
      // Real shooter firing away from the player, so shots fly into the wall.
      const e = new mod.ShooterEnemy(s, 600, 400);
      s.enemies.add(e);
      return { max: s.enemyProjectiles.maxSize };
    });
    expect(setup.max).toBeGreaterThan(0);

    // Let it fire for a while; every shot should die at the border.
    await page.waitForTimeout(12000);

    const res = await page.evaluate(() => {
      const s = window.__game.scene.getScene("GameScene");
      const alive = s.enemyProjectiles.getChildren().filter((p) => p.active);
      const w = s.physics.world.bounds;
      return {
        live: alive.length,
        parkedAtEdge: alive.filter(
          (p) => p.x <= 12 || p.y <= 12 || p.x >= w.width - 12 || p.y >= w.height - 12,
        ).length,
      };
    });

    // The bug: 16 of 19 live projectiles were inert against the wall.
    expect(res.parkedAtEdge).toBe(0);
  });

  test("contact damage resolves once per i-frame window, not per frame", async ({ page }) => {
    await startRun(page);

    const out = await page.evaluate(async () => {
      const mod = await import("/src/entities/ChaserEnemy.ts");
      const s = window.__game.scene.getScene("GameScene");
      s.waveManager.stop();
      s.waveManager.spawnTimer = null;
      s.waveManager.hordeTimer = null;
      s.enemies.clear(true, true);
      s.enemyProjectiles.clear(true, true);

      // Count every call the overlap makes into takeDamage, and how many of
      // those actually land (takeDamage returns a boolean now).
      let calls = 0;
      let landed = 0;
      const real = s.player.takeDamage.bind(s.player);
      s.player.takeDamage = function (amount, time) {
        calls++;
        const ok = real(amount, time);
        if (ok) landed++;
        return ok;
      };

      s.player.setPosition(640, 480);
      s.player.body.moves = false;
      s.player.hp = 100;
      s.player.shield = 0;
      s.player.invulnerableUntil = 0;

      for (const [dx, dy] of [[0, 0], [14, 0], [-14, 0]]) {
        const e = new mod.ChaserEnemy(s, 640 + dx, 480 + dy);
        s.enemies.add(e);
      }

      await new Promise((r) => setTimeout(r, 4000));
      return { calls, landed, hp: Math.round(s.player.hp) };
    });

    // 500 ms i-frames: over 4 s a single attacker lands at most 8 hits, and a
    // crowd can never land more than that either (every landed hit refreshes
    // the window for all of them). Before the fix: 720 calls, ~648 landed.
    expect(out.landed).toBeGreaterThan(0);
    expect(out.landed).toBeLessThanOrEqual(9);
    // The overlap is still allowed to fire per-frame; it just must not damage.
    // Allow a small margin (one extra callback can slip in on a window edge).
    expect(out.calls).toBeLessThanOrEqual(out.landed + 1);
  });

  test("game over is playable on a touch device", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await startRun(page);

    await page.evaluate(() => {
      const s = window.__game.scene.getScene("GameScene");
      s.player.takeDamage(9999, s.time.now);
    });
    await page.waitForTimeout(1500);

    // Every action must be a real, interactive target.
    const buttons = await page.evaluate(() => {
      const go = window.__game.scene.getScene("GameOverScene");
      return go.children.list
        .filter((c) => c.type === "Rectangle" && c.input)
        .map((c) => {
          const label = go.children.list.find(
            (t) => t.type === "Text" && Math.abs(t.x - c.x) < 2 && Math.abs(t.y - c.y) < 2,
          );
          return {
            label: label ? label.text.trim() : "",
            cx: Math.round(c.x),
            cy: Math.round(c.y),
            interactive: !!c.input,
          };
        });
    });

    const labels = buttons.map((b) => b.label).sort();
    expect(labels).toEqual(["MAIN MENU", "RESTART", "SHOP"]);
    for (const b of buttons) expect(b.interactive).toBe(true);

    // Tapping RESTART must actually leave the Game Over screen.
    const restart = buttons.find((b) => b.label === "RESTART");
    if (!restart) throw new Error("RESTART button missing");
    const box = await page.locator("canvas").boundingBox();
    if (!box) throw new Error("canvas missing");
    await page.touchscreen.tap(box.x + restart.cx, box.y + restart.cy);
    await page.waitForTimeout(1800);

    const scenes = await page.evaluate(() =>
      window.__game.scene.getScenes(true).map((s) => s.scene.key),
    );
    expect(scenes).toContain("GameScene");
    expect(scenes).not.toContain("GameOverScene");

    await ctx.close();
  });
});
