import { test, expect } from "@playwright/test";

test.describe("Neon Drift — game loads and renders", () => {
  test("canvas is present with correct dimensions and rendered content", async ({ page }) => {
    await page.goto("/");

    // Wait for Phaser to boot — the canvas element should appear
    const canvas = page.locator("canvas");
    await expect(canvas).toBeAttached({ timeout: 10000 });

    // Give Phaser a moment to render the first frame
    await page.waitForTimeout(2000);

    // The canvas should have non-zero dimensions (Phaser initialized)
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    // Verify the canvas has a WebGL context (Phaser AUTO picks WebGL)
    const hasWebGL = await page.evaluate(() => {
      const c = document.querySelector("canvas")!;
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    });
    expect(hasWebGL).toBe(true);

    // With RESIZE mode the canvas dimensions match the viewport.
    // Assert the canvas has rendered content by checking the data URL size
    const dataUrl = await page.evaluate(() => {
      const c = document.querySelector("canvas")!;
      return c.toDataURL();
    });
    expect(dataUrl.length).toBeGreaterThan(2000);
  });

  test("page has correct title", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator("canvas");
    await expect(canvas).toBeAttached({ timeout: 10000 });
    await expect(page).toHaveTitle("Neon Drift");
  });
});
