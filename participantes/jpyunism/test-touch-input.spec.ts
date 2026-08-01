import { test, expect } from "@playwright/test";

test.describe("Neon Drift — touch input controls", () => {
  test("three simultaneous touches do not cause console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");

    // Wait for Phaser to boot
    const canvas = page.locator("canvas");
    await expect(canvas).toBeAttached({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Simulate three simultaneous touches: left zone (move), right zone (aim), fire zone
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const leftX = box!.x + box!.width * 0.2;
    const leftY = box!.y + box!.height * 0.8;
    const rightX = box!.x + box!.width * 0.8;
    const rightY = box!.y + box!.height * 0.8;
    const fireX = box!.x + box!.width * 0.9;
    const fireY = box!.y + box!.height * 0.7;

    // Dispatch touch events for three pointers simultaneously
    await page.evaluate(
      ({ leftX, leftY, rightX, rightY, fireX, fireY }) => {
        const canvas = document.querySelector("canvas")!;

        // Pointer 1: left joystick zone
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            pointerId: 1,
            clientX: leftX,
            clientY: leftY,
            bubbles: true,
          }),
        );

        // Pointer 2: right joystick zone
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            pointerId: 2,
            clientX: rightX,
            clientY: rightY,
            bubbles: true,
          }),
        );

        // Pointer 3: fire button zone
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            pointerId: 3,
            clientX: fireX,
            clientY: fireY,
            bubbles: true,
          }),
        );
      },
      { leftX, leftY, rightX, rightY, fireX, fireY },
    );

    await page.waitForTimeout(500);

    // Release all three
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas")!;
      for (const id of [1, 2, 3]) {
        canvas.dispatchEvent(
          new PointerEvent("pointerup", {
            pointerId: id,
            bubbles: true,
          }),
        );
      }
    });

    await page.waitForTimeout(500);

    // No console errors from the touch handling
    expect(errors).toEqual([]);
  });
});
