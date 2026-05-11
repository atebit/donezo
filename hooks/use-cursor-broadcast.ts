"use client";

/**
 * use-cursor-broadcast.ts — emit-only hook for broadcasting the current user's
 * cursor position (hovered/focused cell) to other board participants.
 *
 * Subscribing to incoming cursors is handled by useBoardRealtime (S2).
 * This hook only emits.
 *
 * Channel: acquires `supabase.channel(boardChannelName(boardId))`. Supabase's
 * client caches channels by topic; calling .channel() with the same name as
 * useBoardRealtime returns the same instance — no duplicate subscriptions.
 *
 * On unmount: calls send.cancel() to clear any pending trailing throttle call.
 * Does NOT call removeChannel — useBoardRealtime owns the lifecycle.
 */

import { useEffect, useRef } from "react";
import { boardChannelName } from "@/lib/realtime/channel";
import { throttle } from "@/lib/realtime/throttle";
import { createClient } from "@/lib/supabase/client";
import type { CursorPayload } from "@/stores/types/realtime";

export function useCursorBroadcast(
  boardId: string,
  userId: string,
): { emit: (taskId: string, columnId: string) => void } {
  // Keep a stable ref to the throttled emitter across renders.
  const emitRef = useRef<((taskId: string, columnId: string) => void) & { cancel: () => void }>(
    null,
  );

  useEffect(() => {
    const supabase = createClient();
    // Supabase deduplicates channels by topic — same channel as useBoardRealtime.
    const channel = supabase.channel(boardChannelName(boardId));

    const send = throttle((taskId: string, columnId: string) => {
      // Q5: pause emit on hidden tabs — broadcasts are not meaningful on inactive tabs.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      channel.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          user_id: userId,
          task_id: taskId,
          column_id: columnId,
          at: Date.now(),
        } satisfies CursorPayload,
      });
    }, 100);

    emitRef.current = send;

    return () => {
      send.cancel();
      emitRef.current = null;
    };
  }, [boardId, userId]);

  const emit = (taskId: string, columnId: string): void => {
    emitRef.current?.(taskId, columnId);
  };

  return { emit };
}
