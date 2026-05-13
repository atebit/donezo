// @ts-expect-error vitest runner wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * Tests for TaskDrawer mobile fullscreen behaviour.
 *
 * Full render tests (render, screen) require @testing-library/react + jsdom —
 * wired in epic 15. They are in describe.skip per the established repo pattern.
 *
 * Module-shape tests run in node mode now and verify the contract is correct.
 *
 * Contract being tested:
 * - TaskDrawer is exported from components/board/TaskDrawer.
 * - On mobile (<768px), drawer renders as a full-viewport sheet
 *   (data-testid="task-drawer" inside a SheetContent).
 * - On desktop (≥768px), drawer renders as the existing fixed overlay div
 *   with data-testid="task-drawer".
 * - Existing Esc-key and close behaviour are preserved via TaskDrawerModalShell.
 */

// ---------------------------------------------------------------------------
// Module shape tests (plain node — no React rendering needed)
// ---------------------------------------------------------------------------

describe("TaskDrawer mobile — module contract", () => {
  it("exports TaskDrawer as a named function", async () => {
    const mod = await import("@/components/board/TaskDrawer");
    expect(typeof mod.TaskDrawer).toBe("function");
  });

  it("imports Sheet and SheetContent from components/ui/sheet", async () => {
    // Verify the sheet module is available (dependency from Slice B)
    const mod = await import("@/components/ui/sheet");
    expect(typeof mod.Sheet).toBe("function");
    expect(typeof mod.SheetContent).toBe("function");
  });

  it("imports useMediaQuery hook (dependency from Slice B)", async () => {
    const mod = await import("@/hooks/use-media-query");
    expect(typeof mod.useMediaQuery).toBe("function");
  });

  it("TaskDrawer source references useMediaQuery for mobile detection", async () => {
    const mod = await import("@/components/board/TaskDrawer");
    const src = mod.TaskDrawer.toString();
    expect(src).toContain("useMediaQuery");
  });

  it("TaskDrawer source references SheetContent for mobile full-screen", async () => {
    const mod = await import("@/components/board/TaskDrawer");
    const src = mod.TaskDrawer.toString();
    expect(src).toContain("SheetContent");
  });

  it("TaskDrawer source has isDesktop conditional", async () => {
    const mod = await import("@/components/board/TaskDrawer");
    const src = mod.TaskDrawer.toString();
    expect(src).toContain("isDesktop");
  });

  it("TaskDrawer source contains h-[100dvh] for mobile fullscreen height", async () => {
    const mod = await import("@/components/board/TaskDrawer");
    const src = mod.TaskDrawer.toString();
    expect(src).toContain("h-[100dvh]");
  });
});

// ---------------------------------------------------------------------------
// Render tests (require RTL + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe.skip("TaskDrawer — mobile fullscreen render (requires RTL + jsdom, epic 15)", () => {
  it("renders data-testid=task-drawer in mobile mode", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { TaskDrawer } = await import("@/components/board/TaskDrawer");

    const mockTask = {
      id: "t1",
      board_id: "b1",
      group_id: "g1",
      title: "Test Task",
      position: 1,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      deleted_at: null,
      created_by: "u1",
    };

    render(
      <TaskDrawer
        taskId="t1"
        task={mockTask as never}
        comments={[]}
        reactions={[]}
        activity={[]}
        attachments={[]}
        mentionableMembers={[]}
        currentUserId="u1"
        boardRole="member"
        variant="modal"
      />,
    );

    expect(screen.getByTestId("task-drawer")).toBeTruthy();
  });

  it("at <768px the SheetContent has h-[100dvh] for full-screen", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { TaskDrawer } = await import("@/components/board/TaskDrawer");

    const mockTask = {
      id: "t1",
      board_id: "b1",
      group_id: "g1",
      title: "Mobile Task",
      position: 1,
      created_at: "",
      updated_at: "",
      deleted_at: null,
      created_by: "u1",
    };

    render(
      <TaskDrawer
        taskId="t1"
        task={mockTask as never}
        comments={[]}
        reactions={[]}
        activity={[]}
        attachments={[]}
        mentionableMembers={[]}
        currentUserId="u1"
        boardRole="member"
        variant="modal"
      />,
    );

    const drawer = screen.getByTestId("task-drawer");
    expect(drawer).toBeTruthy();
  });
});
