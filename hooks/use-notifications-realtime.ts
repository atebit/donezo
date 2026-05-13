"use client";

/**
 * hooks/use-notifications-realtime.ts
 *
 * Subscribes to the `notifications:<userId>` Supabase Realtime channel and
 * appends new rows into the notification store.
 *
 * Contract (from slice spec):
 *  - Channel name: `notifications:<userId>`
 *  - Filter: INSERT only, `user_id=eq.<userId>`
 *  - Idempotent by id (store.appendIfNew handles dedup).
 *  - Tears down cleanly on unmount.
 *  - Must NOT modify useBoardRealtime — completely separate channel.
 */

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AnyNotification } from "@/stores/notification-store";
import { useNotificationStore } from "@/stores/notification-store";

export function useNotificationsRealtime(userId: string): void {
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channelName = `notifications:${userId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as AnyNotification;
          if (row?.id) {
            useNotificationStore.getState().appendIfNew(row);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
