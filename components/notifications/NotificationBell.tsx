"use client";

/**
 * components/notifications/NotificationBell.tsx
 *
 * Live notification bell. Replaces NotificationBellStub in the topbar.
 *
 * Features:
 *  - Shows unread count badge (hidden when 0).
 *  - Clicking opens the NotificationCenter popover (Base UI Popover).
 *  - Aria-live region announces badge count changes.
 */

import { Popover } from "@base-ui/react/popover";
import { Bell } from "lucide-react";
import { useUnreadCount } from "@/stores/notification-store";
import { NotificationCenter } from "./NotificationCenter";

type Props = {
  workspaceSlug?: string | undefined;
};

export function NotificationBell({ workspaceSlug }: Props) {
  const unreadCount = useUnreadCount();

  return (
    <Popover.Root>
      {/* Accessible live region for screen readers */}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {unreadCount > 0 ? `${unreadCount} unread notifications` : "No unread notifications"}
      </span>

      <Popover.Trigger
        aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : "Notifications"}
        className="relative flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg-base)] hover:bg-[var(--color-surface-raised)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1"
      >
        <Bell size={16} aria-hidden />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-brand)] text-white text-[10px] font-medium leading-none"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Popover.Trigger>

      <NotificationCenter workspaceSlug={workspaceSlug} />
    </Popover.Root>
  );
}
