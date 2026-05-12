// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "../../lib/supabase/types";
import {
  selectCommentsForTask,
  selectGroupedReactions,
  selectTaskActivity,
  useBoardStore,
} from "../../stores/board-store";

type CommentRow = Database["public"]["Tables"]["comment"]["Row"];
type CommentReactionRow = Database["public"]["Tables"]["comment_reaction"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activity"]["Row"];

// ---------------------------------------------------------------------------
// Helpers — minimal fixture factories
// ---------------------------------------------------------------------------

function makeComment(overrides: Partial<CommentRow> = {}): CommentRow {
  return {
    id: "comment-1",
    board_id: "board-1",
    task_id: "task-1",
    author_id: "user-1",
    body: { type: "doc", content: [] },
    body_text: "Hello world",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-01T10:00:00Z",
    ...overrides,
  };
}

function makeReaction(overrides: Partial<CommentReactionRow> = {}): CommentReactionRow {
  return {
    comment_id: "comment-1",
    user_id: "user-1",
    emoji: "👍",
    board_id: "board-1",
    created_at: "2024-01-01T10:00:00Z",
    ...overrides,
  };
}

function makeActivity(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: "activity-1",
    board_id: "board-1",
    task_id: "task-1",
    actor_id: "user-1",
    type: "task.created",
    payload: {},
    created_at: "2024-01-01T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skip("useBoardStore — Epic 09 comments/reactions/activity", () => {
  beforeEach(() => {
    useBoardStore.getState().reset();
    useBoardStore.setState({
      collapsedByBoard: {},
      commentsByTask: new Map(),
      reactionsByComment: new Map(),
      activityByTask: new Map(),
    });
  });

  // -------------------------------------------------------------------------
  // applyCommentUpsert — idempotency
  // -------------------------------------------------------------------------

  it("applyCommentUpsert inserts a new comment into commentsByTask", () => {
    const comment = makeComment();
    useBoardStore.getState().applyCommentUpsert(comment);

    const state = useBoardStore.getState();
    const comments = state.commentsByTask.get("task-1") ?? [];
    expect(comments).toHaveLength(1);
    expect(comments[0]?.id).toBe("comment-1");
  });

  it("applyCommentUpsert: same id + same updated_at is a no-op", () => {
    const comment = makeComment({ updated_at: "2024-01-01T10:00:00Z" });
    useBoardStore.getState().applyCommentUpsert(comment);
    useBoardStore.getState().applyCommentUpsert(comment); // duplicate

    const state = useBoardStore.getState();
    const comments = state.commentsByTask.get("task-1") ?? [];
    expect(comments).toHaveLength(1);
  });

  it("applyCommentUpsert: older updated_at is ignored (stale echo)", () => {
    const newer = makeComment({ updated_at: "2024-01-02T10:00:00Z", body_text: "new" });
    const older = makeComment({ updated_at: "2024-01-01T10:00:00Z", body_text: "old" });

    useBoardStore.getState().applyCommentUpsert(newer);
    useBoardStore.getState().applyCommentUpsert(older);

    const state = useBoardStore.getState();
    const comments = state.commentsByTask.get("task-1") ?? [];
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body_text).toBe("new");
  });

  it("applyCommentUpsert: newer updated_at replaces existing", () => {
    const v1 = makeComment({ updated_at: "2024-01-01T10:00:00Z", body_text: "v1" });
    const v2 = makeComment({ updated_at: "2024-01-02T10:00:00Z", body_text: "v2" });

    useBoardStore.getState().applyCommentUpsert(v1);
    useBoardStore.getState().applyCommentUpsert(v2);

    const state = useBoardStore.getState();
    const comments = state.commentsByTask.get("task-1") ?? [];
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body_text).toBe("v2");
  });

  it("applyCommentUpsert sorts comments oldest-first by created_at", () => {
    const c1 = makeComment({ id: "c1", created_at: "2024-01-01T10:00:00Z" });
    const c3 = makeComment({ id: "c3", created_at: "2024-01-03T10:00:00Z" });
    const c2 = makeComment({ id: "c2", created_at: "2024-01-02T10:00:00Z" });

    useBoardStore.getState().applyCommentUpsert(c3);
    useBoardStore.getState().applyCommentUpsert(c1);
    useBoardStore.getState().applyCommentUpsert(c2);

    const state = useBoardStore.getState();
    const comments = state.commentsByTask.get("task-1") ?? [];
    expect(comments.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });

  // -------------------------------------------------------------------------
  // applyCommentUpsertReplaceTemp
  // -------------------------------------------------------------------------

  it("applyCommentUpsertReplaceTemp swaps temp id with real row in-place", () => {
    const temp = makeComment({ id: "temp:abc", created_at: "2024-01-01T10:00:00Z" });
    useBoardStore.getState().applyCommentUpsert(temp);

    const real = makeComment({ id: "real-id-uuid", created_at: "2024-01-01T10:00:00Z" });
    useBoardStore.getState().applyCommentUpsertReplaceTemp("temp:abc", real);

    const state = useBoardStore.getState();
    const comments = state.commentsByTask.get("task-1") ?? [];
    expect(comments).toHaveLength(1);
    expect(comments[0]?.id).toBe("real-id-uuid");
  });

  it("applyCommentUpsertReplaceTemp falls back to upsert if temp not found", () => {
    const real = makeComment({ id: "real-id-uuid" });
    useBoardStore.getState().applyCommentUpsertReplaceTemp("temp:notfound", real);

    const state = useBoardStore.getState();
    const comments = state.commentsByTask.get("task-1") ?? [];
    expect(comments).toHaveLength(1);
    expect(comments[0]?.id).toBe("real-id-uuid");
  });

  // -------------------------------------------------------------------------
  // applyCommentDelete
  // -------------------------------------------------------------------------

  it("applyCommentDelete removes the comment from commentsByTask", () => {
    const c1 = makeComment({ id: "c1" });
    const c2 = makeComment({ id: "c2" });
    useBoardStore.getState().applyCommentUpsert(c1);
    useBoardStore.getState().applyCommentUpsert(c2);

    useBoardStore.getState().applyCommentDelete("c1");

    const state = useBoardStore.getState();
    const comments = state.commentsByTask.get("task-1") ?? [];
    expect(comments.map((c) => c.id)).toEqual(["c2"]);
  });

  it("applyCommentDelete also clears reactions for the deleted comment", () => {
    const comment = makeComment({ id: "c1" });
    const reaction = makeReaction({ comment_id: "c1" });
    useBoardStore.getState().applyCommentUpsert(comment);
    useBoardStore.getState().applyReactionInsert(reaction);

    useBoardStore.getState().applyCommentDelete("c1");

    const state = useBoardStore.getState();
    const reactions = state.reactionsByComment.get("c1");
    expect(reactions).toBeUndefined();
  });

  it("applyCommentDelete is a no-op if comment not found", () => {
    const comment = makeComment({ id: "c1" });
    useBoardStore.getState().applyCommentUpsert(comment);
    useBoardStore.getState().applyCommentDelete("nonexistent");

    const state = useBoardStore.getState();
    const comments = state.commentsByTask.get("task-1") ?? [];
    expect(comments).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // hydrateCommentsForTask
  // -------------------------------------------------------------------------

  it("hydrateCommentsForTask replaces the entire list for a task and sorts oldest-first", () => {
    // Pre-populate with a stale comment
    useBoardStore.getState().applyCommentUpsert(makeComment({ id: "stale", body_text: "old" }));

    const fresh = [
      makeComment({ id: "c2", created_at: "2024-01-02T00:00:00Z" }),
      makeComment({ id: "c1", created_at: "2024-01-01T00:00:00Z" }),
    ];
    useBoardStore.getState().hydrateCommentsForTask("task-1", fresh);

    const state = useBoardStore.getState();
    const comments = state.commentsByTask.get("task-1") ?? [];
    expect(comments.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  // -------------------------------------------------------------------------
  // applyReactionInsert — idempotency on PK tuple
  // -------------------------------------------------------------------------

  it("applyReactionInsert adds a new reaction", () => {
    const reaction = makeReaction();
    useBoardStore.getState().applyReactionInsert(reaction);

    const state = useBoardStore.getState();
    const reactions = state.reactionsByComment.get("comment-1") ?? [];
    expect(reactions).toHaveLength(1);
  });

  it("applyReactionInsert is idempotent on PK tuple (comment_id, user_id, emoji)", () => {
    const reaction = makeReaction();
    useBoardStore.getState().applyReactionInsert(reaction);
    useBoardStore.getState().applyReactionInsert(reaction); // duplicate

    const state = useBoardStore.getState();
    const reactions = state.reactionsByComment.get("comment-1") ?? [];
    expect(reactions).toHaveLength(1);
  });

  it("applyReactionInsert allows different emoji from the same user", () => {
    const r1 = makeReaction({ emoji: "👍" });
    const r2 = makeReaction({ emoji: "❤️" });
    useBoardStore.getState().applyReactionInsert(r1);
    useBoardStore.getState().applyReactionInsert(r2);

    const state = useBoardStore.getState();
    const reactions = state.reactionsByComment.get("comment-1") ?? [];
    expect(reactions).toHaveLength(2);
  });

  it("applyReactionInsert allows same emoji from different users", () => {
    const r1 = makeReaction({ user_id: "user-1", emoji: "👍" });
    const r2 = makeReaction({ user_id: "user-2", emoji: "👍" });
    useBoardStore.getState().applyReactionInsert(r1);
    useBoardStore.getState().applyReactionInsert(r2);

    const state = useBoardStore.getState();
    const reactions = state.reactionsByComment.get("comment-1") ?? [];
    expect(reactions).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // applyReactionDelete
  // -------------------------------------------------------------------------

  it("applyReactionDelete removes only matching tuple", () => {
    useBoardStore.getState().applyReactionInsert(makeReaction({ user_id: "user-1", emoji: "👍" }));
    useBoardStore.getState().applyReactionInsert(makeReaction({ user_id: "user-2", emoji: "👍" }));
    useBoardStore.getState().applyReactionInsert(makeReaction({ user_id: "user-1", emoji: "❤️" }));

    useBoardStore.getState().applyReactionDelete("comment-1", "user-1", "👍");

    const state = useBoardStore.getState();
    const reactions = state.reactionsByComment.get("comment-1") ?? [];
    expect(reactions).toHaveLength(2);
    expect(reactions.every((r) => !(r.user_id === "user-1" && r.emoji === "👍"))).toBe(true);
  });

  it("applyReactionDelete is a no-op if matching tuple not found", () => {
    useBoardStore.getState().applyReactionInsert(makeReaction({ user_id: "user-1", emoji: "👍" }));
    useBoardStore.getState().applyReactionDelete("comment-1", "user-1", "❤️"); // wrong emoji

    const state = useBoardStore.getState();
    const reactions = state.reactionsByComment.get("comment-1") ?? [];
    expect(reactions).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // selectGroupedReactions
  // -------------------------------------------------------------------------

  it("selectGroupedReactions groups and counts reactions by emoji", () => {
    useBoardStore.getState().applyReactionInsert(makeReaction({ user_id: "user-1", emoji: "👍" }));
    useBoardStore.getState().applyReactionInsert(makeReaction({ user_id: "user-2", emoji: "👍" }));
    useBoardStore.getState().applyReactionInsert(makeReaction({ user_id: "user-1", emoji: "❤️" }));

    const grouped = selectGroupedReactions(useBoardStore.getState(), "comment-1", "user-3");
    const thumbsUp = grouped.find((g) => g.emoji === "👍");
    const heart = grouped.find((g) => g.emoji === "❤️");

    expect(thumbsUp?.count).toBe(2);
    expect(heart?.count).toBe(1);
  });

  it("selectGroupedReactions sets selfReacted=true when currentUserId reacted", () => {
    useBoardStore.getState().applyReactionInsert(makeReaction({ user_id: "user-1", emoji: "👍" }));
    useBoardStore.getState().applyReactionInsert(makeReaction({ user_id: "user-2", emoji: "👍" }));

    const grouped = selectGroupedReactions(useBoardStore.getState(), "comment-1", "user-1");
    const thumbsUp = grouped.find((g) => g.emoji === "👍");

    expect(thumbsUp?.selfReacted).toBe(true);
  });

  it("selectGroupedReactions sets selfReacted=false when currentUserId has not reacted", () => {
    useBoardStore.getState().applyReactionInsert(makeReaction({ user_id: "user-2", emoji: "👍" }));

    const grouped = selectGroupedReactions(useBoardStore.getState(), "comment-1", "user-1");
    const thumbsUp = grouped.find((g) => g.emoji === "👍");

    expect(thumbsUp?.selfReacted).toBe(false);
  });

  it("selectGroupedReactions returns empty array for a comment with no reactions", () => {
    const grouped = selectGroupedReactions(useBoardStore.getState(), "nonexistent", "user-1");
    expect(grouped).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // selectCommentsForTask — ordered oldest-first
  // -------------------------------------------------------------------------

  it("selectCommentsForTask returns comments ordered oldest-first", () => {
    const c1 = makeComment({ id: "c1", created_at: "2024-01-01T10:00:00Z" });
    const c2 = makeComment({ id: "c2", created_at: "2024-01-02T10:00:00Z" });
    useBoardStore.getState().applyCommentUpsert(c2);
    useBoardStore.getState().applyCommentUpsert(c1);

    const comments = selectCommentsForTask(useBoardStore.getState(), "task-1");
    expect(comments.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("selectCommentsForTask returns empty array for unknown task", () => {
    const comments = selectCommentsForTask(useBoardStore.getState(), "nonexistent");
    expect(comments).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // applyActivityInsert — idempotency on id
  // -------------------------------------------------------------------------

  it("applyActivityInsert inserts a new activity event", () => {
    const activity = makeActivity();
    useBoardStore.getState().applyActivityInsert(activity);

    const state = useBoardStore.getState();
    const events = state.activityByTask.get("task-1") ?? [];
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("activity-1");
  });

  it("applyActivityInsert is idempotent on id", () => {
    const activity = makeActivity();
    useBoardStore.getState().applyActivityInsert(activity);
    useBoardStore.getState().applyActivityInsert(activity); // duplicate

    const state = useBoardStore.getState();
    const events = state.activityByTask.get("task-1") ?? [];
    expect(events).toHaveLength(1);
  });

  it("applyActivityInsert sorts activity newest-first", () => {
    const a1 = makeActivity({ id: "a1", created_at: "2024-01-01T10:00:00Z" });
    const a3 = makeActivity({ id: "a3", created_at: "2024-01-03T10:00:00Z" });
    const a2 = makeActivity({ id: "a2", created_at: "2024-01-02T10:00:00Z" });

    useBoardStore.getState().applyActivityInsert(a1);
    useBoardStore.getState().applyActivityInsert(a3);
    useBoardStore.getState().applyActivityInsert(a2);

    const state = useBoardStore.getState();
    const events = state.activityByTask.get("task-1") ?? [];
    expect(events.map((e) => e.id)).toEqual(["a3", "a2", "a1"]);
  });

  // -------------------------------------------------------------------------
  // selectTaskActivity — newest-first
  // -------------------------------------------------------------------------

  it("selectTaskActivity returns activity events newest-first", () => {
    const a1 = makeActivity({ id: "a1", created_at: "2024-01-01T10:00:00Z" });
    const a2 = makeActivity({ id: "a2", created_at: "2024-01-02T10:00:00Z" });
    useBoardStore.getState().applyActivityInsert(a1);
    useBoardStore.getState().applyActivityInsert(a2);

    const events = selectTaskActivity(useBoardStore.getState(), "task-1");
    expect(events.map((e) => e.id)).toEqual(["a2", "a1"]);
  });

  it("selectTaskActivity returns empty array for unknown task", () => {
    const events = selectTaskActivity(useBoardStore.getState(), "nonexistent");
    expect(events).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // hydrateActivityForTask
  // -------------------------------------------------------------------------

  it("hydrateActivityForTask replaces the entire list and sorts newest-first", () => {
    useBoardStore.getState().applyActivityInsert(makeActivity({ id: "stale" }));

    const fresh = [
      makeActivity({ id: "a1", created_at: "2024-01-01T00:00:00Z" }),
      makeActivity({ id: "a2", created_at: "2024-01-02T00:00:00Z" }),
    ];
    useBoardStore.getState().hydrateActivityForTask("task-1", fresh);

    const state = useBoardStore.getState();
    const events = state.activityByTask.get("task-1") ?? [];
    expect(events.map((e) => e.id)).toEqual(["a2", "a1"]);
  });

  // -------------------------------------------------------------------------
  // reset() clears the three new maps
  // -------------------------------------------------------------------------

  it("reset() clears commentsByTask, reactionsByComment, and activityByTask", () => {
    useBoardStore.getState().applyCommentUpsert(makeComment());
    useBoardStore.getState().applyReactionInsert(makeReaction());
    useBoardStore.getState().applyActivityInsert(makeActivity());

    useBoardStore.getState().reset();

    const state = useBoardStore.getState();
    expect(state.commentsByTask.size).toBe(0);
    expect(state.reactionsByComment.size).toBe(0);
    expect(state.activityByTask.size).toBe(0);
  });

  it("reset() preserves collapsedByBoard, columnPrefsByBoard, and outbox", () => {
    useBoardStore.setState({
      collapsedByBoard: { "board-1": ["group-1"] },
      columnPrefsByBoard: { "board-1": { "col-1": { width: 200 } } },
      outbox: [],
    });

    useBoardStore.getState().reset();

    const state = useBoardStore.getState();
    expect(state.collapsedByBoard).toEqual({ "board-1": ["group-1"] });
    expect(state.columnPrefsByBoard).toEqual({ "board-1": { "col-1": { width: 200 } } });
  });
});
