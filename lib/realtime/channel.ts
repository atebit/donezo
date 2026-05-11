/**
 * Channel name helpers for Supabase Realtime.
 * All board-scoped channels use the `board:<boardId>` convention.
 */

/**
 * Returns the canonical Realtime channel name for a board.
 * Format: `board:<boardId>` — matches the Supabase config naming convention
 * used throughout the app.
 */
export function boardChannelName(boardId: string): string {
  return `board:${boardId}`;
}
