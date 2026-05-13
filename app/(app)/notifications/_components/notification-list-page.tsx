"use client";

/**
 * Client component wrapper for the /notifications full-page view.
 * Syncs the server-fetched notifications into the store (idempotent),
 * then renders the notification list.
 */

import { useEffect } from "react";
import { NotificationList } from "@/components/notifications/NotificationList";
import { useWorkspaceMaybe } from "@/hooks/use-workspace";
import type { AnyNotification } from "@/stores/notification-store";
import { useAllNotifications, useNotificationStore } from "@/stores/notification-store";

type Props = {
  notifications: AnyNotification[];
};

export function NotificationListPage({ notifications: serverNotifications }: Props) {
  const hydrate = useNotificationStore((s) => s.hydrate);
  const hydrated = useNotificationStore((s) => s.hydrated);

  // Hydrate store if not yet done (user landed directly on this page)
  useEffect(() => {
    if (!hydrated) {
      const unreadCount = serverNotifications.filter((n) => n.read_at === null).length;
      hydrate(serverNotifications.slice(0, 50), unreadCount);
    }
  }, [hydrated, serverNotifications, hydrate]);

  const storeNotifications = useAllNotifications();
  const workspaceCtx = useWorkspaceMaybe();
  const workspaceSlug = workspaceCtx?.workspace.slug;

  // Show the longer server list on this full page; fall back to store if populated
  const displayed = hydrated ? storeNotifications : serverNotifications;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Notifications</h1>
      <NotificationList
        notifications={displayed}
        {...(workspaceSlug !== undefined ? { workspaceSlug } : {})}
      />
    </main>
  );
}
