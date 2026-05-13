/**
 * lib/notifications/followers.ts
 *
 * Task follower management helpers.
 *
 * All writes use the adminClient (service-role) because:
 *   - Auto-follow is triggered from emitters, not from a user-initiated action.
 *   - The task_follower table's write policy is user_id = auth.uid() — no anon
 *     or server-side JWT for the acting user is available in emitter context.
 *   - The adminClient is only used for insert/delete; reads still go via the
 *     user-scoped supabase client where RLS applies.
 *
 * CONTRACT — best-effort:
 *   All exported helpers swallow errors and never propagate. Callers (emitters)
 *   must not rely on these succeeding.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: service-role writes for auto-follow fan-out.
import { adminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Core CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Idempotently add a follower. On unique-key conflict (already following) → no-op.
 */
export async function ensureFollower(taskId: string, userId: string): Promise<void> {
  try {
    const { error } = await adminClient()
      .from("task_follower")
      .upsert(
        { task_id: taskId, user_id: userId },
        { onConflict: "task_id,user_id", ignoreDuplicates: true },
      );
    if (error) {
      logger.warn({ err: error, taskId, userId }, "ensureFollower: upsert failed");
    }
  } catch (err) {
    logger.warn({ err, taskId, userId }, "ensureFollower: unexpected error");
  }
}

/**
 * Remove a follower. If the row does not exist, this is a no-op.
 */
export async function removeFollower(taskId: string, userId: string): Promise<void> {
  try {
    const { error } = await adminClient()
      .from("task_follower")
      .delete()
      .eq("task_id", taskId)
      .eq("user_id", userId);
    if (error) {
      logger.warn({ err: error, taskId, userId }, "removeFollower: delete failed");
    }
  } catch (err) {
    logger.warn({ err, taskId, userId }, "removeFollower: unexpected error");
  }
}

/**
 * Get all follower user IDs for a task.
 * Uses the provided supabase client (caller's RLS context) for reads.
 * Falls back to empty array on error.
 */
export async function getFollowers(
  taskId: string,
  supabase: SupabaseClient<Database>,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("task_follower")
      .select("user_id")
      .eq("task_id", taskId);
    if (error) {
      logger.warn({ err: error, taskId }, "getFollowers: select failed");
      return [];
    }
    return (data ?? []).map((r) => r.user_id);
  } catch (err) {
    logger.warn({ err, taskId }, "getFollowers: unexpected error");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Auto-follow triggers (called from emitters)
// ---------------------------------------------------------------------------

/**
 * Auto-follow rule: commenter follows the task they commented on.
 */
export async function autoFollowOnComment(taskId: string, authorId: string): Promise<void> {
  await ensureFollower(taskId, authorId);
}

/**
 * Auto-follow rule: mentioned user follows the task they were mentioned on.
 */
export async function autoFollowOnMention(taskId: string, mentionedUserId: string): Promise<void> {
  await ensureFollower(taskId, mentionedUserId);
}

/**
 * Auto-follow rule: assignee follows the task they were assigned to.
 */
export async function autoFollowOnAssign(taskId: string, assignedUserId: string): Promise<void> {
  await ensureFollower(taskId, assignedUserId);
}
