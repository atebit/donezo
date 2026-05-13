/**
 * lib/notifications/emitters.ts
 *
 * Per-kind notification emitters. Each emitter:
 *   - Is best-effort: wrapped in try/catch, logged via lib/logger, never throws.
 *   - Calls `getPreferenceFor(userId, kind).inApp` before inserting a row;
 *     skips if in-app is disabled. Email-channel gating is handled by the mailer
 *     (slice 2C) — not here.
 *   - Skips the actor (no self-notification).
 *   - Verifies board access via `role_for_board` rpc where relevant.
 *   - Calls auto-follow helpers from followers.ts where appropriate.
 *
 * The `supabase` parameter is the per-user client from the calling server action.
 * Service-role calls (admin writes) are done inside the follower helpers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractMentions } from "@/lib/comments/mentions";
import type { TiptapDoc } from "@/lib/comments/types";
import { logger } from "@/lib/logger";
import { emit } from "@/lib/notifications/emit";
import {
  autoFollowOnAssign,
  autoFollowOnMention,
  getFollowers,
} from "@/lib/notifications/followers";
import { getPreferenceFor } from "@/lib/notifications/preferences";
// biome-ignore lint/style/noRestrictedImports: service-role used for board access check in emitters.
import { adminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// emitMentionNotifications
// ---------------------------------------------------------------------------

/**
 * Fan-out mention notifications for a comment create/edit.
 *
 * - Extracts mentions from `doc`.
 * - For edits: only notifies users newly added (not in `previousMentionIds`).
 * - Expands `@everyone` to all board members (only when newly added).
 *   NOTE: Only explicit board_member rows are expanded (not implicit workspace
 *   members with public-board access). See epic 09 followup Q-A1.
 * - Skips the actor (no self-notify).
 * - Verifies board access via role_for_board for each target.
 * - Auto-follows: mentioned user follows the task.
 */
export async function emitMentionNotifications({
  doc,
  boardId,
  taskId,
  commentId,
  actorId,
  supabase,
  previousMentionIds = [],
  previousEveryone = false,
}: {
  doc: TiptapDoc | null | undefined;
  boardId: string;
  taskId: string;
  commentId: string;
  actorId: string;
  supabase: Supabase;
  previousMentionIds?: string[];
  previousEveryone?: boolean;
}): Promise<void> {
  try {
    const { userIds: rawUserIds, everyone } = extractMentions(doc);

    let targetIds = new Set<string>(rawUserIds);

    // Only expand @everyone when it's newly added.
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

    // Verify board access + check preferences.
    const rows = await Promise.all(
      [...targetIds].map(async (targetUserId) => {
        const { data: role } = await supabase.rpc("role_for_board", {
          p_board_id: boardId,
          p_user_id: targetUserId,
        });
        if (!role) return null; // Not a board member — skip.

        const pref = await getPreferenceFor(targetUserId, "mention");
        if (!pref.inApp) return null;

        // Auto-follow: mentioned user follows the task.
        void autoFollowOnMention(taskId, targetUserId);

        return {
          user_id: targetUserId,
          kind: "mention" as const,
          payload: {
            actor_id: actorId,
            board_id: boardId,
            task_id: taskId,
            comment_id: commentId,
          },
        };
      }),
    );

    const validRows = rows.filter((r): r is NonNullable<typeof r> => r !== null);
    if (validRows.length === 0) return;
    await emit(validRows, "emitMentionNotifications");
  } catch (err) {
    logger.warn({ err, boardId, taskId, commentId }, "emitMentionNotifications: unexpected error");
  }
}

// ---------------------------------------------------------------------------
// emitCommentReplyNotifications
// ---------------------------------------------------------------------------

/**
 * Heuristic: scan the comment body for a <blockquote> whose nested mention id
 * matches a user. Treat that user as the reply-target and emit comment_reply.
 *
 * Heuristic rationale: Tiptap does not have a first-class "reply" concept.
 * When a user quotes another comment (blockquote wrapping the original mention),
 * we interpret that as a reply to the quoted user. If no such structure is found,
 * no comment_reply notification is emitted — the comment may still produce a
 * comment_on_followed notification if the task has followers.
 *
 * Limitations:
 *   - Only the first quoted mention per blockquote is treated as the reply-target.
 *   - This fires even if the blockquote was hand-crafted; false positives are
 *     acceptable (the recipient benefits from the notification in any case).
 */
