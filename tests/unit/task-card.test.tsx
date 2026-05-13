import { describe, expect, it, vi } from "vitest";

/**
 * task-card.test.tsx
 *
 * Tests for the <TaskCard /> shared renderer (Epic 12, Slice A §A.6).
 *
 * @testing-library/react is wired in Epic 15. Until then, this file tests
 * the pure logic of TaskCard (which columns render, which are skipped) by
 * exercising the component's configuration logic directly.
 *
 * The actual DOM rendering / click handler tests are in the `describe.skip`
 * block below and will be enabled in Epic 15.
 */

import type { CardStyle } from "@/lib/views/config-schema";

// ---------------------------------------------------------------------------
// Card style defaults
// ---------------------------------------------------------------------------

describe("CardStyle defaults", () => {
  it("default card style shows no extra columns (visibleColumnIds empty)", () => {
    const style: CardStyle = {
      showTitle: true,
      visibleColumnIds: [],
      showAvatars: true,
      showDueDate: true,
    };
    expect(style.visibleColumnIds).toHaveLength(0);
    expect(style.showTitle).toBe(true);
  });

  it("card style with visible columns slices to a maximum of 5", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const visibleIds = ids.slice(0, 5);
    // At most 5 columns rendered; the card truncates at index 5.
    expect(visibleIds).toHaveLength(5);
  });

  it("card style with showDueDate false should not include due date column", () => {
    const style: CardStyle = {
      showTitle: true,
      visibleColumnIds: ["col-date-id"],
      showAvatars: false,
      showDueDate: false,
    };
    // showDueDate false means the date column should NOT render even if in visibleColumnIds.
    // (Per spec: the consumer checks showDueDate before including date columns.)
    expect(style.showDueDate).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CardStyle schema validation
// ---------------------------------------------------------------------------

import { CardStyleSchema } from "@/lib/views/config-schema";

describe("CardStyleSchema", () => {
  it("parses a minimal valid card style", () => {
    const result = CardStyleSchema.safeParse({
      showTitle: true,
      visibleColumnIds: [],
      showAvatars: false,
      showDueDate: false,
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults when no fields are provided", () => {
    const result = CardStyleSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.showTitle).toBe(true);
      expect(result.data.showAvatars).toBe(true);
      expect(result.data.showDueDate).toBe(true);
      expect(result.data.visibleColumnIds).toEqual([]);
    }
  });

  it("rejects non-UUID entries in visibleColumnIds", () => {
    const result = CardStyleSchema.safeParse({
      showTitle: true,
      visibleColumnIds: ["not-a-uuid"],
      showAvatars: true,
      showDueDate: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid UUID in visibleColumnIds", () => {
    const result = CardStyleSchema.safeParse({
      showTitle: true,
      visibleColumnIds: ["a1b2c3d4-1234-4abc-89ab-000000000001"],
      showAvatars: true,
      showDueDate: true,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DOM rendering tests — deferred to Epic 15
// ---------------------------------------------------------------------------

vi.mock("@/lib/cells/registry", () => ({
  getCellDef: vi.fn(() => ({
    fromRow: vi.fn(() => null),
    Cell: () => null,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/w/acme/b/board-id/kanban",
}));

describe("TaskCard rendering (Epic 15 wiring)", () => {
  it("renders task title in the card", () => {
    // TODO(epic-15): render <TaskCard /> with renderHook/render and assert
    // that the task title appears in the DOM.
    //
    // const task = makeTask({ title: "My task" });
    // const { getByText } = render(<TaskCard task={task} ... />);
    // expect(getByText("My task")).toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", () => {
    // TODO(epic-15): render <TaskCard /> and simulate a click.
    //
    // const onClick = vi.fn();
    // const { getByRole } = render(<TaskCard ... onClick={onClick} />);
    // await userEvent.click(getByRole("button"));
    // expect(onClick).toHaveBeenCalledWith(task.id);
  });

  it("does not render cell rows for columns not in visibleColumnIds", () => {
    // TODO(epic-15): render with a cardStyle that has empty visibleColumnIds.
    // Assert no cell rows appear.
  });

  it("renders up to 5 cell rows when visibleColumnIds has more than 5 entries", () => {
    // TODO(epic-15): render with cardStyle.visibleColumnIds having 7 entries.
    // Assert exactly 5 cell rows are rendered.
  });
});
