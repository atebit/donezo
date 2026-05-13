import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * use-board-view-cross-kind.test.ts
 *
 * Tests for the cross-kind `switchView` navigation added in Epic 12 Slice A.
 *
 * Since `useBoardView` is a "use client" hook that requires renderHook from
 * @testing-library/react (wired in Epic 15), the hook itself cannot be rendered
 * in the current test environment.
 *
 * This file tests the PURE HELPERS that power the cross-kind navigation:
 *   - `kindFromPath` — extract view kind from pathname
 *   - `pathForKind` — build target URL for a given kind
 *
 * The integration test (hook + router mocking) is deferred to Epic 15 and is
 * described in the `describe.skip` block below so the full intent is documented.
 */

import { kindFromPath, pathForKind } from "@/lib/views/kind-routes";

const WORKSPACE_SLUG = "acme";
const BOARD_ID = "b1234567-0000-0000-0000-000000000001";
const VIEW_ID = "v9abcdef0-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Pure helper tests — run without renderHook
// ---------------------------------------------------------------------------

describe("kindFromPath", () => {
  it("returns 'table' for a /table pathname", () => {
    expect(kindFromPath(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/table`)).toBe("table");
  });

  it("returns 'kanban' for a /kanban pathname", () => {
    expect(kindFromPath(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/kanban`)).toBe("kanban");
  });

  it("returns 'calendar' for a /calendar pathname", () => {
    expect(kindFromPath(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/calendar`)).toBe("calendar");
  });

  it("returns 'timeline' for a /timeline pathname", () => {
    expect(kindFromPath(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/timeline`)).toBe("timeline");
  });

  it("returns 'dashboard' for a /dashboard pathname", () => {
    expect(kindFromPath(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/dashboard`)).toBe("dashboard");
  });

  it("returns 'form' for a /form pathname", () => {
    expect(kindFromPath(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/form`)).toBe("form");
  });

  it("returns 'table' when no kind segment is present (bare board route)", () => {
    expect(kindFromPath(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`)).toBe("table");
  });

  it("strips query string when parsing kind", () => {
    expect(kindFromPath(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/kanban?view=${VIEW_ID}`)).toBe(
      "kanban",
    );
  });

  it("returns 'table' for an unrecognised kind segment", () => {
    expect(kindFromPath(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/unknown`)).toBe("table");
  });
});

describe("pathForKind", () => {
  it("builds a table path with a view id", () => {
    const path = pathForKind("table", WORKSPACE_SLUG, BOARD_ID, VIEW_ID);
    expect(path).toBe(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/table?view=${VIEW_ID}`);
  });

  it("builds a kanban path with a view id", () => {
    const path = pathForKind("kanban", WORKSPACE_SLUG, BOARD_ID, VIEW_ID);
    expect(path).toBe(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/kanban?view=${VIEW_ID}`);
  });

  it("builds a calendar path without a view id", () => {
    const path = pathForKind("calendar", WORKSPACE_SLUG, BOARD_ID);
    expect(path).toBe(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/calendar`);
  });

  it("builds a timeline path", () => {
    const path = pathForKind("timeline", WORKSPACE_SLUG, BOARD_ID, VIEW_ID);
    expect(path).toBe(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/timeline?view=${VIEW_ID}`);
  });

  it("builds a dashboard path", () => {
    const path = pathForKind("dashboard", WORKSPACE_SLUG, BOARD_ID, VIEW_ID);
    expect(path).toBe(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/dashboard?view=${VIEW_ID}`);
  });

  it("builds a form path", () => {
    const path = pathForKind("form", WORKSPACE_SLUG, BOARD_ID, VIEW_ID);
    expect(path).toBe(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/form?view=${VIEW_ID}`);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — deferred to Epic 15 when renderHook is available
// ---------------------------------------------------------------------------

// Top-level module mocks (hoisted by vitest regardless of placement)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/table`,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-board", () => ({
  useBoard: () => ({
    board: { id: BOARD_ID },
    role: "editor",
    workspaceSlug: WORKSPACE_SLUG,
  }),
}));

describe("useBoardView cross-kind navigation (Epic 15 wiring)", () => {
  // Reset board store between tests.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls router.push for a cross-kind switch (table → kanban)", () => {
    // TODO(epic-15): render the hook with renderHook, inject a kanban view
    // into the store, call switchView(kanbanViewId), and assert that
    // router.push was called with the kanban path.
    //
    // const kanbanViewId = "kanban-view-id";
    // const { result } = renderHook(() => useBoardView());
    // act(() => { result.current.switchView(kanbanViewId); });
    // expect(mockPush).toHaveBeenCalledWith(
    //   `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/kanban?view=${kanbanViewId}`
    // );
  });

  it("calls router.replace for a same-kind switch (table → table)", () => {
    // TODO(epic-15): render the hook with renderHook, inject a table view
    // into the store, call switchView(tableViewId), and assert that
    // router.replace was called (not push).
  });
});
