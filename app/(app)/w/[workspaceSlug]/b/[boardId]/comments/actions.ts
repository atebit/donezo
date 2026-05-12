"use server";

/**
 * Comment server actions — createComment, editComment, deleteComment,
 * reactComment, unreactComment.
 *
 * All actions:
 *   - Wrap `withUser` for authentication + error normalisation.
 *   - Parse raw input via Zod schemas from `lib/validations/comment.ts`.
 *   - Resolve boardId from the task/comment record.
 *   - Mutate via the per-user Supabase client (RLS applies).
 *   - Log activity best-effort (never fails the parent action).
 *
 * Admin-delete note (A.8 spec):
 *   The existing `comment_delete` RLS policy permits both the author and any
 *   board admin to delete. When the actor is an admin-not-author we still route
 *   through `adminClient()` as specified, as a defensive measure and to document
 *   the intent clearly. (The user-client would also work given the current policy.)
 */

import { type ActionContext, withUser } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireBoardRole } from "@/lib/authorization";
import { extractMentions } from "@/lib/comments/mentions";
import type { TiptapDoc } from "@/lib/comments/types";
import { notifyUsers } from "@/lib/notifications/notify";
// biome-ignore lint/style/noRestrictedImports: admin-delete of others' comments bypasses RLS author check.
import { adminClient } from "@/lib/supabase/admin";
import {
  CreateCommentSchema,
  DeleteCommentSchema,
  EditCommentSchema,
  ReactCommentSchema,
  UnreactCommentSchema,
} from "@/lib/validations/comment";

// ---------------------------------------------------------------------------
// createComment
// ---------------------------------------------------------------------------

