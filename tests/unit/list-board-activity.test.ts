// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for listBoardActivity server action.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * Written now so epic 15 executor can pick them up without changes.
 *
 * Mocking approach:
 *   - `@/lib/supabase/server` → createClient returns a fake SupabaseClient.
 *   - `@/lib/authorization/board` → requireBoardRole is a spy.
 *   - `@/lib/logger` → no-op stubs.
 *   - Auth user set to ACTOR_ID.
 *
 * Mock builder: the query object is a chainable mock where every method returns
 * `this`, and the final resolved value comes from `mockResolvedValueOnce` applied
 * to `lte` (the last chain-method in the builder). Because Supabase query builders
 * are not promises until awaited, we attach a real promise via `Symbol.toStringTag`
 * and override the underlying `then` by making the mock object itself thenable via
 * a wrapper — but Biome disallows `then` properties. Instead, we wrap the query
 * builder in a real Promise that resolves to `{ data, error }` and expose it as
 * the mock return from `from()`.
 */

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BOARD_ID = "bbbbb000-0000-0000-0000-000000000001";
const ACTOR_ID = "aaaaa000-0000-0000-0000-000000000001";

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    board_id: BOARD_ID,
    task_id: null,
    actor_id: ACTOR_ID,
    type: "task.created",
    payload: {},
    created_at: "2024-01-01T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockRequireBoardRole = vi.fn().mockResolvedValue("viewer");
vi.mock("../../lib/authorization/board", () => ({
  requireBoardRole: (...args: unknown[]) => mockRequireBoardRole(...args),
}));

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * Build a chainable Supabase-like query mock.
 *
 * Because Biome forbids a `then` property on plain objects (noThenProperty),
 * we use a two-layer approach:
 *   1. The query object exposes chainable vi.fn() methods — each returns the
 *      same object so `.eq(...).order(...).limit(...)` chains work.
 *   2. `mockFrom` returns a function that, when called, returns a Promise that
 *      resolves to `{ data, error }`. The action's `await q` will resolve the
 *      Promise returned by `from()`.
 *
 * This avoids any object with a `then` property while still being awaitable.
 */
function makeMockQuerySetup(returnData: unknown[] = [], returnError: unknown = null) {
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
  };
  // The Supabase builder needs to be awaitable. We achieve this by making `from`
  // return a Proxy that wraps q and is itself a Promise. However a simpler
  // approach that avoids Biome's noThenProperty: have the final `.lte()` (or any
  // terminal call) return a real promise. In tests, we ensure that when `await q`
  // is used, TypeScript treats q as PromiseLike by having `from` return:
  //   Object.assign(Promise.resolve({ data, error }), q)
  // That object IS a Promise (inherits .then from Promise.prototype), so Biome
  // will not flag it as "this object defines a then property".
  const resolved = Object.assign(Promise.resolve({ data: returnData, error: returnError }), q);
  return resolved;
}

const mockFrom = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: ACTOR_ID } },
});