export async function emitCommentReplyNotifications({
  doc,
  boardId,
  taskId,
  commentId,
  actorId,
  supabase,
}: {
  doc: TiptapDoc | null | undefined;
  boardId: string;
  taskId: string;
  commentId: string;
  actorId: string;
  supabase: Supabase;
}): Promise<void> {
  try {
    if (!doc || doc.type !== "doc") return;

    // Find blockquote nodes and extract the first mention id inside each.
    const replyTargetIds = new Set<string>();

    function walkForBlockquote(
      node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] } | undefined,
    ): void {
      if (!node) return;
      if (node.type === "blockquote") {
        // Inside blockquote, find first mention.
        function findFirstMention(inner: typeof node): string | null {
          if (!inner) return null;
          if (inner.type === "mention" && typeof inner.attrs?.id === "string") {
            return inner.attrs.id as string;
          }
          if (inner.content) {
            for (const child of inner.content) {
              const found = findFirstMention(child as typeof node);
              if (found) return found;
            }
          }
          return null;
        }
        const mentionId = findFirstMention(node);
        if (mentionId && mentionId !== actorId) {
          replyTargetIds.add(mentionId);
        }
        return; // Don't recurse deeper into blockquote.
      }
      if (node.content) {
        for (const child of node.content) {
          walkForBlockquote(child as typeof node);
        }
      }
    }

    if (doc.content) {
      for (const node of doc.content) {
        walkForBlockquote(node as Parameters<typeof walkForBlockquote>[0]);
      }
    }

    if (replyTargetIds.size === 0) return;

    const rows = await Promise.all(
      [...replyTargetIds].map(async (targetUserId) => {
        const { data: role } = await supabase.rpc("role_for_board", {
          p_board_id: boardId,
          p_user_id: targetUserId,
        });
        if (!role) return null;

        const pref = await getPreferenceFor(targetUserId, "comment_reply");
        if (!pref.inApp) return null;

        return {
          user_id: targetUserId,
          kind: "comment_reply" as const,
          payload: {
            actor_id: actorId,
            board_id: boardId,
            task_id: taskId,
            comment_id: commentId,
          },
        };
      }),
    );

    const validRows = rows.filter((r): r is NonNullable<typeof r> => r !== null);
    if (validRows.length === 0) return;
    await emit(validRows, "emitCommentReplyNotifications");
  } catch (err) {
    logger.warn(
      { err, boardId, taskId, commentId },
      "emitCommentReplyNotifications: unexpected error",
    );
  }
}

// ---------------------------------------------------------------------------
// emitCommentOnFollowedNotifications
// ---------------------------------------------------------------------------

/**
 * Notify task followers of a new comment, excluding:
 *   - The actor (commenter).
 *   - Users already notified via a mention (they got a higher-priority mention
 *     notification; we don't want to double-notify).
 */
export async function emitCommentOnFollowedNotifications({
  doc,
  boardId,
  taskId,
  commentId,
  actorId,
  supabase,
}: {
  doc: TiptapDoc | null | undefined;
  boardId: string;
  taskId: string;
  commentId: string;
  actorId: string;
  supabase: Supabase;
}): Promise<void> {
  try {
    // Extract mentioned user IDs to exclude them (they receive 'mention' instead).
    const { userIds: mentionedIds } = extractMentions(doc);
    const excludeSet = new Set([actorId, ...mentionedIds]);

    const followers = await getFollowers(taskId, supabase);
    const targets = followers.filter((uid) => !excludeSet.has(uid));

    if (targets.length === 0) return;

    const rows = await Promise.all(
      targets.map(async (targetUserId) => {
        const pref = await getPreferenceFor(targetUserId, "comment_on_followed");
        if (!pref.inApp) return null;

        return {
          user_id: targetUserId,
          kind: "comment_on_followed" as const,
          payload: {
            actor_id: actorId,
            board_id: boardId,
            task_id: taskId,
            comment_id: commentId,
          },
        };
      }),
    );

    const validRows = rows.filter((r): r is NonNullable<typeof r> => r !== null);
    if (validRows.length === 0) return;
    await emit(validRows, "emitCommentOnFollowedNotifications");
  } catch (err) {
    logger.warn(
      { err, boardId, taskId, commentId },
      "emitCommentOnFollowedNotifications: unexpected error",
    );
  }
}

// ---------------------------------------------------------------------------
// emitAssignmentNotifications
// ---------------------------------------------------------------------------

/**
 * Emit assigned/unassigned notifications on person-cell changes.
 *
 * - `added` = nextUserIds \ prevUserIds → emit `assigned`, auto-follow assignee.
 * - `removed` = prevUserIds \ nextUserIds → emit `unassigned`.
 * - Skip `actorId` in both sets.
 * - Verify board access via role_for_board for each target.
 */