export const createComment = withUser(async ({ supabase, userId }, raw) => {
  const input = CreateCommentSchema.parse(raw);

  // 1. Load task to get board_id; verify task exists + not deleted.
  const { data: task, error: taskError } = await supabase
    .from("task")
    .select("id, board_id")
    .eq("id", input.taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (taskError) throw { code: "DB", message: taskError.message };
  if (!task) throw { code: "NOT_FOUND", message: "Task not found." };

  // 2. Require >= member on the board.
  await requireBoardRole(task.board_id, "member");

  // 3. Insert comment via user-client (RLS enforced).
  const { data: comment, error: insertError } = await supabase
    .from("comment")
    .insert({
      task_id: input.taskId,
      board_id: task.board_id,
      author_id: userId,
      body: input.body as unknown as never,
      body_text: input.bodyText,
    })
    .select("id, board_id")
    .single();

  if (insertError) throw { code: "DB", message: insertError.message };
  if (!comment) throw { code: "NOT_FOUND", message: "Comment not found after insert." };

  // 4. Mention fan-out (best-effort).
  await _fanOutMentions({
    doc: input.body as TiptapDoc,
    boardId: task.board_id,
    taskId: input.taskId,
    commentId: comment.id,
    actorId: userId,
    supabase,
    previousMentionIds: [],
    previousEveryone: false,
  });

  // 5. Log activity (best-effort).
  void logActivity({
    boardId: task.board_id,
    taskId: input.taskId,
    actorId: userId,
    type: "comment.posted",
    payload: { commentId: comment.id, bodyTextPreview: input.bodyText.slice(0, 140) },
  });

  return comment;
});

// ---------------------------------------------------------------------------
// editComment
// ---------------------------------------------------------------------------

export const editComment = withUser(async ({ supabase, userId }, raw) => {
  const input = EditCommentSchema.parse(raw);

  // 1. Load existing comment (RLS ensures author-only or board-access visibility).
  const { data: existing, error: fetchError } = await supabase
    .from("comment")
    .select("id, board_id, task_id, author_id, body")
    .eq("id", input.commentId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!existing) throw { code: "NOT_FOUND", message: "Comment not found." };

  // 2. Update via user-client (comment_update RLS is author-only).
  const { data: updated, error: updateError } = await supabase
    .from("comment")
    .update({
      body: input.body as unknown as never,
      body_text: input.bodyText,
    })
    .eq("id", input.commentId)
    .select("id, board_id, task_id")
    .single();

  if (updateError) throw { code: "DB", message: updateError.message };
  if (!updated) throw { code: "NOT_FOUND", message: "Comment not found after update." };

  // 3. Notify only newly-added mentions (diff against old body).
  const oldMentions = extractMentions(existing.body as unknown as TiptapDoc);
  await _fanOutMentions({
    doc: input.body as TiptapDoc,
    boardId: existing.board_id,
    taskId: existing.task_id,
    commentId: existing.id,
    actorId: userId,
    supabase,
    previousMentionIds: oldMentions.userIds,
    previousEveryone: oldMentions.everyone,
  });

  // 4. Log activity (best-effort).
  void logActivity({
    boardId: existing.board_id,
    taskId: existing.task_id,
    actorId: userId,
    type: "comment.edited",
    payload: { commentId: existing.id },
  });

  return updated;
});

// ---------------------------------------------------------------------------
// deleteComment
// ---------------------------------------------------------------------------

export const deleteComment = withUser(async ({ supabase, userId }, raw) => {
  const input = DeleteCommentSchema.parse(raw);

  // 1. Load comment to determine authorship and boardId.
  const { data: comment, error: fetchError } = await supabase
    .from("comment")
    .select("id, board_id, task_id, author_id")
    .eq("id", input.commentId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!comment) throw { code: "NOT_FOUND", message: "Comment not found." };

  const isAuthor = comment.author_id === userId;

  if (isAuthor) {
    // 2a. Actor is author — DELETE via user-client (RLS allows author).
    const { error } = await supabase.from("comment").delete().eq("id", input.commentId);

    if (error) throw { code: "DB", message: error.message };
  } else {
    // 2b. Actor is not author — verify they are an admin+ on the board.
    // Then DELETE via adminClient() because the intent is to bypass the
    // author-gated path. (Current comment_delete RLS also allows admins via
    // user-client, but we use adminClient() here as a documented defensive path.)
    await requireBoardRole(comment.board_id, "admin");

    const { error } = await adminClient().from("comment").delete().eq("id", input.commentId);

    if (error) throw { code: "DB", message: error.message };
  }

  // 3. Log activity (best-effort).
  void logActivity({
    boardId: comment.board_id,
    taskId: comment.task_id,
    actorId: userId,
    type: "comment.deleted",
    payload: { commentId: comment.id },
  });

  return { commentId: input.commentId };
});

// ---------------------------------------------------------------------------
// reactComment
// ---------------------------------------------------------------------------

export const reactComment = withUser(async ({ supabase, userId }, raw) => {
  const input = ReactCommentSchema.parse(raw);

  // 1. Load comment to get board_id.
  const { data: comment, error: fetchError } = await supabase
    .from("comment")
    .select("id, board_id, task_id")
    .eq("id", input.commentId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!comment) throw { code: "NOT_FOUND", message: "Comment not found." };

  // 2. Require >= member on the board.
  await requireBoardRole(comment.board_id, "member");

  // 3. INSERT reaction; on unique-violation (already reacted with same emoji), treat as no-op.
  const { error: insertError } = await supabase.from("comment_reaction").insert({
    comment_id: input.commentId,
    user_id: userId,
    emoji: input.emoji,
    board_id: comment.board_id,
  });

  if (insertError) {
    // PostgreSQL unique violation code: 23505
    if (insertError.code === "23505") {
      return { ok: true } as const;
    }
    throw { code: "DB", message: insertError.message };
  }

  // 4. Log activity (best-effort).
  void logActivity({
    boardId: comment.board_id,
    taskId: comment.task_id,
    actorId: userId,
    type: "comment.reacted",
    payload: { commentId: comment.id, emoji: input.emoji },
  });

  return { ok: true } as const;
});

// ---------------------------------------------------------------------------
// unreactComment
// ---------------------------------------------------------------------------

export const unreactComment = withUser(async ({ supabase, userId }, raw) => {
  const input = UnreactCommentSchema.parse(raw);

  // Load comment to get board_id and task_id for activity logging.
  const { data: comment, error: fetchError } = await supabase
    .from("comment")
    .select("id, board_id, task_id")
    .eq("id", input.commentId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!comment) throw { code: "NOT_FOUND", message: "Comment not found." };

  // DELETE the (comment, user, emoji) tuple — RLS allows self-only.
  const { error: deleteError } = await supabase
    .from("comment_reaction")
    .delete()
    .eq("comment_id", input.commentId)
    .eq("user_id", userId)
    .eq("emoji", input.emoji);

  if (deleteError) throw { code: "DB", message: deleteError.message };

  // Log activity (best-effort).
  void logActivity({
    boardId: comment.board_id,
    taskId: comment.task_id,
    actorId: userId,
    type: "comment.unreacted",
    payload: { commentId: comment.id, emoji: input.emoji },
  });

  return { ok: true } as const;
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fan-out mention notifications for a comment create/edit.
 *
 * - Extracts mentions from `doc`.
 * - For edits: only notifies users who are newly added (not in `previousMentionIds`).
 * - Expands `@everyone` to all board members (excluding the actor).
 * - Skips the actor (no self-notify).
 * - Verifies board access for each target (no-op for @everyone expansion as all
 *   board members already have access, but check kept for safety).
 * - Calls `notifyUsers` (best-effort; never throws).
 */
async function _fanOutMentions({
  doc,
  boardId,
  taskId,
  commentId,
  actorId,
  supabase,
  previousMentionIds,
  previousEveryone,
}: {
  doc: TiptapDoc | null | undefined;
  boardId: string;
  taskId: string;
  commentId: string;
  actorId: string;
  supabase: ActionContext["supabase"];
  /** Previously mentioned user IDs (for edit diff — skip already-notified). */
  previousMentionIds: string[];
  /**
   * Whether `@everyone` was present in the previous version of the comment body.
   * When true, board members were already notified by the prior create/edit and
   * should not be re-notified on this edit (even if @everyone is still present).
   */
  previousEveryone: boolean;
}): Promise<void> {
  try {
    const { userIds: rawUserIds, everyone } = extractMentions(doc);

    let targetIds = new Set<string>(rawUserIds);

    // Only expand @everyone when it's newly added.
    // If it was present on the previous version too, the prior createComment /
    // editComment already fanned out to every board member; re-expanding would
    // re-notify them on every subsequent edit.
    // NOTE: For public boards, workspace members with implicit access are NOT
    // expanded here. Confirmed Option A per followup-1 Q-A1: only explicit
    // board_member rows are expanded.
    if (everyone && !previousEveryone) {
      const { data: members } = await supabase
        .from("board_member")
        .select("user_id")
        .eq("board_id", boardId);

      if (members) {
        for (const m of members) {
          targetIds.add(m.user_id);
        }
      }
    }

    // Remove the actor (no self-notify).
    targetIds.delete(actorId);

    // For edits: only notify newly-added mentions.
    const previousSet = new Set(previousMentionIds);
    targetIds = new Set([...targetIds].filter((id) => !previousSet.has(id)));

    if (targetIds.size === 0) return;

    // Verify board access for each target and build notification rows.
    const notificationRows = await Promise.all(
      [...targetIds].map(async (targetUserId) => {
        const { data: role } = await supabase.rpc("role_for_board", {
          p_board_id: boardId,
          p_user_id: targetUserId,
        });
        if (!role) return null; // Not a board member — skip.
        return {
          user_id: targetUserId,
          kind: "mention" as const,
          payload: { board_id: boardId, task_id: taskId, comment_id: commentId, actor_id: actorId },
        };
      }),
    );

    const validRows = notificationRows.filter((r): r is NonNullable<typeof r> => r !== null);

    await notifyUsers(validRows);
  } catch {
    // Best-effort — never propagate mention errors to the caller.
  }
}
