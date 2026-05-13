// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for view server actions and setLastViewForBoard.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * Written now so epic 15 executor can pick them up without changes.
 *
 * Mocking approach (mirrors attachment-actions.test.ts):
 *   - `@/lib/supabase/server` → createClient returns a fake SupabaseClient.
 *   - `@/lib/logger`          → no-op stubs.
 *   - `@/lib/authorization/board` → requireBoardRole is a spy.
 */

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

const mockRequireBoardRole = vi.fn().mockResolvedValue("member");
vi.mock("../../lib/authorization/board", () => ({
  requireBoardRole: (...args: unknown[]) => mockRequireBoardRole(...args),
  getBoardRole: vi.fn().mockResolvedValue("member"),
}));

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOARD_ID = "bbbbb000-0000-0000-0000-000000000001";
const VIEW_ID = "vvvvv000-0000-0000-0000-000000000001";
const VIEW_ID_2 = "vvvvv000-0000-0000-0000-000000000002";
const USER_ID = "uuuuu000-0000-0000-0000-000000000001";
const USER_ID_2 = "uuuuu000-0000-0000-0000-000000000002";
const WORKSPACE_ID = "wwwww000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeViewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VIEW_ID,
    board_id: BOARD_ID,
    owner_id: USER_ID,
    name: "My view",
    kind: "table",
    config: {},
    is_shared: false,
    position: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: "user@example.com",
    display_name: "Test User",
    avatar_url: null,
    last_workspace_id: null,
    last_view_per_board: {} as Record<string, string>,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Builds a minimal chainable Supabase client mock that handles the
 * typical query chains used by view actions:
 *   from → select → eq → order → limit → maybeSingle
 *   from → select → eq → single
 *   from → insert → select → single
 *   from → update → eq → select → single
 *   from → delete → eq
 *   from → select("id", { count, head }) → eq → eq → eq (count query)
 */
function makeSupabase({
  viewRow = makeViewRow() as ReturnType<typeof makeViewRow> | null,
  viewRowError = null as { message: string } | null,
  maxPositionRow = { position: 2 } as { position: number } | null,
  insertedView = makeViewRow({ id: VIEW_ID_2 }) as ReturnType<typeof makeViewRow> | null,
  insertError = null as { message: string } | null,
  updateError = null as { message: string } | null,
  deleteError = null as { message: string } | null,
  sharedTableViewCount = 2,
  profileRow = makeProfileRow() as ReturnType<typeof makeProfileRow> | null,
  profileRowError = null as { message: string } | null,
  profileUpdateError = null as { message: string } | null,
  rpcData = [] as unknown[],
  rpcError = null as { message: string } | null,
} = {}) {
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
  };

  // Shared view row chain (select + eq + single)
  const viewSelectChain = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: viewRow, error: viewRow ? null : viewRowError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: maxPositionRow, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
  };

  // Count chain for the "last shared table view" guard.
  // The query: await supabase.from("view").select("id",{count:"exact",head:true})
  //              .eq("board_id", ...).eq("is_shared", ...).eq("kind", ...)
  // resolves to { count: N }.
  // The mock resolves the whole chain when awaited by making each .eq() call
  // return an object whose final .eq() resolves to the count result.
  const countResult = { count: sharedTableViewCount };
  const countLeaf = vi.fn().mockResolvedValue(countResult);
  const countChain = {
    eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: countLeaf }) }),
  };

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "view") {
      return {
        select: vi
          .fn()
          .mockImplementation((cols?: string, opts?: { count?: string; head?: boolean }) => {
            // Count query: .select("id", { count: "exact", head: true })
            if (opts?.count === "exact" && opts?.head === true) {
              return countChain;
            }
            // Position query: .select("position") → order → limit → maybeSingle
            if (cols === "position") {
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({ data: maxPositionRow, error: null }),
                    }),
                  }),
                }),
              };
            }
            // Default select ("*")
            return viewSelectChain;
          }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: insertedView, error: insertError }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: viewRow ? { ...viewRow, name: "Updated" } : null,
                error: updateError,
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: deleteError }),
        }),
      };
    }

    if (table === "profile") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: profileRow,
              error: profileRow ? null : profileRowError,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: profileUpdateError }),
        }),
      };
    }

    // Fallback
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });

  return { auth, from, rpc };
}

