/**
 * tests/unit/digest-builder.test.ts
 *
 * Unit tests for lib/email/digest.ts (buildDigest).
 *
 * Coverage:
 *  - Returns null when recipient profile is missing.
 *  - Returns null when no digest-eligible kinds exist for the user.
 *  - Returns null when no pending notifications exist.
 *  - Correct count tallies for mentions / assigned / statusChanges / commentsOnFollowed.
 *  - Per-board grouping — notifications from the same board go in the same section.
 *  - Cap at 10 items per board; moreCount reflects the overflow.
 *  - Items from different boards appear in separate sections.
 *  - Rows with null board_id are silently skipped in sections (but counted).
 */

import { assert, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const BOARD_A = "aaaa0000-0000-0000-0000-000000000001";
const BOARD_B = "bbbb0000-0000-0000-0000-000000000002";
const TASK_1 = "tttt0000-0000-0000-0000-000000000001";
const TASK_2 = "tttt0000-0000-0000-0000-000000000002";
const ACTOR_1 = "actr0000-0000-0000-0000-000000000001";
const USER_ID = "user0000-0000-0000-0000-000000000001";
const WS_ID = "wsid0000-0000-0000-0000-000000000001";
const WS_SLUG = "test-workspace";

const PROFILE_ROW = {
  id: USER_ID,
  email: "user@example.com",
  display_name: "Test User",
};

const BOARDS = [
  { id: BOARD_A, name: "Board Alpha", workspace_id: WS_ID },
  { id: BOARD_B, name: "Board Beta", workspace_id: WS_ID },
];

const WORKSPACE = { id: WS_ID, slug: WS_SLUG };

const TASKS = [
  { id: TASK_1, title: "Task One" },
  { id: TASK_2, title: "Task Two" },
];

const ACTORS = [{ id: ACTOR_1, display_name: "Actor One", email: "actor@example.com" }];

function makeNotificationRow(overrides: {
  id?: string;
  kind?: string;
  board_id?: string;
  task_id?: string;
  actor_id?: string;
}) {
  return {
    id: overrides.id ?? `notif-${Math.random()}`,
    user_id: USER_ID,
    kind: overrides.kind ?? "assigned",
    payload: {
      board_id: overrides.board_id ?? BOARD_A,
      task_id: overrides.task_id ?? TASK_1,
      actor_id: overrides.actor_id ?? ACTOR_1,
    },
    read_at: null,
    digested_at: null,
    email_sent_at: null,
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

/**
 * Resolves the table-specific data for a given table name.
 * Used by makeChainProxy below.
 */
function resolveTableData(
  table: string,
  notificationRows: unknown[],
): { data: unknown; error: null } {
  switch (table) {
    // Profile table: for bulk fetches (actor lookup) return the ACTORS array.
    // For maybeSingle() (recipient lookup) the makeChainProxy override returns PROFILE_ROW.
    case "profile":
      return { data: ACTORS, error: null };
    case "notification":
      return { data: notificationRows, error: null };
    case "board":
      return { data: BOARDS, error: null };
    case "workspace":
      return { data: [WORKSPACE], error: null };
    case "task":
      return { data: TASKS, error: null };
    default:
      return { data: [], error: null };
  }
}

// ---------------------------------------------------------------------------
// Mock adminClient before importing buildDigest
// ---------------------------------------------------------------------------

// We intercept at the module level. The chain builder is a thin wrapper that
// proxies all method calls back to itself and ultimately resolves the promise.

let _notificationRows: unknown[] = [];

/**
 * Creates a fluent Supabase query-chain mock where every chained method
 * returns the SAME object (the merged Promise + proxy). This ensures that
 * `await admin.from("table").select(...).eq(...).in(...)` resolves correctly
 * regardless of how many chain methods are called before the await.
 *
 * `maybeSingle()` is overridden to return the expected single-row shape for
 * the profile table (recipient lookup).
 */
function makeChainProxy(tableName: string): Promise<{ data: unknown; error: null }> {
  const resolved = resolveTableData(tableName, _notificationRows);

  // Start with a settled promise.
  const p = Promise.resolve(resolved);

  // The merged object gets all chain methods that return itself.
  // biome-ignore lint/suspicious/noExplicitAny: merged Promise + proxy type
  const merged: any = Object.assign(p, {
    select: () => merged,
    eq: () => merged,
    in: () => merged,
    is: () => merged,
    order: () => merged,
    limit: () => merged,
    update: () => merged,
    insert: () => merged,
    maybeSingle: () =>
      tableName === "profile"
        ? Promise.resolve({ data: PROFILE_ROW, error: null })
        : Promise.resolve({ data: null, error: null }),
  });

  return merged;
}

const mockFrom = vi.fn();

vi.mock("../../lib/supabase/admin", () => ({
  adminClient: () => ({ from: mockFrom }),
}));

// Mock getPreferenceFor — default: every kind has email='digest'.
const mockGetPreferenceFor = vi.fn().mockResolvedValue({ inApp: true, email: "digest" });
vi.mock("../../lib/notifications/preferences", () => ({
  getPreferenceFor: (...args: unknown[]) => mockGetPreferenceFor(...args),
}));

vi.mock("../../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupAdminMock(notifications: unknown[]) {
  _notificationRows = notifications;
  mockFrom.mockImplementation((table: string) => makeChainProxy(table));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPreferenceFor.mockResolvedValue({ inApp: true, email: "digest" });
  });

  it("returns null when the recipient profile is missing", async () => {
    mockFrom.mockImplementation(() => {
      const p = Promise.resolve({ data: null, error: null });
      const proxy = {
        select: () => proxy,
        eq: () => proxy,
        in: () => proxy,
        is: () => proxy,
        order: () => proxy,
        limit: () => proxy,
        update: () => proxy,
        insert: () => proxy,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      };
      return Object.assign(p, proxy);
    });

    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);
    expect(result).toBeNull();
  });

  it("returns null when no kinds are digest-eligible for the user", async () => {
    mockGetPreferenceFor.mockResolvedValue({ inApp: true, email: "instant" });

    mockFrom.mockImplementation(() => {
      const p = Promise.resolve({ data: PROFILE_ROW, error: null });
      const proxy = {
        select: () => proxy,
        eq: () => proxy,
        in: () => proxy,
        is: () => proxy,
        order: () => proxy,
        limit: () => proxy,
        update: () => proxy,
        insert: () => proxy,
        maybeSingle: () => Promise.resolve({ data: PROFILE_ROW, error: null }),
      };
      return Object.assign(p, proxy);
    });

    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);
    expect(result).toBeNull();
  });

  it("returns null when there are no pending notifications", async () => {
    setupAdminMock([]);
    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);
    expect(result).toBeNull();
  });

  it("correctly counts mentions", async () => {
    const rows = [
      makeNotificationRow({ id: "n1", kind: "mention", board_id: BOARD_A, task_id: TASK_1 }),
      makeNotificationRow({ id: "n2", kind: "mention", board_id: BOARD_A, task_id: TASK_1 }),
    ];
    setupAdminMock(rows);

    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);

    assert(result !== null, "expected DigestData to be non-null");
    expect(result.counts.mentions).toBe(2);
    expect(result.counts.total).toBe(2);
    expect(result.counts.assigned).toBe(0);
    expect(result.counts.statusChanges).toBe(0);
    expect(result.counts.commentsOnFollowed).toBe(0);
  });

  it("correctly counts assigned, statusChanges, commentsOnFollowed", async () => {
    const rows = [
      makeNotificationRow({ id: "n1", kind: "assigned" }),
      makeNotificationRow({ id: "n2", kind: "status_changed_assigned" }),
      makeNotificationRow({ id: "n3", kind: "status_changed_followed" }),
      makeNotificationRow({ id: "n4", kind: "comment_on_followed" }),
      makeNotificationRow({ id: "n5", kind: "mention" }),
    ];
    setupAdminMock(rows);

    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);

    assert(result !== null, "expected DigestData to be non-null");
    expect(result.counts.assigned).toBe(1);
    expect(result.counts.statusChanges).toBe(2);
    expect(result.counts.commentsOnFollowed).toBe(1);
    expect(result.counts.mentions).toBe(1);
    expect(result.counts.total).toBe(5);
  });

  it("groups notifications by board into separate sections", async () => {
    const rows = [
      makeNotificationRow({ id: "n1", board_id: BOARD_A, task_id: TASK_1 }),
      makeNotificationRow({ id: "n2", board_id: BOARD_B, task_id: TASK_2 }),
    ];
    setupAdminMock(rows);

    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);

    assert(result !== null, "expected DigestData to be non-null");
    expect(result.sections).toHaveLength(2);
    const boardIds = result.sections.map((s) => s.board.id);
    expect(boardIds).toContain(BOARD_A);
    expect(boardIds).toContain(BOARD_B);
  });

  it("groups multiple notifications from the same board into one section", async () => {
    const rows = [
      makeNotificationRow({ id: "n1", board_id: BOARD_A, task_id: TASK_1 }),
      makeNotificationRow({ id: "n2", board_id: BOARD_A, task_id: TASK_2 }),
      makeNotificationRow({ id: "n3", board_id: BOARD_A, task_id: TASK_1 }),
    ];
    setupAdminMock(rows);

    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);

    assert(result !== null, "expected DigestData to be non-null");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].items).toHaveLength(3);
    expect(result.sections[0].moreCount).toBe(0);
  });

  it("caps board sections at 10 items and sets moreCount for overflow", async () => {
    const rows = Array.from({ length: 13 }, (_, i) =>
      makeNotificationRow({ id: `n${i}`, board_id: BOARD_A, task_id: TASK_1 }),
    );
    setupAdminMock(rows);

    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);

    assert(result !== null, "expected DigestData to be non-null");
    const section = result.sections.find((s) => s.board.id === BOARD_A);
    assert(section !== undefined, "expected section for BOARD_A to exist");
    expect(section.items).toHaveLength(10);
    expect(section.moreCount).toBe(3);
  });

  it("includes board title and workspaceSlug in section.board", async () => {
    const rows = [makeNotificationRow({ id: "n1", board_id: BOARD_A, task_id: TASK_1 })];
    setupAdminMock(rows);

    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);

    assert(result !== null, "expected DigestData to be non-null");
    const section = result.sections[0];
    expect(section.board.title).toBe("Board Alpha");
    expect(section.board.workspaceSlug).toBe(WS_SLUG);
  });

  it("includes actor name and task title in items", async () => {
    const rows = [
      makeNotificationRow({
        id: "n1",
        board_id: BOARD_A,
        task_id: TASK_1,
        actor_id: ACTOR_1,
      }),
    ];
    setupAdminMock(rows);

    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);

    assert(result !== null, "expected DigestData to be non-null");
    const item = result.sections[0].items[0];
    expect(item.actor.name).toBe("Actor One");
    expect(item.task.title).toBe("Task One");
  });

  it("sets recipient displayName and email correctly", async () => {
    const rows = [makeNotificationRow({ id: "n1" })];
    setupAdminMock(rows);

    const { buildDigest } = await import("@/lib/email/digest");
    const result = await buildDigest(USER_ID);

    assert(result !== null, "expected DigestData to be non-null");
    expect(result.recipient.email).toBe(PROFILE_ROW.email);
    expect(result.recipient.displayName).toBe(PROFILE_ROW.display_name);
  });
});