export async function emitAssignmentNotifications({
  supabase,
  boardId,
  taskId,
  prevUserIds,
  nextUserIds,
  actorId,
}: {
  supabase: Supabase;
  boardId: string;
  taskId: string;
  prevUserIds: string[];
  nextUserIds: string[];
  actorId: string;
}): Promise<void> {
  try {
    const prevSet = new Set(prevUserIds);
    const nextSet = new Set(nextUserIds);

    const added = [...nextSet].filter((id) => !prevSet.has(id) && id !== actorId);
    const removed = [...prevSet].filter((id) => !nextSet.has(id) && id !== actorId);

    if (added.length === 0 && removed.length === 0) return;

    const rows = await Promise.all([
      ...added.map(async (userId) => {
        const { data: role } = await supabase.rpc("role_for_board", {
          p_board_id: boardId,
          p_user_id: userId,
        });
        if (!role) return null;

        const pref = await getPreferenceFor(userId, "assigned");
        if (!pref.inApp) return null;

        // Auto-follow: assignee follows the task.
        void autoFollowOnAssign(taskId, userId);

        return {
          user_id: userId,
          kind: "assigned" as const,
          payload: { actor_id: actorId, board_id: boardId, task_id: taskId },
        };
      }),
      ...removed.map(async (userId) => {
        const { data: role } = await supabase.rpc("role_for_board", {
          p_board_id: boardId,
          p_user_id: userId,
        });
        if (!role) return null;

        const pref = await getPreferenceFor(userId, "unassigned");
        if (!pref.inApp) return null;

        return {
          user_id: userId,
          kind: "unassigned" as const,
          payload: { actor_id: actorId, board_id: boardId, task_id: taskId },
        };
      }),
    ]);

    const validRows = rows.filter((r): r is NonNullable<typeof r> => r !== null);
    if (validRows.length === 0) return;
    await emit(validRows, "emitAssignmentNotifications");
  } catch (err) {
    logger.warn({ err, boardId, taskId }, "emitAssignmentNotifications: unexpected error");
  }
}

// ---------------------------------------------------------------------------
// emitStatusChangeNotifications
// ---------------------------------------------------------------------------

/**
 * Emit status-change notifications when a status cell changes.
 *
 * Recipients = assignees ∪ followers, minus actor.
 *   - Assignees → `status_changed_assigned`.
 *   - Non-assignee followers → `status_changed_followed`.
 *
 * Assignees are resolved by reading person cells on the task (bounded by
 * taskId — no N+1 across the board). We fetch all cells for this task where
 * the column type is 'person', then extract userIds from json_value.
 *
 * NOTE: This is bounded by taskId; we do NOT fetch every assignee board-wide.
 */
export async function emitStatusChangeNotifications({
  supabase,
  boardId,
  taskId,
  fromLabelId,
  toLabelId,
  actorId,
}: {
  supabase: Supabase;
  boardId: string;
  taskId: string;
  fromLabelId: string | null;
  toLabelId: string | null;
  actorId: string;
}): Promise<void> {
  try {
    // Resolve assignees: fetch all person-column cells for this task.
    // join column on type = 'person', bounded to this taskId.
    const { data: personCells } = await supabase
      .from("cell")
      .select("json_value, column!inner(type)")
      .eq("task_id", taskId)
      .eq("column.type", "person");

    const assigneeSet = new Set<string>();
    for (const cell of personCells ?? []) {
      const jv = cell.json_value as { userIds?: string[] } | null;
      if (jv?.userIds) {
        for (const uid of jv.userIds) {
          assigneeSet.add(uid);
        }
      }
    }

    // Followers of the task.
    const followers = await getFollowers(taskId, supabase);
    const followerSet = new Set(followers);

    // Union of all recipients, minus actor.
    const allRecipients = new Set([...assigneeSet, ...followerSet]);
    allRecipients.delete(actorId);

    if (allRecipients.size === 0) return;

    const rows = await Promise.all(
      [...allRecipients].map(async (userId) => {
        const isAssignee = assigneeSet.has(userId);
        const kind = isAssignee
          ? ("status_changed_assigned" as const)
          : ("status_changed_followed" as const);

        const pref = await getPreferenceFor(userId, kind);
        if (!pref.inApp) return null;

        return {
          user_id: userId,
          kind,
          payload: {
            actor_id: actorId,
            board_id: boardId,
            task_id: taskId,
            from_label_id: fromLabelId,
            to_label_id: toLabelId,
          },
        };
      }),
    );

    const validRows = rows.filter((r): r is NonNullable<typeof r> => r !== null);
    if (validRows.length === 0) return;
    await emit(validRows, "emitStatusChangeNotifications");
  } catch (err) {
    logger.warn({ err, boardId, taskId }, "emitStatusChangeNotifications: unexpected error");
  }
}