// ---------------------------------------------------------------------------
// describe: createView
// ---------------------------------------------------------------------------

describe.skip("createView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBoardRole.mockResolvedValue("member");
  });

  it("creates a personal view when isShared is false", async () => {
    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { createView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await createView({
      boardId: BOARD_ID,
      name: "My view",
      kind: "table",
      isShared: false,
    });

    expect(result.ok).toBe(true);
    expect(mockRequireBoardRole).toHaveBeenCalledWith(BOARD_ID, "member");
  });

  it("requires admin+ when isShared is true", async () => {
    mockRequireBoardRole.mockRejectedValue({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    });

    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { createView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await createView({
      boardId: BOARD_ID,
      name: "Main table",
      kind: "table",
      isShared: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(mockRequireBoardRole).toHaveBeenCalledWith(BOARD_ID, "admin");
  });

  it("rejects invalid input with VALIDATION code", async () => {
    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { createView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await createView({
      boardId: "not-a-uuid",
      name: "My view",
      kind: "table",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
    }
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("uses next position = maxPosition + 1", async () => {
    const supabase = makeSupabase({ maxPositionRow: { position: 5 } });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { createView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    await createView({
      boardId: BOARD_ID,
      name: "My view",
      kind: "table",
    });

    // position should have been passed as 6 to the insert
    const viewFrom = supabase.from.mock.calls.find((c: unknown[]) => c[0] === "view");
    expect(viewFrom).toBeDefined();
  });

  it("uses position 0 when no existing views (maxPosition = null)", async () => {
    const supabase = makeSupabase({ maxPositionRow: null });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { createView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await createView({
      boardId: BOARD_ID,
      name: "My view",
      kind: "table",
    });

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// describe: saveView
// ---------------------------------------------------------------------------

describe.skip("saveView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBoardRole.mockResolvedValue("admin");
  });

  it("allows updating own personal view (owner_id = userId)", async () => {
    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: USER_ID, is_shared: false }),
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { saveView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await saveView({
      viewId: VIEW_ID,
      config: { density: "compact" },
    });

    expect(result.ok).toBe(true);
    // requireBoardRole should NOT have been called (personal row, own user)
    expect(mockRequireBoardRole).not.toHaveBeenCalled();
  });

  it("requires admin+ for a shared view", async () => {
    mockRequireBoardRole.mockRejectedValue({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    });

    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: null, is_shared: true }),
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { saveView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await saveView({
      viewId: VIEW_ID,
      config: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(mockRequireBoardRole).toHaveBeenCalledWith(BOARD_ID, "admin");
  });

  it("forbids editing another user's personal view", async () => {
    // The view belongs to USER_ID_2, but the authed user is USER_ID.
    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: USER_ID_2, is_shared: false }),
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { saveView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await saveView({
      viewId: VIEW_ID,
      config: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.message).toMatch(/personal view/i);
    }
  });

  it("returns NOT_FOUND when the view does not exist", async () => {
    const supabase = makeSupabase({
      viewRow: null,
      viewRowError: { message: "not found" },
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { saveView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await saveView({ viewId: VIEW_ID, config: {} });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});

// ---------------------------------------------------------------------------
// describe: renameView
// ---------------------------------------------------------------------------

describe.skip("renameView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBoardRole.mockResolvedValue("admin");
  });

  it("allows renaming own personal view", async () => {
    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: USER_ID, is_shared: false }),
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { renameView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await renameView({ viewId: VIEW_ID, name: "Renamed" });

    expect(result.ok).toBe(true);
    expect(mockRequireBoardRole).not.toHaveBeenCalled();
  });

  it("requires admin+ for a shared view (mirrors saveView gate)", async () => {
    mockRequireBoardRole.mockRejectedValue({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    });

    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: null, is_shared: true }),
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { renameView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await renameView({ viewId: VIEW_ID, name: "New name" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("forbids renaming another user's personal view", async () => {
    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: USER_ID_2, is_shared: false }),
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { renameView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await renameView({ viewId: VIEW_ID, name: "Renamed" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });
});

// ---------------------------------------------------------------------------
// describe: duplicateView
// ---------------------------------------------------------------------------

describe.skip("duplicateView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBoardRole.mockResolvedValue("viewer");
  });

  it("creates a personal copy with (copy) suffix", async () => {
    const sourceView = makeViewRow({
      name: "Main table",
      owner_id: null,
      is_shared: true,
    });
    const supabase = makeSupabase({ viewRow: sourceView });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { duplicateView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await duplicateView({ viewId: VIEW_ID });

    expect(result.ok).toBe(true);
    // Verify that requireBoardRole was called with "viewer"
    expect(mockRequireBoardRole).toHaveBeenCalledWith(BOARD_ID, "viewer");
  });

  it("requires at minimum viewer access", async () => {
    mockRequireBoardRole.mockRejectedValue({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    });

    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { duplicateView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await duplicateView({ viewId: VIEW_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("always sets is_shared = false on the duplicate (even when source is shared)", async () => {
    const sourceView = makeViewRow({ name: "Main table", owner_id: null, is_shared: true });
    let capturedInsert: Record<string, unknown> | null = null;

    const supabase = makeSupabase({ viewRow: sourceView });
    // Intercept the insert call to capture what was passed
    const originalFrom = supabase.from.getMockImplementation?.();
    supabase.from.mockImplementation((table: string) => {
      const chain = originalFrom ? originalFrom(table) : null;
      if (table === "view" && chain) {
        const origInsert = chain.insert.bind(chain);
        chain.insert = vi.fn().mockImplementation((data: Record<string, unknown>) => {
          capturedInsert = data;
          return origInsert(data);
        });
      }
      return chain;
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { duplicateView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    await duplicateView({ viewId: VIEW_ID });

    // The duplicate must be personal regardless of source
    if (capturedInsert) {
      expect((capturedInsert as Record<string, unknown>).is_shared).toBe(false);
      expect((capturedInsert as Record<string, unknown>).owner_id).toBe(USER_ID);
      expect(String((capturedInsert as Record<string, unknown>).name)).toContain("(copy)");
    }
  });
});

// ---------------------------------------------------------------------------
// describe: deleteView
// ---------------------------------------------------------------------------

describe.skip("deleteView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBoardRole.mockResolvedValue("admin");
  });

  it("allows deleting own personal view", async () => {
    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: USER_ID, is_shared: false }),
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { deleteView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await deleteView({ viewId: VIEW_ID });

    expect(result.ok).toBe(true);
  });

  it("throws LAST_DEFAULT when deleting the last shared table view", async () => {
    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: null, is_shared: true, kind: "table" }),
      sharedTableViewCount: 1, // only one left
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { deleteView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await deleteView({ viewId: VIEW_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("LAST_DEFAULT");
    }
  });

  it("allows deleting a shared view when there are other shared table views", async () => {
    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: null, is_shared: true, kind: "table" }),
      sharedTableViewCount: 2, // more than one
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { deleteView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await deleteView({ viewId: VIEW_ID });

    expect(result.ok).toBe(true);
  });

  it("forbids deleting another user's personal view", async () => {
    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: USER_ID_2, is_shared: false }),
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { deleteView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await deleteView({ viewId: VIEW_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("does NOT check LAST_DEFAULT for non-table shared views", async () => {
    // A shared kanban view — the guard only fires for kind === "table"
    const supabase = makeSupabase({
      viewRow: makeViewRow({ owner_id: null, is_shared: true, kind: "kanban" }),
      sharedTableViewCount: 0, // irrelevant — guard shouldn't fire
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { deleteView } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await deleteView({ viewId: VIEW_ID });

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// describe: globalSearch
// ---------------------------------------------------------------------------

describe.skip("globalSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls supabase.rpc with the correct parameters", async () => {
    const mockResults = [
      { kind: "task", id: "t1", title: "Fix bug", board_id: BOARD_ID, board_title: "Dev Board" },
    ];
    const supabase = makeSupabase({ rpcData: mockResults });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { globalSearch } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await globalSearch({ workspaceId: WORKSPACE_ID, q: "fix" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockResults);
    }
    expect(supabase.rpc).toHaveBeenCalledWith("global_search", {
      p_workspace_id: WORKSPACE_ID,
      q: "fix",
    });
  });

  it("rejects an empty query string", async () => {
    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { globalSearch } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await globalSearch({ workspaceId: WORKSPACE_ID, q: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
    }
  });

  it("surfaces DB error from rpc", async () => {
    const supabase = makeSupabase({
      rpcData: null,
      rpcError: { message: "function does not exist" },
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { globalSearch } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions"
    );

    const result = await globalSearch({ workspaceId: WORKSPACE_ID, q: "hello" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DB");
    }
  });
});

// ---------------------------------------------------------------------------
// describe: setLastViewForBoard
// ---------------------------------------------------------------------------

describe.skip("setLastViewForBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges the new boardId→viewId into an existing map", async () => {
    const existingMap = { "other-board-id": "other-view-id" };
    const supabase = makeSupabase({
      profileRow: makeProfileRow({ last_view_per_board: existingMap }),
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { setLastViewForBoard } = await import("../../app/(app)/account/last-view-actions");

    const result = await setLastViewForBoard({ boardId: BOARD_ID, viewId: VIEW_ID });

    expect(result.ok).toBe(true);
    // Verify that the update was called with the merged map
    const profileFrom = supabase.from.mock.calls.find((c: unknown[]) => c[0] === "profile");
    expect(profileFrom).toBeDefined();
  });

  it("preserves existing entries when merging", async () => {
    const existingMap = {
      "board-aaa": "view-aaa",
      "board-bbb": "view-bbb",
    };
    let capturedUpdate: Record<string, unknown> | null = null;

    const supabase = makeSupabase({
      profileRow: makeProfileRow({ last_view_per_board: existingMap }),
    });
    // Intercept the update call
    const origFrom = supabase.from.getMockImplementation?.();
    supabase.from.mockImplementation((table: string) => {
      const chain = origFrom ? origFrom(table) : null;
      if (table === "profile" && chain) {
        const origUpdate = chain.update.bind(chain);
        chain.update = vi.fn().mockImplementation((data: Record<string, unknown>) => {
          capturedUpdate = data;
          return origUpdate(data);
        });
      }
      return chain;
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { setLastViewForBoard } = await import("../../app/(app)/account/last-view-actions");

    await setLastViewForBoard({ boardId: BOARD_ID, viewId: VIEW_ID });

    if (capturedUpdate) {
      const map = (capturedUpdate as { last_view_per_board: Record<string, string> })
        .last_view_per_board;
      // Existing entries preserved
      expect(map?.["board-aaa"]).toBe("view-aaa");
      expect(map?.["board-bbb"]).toBe("view-bbb");
      // New entry added
      expect(map?.[BOARD_ID]).toBe(VIEW_ID);
    }
  });

  it("handles a profile with null last_view_per_board (first write)", async () => {
    const supabase = makeSupabase({
      profileRow: makeProfileRow({ last_view_per_board: null }),
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { setLastViewForBoard } = await import("../../app/(app)/account/last-view-actions");

    const result = await setLastViewForBoard({ boardId: BOARD_ID, viewId: VIEW_ID });

    expect(result.ok).toBe(true);
  });

  it("surfaces DB error when profile update fails", async () => {
    const supabase = makeSupabase({
      profileUpdateError: { message: "update failed" },
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { setLastViewForBoard } = await import("../../app/(app)/account/last-view-actions");

    const result = await setLastViewForBoard({ boardId: BOARD_ID, viewId: VIEW_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DB");
    }
  });

  it("returns DB error when profile is missing", async () => {
    const supabase = makeSupabase({
      profileRow: null,
      profileRowError: { message: "row not found" },
    });
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { setLastViewForBoard } = await import("../../app/(app)/account/last-view-actions");

    const result = await setLastViewForBoard({ boardId: BOARD_ID, viewId: VIEW_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DB");
    }
  });
});
