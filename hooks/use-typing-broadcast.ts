"use client";

import { useCallback, useEffect, useRef } from "react";
import { boardChannelName } from "@/lib/realtime/channel";
import { throttle } from "@/lib/realtime/throttle";
import type { TypingPayload } from "@/lib/realtime/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Emits a typing event for a given context (e.g. `comment:<task_id>`).
 * Throttled to one emit per 2000ms. Pauses on hidden tabs.
 *
 * Returns an `emit()` function the caller invokes on every keystroke;
 * the throttle handles the rest. No automatic "stopped typing" event —
 * the reader hook expires entries after 5s of silence.
 *
 * Acquires the same-named `board:<boardId>` channel that useBoardRealtime
 * already holds; Supabase deduplicates same-named channels within a client.
 *
 * First consumer lands in Epic 09 (CommentComposer).
 */
export function useTypingBroadcast(args: {
  boardId: string;
  userId: string;
  context: string; // e.g. `comment:<task_id>`
}): { emit: () => void } {
  const { boardId, userId, context } = args;

  // Keep a stable ref to the throttled send function so it can be cancelled on unmount.
  const throttledRef = useRef<(((...a: unknown[]) => void) & { cancel: () => void }) | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // Acquires the same-named channel as useBoardRealtime — Supabase deduplicates
    // same-named channels within a single browser client instance.
    const channel = supabase.channel(boardChannelName(boardId));

    const sendPayload = () => {
      // Visibility gate: do not emit when the tab is hidden
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      const payload: TypingPayload = {
        user_id: userId,
        context,
        at: Date.now(),
      } satisfies TypingPayload;

      channel.send({
        type: "broadcast",
        event: "typing",
        payload,
      });
    };

    const throttledSend = throttle(sendPayload, 2000);
    throttledRef.current = throttledSend;

    return () => {
      // useBoardRealtime owns channel lifecycle; we only cancel pending sends here.
      throttledRef.current?.cancel();
      throttledRef.current = null;
    };
  }, [boardId, userId, context]);

  const emit = useCallback(() => {
    throttledRef.current?.();
  }, []);

  return { emit };
}