// ---------------------------------------------------------------------------
// emitBoardInviteNotification
// ---------------------------------------------------------------------------

/**
 * Emit a board_invite in-app notification when the invitee already has a profile.
 *
 * Email send (always, even for new accounts) lives in slice 2C.
 * This emitter only handles the in-app row.
 */
export async function emitBoardInviteNotification({
  boardId,
  workspaceId,
  invitationId,
  inviteeEmail,
  actorId,
}: {
  boardId: string;
  workspaceId: string;
  invitationId: string;
  inviteeEmail: string;
  actorId: string;
}): Promise<void> {
  try {
    // Check if the invitee already has a profile (email match).
    const { data: profile } = await adminClient()
      .from("profile")
      .select("id")
      .eq("email", inviteeEmail.toLowerCase())
      .maybeSingle();

    if (!profile) return; // No profile yet — in-app notification deferred until they join.

    const targetUserId = profile.id;

    // Skip self-invite (edge case).
    if (targetUserId === actorId) return;

    const pref = await getPreferenceFor(targetUserId, "board_invite");
    if (!pref.inApp) return;

    await emit(
      [
        {
          user_id: targetUserId,
          kind: "board_invite" as const,
          payload: {
            actor_id: actorId,
            board_id: boardId,
            workspace_id: workspaceId,
            invitation_id: invitationId,
          },
        },
      ],
      "emitBoardInviteNotification",
    );
  } catch (err) {
    logger.warn(
      { err, boardId, workspaceId, invitationId },
      "emitBoardInviteNotification: unexpected error",
    );
  }
}

// ---------------------------------------------------------------------------
// emitWorkspaceInviteNotification
// ---------------------------------------------------------------------------

/**
 * Emit a board_invite (workspace variant) in-app notification when the invitee
 * already has a profile.
 *
 * Uses the board_invite kind with board_id = '' (empty) to signal workspace scope.
 * Email send lives in slice 2C.
 */
export async function emitWorkspaceInviteNotification({
  workspaceId,
  invitationId,
  inviteeEmail,
  actorId,
}: {
  workspaceId: string;
  invitationId: string;
  inviteeEmail: string;
  actorId: string;
}): Promise<void> {
  try {
    const { data: profile } = await adminClient()
      .from("profile")
      .select("id")
      .eq("email", inviteeEmail.toLowerCase())
      .maybeSingle();

    if (!profile) return;

    const targetUserId = profile.id;
    if (targetUserId === actorId) return;

    const pref = await getPreferenceFor(targetUserId, "board_invite");
    if (!pref.inApp) return;

    await emit(
      [
        {
          user_id: targetUserId,
          kind: "board_invite" as const,
          payload: {
            actor_id: actorId,
            board_id: "",
            workspace_id: workspaceId,
            invitation_id: invitationId,
          },
        },
      ],
      "emitWorkspaceInviteNotification",
    );
  } catch (err) {
    logger.warn(
      { err, workspaceId, invitationId },
      "emitWorkspaceInviteNotification: unexpected error",
    );
  }
}

// ---------------------------------------------------------------------------
// emitRoleChangedNotification
// ---------------------------------------------------------------------------

/**
 * Emit a role_changed in-app notification.
 * In-app only; no email send in this emitter.
 *
 * Payload: { workspace_id?, board_id?, from, to, actor_id }.
 */
export async function emitRoleChangedNotification({
  targetUserId,
  actorId,
  workspaceId,
  boardId,
  fromRole,
  toRole,
}: {
  targetUserId: string;
  actorId: string;
  workspaceId?: string;
  boardId?: string;
  fromRole: string | null;
  toRole: string;
}): Promise<void> {
  try {
    // Skip if target is the actor (admin changing their own role — edge case).
    if (targetUserId === actorId) return;

    const pref = await getPreferenceFor(targetUserId, "role_changed");
    if (!pref.inApp) return;

    await emit(
      [
        {
          user_id: targetUserId,
          kind: "role_changed" as const,
          payload: {
            actor_id: actorId,
            ...(workspaceId !== undefined ? { workspace_id: workspaceId } : {}),
            ...(boardId !== undefined ? { board_id: boardId } : {}),
            from: fromRole,
            to: toRole,
          },
        },
      ],
      "emitRoleChangedNotification",
    );
  } catch (err) {
    logger.warn(
      { err, targetUserId, workspaceId, boardId },
      "emitRoleChangedNotification: unexpected error",
    );
  }
}
