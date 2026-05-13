import { test } from "@playwright/test";

/**
 * E2E tests for Timeline (Gantt) drag interactions.
 *
 * Skipped until Epic 15 e2e runner is configured with a seeded DB + auth.
 * Tests are written for reference and can be enabled when the runner is ready.
 */
test.skip(true, "Epic 15 e2e runner");

test("drag a bar 5 days right — start+end shift by 5 days", async ({ page }) => {
  // 1. Navigate to a board with a timeline view
  await page.goto("/w/test-workspace/b/test-board/timeline?view=test-view-id");
  await page.waitForSelector("[data-testid='timeline-bar']");

  // 2. Record the initial bar position
  const bar = page.locator("[data-testid='timeline-bar']").first();
  const initialBox = await bar.boundingBox();
  if (!initialBox) throw new Error("Bar not visible");

  // 3. Drag the bar body 5 days to the right
  // The pixel width of 5 days depends on scale — this test uses "week" scale
  // with a ~1200px container, giving 40px/day, so 5 days = 200px.
  const dragDeltaX = 200;
  await bar.dragTo(bar, {
    targetPosition: { x: initialBox.width / 2 + dragDeltaX, y: initialBox.height / 2 },
    sourcePosition: { x: initialBox.width / 2, y: initialBox.height / 2 },
  });

  // 4. Assert the bar moved right by the correct amount
  const newBox = await bar.boundingBox();
  if (!newBox) throw new Error("Bar not visible after drag");
  // Allow ±1px tolerance for sub-pixel rounding
  const expectedShift = dragDeltaX;
  if (Math.abs(newBox.x - initialBox.x - expectedShift) > 2) {
    throw new Error(`Bar shifted by ${newBox.x - initialBox.x}px, expected ~${expectedShift}px`);
  }

  // 5. Reload and confirm persistence
  await page.reload();
  await page.waitForSelector("[data-testid='timeline-bar']");
  const reloadedBox = await page.locator("[data-testid='timeline-bar']").first().boundingBox();
  if (!reloadedBox) throw new Error("Bar not visible after reload");
  if (Math.abs(reloadedBox.x - newBox.x) > 2) {
    throw new Error("Bar position did not persist after reload");
  }
});

test("drag the right edge handle 3 days right — only end shifts", async ({ page }) => {
  await page.goto("/w/test-workspace/b/test-board/timeline?view=test-view-id");
  await page.waitForSelector("[data-testid='timeline-bar']");

  const bar = page.locator("[data-testid='timeline-bar']").first();
  const initialBox = await bar.boundingBox();
  if (!initialBox) throw new Error("Bar not visible");

  // Right edge handle is the last 8px of the bar
  const rightHandleX = initialBox.x + initialBox.width - 4;
  const centerY = initialBox.y + initialBox.height / 2;

  // 3 days in week scale = ~120px
  const dragDeltaX = 120;

  await page.mouse.move(rightHandleX, centerY);
  await page.mouse.down();
  await page.mouse.move(rightHandleX + dragDeltaX, centerY, { steps: 10 });
  await page.mouse.up();

  // Only end should have changed — left edge stays the same
  const newBox = await bar.boundingBox();
  if (!newBox) throw new Error("Bar not visible after resize");

  const leftEdgeShift = Math.abs(newBox.x - initialBox.x);
  const widthChange = newBox.width - initialBox.width;

  if (leftEdgeShift > 2) {
    throw new Error(`Left edge moved by ${leftEdgeShift}px (should not move)`);
  }
  if (Math.abs(widthChange - dragDeltaX) > 2) {
    throw new Error(`Width changed by ${widthChange}px, expected ~${dragDeltaX}px`);
  }
});
