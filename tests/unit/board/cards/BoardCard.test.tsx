// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * Unit tests for BoardCard (Slice D — mobile card list view).
 *
 * RTL rendering is skipped (describe.skip) because @testing-library/react
 * is not wired in the test environment until Epic 15. The describe.skip
 * pattern follows prior slices (see ViewTabs.test.tsx).
 *
 * Module-shape tests DO run — they verify imports resolve and the exported
 * symbol is a function.
 */

// ---------------------------------------------------------------------------
// Module-shape tests (run immediately — no RTL required)
// ---------------------------------------------------------------------------

describe("BoardCard module shape", () => {
  it("exports BoardCard as a function", async () => {
    const mod = await import("@/components/board/cards/BoardCard");
    expect(typeof mod.BoardCard).toBe("function");
  });

  it("barrel index re-exports BoardCard", async () => {
    const mod = await import("@/components/board/cards");
    expect(typeof mod.BoardCard).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Rendering tests (skipped — RTL not wired until Epic 15)
// ---------------------------------------------------------------------------

describe.skip("BoardCard rendering", () => {
  it("renders task title", () => {
    // When task.title = "Write tests"
    // → renders a paragraph containing "Write tests"
    expect(true).toBe(true);
  });

  it("renders status pill when status column exists and cell has a value", () => {
    // When columns has a status column and cell has value_label_id
    // → renders a span with the label title and background color
    expect(true).toBe(true);
  });

  it("omits status pill when cell has no label id", () => {
    // When statusCell.value_label_id = null
    // → no status pill rendered
    expect(true).toBe(true);
  });

  it("renders date in summary row when date cell is non-null", () => {
    // When dateCell.value_text = "2025-05-15T00:00:00Z"
    // → summary row contains "Due May 15, 2025"
    expect(true).toBe(true);
  });

  it("renders currency in summary row when currency cell is non-null", () => {
    // When currencyCell.value_number = 1200
    // → summary row contains "$1,200"
    expect(true).toBe(true);
  });

  it("renders file count in summary row when attachments exist", () => {
    // When attachmentsByTask.get(task.id).length = 4
    // → summary row contains "4 files"
    expect(true).toBe(true);
  });

  it("omits summary row segments that are null", () => {
    // When no date, no currency, no files
    // → no summary row rendered
    expect(true).toBe(true);
  });

  it("renders top-3 non-empty non-title non-status cells", () => {
    // When visible columns contain 5 non-empty cells
    // → only first 3 are shown
    expect(true).toBe(true);
  });

  it("wraps card in a Link when not in reorderMode", () => {
    // When reorderMode = false
    // → card is wrapped in a Next.js Link with task drawer href
    expect(true).toBe(true);
  });

  it("shows drag handle when reorderMode is true", () => {
    // When reorderMode = true
    // → GripVertical button rendered; card is NOT a Link
    expect(true).toBe(true);
  });

  it("title is clamped to 2 lines via CSS", () => {
    // The title paragraph has style={{ WebkitLineClamp: 2 }}
    expect(true).toBe(true);
  });
});
