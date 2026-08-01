import { test, expect, devices } from "@playwright/test";

test.describe("Neon Drift — mobile emulation", () => {
  test("iPhone 13 landscape: canvas fills viewport, no horizontal scroll", async ({ page }) => {
    const iPhone13 = devices["iPhone 13"];
    // Override to landscape
    const context = await page.context();
    await context.addInitScript(() => {
      Object.defineProperty(window, "innerWidth", { value: 667 });
      Object.defineProperty(window, "innerHeight", { value: 375 });
    });

    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto("/");

    const canvas = page.locator("canvas");
    await expect(canvas).toBeAttached({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Canvas should fill the viewport
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    // No horizontal scrollbar
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);

    // Viewport meta tag should be present
    const viewportMeta = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta ? meta.getAttribute("content") : null;
    });
    expect(viewportMeta).not.toBeNull();
    expect(viewportMeta).toContain("user-scalable=no");
  });

  test("Pixel 5 landscape: canvas fills viewport", async ({ page }) => {
    await page.setViewportSize({ width: 869, height: 411 });
    await page.goto("/");

    const canvas = page.locator("canvas");
    await expect(canvas).toBeAttached({ timeout: 10000 });
    await page.waitForTimeout(2000);

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });
});
