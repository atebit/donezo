"use client";

/**
 * stores/notification-store.ts
 *
 * Zustand store for in-app notifications.
 *
 * Design notes:
 *  - Initial state is hydrated server-side via NotificationsBootstrap.
 *  - Realtime channel (use-notifications-realtime) appends new rows idempotently.
 *  - All selectors returning arrays/objects are wrapped in useShallow per the
 *    Donezo memory rule (donezo-zustand-v5-selectors.md).
 *  - markAllRead optimistically zeros the unread count and stamps read_at on
 *    the local rows; the server action commits the change.
 */

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { NotificationKind } from "@/lib/notifications/kinds";
import type { TypedNotification } from "@/lib/notifications/types";

// We store notifications as the raw DB shape (kind = string) but we narrow to
// TypedNotification for the public API.
export type AnyNotification = TypedNotification<NotificationKind>;

export type NotificationState = {
  /** Up to 50 most-recent notifications, ordered newest-first. */
  notifications: AnyNotification[];
  /** Unread count (authoritative on server; optimistic on client). */
  unreadCount: number;
  /** True after the server hydration has been applied. */
  hydrated: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Called once from NotificationsBootstrap with the SSR-fetched initial data. */
  hydrate: (notifications: AnyNotification[], unreadCount: number) => void;

  /** Idempotent — called by the realtime hook on INSERT. */
  appendIfNew: (notification: AnyNotification) => void;

  /** Mark specific notifications as read (optimistic). */
  markRead: (ids: string[]) => void;

  /** Mark all notifications as read (optimistic, zeros badge). */
  markAllRead: () => void;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  hydrated: false,

  hydrate(notifications, unreadCount) {
    // Only apply once; guard against accidental double-hydration.
    if (get().hydrated) return;
    set({ notifications, unreadCount, hydrated: true });
  },

  appendIfNew(notification) {
    const existing = get().notifications;
    if (existing.some((n) => n.id === notification.id)) return;
    const updated = [notification, ...existing].slice(0, 50);
    const wasUnread = notification.read_at === null;
    set({
      notifications: updated,
      unreadCount: get().unreadCount + (wasUnread ? 1 : 0),
    });
  },

  markRead(ids) {
    const now = new Date().toISOString();
    const idSet = new Set(ids);
    let readDelta = 0;
    const updated = get().notifications.map((n) => {
      if (idSet.has(n.id) && n.read_at === null) {
        readDelta++;
        return { ...n, read_at: now } as AnyNotification;
      }
      return n;
    });
    set({
      notifications: updated,
      unreadCount: Math.max(0, get().unreadCount - readDelta),
    });
  },

  markAllRead() {
    const now = new Date().toISOString();
    const updated = get().notifications.map((n) =>
      n.read_at === null ? ({ ...n, read_at: now } as AnyNotification) : n,
    );
    set({ notifications: updated, unreadCount: 0 });
  },
}));

// ── Selectors (useShallow-wrapped) ──────────────────────────────────────────

/** All notifications (newest-first). */
export function useAllNotifications() {
  return useNotificationStore(useShallow((s) => s.notifications));
}

/** Only unread notifications. */
export function useUnreadNotifications() {
  return useNotificationStore(useShallow((s) => s.notifications.filter((n) => n.read_at === null)));
}

/** Only mention notifications. */
export function useMentionNotifications() {
  return useNotificationStore(
    useShallow((s) => s.notifications.filter((n) => n.kind === "mention")),
  );
}

/** Current unread count (for the bell badge). */
export function useUnreadCount() {
  return useNotificationStore((s) => s.unreadCount);
}

/** Whether the store has been hydrated from the server. */
export function useNotificationsHydrated() {
  return useNotificationStore((s) => s.hydrated);
}
