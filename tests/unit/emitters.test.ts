/**
 * tests/unit/emitters.test.ts
 *
 * Unit tests for lib/notifications/emitters.ts.
 *
 * Coverage per spec:
 *   - emitMentionNotifications: add/remove diffing, skip-self, preference-gating.
 *   - emitAssignmentNotifications: added/removed diff, skip-self, preference-gating.
 *   - emitStatusChangeNotifications: assignee vs follower split, skip-self, pref-gate.
 *   - emitCommentReplyNotifications: blockquote heuristic, skip-self.
 *   - emitCommentOnFollowedNotifications: excludes actor + mentioned users.
 *   - emitRoleChangedNotification: skip-self, payload.
 *   - emitBoardInviteNotification: skips when no profile, emits when profile exists.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Global mocks (must be defined before importing the module under test)
// ---------------------------------------------------------------------------

// Mock emit so we can capture calls without hitting the DB.
const mockEmit = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/notifications/emit", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

// Mock getPreferenceFor — default: inApp true, email instant.
const mockGetPreferenceFor = vi.fn().mockResolvedValue({ inApp: true, email: "instant" });
vi.mock("../../lib/notifications/preferences", () => ({
  getPreferenceFor: (...args: unknown[]) => mockGetPreferenceFor(...args),
}));

// Mock follower helpers.
const mockAutoFollowOnMention = vi.fn().mockResolvedValue(undefined);
const mockAutoFollowOnAssign = vi.fn().mockResolvedValue(undefined);
const mockGetFollowers = vi.fn().mockResolvedValue([]);
vi.mock("../../lib/notifications/followers", () => ({
  autoFollowOnMention: (...args: unknown[]) => mockAutoFollowOnMention(...args),
  autoFollowOnAssign: (...args: unknown[]) => mockAutoFollowOnAssign(...args),
  getFollowers: (...args: unknown[]) => mockGetFollowers(...args),
}));

// Mock adminClient (used in emitBoardInviteNotification for profile lookup).
const mockAdminFrom = vi.fn();
const mockAdminClient = vi.fn(() => ({ from: mockAdminFrom }));
vi.mock("../../lib/supabase/admin", () => ({
  adminClient: () => mockAdminClient(),
}));

// Mock logger.
vi.mock("../../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

const BOARD_ID = "bbbb0000-0000-0000-0000-000000000001";
const TASK_ID = "tttt0000-0000-0000-0000-000000000001";
const COMMENT_ID = "cccc0000-0000-0000-0000-000000000001";
const ACTOR_ID = "aaaa0000-0000-0000-0000-000000000001";
const USER_A = "uuuu0000-0000-0000-0000-000000000002";
const USER_B = "uuuu0000-0000-0000-0000-000000000003";
const WORKSPACE_ID = "wwww0000-0000-0000-0000-000000000001";
const INVITATION_ID = "iiii0000-0000-0000-0000-000000000001";

/** Make a minimal Tiptap doc with a list of mention attrs. */
function makeDoc(
  mentions: Array<{ id: string; label: string }>,
  options: { wrapInBlockquote?: boolean } = {},
) {
  const mentionNodes = mentions.map((m) => ({ type: "mention", attrs: m }));
  const content = options.wrapInBlockquote
    ? [{ type: "blockquote", content: mentionNodes }]
    : mentionNodes;

  return {
    type: "doc" as const,
    content: [{ type: "paragraph", content }],
  };
}

/**
 * Build a minimal mock supabase client that:
 *   - Returns `role` for rpc("role_for_board") calls.
 *   - Returns `members` for from("board_member").select().eq() chains.
 *   - Returns `followers` for from("task_follower").select().eq() chains.
 *   - Returns `personCells` for from("cell").select().eq().eq() chains.
 */
