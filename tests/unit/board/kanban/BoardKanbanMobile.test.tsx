// @ts-expect-error vitest runner wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * Tests for KanbanBoard / KanbanLane mobile snap-scroll behaviour.
 *
 * Full render tests (render, screen) require @testing-library/react + jsdom —
 * wired in epic 15. Module-shape tests run in node mode now.
 *
 * Contract being tested:
 * - KanbanBoard and KanbanLane are exported from their modules.
 * - The container div in KanbanBoard has scroll-snap classes (snap-x snap-mandatory).
 * - KanbanLane has min-w-full and snap-start classes for mobile snap snapping.
 * - Desktop (md+) snap context is removed via md:snap-none on the container.
 */

// ---------------------------------------------------------------------------
// Module shape tests (plain node)
// ---------------------------------------------------------------------------

describe("KanbanBoard mobile — module contract", () => {
  it("exports KanbanBoard as a named function", async () => {
    const mod = await import("@/components/board/kanban/KanbanBoard");
    expect(typeof mod.KanbanBoard).toBe("function");
  });
});

describe("KanbanLane mobile — module contract", () => {
  it("exports KanbanLane as a named function", async () => {
    const mod = await import("@/components/board/kanban/KanbanLane");
    expect(typeof mod.KanbanLane).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Class-string verification (static inspection)
// ---------------------------------------------------------------------------

describe("KanbanBoard — snap-scroll CSS classes", () => {
  it("KanbanBoard source contains snap-x class for mobile horizontal snap", async () => {
    // Static verification: the component source includes the expected classes.
    // This test reads the compiled module function source to verify the class strings
    // are present. It will be replaced by RTL render tests in epic 15.
    const mod = await import("@/components/board/kanban/KanbanBoard");
    const src = mod.KanbanBoard.toString();
    // The container should include snap-x (scroll-snap-type: x) and snap-mandatory
    expect(src).toContain("snap-x");
    expect(src).toContain("snap-mandatory");
  });

  it("KanbanBoard source contains md:snap-none to disable snapping on desktop", async () => {
    const mod = await import("@/components/board/kanban/KanbanBoard");
    const src = mod.KanbanBoard.toString();
    expect(src).toContain("md:snap-none");
  });
});

describe("KanbanLane — snap CSS classes", () => {
  it("KanbanLane source contains snap-start for scroll-snap-align: start", async () => {
    const mod = await import("@/components/board/kanban/KanbanLane");
    const src = mod.KanbanLane.toString();
    expect(src).toContain("snap-start");
  });

  it("KanbanLane source contains min-w-full for full-viewport width on mobile", async () => {
    const mod = await import("@/components/board/kanban/KanbanLane");
    const src = mod.KanbanLane.toString();
    expect(src).toContain("min-w-full");
  });

  it("KanbanLane source contains md:min-w-0 to reset min-width on desktop", async () => {
    const mod = await import("@/components/board/kanban/KanbanLane");
    const src = mod.KanbanLane.toString();
    expect(src).toContain("md:min-w-0");
  });
});

// ---------------------------------------------------------------------------
// Render tests (require RTL + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe.skip("KanbanBoard — mobile snap render (requires RTL + jsdom, epic 15)", () => {
  it("lane container has scroll-snap-type x mandatory class on mobile", async () => {
    const { render, container } = await import("@testing-library/react");
    const { KanbanBoard } = await import("@/components/board/kanban/KanbanBoard");

    // Mock stores and deps
    render(
      <KanbanBoard
        boardId="b1"
        initial={
          {
            tasks: [],
            cells: new Map(),
            columns: [],
            groups: [],
            labelsByColumn: new Map(),
            sortKeys: [],
            workspaceMembers: [],
          } as never
        }
      />,
    );

    const laneContainer = container.querySelector(".snap-x.snap-mandatory");
    expect(laneContainer).toBeTruthy();
  });

  it("each KanbanLane has snap-start and min-w-full classes", async () => {
    const { render, container } = await import("@testing-library/react");
    const { KanbanBoard } = await import("@/components/board/kanban/KanbanBoard");

    render(
      <KanbanBoard
        boardId="b1"
        initial={
          {
            tasks: [],
            cells: new Map(),
            columns: [],
            groups: [],
            labelsByColumn: new Map(),
            sortKeys: [],
            workspaceMembers: [],
          } as never
        }
      />,
    );

    const lanes = container.querySelectorAll(".snap-start.min-w-full");
    expect(lanes.length).toBeGreaterThan(0);
  });
});