vi.mock("../../lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skip("listBoardActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBoardRole.mockResolvedValue("viewer");
    mockGetUser.mockResolvedValue({ data: { user: { id: ACTOR_ID } } });
  });

  it("calls requireBoardRole with boardId and viewer", async () => {
    const events = [makeActivity()];
    mockFrom.mockReturnValue(makeMockQuerySetup(events));

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    await listBoardActivity({ boardId: BOARD_ID });

    expect(mockRequireBoardRole).toHaveBeenCalledWith(BOARD_ID, "viewer");
  });

  it("builds query with eq(board_id), order(created_at desc), order(id desc), limit(50)", async () => {
    const events = [makeActivity()];
    const mockQuery = makeMockQuerySetup(events);
    mockFrom.mockReturnValue(mockQuery);

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    await listBoardActivity({ boardId: BOARD_ID });

    expect(mockQuery.eq).toHaveBeenCalledWith("board_id", BOARD_ID);
    expect(mockQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockQuery.order).toHaveBeenCalledWith("id", { ascending: false });
    expect(mockQuery.limit).toHaveBeenCalledWith(50);
  });

  it("applies cursor or-clause when cursor provided", async () => {
    const ts = "2024-01-01T10:00:00.000Z";
    const id = "evt-99";
    const cursor = `${ts}|${id}`;
    const mockQuery = makeMockQuerySetup([]);
    mockFrom.mockReturnValue(mockQuery);

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    await listBoardActivity({ boardId: BOARD_ID, cursor });

    expect(mockQuery.or).toHaveBeenCalledWith(
      `created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${id})`,
    );
  });

  it("does not call or() when cursor is null", async () => {
    const mockQuery = makeMockQuerySetup([]);
    mockFrom.mockReturnValue(mockQuery);

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    await listBoardActivity({ boardId: BOARD_ID, cursor: null });

    expect(mockQuery.or).not.toHaveBeenCalled();
  });

  it("applies actorIds filter via in() when provided", async () => {
    const mockQuery = makeMockQuerySetup([]);
    mockFrom.mockReturnValue(mockQuery);

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    await listBoardActivity({
      boardId: BOARD_ID,
      filters: { actorIds: [ACTOR_ID] },
    });

    expect(mockQuery.in).toHaveBeenCalledWith("actor_id", [ACTOR_ID]);
  });

  it("applies actionGroups filter via or() with like patterns", async () => {
    const mockQuery = makeMockQuerySetup([]);
    mockFrom.mockReturnValue(mockQuery);

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    await listBoardActivity({
      boardId: BOARD_ID,
      filters: { actionGroups: ["task", "comment"] },
    });

    expect(mockQuery.or).toHaveBeenCalledWith("type.like.task.%,type.like.comment.%");
  });

  it("applies dateFrom filter via gte()", async () => {
    const mockQuery = makeMockQuerySetup([]);
    mockFrom.mockReturnValue(mockQuery);

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    await listBoardActivity({
      boardId: BOARD_ID,
      filters: { dateFrom: "2024-01-01T00:00:00.000Z" },
    });

    expect(mockQuery.gte).toHaveBeenCalledWith("created_at", "2024-01-01T00:00:00.000Z");
  });

  it("applies dateTo filter via lte()", async () => {
    const mockQuery = makeMockQuerySetup([]);
    mockFrom.mockReturnValue(mockQuery);

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    await listBoardActivity({
      boardId: BOARD_ID,
      filters: { dateTo: "2024-01-31T23:59:59.999Z" },
    });

    expect(mockQuery.lte).toHaveBeenCalledWith("created_at", "2024-01-31T23:59:59.999Z");
  });

  it("returns nextCursor from last event when exactly 50 results returned", async () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      makeActivity({
        id: `evt-${i}`,
        created_at: `2024-01-01T${String(i).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    mockFrom.mockReturnValue(makeMockQuerySetup(events));

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    const result = await listBoardActivity({ boardId: BOARD_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lastEvent = events[49];
    const expectedCreatedAt = lastEvent?.created_at ?? "";
    const expectedId = lastEvent?.id ?? "";
    expect(result.data.nextCursor).toBe(`${expectedCreatedAt}|${expectedId}`);
  });

  it("returns nextCursor as null when fewer than 50 results", async () => {
    const events = [makeActivity()];
    mockFrom.mockReturnValue(makeMockQuerySetup(events));

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    const result = await listBoardActivity({ boardId: BOARD_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nextCursor).toBeNull();
  });

  it("returns nextCursor as null when result is empty", async () => {
    mockFrom.mockReturnValue(makeMockQuerySetup([]));

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    const result = await listBoardActivity({ boardId: BOARD_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.events).toHaveLength(0);
    expect(result.data.nextCursor).toBeNull();
  });

  it("returns ok:false with DB error when supabase query fails", async () => {
    const mockQuery = makeMockQuerySetup([], { message: "some db error" });
    mockFrom.mockReturnValue(mockQuery);

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    const result = await listBoardActivity({ boardId: BOARD_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DB");
  });

  it("returns ok:false with UNAUTHENTICATED when user is null", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFrom.mockReturnValue(makeMockQuerySetup([]));

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    const result = await listBoardActivity({ boardId: BOARD_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns ok:false with VALIDATION error on invalid boardId", async () => {
    mockFrom.mockReturnValue(makeMockQuerySetup([]));

    const { listBoardActivity } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions"
    );
    const result = await listBoardActivity({ boardId: "not-a-uuid" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
  });
});
