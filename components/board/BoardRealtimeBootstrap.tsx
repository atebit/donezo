"use client";

/**
 * BoardRealtimeBootstrap — mounts the board-scoped Realtime subscription once
 * at the layout level so the channel stays alive across all view-kind navigations
 * (table → kanban → calendar → etc.).
 *
 * Renders nothing — it is a "side-effect component" pattern where we mount a
 * hook once at the layout boundary.
 *
 * Prior to Epic 12, useBoardRealtime was called inside <BoardTable />.
 * Moving it here means alt-view pages (kanban, calendar, …) receive realtime
 * updates without each mounting their own subscription.
 */

import { useBoard } from "@/hooks/use-board";
import { useBoardRealtime } from "@/hooks/use-board-realtime";

export function BoardRealtimeBootstrap() {
  const { board, userId } = useBoard();
  useBoardRealtime(board.id, userId);
  return null;
}
