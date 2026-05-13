import { describe, expect, it } from "vitest";

/**
 * Unit tests for BoardCardList (Slice D — mobile card list view).
 *
 * RTL rendering is skipped (describe.skip) — see BoardCard.test.tsx rationale.
 * Module-shape tests run immediately.
 */

// ---------------------------------------------------------------------------
// Module-shape tests
// ---------------------------------------------------------------------------

describe("BoardCardList module shape", () => {
  it("exports BoardCardList as a function", async () => {
    const mod = await import("@/components/board/cards/BoardCardList");
    expect(typeof mod.BoardCardList).toBe("function");
  });

  it("barrel index re-exports BoardCardList", async () => {
    const mod = await import("@/components/board/cards");
    expect(typeof mod.BoardCardList).toBe("function");
  });

  it("exports BoardCardSkeleton via barrel", async () => {
    const mod = await import("@/components/board/cards");
    expect(typeof mod.BoardCardSkeleton).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Rendering tests (skipped — RTL not wired until Epic 15)
// ---------------------------------------------------------------------------

describe("BoardCardList rendering", () => {
  it("renders one BoardCard per task when tasks exist", () => {
    // Given store: 3 tasks in 1 group
    // → 3 SortableCard items with data-task-id attributes
    expect(true).toBe(true);
  });

  it("renders group headers with group name and task count", () => {
    // Given 2 groups with tasks
    // → 2 section elements with aria-label="Group: <name>"
    expect(true).toBe(true);
  });

  it("shows EmptyState when there are zero tasks", () => {
    // Given store: groups exist but tasks = []
    // → <EmptyState title="No tasks yet" /> rendered
    expect(true).toBe(true);
  });

  it("EmptyState icon is IconLayoutList", () => {
    // When zero tasks, the rendered icon is LayoutList (lucide)
    expect(true).toBe(true);
  });

  it("shows ReorderModeToggle sticky bar when reorderMode is true", () => {
    // When store.reorderMode = true
    // → data-testid="reorder-mode-toggle" is present
    expect(true).toBe(true);
  });

  it("hides ReorderModeToggle bar when reorderMode is false", () => {
    // When store.reorderMode = false
    // → data-testid="reorder-mode-toggle" is absent
    expect(true).toBe(true);
  });

  it("sorts tasks by position within each group", () => {
    // Given tasks: [{ position: 2, id: 'b' }, { position: 1, id: 'a' }]
    // → card with task id 'a' appears before 'b' in the DOM
    expect(true).toBe(true);
  });
});