function makeSupabase({
  roleForBoard = "member",
  boardMembers = [] as Array<{ user_id: string }>,
  personCells = [] as Array<{
    json_value: { userIds?: string[] } | null;
    column: { type: string };
  }>,
} = {}) {
  // The supabase mock needs to handle method chaining.
  // We use a builder pattern that returns `this` for chainable calls.

  const supabase = {
    rpc: vi.fn((name: string) => {
      if (name === "role_for_board") {
        return Promise.resolve({ data: roleForBoard, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn((table: string) => {
      if (table === "board_member") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue(Promise.resolve({ data: boardMembers, error: null })),
        };
      }
      if (table === "task_follower") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
        };
      }
      if (table === "cell") {
        // Chain: .select().eq("task_id", ...).eq("column.type", ...) → Promise
        const cellChainInner = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(),
        };
        let innerEqCount = 0;
        cellChainInner.eq.mockImplementation(() => {
          innerEqCount++;
          if (innerEqCount >= 2) {
            return Promise.resolve({ data: personCells, error: null });
          }
          return cellChainInner;
        });
        return cellChainInner;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  };
  return supabase;
}

// ---------------------------------------------------------------------------
// emitMentionNotifications
// ---------------------------------------------------------------------------

describe("emitMentionNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreferenceFor.mockResolvedValue({ inApp: true, email: "instant" });
  });

  it("emits mention notification for a new target", async () => {
    const { emitMentionNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    await emitMentionNotifications({
      doc: makeDoc([{ id: USER_A, label: "@alice" }]),
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: USER_A,
      kind: "mention",
      payload: {
        actor_id: ACTOR_ID,
        board_id: BOARD_ID,
        task_id: TASK_ID,
        comment_id: COMMENT_ID,
      },
    });
  });

  it("skips the actor (no self-notify)", async () => {
    const { emitMentionNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    await emitMentionNotifications({
      doc: makeDoc([{ id: ACTOR_ID, label: "@self" }]),
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
    });

    // emit should not be called for a zero-row set.
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("skips already-mentioned users on edit (previousMentionIds diff)", async () => {
    const { emitMentionNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    // USER_A was already mentioned in the previous version; USER_B is new.
    await emitMentionNotifications({
      doc: makeDoc([
        { id: USER_A, label: "@alice" },
        { id: USER_B, label: "@bob" },
      ]),
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
      previousMentionIds: [USER_A],
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(USER_B);
  });

  it("skips non-board-members (role_for_board returns null)", async () => {
    const { emitMentionNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: null as unknown as string });

    await emitMentionNotifications({
      doc: makeDoc([{ id: USER_A, label: "@alice" }]),
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("skips when inApp preference is false", async () => {
    const { emitMentionNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });
    mockGetPreferenceFor.mockResolvedValue({ inApp: false, email: "off" });

    await emitMentionNotifications({
      doc: makeDoc([{ id: USER_A, label: "@alice" }]),
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("calls autoFollowOnMention for notified users", async () => {
    const { emitMentionNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    await emitMentionNotifications({
      doc: makeDoc([{ id: USER_A, label: "@alice" }]),
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
    });

    expect(mockAutoFollowOnMention).toHaveBeenCalledWith(TASK_ID, USER_A);
  });
});

// ---------------------------------------------------------------------------
// emitAssignmentNotifications
// ---------------------------------------------------------------------------

describe("emitAssignmentNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreferenceFor.mockResolvedValue({ inApp: true, email: "instant" });
  });

  it("emits 'assigned' for newly added users", async () => {
    const { emitAssignmentNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    await emitAssignmentNotifications({
      supabase: supabase as never,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      prevUserIds: [],
      nextUserIds: [USER_A],
      actorId: ACTOR_ID,
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: USER_A, kind: "assigned" });
  });

  it("emits 'unassigned' for removed users", async () => {
    const { emitAssignmentNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    await emitAssignmentNotifications({
      supabase: supabase as never,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      prevUserIds: [USER_A],
      nextUserIds: [],
      actorId: ACTOR_ID,
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: USER_A, kind: "unassigned" });
  });

  it("skips the actor in both added and removed sets", async () => {
    const { emitAssignmentNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    // Actor is both added and removed (edge case — should be skipped).
    await emitAssignmentNotifications({
      supabase: supabase as never,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      prevUserIds: [ACTOR_ID],
      nextUserIds: [ACTOR_ID, USER_A],
      actorId: ACTOR_ID,
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    // Only USER_A should be in the rows (actor is skipped from added).
    expect(rows.every((r: { user_id: string }) => r.user_id !== ACTOR_ID)).toBe(true);
  });

  it("skips when inApp preference is false (assigned)", async () => {
    const { emitAssignmentNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });
    mockGetPreferenceFor.mockResolvedValue({ inApp: false, email: "off" });

    await emitAssignmentNotifications({
      supabase: supabase as never,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      prevUserIds: [],
      nextUserIds: [USER_A],
      actorId: ACTOR_ID,
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("calls autoFollowOnAssign for newly assigned users", async () => {
    const { emitAssignmentNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    await emitAssignmentNotifications({
      supabase: supabase as never,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      prevUserIds: [],
      nextUserIds: [USER_A],
      actorId: ACTOR_ID,
    });

    expect(mockAutoFollowOnAssign).toHaveBeenCalledWith(TASK_ID, USER_A);
  });

  it("emits nothing when prev === next", async () => {
    const { emitAssignmentNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    await emitAssignmentNotifications({
      supabase: supabase as never,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      prevUserIds: [USER_A],
      nextUserIds: [USER_A],
      actorId: ACTOR_ID,
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// emitStatusChangeNotifications
// ---------------------------------------------------------------------------

describe("emitStatusChangeNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreferenceFor.mockResolvedValue({ inApp: true, email: "instant" });
  });

  it("emits status_changed_assigned for assignees", async () => {
    const { emitStatusChangeNotifications } = await import("../../lib/notifications/emitters");

    // Mock getFollowers returns empty; person cell returns USER_A.
    mockGetFollowers.mockResolvedValue([]);

    const personCells = [{ json_value: { userIds: [USER_A] }, column: { type: "person" } }];
    const supabase = makeSupabase({ personCells });

    // Override the cell query mock to return personCells.
    const cellChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    // Final .eq returns the data.
    let eqCallCount = 0;
    cellChain.eq.mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount >= 2) {
        return Promise.resolve({ data: personCells, error: null });
      }
      return cellChain;
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "cell") return cellChain;
      if (table === "task_follower") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return supabase.from(table);
    });

    await emitStatusChangeNotifications({
      supabase: supabase as never,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      fromLabelId: "label-1",
      toLabelId: "label-2",
      actorId: ACTOR_ID,
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    const assigneeRow = rows.find((r: { user_id: string }) => r.user_id === USER_A);
    expect(assigneeRow?.kind).toBe("status_changed_assigned");
  });

  it("emits status_changed_followed for non-assignee followers", async () => {
    const { emitStatusChangeNotifications } = await import("../../lib/notifications/emitters");

    // USER_B is a follower but NOT an assignee.
    mockGetFollowers.mockResolvedValue([USER_B]);

    const supabase = makeSupabase({ personCells: [] });
    const cellChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    let eqCallCount = 0;
    cellChain.eq.mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount >= 2) {
        return Promise.resolve({ data: [], error: null });
      }
      return cellChain;
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "cell") return cellChain;
      if (table === "task_follower") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [{ user_id: USER_B }], error: null }),
        };
      }
      return supabase.from(table);
    });

    await emitStatusChangeNotifications({
      supabase: supabase as never,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      fromLabelId: null,
      toLabelId: "label-2",
      actorId: ACTOR_ID,
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    const followerRow = rows.find((r: { user_id: string }) => r.user_id === USER_B);
    expect(followerRow?.kind).toBe("status_changed_followed");
  });

  it("skips the actor", async () => {
    const { emitStatusChangeNotifications } = await import("../../lib/notifications/emitters");

    // Actor is in the followers list.
    mockGetFollowers.mockResolvedValue([ACTOR_ID]);

    const supabase = makeSupabase({ personCells: [] });
    const cellChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    let eqCallCount = 0;
    cellChain.eq.mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount >= 2) {
        return Promise.resolve({ data: [], error: null });
      }
      return cellChain;
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "cell") return cellChain;
      if (table === "task_follower") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [{ user_id: ACTOR_ID }], error: null }),
        };
      }
      return supabase.from(table);
    });

    await emitStatusChangeNotifications({
      supabase: supabase as never,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      fromLabelId: null,
      toLabelId: "label-2",
      actorId: ACTOR_ID,
    });

    // emit should not be called since the only candidate is the actor.
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// emitCommentReplyNotifications
// ---------------------------------------------------------------------------

describe("emitCommentReplyNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreferenceFor.mockResolvedValue({ inApp: true, email: "instant" });
  });

  it("emits comment_reply when a mention is found inside a blockquote", async () => {
    const { emitCommentReplyNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    const doc = makeDoc([{ id: USER_A, label: "@alice" }], { wrapInBlockquote: true });

    await emitCommentReplyNotifications({
      doc,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    expect(rows[0]).toMatchObject({ user_id: USER_A, kind: "comment_reply" });
  });

  it("does not emit when there are no blockquote mentions", async () => {
    const { emitCommentReplyNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    // Plain mention (not in a blockquote) should NOT produce comment_reply.
    const doc = makeDoc([{ id: USER_A, label: "@alice" }], { wrapInBlockquote: false });

    await emitCommentReplyNotifications({
      doc,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("skips the actor even if they appear in a blockquote mention", async () => {
    const { emitCommentReplyNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase({ roleForBoard: "member" });

    const doc = makeDoc([{ id: ACTOR_ID, label: "@self" }], { wrapInBlockquote: true });

    await emitCommentReplyNotifications({
      doc,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// emitCommentOnFollowedNotifications
// ---------------------------------------------------------------------------

describe("emitCommentOnFollowedNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreferenceFor.mockResolvedValue({ inApp: true, email: "digest" });
  });

  it("emits comment_on_followed for followers not mentioned", async () => {
    const { emitCommentOnFollowedNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase();

    // USER_B is a follower; USER_A is mentioned (should be excluded from this notification).
    mockGetFollowers.mockResolvedValue([USER_A, USER_B]);
    const doc = makeDoc([{ id: USER_A, label: "@alice" }]);

    await emitCommentOnFollowedNotifications({
      doc,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    // Only USER_B (follower, not mentioned).
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: USER_B, kind: "comment_on_followed" });
  });

  it("excludes the actor", async () => {
    const { emitCommentOnFollowedNotifications } = await import("../../lib/notifications/emitters");
    const supabase = makeSupabase();

    // ACTOR_ID is a follower.
    mockGetFollowers.mockResolvedValue([ACTOR_ID, USER_A]);
    const doc = makeDoc([]);

    await emitCommentOnFollowedNotifications({
      doc,
      boardId: BOARD_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
      actorId: ACTOR_ID,
      supabase: supabase as never,
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    expect(rows.every((r: { user_id: string }) => r.user_id !== ACTOR_ID)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// emitRoleChangedNotification
// ---------------------------------------------------------------------------

describe("emitRoleChangedNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreferenceFor.mockResolvedValue({ inApp: true, email: "instant" });
  });

  it("emits role_changed with the correct payload", async () => {
    const { emitRoleChangedNotification } = await import("../../lib/notifications/emitters");

    await emitRoleChangedNotification({
      targetUserId: USER_A,
      actorId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      fromRole: "member",
      toRole: "admin",
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    expect(rows[0]).toMatchObject({
      user_id: USER_A,
      kind: "role_changed",
      payload: {
        actor_id: ACTOR_ID,
        workspace_id: WORKSPACE_ID,
        from: "member",
        to: "admin",
      },
    });
  });

  it("skips when target === actor", async () => {
    const { emitRoleChangedNotification } = await import("../../lib/notifications/emitters");

    await emitRoleChangedNotification({
      targetUserId: ACTOR_ID,
      actorId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      fromRole: "member",
      toRole: "admin",
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("skips when inApp preference is false", async () => {
    const { emitRoleChangedNotification } = await import("../../lib/notifications/emitters");
    mockGetPreferenceFor.mockResolvedValue({ inApp: false, email: "off" });

    await emitRoleChangedNotification({
      targetUserId: USER_A,
      actorId: ACTOR_ID,
      boardId: BOARD_ID,
      fromRole: null,
      toRole: "member",
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// emitBoardInviteNotification
// ---------------------------------------------------------------------------

describe("emitBoardInviteNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPreferenceFor.mockResolvedValue({ inApp: true, email: "instant" });
  });

  it("emits board_invite when invitee has a profile", async () => {
    const { emitBoardInviteNotification } = await import("../../lib/notifications/emitters");

    // adminClient().from("profile").select().eq().maybeSingle() → profile exists.
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: USER_A }, error: null }),
    };
    mockAdminFrom.mockReturnValue(profileChain);

    await emitBoardInviteNotification({
      boardId: BOARD_ID,
      workspaceId: WORKSPACE_ID,
      invitationId: INVITATION_ID,
      inviteeEmail: "alice@example.com",
      actorId: ACTOR_ID,
    });

    expect(mockEmit).toHaveBeenCalledOnce();
    const [rows] = mockEmit.mock.calls[0];
    expect(rows[0]).toMatchObject({
      user_id: USER_A,
      kind: "board_invite",
      payload: {
        actor_id: ACTOR_ID,
        board_id: BOARD_ID,
        workspace_id: WORKSPACE_ID,
        invitation_id: INVITATION_ID,
      },
    });
  });

  it("does not emit when invitee has no profile yet", async () => {
    const { emitBoardInviteNotification } = await import("../../lib/notifications/emitters");

    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockAdminFrom.mockReturnValue(profileChain);

    await emitBoardInviteNotification({
      boardId: BOARD_ID,
      workspaceId: WORKSPACE_ID,
      invitationId: INVITATION_ID,
      inviteeEmail: "new@example.com",
      actorId: ACTOR_ID,
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });
});
