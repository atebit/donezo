"use client";

/**
 * useTaskDrawerPresence — tracks the current user as "viewing: { type: 'task', task_id }"
 * on the board-scoped Realtime presence channel.
 *
 * Channel deduplication: calls `supabase.channel(boardChannelName(boardId))` which
 * returns the SAME channel instance that `useBoardRealtime` already holds. Supabase's
 * JS client deduplicates channels by topic name — no second subscription is created.
 * This is the same pattern as `useCursorBroadcast` and `useTypingBroadcast`.
 *
 * On mount: tracks `{ user_id, online_at, viewing: { type: 'task', task_id } }`.
 * On unmount: reverts to `{ user_id, online_at, viewing: { type: 'board' } }`.
 *
 * `selectUsersViewingTask` in board-store.ts (forward-compat from Epic 08) reads
 * the presence state to build the per-task viewer dot.
 */

import { useEffect } from "react";
import { boardChannelName } from "@/lib/realtime/channel";
import { createClient } from "@/lib/supabase/client";
import { useBoard } from "./use-board";

export function useTaskDrawerPresence(taskId: string): void {
  const { board, userId } = useBoard();
  const boardId = board.id;

  useEffect(() => {
    const supabase = createClient();
    // Supabase deduplicates channels by topic — same channel as useBoardRealtime.
    // Do NOT call subscribe() or unsubscribe() here; useBoardRealtime owns the lifecycle.
    const channel = supabase.channel(boardChannelName(boardId));

    // Track: this user is viewing this specific task
    void channel.track({
      user_id: userId,
      online_at: Date.now(),
      viewing: { type: "task", task_id: taskId },
    });

    return () => {
      // Revert to board-level presence on unmount
      void channel.track({
        user_id: userId,
        online_at: Date.now(),
        viewing: { type: "board" },
      });
    };
  }, [boardId, userId, taskId]);
}
