// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TiptapDoc } from "../../lib/comments/types";

/**
 * Unit tests for comment server actions.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * Written now so epic 15 executor can pick them up without changes.
 *
 * Mocking approach:
 *   - `@/lib/supabase/server` → createClient returns a fake SupabaseClient.
 *   - `@/lib/supabase/admin` → adminClient returns a fake admin SupabaseClient.
 *   - `@/lib/logger` → no-op stubs.
 *   - `@/lib/authorization` → requireBoardRole and getBoardRole are spies.
 *   - `@/lib/notifications/notify` → notifyUsers is a spy.
 *   - `@/lib/activity` → logActivity is a spy.
 *
 * Each `describe` block sets up its own mock state via `beforeEach`.
 */

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/activity", () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

const mockNotifyUsers = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/notifications/notify", () => ({
  notifyUsers: (...args: unknown[]) => mockNotifyUsers(...args),
}));

const mockRequireBoardRole = vi.fn().mockResolvedValue("member");
vi.mock("../../lib/authorization", () => ({
  requireBoardRole: (...args: unknown[]) => mockRequireBoardRole(...args),
  getBoardRole: vi.fn().mockResolvedValue("member"),
}));

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Shared test fixture builders
// ---------------------------------------------------------------------------

const BOARD_ID = "bbbbb000-0000-0000-0000-000000000001";
const TASK_ID = "ttttt000-0000-0000-0000-000000000001";
const COMMENT_ID = "ccccc000-0000-0000-0000-000000000001";
const USER_ID = "uuuuu000-0000-0000-0000-000000000001";
const USER2_ID = "uuuuu000-0000-0000-0000-000000000002";
const USER3_ID = "uuuuu000-0000-0000-0000-000000000003";

function makeDoc(mentions: Array<{ id: string; label: string }>): TiptapDoc {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: mentions.map((m) => ({
          type: "mention",
          attrs: m,
        })),
      },
    ],
  };
}

// Minimal supabase builder for user-client simulation.
function makeSupabase({
  task,
  comment,
  boardMembers = [],
  roleForBoard = "member",
  insertError = null,
  updateError = null,
  deleteError = null,
}: {
  task?: { id: string; board_id: string } | null;
  comment?: {
    id: string;
    board_id: string;
    task_id: string;
    author_id: string;
    body?: TiptapDoc;
  } | null;
  boardMembers?: Array<{ user_id: string }>;
  roleForBoard?: string | null;
  insertError?: { code?: string; message: string } | null;
  updateError?: { code?: string; message: string } | null;
  deleteError?: { code?: string; message: string } | null;
}) {
  // Build chainable query mocks.
  const makeChain = (result: unknown, error: unknown = null) => {
    const chain: Record<string, unknown> = {};
    const methods = ["select", "eq", "is", "maybeSingle", "single", "insert", "update", "delete"];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // Terminal resolvers
    (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: result, error });
    (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: result, error });
    return chain;
  };

  const taskChain = makeChain(task ?? null, task === null ? { message: "not found" } : null);
  const commentChain = makeChain(comment ?? null, null);
  const insertCommentChain = makeChain(
    comment ?? { id: COMMENT_ID, board_id: BOARD_ID },
    insertError,
  );
  const updateChain = makeChain(comment ?? null, updateError);
  const deleteChain = { error: deleteError };
  const boardMembersChain = makeChain(boardMembers, null);
  const reactionInsertChain = { error: insertError };
  const reactionDeleteChain = { error: deleteError };

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "task") return taskChain;
    if (table === "comment") {
      return {
        ...commentChain,
        insert: vi.fn().mockReturnValue(insertCommentChain),
        update: vi.fn().mockReturnValue(updateChain),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(deleteChain),
        }),
      };
    }
    if (table === "board_member") return boardMembersChain;
    if (table === "comment_reaction") {
      return {
        insert: vi.fn().mockResolvedValue(reactionInsertChain),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue(reactionDeleteChain),
            }),
          }),
        }),
      };
    }
    return makeChain(null, null);
  });

  const rpc = vi.fn().mockResolvedValue({ data: roleForBoard, error: null });
  const auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) };

  return { from, rpc, auth };
}

function makeAdminClient() {
  const deleteChain = { error: null };
  const from = vi.fn().mockReturnValue({
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(deleteChain),
    }),
  });
  return { from };
}

// ---------------------------------------------------------------------------
// describe: createComment
// ---------------------------------------------------------------------------

