"use client";

/**
 * components/shared/topbar/NotificationsBootstrap.tsx
 *
 * Client-only component that:
 *  1. Hydrates the notification store with server-fetched initial state.
 *  2. Mounts the per-user Realtime channel (use-notifications-realtime).
 *
 * Rendered by the (app) layout server component so it can receive SSR data
 * without needing a client boundary at the layout level.
 *
 * Renders nothing visible — it's a pure side-effect component.
 */

import { useEffect } from "react";
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime";
import type { AnyNotification } from "@/stores/notification-store";
import { useNotificationStore } from "@/stores/notification-store";

type Props = {
  userId: string;
  initialNotifications: AnyNotification[];
  initialUnreadCount: number;
  workspaceSlug?: string;
};

export function NotificationsBootstrap({
  userId,
  initialNotifications,
  initialUnreadCount,
}: Props) {
  const hydrate = useNotificationStore((s) => s.hydrate);

  // Hydrate the store once on mount with server-side data.
  // We intentionally omit deps — hydrate is idempotent (second call is a no-op)
  // and the props are always the same values from a single SSR snapshot.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-once effect
  useEffect(() => {
    hydrate(initialNotifications, initialUnreadCount);
  }, []); // intentionally run only once

  // Mount the realtime channel
  useNotificationsRealtime(userId);

  return null;
}
