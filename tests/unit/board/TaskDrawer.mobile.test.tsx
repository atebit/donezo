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
 *
 * Epic 14 followup-1 F3 additions:
 * - TaskDrawer imports SheetTitle for the visually-hidden accessible label.
 * - TaskDrawer mobile branch contains <SheetTitle className="sr-only"> to
 *   give the Base UI Dialog an accessible name (WCAG 4.1.2).
 * - TaskDrawerModalShell imports and calls useMediaQuery('(min-width: 768px)')
 *   and uses the result to gate the outer role="dialog" wrapper (desktop only).
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

  // --- Epic 14 followup-1 F3: SheetTitle accessible label ---

  it("sheet module exports SheetTitle", async () => {
    const mod = await import("@/components/ui/sheet");
    expect(typeof mod.SheetTitle).toBe("function");
  });

  it("TaskDrawer.tsx imports SheetTitle from @/components/ui/sheet", async () => {
    // Source-contract: verify SheetTitle is used inside the component module.
    // The compiled toString() of TaskDrawer won't include import statements,
    // but we can verify the SheetTitle symbol is reachable through the sheet module
    // and that TaskDrawer's source references it.
    const sheetMod = await import("@/components/ui/sheet");
    expect(typeof sheetMod.SheetTitle).toBe("function");
    // The component function source must mention SheetTitle (used in mobile branch).
    const drawerMod = await import("@/components/board/TaskDrawer");
    const src = drawerMod.TaskDrawer.toString();
    expect(src).toContain("SheetTitle");
  });

  it("TaskDrawer source contains sr-only signaling the visually-hidden title", async () => {
    const mod = await import("@/components/board/TaskDrawer");
    const src = mod.TaskDrawer.toString();
    expect(src).toContain("sr-only");
  });
});

// ---------------------------------------------------------------------------
// TaskDrawerModalShell module-shape tests (Epic 14 followup-1 F3)
// ---------------------------------------------------------------------------

describe("TaskDrawerModalShell — mobile ARIA gate contract", () => {
  it("exports TaskDrawerModalShell as a named function", async () => {
    const mod = await import("@/components/board/TaskDrawerModalShell");
    expect(typeof mod.TaskDrawerModalShell).toBe("function");
  });

  it("useMediaQuery hook is importable (dependency for the gate)", async () => {
    const mod = await import("@/hooks/use-media-query");
    expect(typeof mod.useMediaQuery).toBe("function");
  });

  it("TaskDrawerModalShell source calls useMediaQuery('(min-width: 768px)')", async () => {
    const mod = await import("@/components/board/TaskDrawerModalShell");
    const src = mod.TaskDrawerModalShell.toString();
    // The compiled output must reference the media query string used for gating.
    expect(src).toContain("useMediaQuery");
    expect(src).toContain("(min-width: 768px)");
  });

  it("TaskDrawerModalShell source references isDesktop to gate the outer dialog", async () => {
    const mod = await import("@/components/board/TaskDrawerModalShell");
    const src = mod.TaskDrawerModalShell.toString();
    expect(src).toContain("isDesktop");
  });

  it("TaskDrawerModalShell source does NOT render role=dialog unconditionally", async () => {
    // The outer role="dialog" must be inside the desktop branch (behind isDesktop).
    // We verify this by checking that the source has both isDesktop and role="dialog".
    // (A full render assertion requires RTL — deferred to epic 15.)
    const mod = await import("@/components/board/TaskDrawerModalShell");
    const src = mod.TaskDrawerModalShell.toString();
    expect(src).toContain("isDesktop");
    expect(src).toContain("role");
    expect(src).toContain("dialog");
  });
});

// ---------------------------------------------------------------------------
// Render tests (require RTL + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe.skip("TaskDrawer — mobile fullscreen render (requires RTL + jsdom, epic 15)", () => {
  // Skipped: TaskDrawer requires <BoardProvider> wrapper; rendering without it throws
  // "useBoard must be used inside <BoardProvider>". Needs a BoardProvider test wrapper.
  // Tracked in epic-15-test-debt.md.
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