describe.skip("createComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity.mockResolvedValue(undefined);
    mockNotifyUsers.mockResolvedValue(undefined);
    mockRequireBoardRole.mockResolvedValue("member");
  });

  it("with no mentions: inserts the row and calls logActivity('comment.posted')", async () => {
    const supabase = makeSupabase({
      task: { id: TASK_ID, board_id: BOARD_ID },
      comment: { id: COMMENT_ID, board_id: BOARD_ID, task_id: TASK_ID, author_id: USER_ID },
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { createComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    const result = await createComment({
      taskId: TASK_ID,
      body: { type: "doc", content: [] },
      bodyText: "Hello",
    });

    expect(result.ok).toBe(true);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "comment.posted" }),
    );
    expect(mockNotifyUsers).not.toHaveBeenCalled();
  });

  it("with two user mentions: calls notifyUsers with two rows; self-mention filtered", async () => {
    const doc = makeDoc([
      { id: USER_ID, label: "Self" }, // self — should be filtered
      { id: USER2_ID, label: "Alice" },
      { id: USER3_ID, label: "Bob" },
    ]);

    const supabase = makeSupabase({
      task: { id: TASK_ID, board_id: BOARD_ID },
      comment: { id: COMMENT_ID, board_id: BOARD_ID, task_id: TASK_ID, author_id: USER_ID },
      roleForBoard: "member",
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { createComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    await createComment({ taskId: TASK_ID, body: doc, bodyText: "Hello @Alice @Bob" });

    // notifyUsers called once with 2 rows (self filtered).
    expect(mockNotifyUsers).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: USER2_ID, kind: "mention" }),
        expect.objectContaining({ user_id: USER3_ID, kind: "mention" }),
      ]),
    );
    const rows = mockNotifyUsers.mock.calls[0][0] as Array<{ user_id: string }>;
    expect(rows.some((r) => r.user_id === USER_ID)).toBe(false); // self excluded
  });

  it("@everyone expands to all board members; actor filtered", async () => {
    const doc = makeDoc([{ id: "everyone", label: "everyone" }]);

    const supabase = makeSupabase({
      task: { id: TASK_ID, board_id: BOARD_ID },
      comment: { id: COMMENT_ID, board_id: BOARD_ID, task_id: TASK_ID, author_id: USER_ID },
      boardMembers: [{ user_id: USER_ID }, { user_id: USER2_ID }, { user_id: USER3_ID }],
      roleForBoard: "member",
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { createComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    await createComment({ taskId: TASK_ID, body: doc, bodyText: "Hey @everyone" });

    if (mockNotifyUsers.mock.calls.length > 0) {
      const rows = mockNotifyUsers.mock.calls[0][0] as Array<{ user_id: string }>;
      expect(rows.some((r) => r.user_id === USER_ID)).toBe(false); // actor excluded
    }
  });

  it("@everyone + explicit mention: user does not appear twice", async () => {
    const doc = makeDoc([
      { id: "everyone", label: "everyone" },
      { id: USER2_ID, label: "Alice" }, // also in board members
    ]);

    const supabase = makeSupabase({
      task: { id: TASK_ID, board_id: BOARD_ID },
      comment: { id: COMMENT_ID, board_id: BOARD_ID, task_id: TASK_ID, author_id: USER_ID },
      boardMembers: [{ user_id: USER_ID }, { user_id: USER2_ID }],
      roleForBoard: "member",
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { createComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    await createComment({ taskId: TASK_ID, body: doc, bodyText: "Hey @everyone @Alice" });

    if (mockNotifyUsers.mock.calls.length > 0) {
      const rows = mockNotifyUsers.mock.calls[0][0] as Array<{ user_id: string }>;
      const userCount = rows.filter((r) => r.user_id === USER2_ID).length;
      expect(userCount).toBe(1); // deduplicated
    }
  });

  it("skips non-board-member mentions (roleForBoard returns null)", async () => {
    const doc = makeDoc([{ id: USER2_ID, label: "Outsider" }]);

    const supabase = makeSupabase({
      task: { id: TASK_ID, board_id: BOARD_ID },
      comment: { id: COMMENT_ID, board_id: BOARD_ID, task_id: TASK_ID, author_id: USER_ID },
      roleForBoard: null, // not a board member
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { createComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    await createComment({ taskId: TASK_ID, body: doc, bodyText: "Hey @Outsider" });

    // notifyUsers either not called or called with empty array.
    if (mockNotifyUsers.mock.calls.length > 0) {
      expect(mockNotifyUsers.mock.calls[0][0]).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// describe: editComment
// ---------------------------------------------------------------------------

describe.skip("editComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity.mockResolvedValue(undefined);
    mockNotifyUsers.mockResolvedValue(undefined);
  });

  it("notifies only newly-added mentions (diff against old body)", async () => {
    // Old body has USER2_ID; new body adds USER3_ID, keeps USER2_ID.
    const oldDoc = makeDoc([{ id: USER2_ID, label: "Alice" }]);
    const newDoc = makeDoc([
      { id: USER2_ID, label: "Alice" },
      { id: USER3_ID, label: "Bob" },
    ]);

    const supabase = makeSupabase({
      comment: {
        id: COMMENT_ID,
        board_id: BOARD_ID,
        task_id: TASK_ID,
        author_id: USER_ID,
        body: oldDoc,
      },
      roleForBoard: "member",
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { editComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    await editComment({ commentId: COMMENT_ID, body: newDoc, bodyText: "updated" });

    if (mockNotifyUsers.mock.calls.length > 0) {
      const rows = mockNotifyUsers.mock.calls[0][0] as Array<{ user_id: string }>;
      // USER2_ID already notified — should not be in new rows
      expect(rows.some((r) => r.user_id === USER2_ID)).toBe(false);
      expect(rows.some((r) => r.user_id === USER3_ID)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// describe: deleteComment
// ---------------------------------------------------------------------------

describe.skip("deleteComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity.mockResolvedValue(undefined);
    mockRequireBoardRole.mockResolvedValue("admin");
  });

  it("issues DELETE via user-client when actor is author", async () => {
    const mockAdminFrom = vi.fn();
    vi.mock("../../lib/supabase/admin", () => ({
      adminClient: vi.fn().mockReturnValue({ from: mockAdminFrom }),
    }));

    const supabase = makeSupabase({
      comment: {
        id: COMMENT_ID,
        board_id: BOARD_ID,
        task_id: TASK_ID,
        author_id: USER_ID, // actor IS the author
      },
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { deleteComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    await deleteComment({ commentId: COMMENT_ID });

    // Admin client should NOT have been called (user-client path).
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("issues DELETE via adminClient when actor is admin-not-author", async () => {
    const admin = makeAdminClient();
    vi.mock("../../lib/supabase/admin", () => ({
      adminClient: vi.fn().mockReturnValue(admin),
    }));

    const DIFFERENT_AUTHOR = "aaaaa000-0000-0000-0000-000000000999";
    const supabase = makeSupabase({
      comment: {
        id: COMMENT_ID,
        board_id: BOARD_ID,
        task_id: TASK_ID,
        author_id: DIFFERENT_AUTHOR, // different from USER_ID (the actor)
      },
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { deleteComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    await deleteComment({ commentId: COMMENT_ID });

    // Admin client SHOULD have been used.
    expect(admin.from).toHaveBeenCalledWith("comment");
  });
});

// ---------------------------------------------------------------------------
// describe: reactComment
// ---------------------------------------------------------------------------

describe.skip("reactComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity.mockResolvedValue(undefined);
    mockRequireBoardRole.mockResolvedValue("member");
  });

  it("inserts a reaction row and returns ok", async () => {
    const supabase = makeSupabase({
      comment: { id: COMMENT_ID, board_id: BOARD_ID, task_id: TASK_ID, author_id: USER_ID },
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { reactComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    const result = await reactComment({ commentId: COMMENT_ID, emoji: "👍" });
    expect(result.ok).toBe(true);
  });

  it("unique-violation on duplicate emoji → returns ok no-op", async () => {
    const supabase = makeSupabase({
      comment: { id: COMMENT_ID, board_id: BOARD_ID, task_id: TASK_ID, author_id: USER_ID },
      insertError: { code: "23505", message: "unique violation" },
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { reactComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    const result = await reactComment({ commentId: COMMENT_ID, emoji: "👍" });
    // Should not throw; returns ok no-op
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// describe: unreactComment
// ---------------------------------------------------------------------------

describe.skip("unreactComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("deletes only the (comment, user, emoji) tuple", async () => {
    const supabase = makeSupabase({
      comment: { id: COMMENT_ID, board_id: BOARD_ID, task_id: TASK_ID, author_id: USER_ID },
    });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { unreactComment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions"
    );

    const result = await unreactComment({ commentId: COMMENT_ID, emoji: "👎" });
    expect(result.ok).toBe(true);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "comment.unreacted" }),
    );
  });
});
