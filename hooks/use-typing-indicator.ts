"use client";

import { useShallow } from "zustand/react/shallow";
import { useBoardStore } from "@/stores/board-store";

/**
 * Returns the list of OTHER users currently typing in the given context.
 * Self is filtered out. Stale entries (> 5s) are excluded via the store's
 * pruneExpiredTyping sweeper (run by useBoardRealtime).
 *
 * Reads from `typingByContext` in the board store, which is populated by
 * useBoardRealtime's broadcast listener for the "typing" event.
 *
 * First consumer lands in Epic 09 (CommentComposer).
 */
export function useTypingIndicator(args: {
  userId: string; // current user, to filter self
  context: string;
}): Array<{ user_id: string; at: number }> {
  const { userId, context } = args;

  const entries = useBoardStore(useShallow((state) => state.typingByContext.get(context) ?? []));

  // Filter out the current user so they never see their own typing indicator
  return entries.filter((e) => e.user_id !== userId);
}
