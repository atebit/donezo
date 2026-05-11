"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { boardChannelName } from "@/lib/realtime/channel";
import type { CursorPayload, PresenceState, TypingPayload } from "@/lib/realtime/types";
import { createClient } from "@/lib/supabase/client";
import { useBoardStore } from "@/stores/board-store";

/**
 * useBoardRealtime — owns the entire board-scoped Realtime lifecycle.
 *
 * Subscribes to:
 *  - postgres_changes for task, group, column, cell (all filtered by board_id)
 *  - presence for membership (sync event drives setPresence)
 *  - broadcast for cursor and typing events
 *
 * Lifecycle:
 *  - On SUBSCRIBED after reconnecting: calls router.refresh() to rehydrate RSC
 *    tree, then marks connected and tracks the user's presence.
 *  - On TIMED_OUT / CHANNEL_ERROR: marks reconnecting and clears stale presence.
 *  - Cleans up channel and sweeper interval on unmount or [boardId, userId] change.
 *
 * comment postgres_changes deferred to epic 09
 */
export function useBoardRealtime(boardId: string, userId: string): void {
  const router = useRouter();
  // Track previous subscribe status to detect the reconnect transition
  const previousStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Open one channel for the entire board
    const channel = supabase.channel(boardChannelName(boardId), {
      config: {
        broadcast: { self: false },
        presence: { key: userId },
      },
    });

    // ------------------------------------------------------------------
    // Postgres changes — task
    // ------------------------------------------------------------------
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "task",
        filter: `board_id=eq.${boardId}`,
      },
      (e: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
        const store = useBoardStore.getState();
        if (e.eventType === "INSERT" || e.eventType === "UPDATE") {
          store.applyTaskUpsert(e.new as Parameters<typeof store.applyTaskUpsert>[0]);
        } else if (e.eventType === "DELETE") {
          const id = (e.old as { id?: string }).id;
          if (id) {
            store.applyTaskDelete(id);
          }
        }
      },
    );

    // ------------------------------------------------------------------
    // Postgres changes — group
    // ------------------------------------------------------------------
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "group",
        filter: `board_id=eq.${boardId}`,
      },
      (e: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
        const store = useBoardStore.getState();
        if (e.eventType === "INSERT" || e.eventType === "UPDATE") {
          store.applyGroupUpsert(e.new as Parameters<typeof store.applyGroupUpsert>[0]);
        } else if (e.eventType === "DELETE") {
          const id = (e.old as { id?: string }).id;
          if (id) {
            store.applyGroupDelete(id);
          }
        }
      },
    );

    // ------------------------------------------------------------------
    // Postgres changes — column
    // ------------------------------------------------------------------
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "column",
        filter: `board_id=eq.${boardId}`,
      },
      (e: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
        const store = useBoardStore.getState();
        if (e.eventType === "INSERT" || e.eventType === "UPDATE") {
          store.applyColumnUpsert(e.new as Parameters<typeof store.applyColumnUpsert>[0]);
        } else if (e.eventType === "DELETE") {
          const id = (e.old as { id?: string }).id;
          if (id) {
            store.applyColumnDelete(id);
          }
        }
      },
    );

    // ------------------------------------------------------------------
    // Postgres changes — cell
    // cell DELETEs: no store method exists for direct cell deletion.
    // Cells are removed client-side as a cascade from applyColumnDelete /
    // applyTaskDelete when their parent is deleted. Log a warn in dev if
    // a bare cell DELETE arrives (unexpected in our model).
    // ------------------------------------------------------------------
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cell",
        filter: `board_id=eq.${boardId}`,
      },
      (e: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
        const store = useBoardStore.getState();
        if (e.eventType === "INSERT" || e.eventType === "UPDATE") {
          store.applyCellUpsert(e.new as Parameters<typeof store.applyCellUpsert>[0]);
        } else if (e.eventType === "DELETE") {
          // No store method exists for direct cell deletion — cells are removed
          // client-side via cascade in applyColumnDelete / applyTaskDelete.
          if (process.env.NODE_ENV !== "production") {
            // biome-ignore lint/suspicious/noConsole: dev-only diagnostic for unexpected cell DELETE
            console.warn(
              "[useBoardRealtime] Received unexpected cell DELETE event. " + "Cell id:",
              (e.old as { id?: string }).id,
              "— No store method; relies on parent cascade.",
            );
          }
        }
      },
    );

    // comment postgres_changes deferred to epic 09

    // ------------------------------------------------------------------
    // Presence — sync is the canonical event; join/leave are no-ops
    // ------------------------------------------------------------------
    channel.on("presence", { event: "sync" }, () => {
      useBoardStore.getState().setPresence(channel.presenceState() as PresenceState);
    });

    channel.on("presence", { event: "join" }, () => {
      // no-op: sync event always carries the canonical state
    });

    channel.on("presence", { event: "leave" }, () => {
      // no-op: sync event always carries the canonical state
    });

    // ------------------------------------------------------------------
    // Broadcast — cursor and typing events from other clients
    // ------------------------------------------------------------------
    channel.on("broadcast", { event: "cursor" }, ({ payload }: { payload: unknown }) => {
      useBoardStore.getState().setCursor(payload as CursorPayload);
    });

    channel.on("broadcast", { event: "typing" }, ({ payload }: { payload: unknown }) => {
      useBoardStore.getState().setTyping(payload as TypingPayload);
    });

    // ------------------------------------------------------------------
    // Subscribe + lifecycle
    // ------------------------------------------------------------------
    channel.subscribe(async (status: string) => {
      const store = useBoardStore.getState();

      if (status === "SUBSCRIBED") {
        // If recovering from a disconnect, refresh the RSC tree to rehydrate
        // server data before marking connected. This re-runs BoardPage's RSC
        // and triggers BoardTable's mount-time hydrate() call.
        // No revalidateTag, no server action, no cache layer.
        if (previousStatusRef.current === "reconnecting") {
          router.refresh();
        }

        previousStatusRef.current = "connected";
        store.setConnectionStatus("connected");

        // Track this user's presence on the board
        await channel.track({
          user_id: userId,
          online_at: Date.now(),
          viewing: { type: "board" },
        });
      } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
        previousStatusRef.current = "reconnecting";
        store.setConnectionStatus("reconnecting");
        // Clear stale presence so stale avatars don't linger
        store.setPresence({});
      }
      // CLOSED fires on intentional unsubscribe only — no action needed
    });

    // ------------------------------------------------------------------
    // Cursor + typing expiry sweeper (runs every 2s)
    // ------------------------------------------------------------------
    const sweepInterval = setInterval(() => {
      const store = useBoardStore.getState();
      store.pruneExpiredCursors(Date.now(), 5000);
      store.pruneExpiredTyping(Date.now(), 5000);
    }, 2000);

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------
    return () => {
      clearInterval(sweepInterval);
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [boardId, userId, router]);
}
