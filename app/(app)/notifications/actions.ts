"use server";

/**
 * app/(app)/notifications/actions.ts
 *
 * Server actions for notification read-state and follow/unfollow.
 * Follow/unfollow write directly to task_follower via the user-scoped client
 * (RLS allows user_id = auth.uid()).
 */

import { withUser } from "@/lib/actions";
import {
  FollowTaskSchema,
  SetReadStateSchema,
  UnfollowTaskSchema,
} from "@/lib/validations/notifications";

// ── Read state ────────────────────────────────────────────────────────────────

/**
 * Mark specific notifications as read, or mark all as read.
 * Accepts the SetReadStateSchema discriminated union.
 */
export const markRead = withUser(async ({ supabase, userId }, raw) => {
  const input = SetReadStateSchema.parse(raw);

  if ("markAll" in input && input.markAll === true) {
    // Mark all unread notifications for this user as read
    const { error } = await supabase
      .from("notification")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) {
      throw { code: "DB_ERROR", message: error.message };
    }
    return { markedAll: true };
  }

  // Discriminated union: markAll must be false here
  const ids = (input as { markAll: false; notificationIds: string[] }).notificationIds;

  const { error } = await supabase
    .from("notification")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", ids)
    .is("read_at", null);

  if (error) {
    throw { code: "DB_ERROR", message: error.message };
  }

  return { markedIds: ids };
});

/** Convenience: mark all read (calls markRead under the hood with markAll: true). */
export const markAllRead = withUser(async ({ supabase, userId }) => {
  const { error } = await supabase
    .from("notification")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    throw { code: "DB_ERROR", message: error.message };
  }
  return { ok: true };
});

// ── Follow / unfollow ─────────────────────────────────────────────────────────

/** Follow a task. Idempotent via upsert (conflict = no-op). */
export const followTask = withUser(async ({ supabase, userId }, raw) => {
  const { taskId } = FollowTaskSchema.parse(raw);

  const { error } = await supabase
    .from("task_follower")
    .upsert(
      { task_id: taskId, user_id: userId },
      { onConflict: "task_id,user_id", ignoreDuplicates: true },
    );

  if (error) {
    throw { code: "DB_ERROR", message: error.message };
  }
  return { following: true };
});

/** Unfollow a task. No-op if not following. */
export const unfollowTask = withUser(async ({ supabase, userId }, raw) => {
  const { taskId } = UnfollowTaskSchema.parse(raw);

  const { error } = await supabase
    .from("task_follower")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (error) {
    throw { code: "DB_ERROR", message: error.message };
  }
  return { following: false };
});
