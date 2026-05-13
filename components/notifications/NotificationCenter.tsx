"use client";

/**
 * components/notifications/NotificationCenter.tsx
 *
 * Base UI Popover containing three tabs: All / Unread / Mentions.
 * Anchored to the bell button. Rendered inside NotificationBell.
 */

import { Popover } from "@base-ui/react/popover";
import { useState } from "react";
import { toast } from "sonner";
import { markAllRead } from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";
import {
  useAllNotifications,
  useMentionNotifications,
  useNotificationStore,
  useUnreadNotifications,
} from "@/stores/notification-store";
import { NotificationList } from "./NotificationList";

type Tab = "all" | "unread" | "mentions";

type Props = {
  workspaceSlug?: string | undefined;
};

export function NotificationCenter({ workspaceSlug }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const allNotifications = useAllNotifications();
  const unreadNotifications = useUnreadNotifications();
  const mentionNotifications = useMentionNotifications();
  const markAllReadLocal = useNotificationStore((s) => s.markAllRead);

  const notifications =
    activeTab === "unread"
      ? unreadNotifications
      : activeTab === "mentions"
        ? mentionNotifications
        : allNotifications;

  async function handleMarkAllRead() {
    setIsMarkingAll(true);
    markAllReadLocal(); // optimistic
    try {
      const result = await markAllRead(undefined);
      if (!result.ok) {
        toast.error("Failed to mark all as read.");
      }
    } catch {
      toast.error("Failed to mark all as read.");
    } finally {
      setIsMarkingAll(false);
    }
  }

  const tabButtonClass = (tab: Tab) =>
    `px-3 py-1.5 text-sm rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ${
      activeTab === tab
        ? "bg-[var(--color-surface-raised)] text-[var(--color-fg-strong)] font-medium"
        : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-base)] hover:bg-[var(--color-surface-raised)]"
    }`;

  return (
    <Popover.Portal>
      <Popover.Positioner
        side="bottom"
        align="end"
        sideOffset={8}
        style={{ zIndex: "var(--z-popover)" as unknown as number }}
      >
        <Popover.Popup
          style={{
            width: 380,
            maxHeight: 520,
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-popover)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-subtle)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 border-b border-[var(--color-border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--color-fg-strong)]">Notifications</h2>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleMarkAllRead}
              disabled={isMarkingAll || unreadNotifications.length === 0}
            >
              Mark all read
            </Button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-3 py-2 shrink-0">
            <button
              type="button"
              className={tabButtonClass("all")}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>
            <button
              type="button"
              className={tabButtonClass("unread")}
              onClick={() => setActiveTab("unread")}
            >
              Unread
              {unreadNotifications.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[var(--color-brand)] text-white text-xs px-1.5 py-0.5 leading-none">
                  {unreadNotifications.length}
                </span>
              )}
            </button>
            <button
              type="button"
              className={tabButtonClass("mentions")}
              onClick={() => setActiveTab("mentions")}
            >
              Mentions
            </button>
          </div>

          {/* List — scrollable */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            <NotificationList
              notifications={notifications}
              {...(workspaceSlug !== undefined ? { workspaceSlug } : {})}
            />
          </div>

          {/* Footer link */}
          <div className="shrink-0 border-t border-[var(--color-border-subtle)] px-4 py-2">
            <a
              href="/notifications"
              className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg-base)] transition-colors"
            >
              View all notifications
            </a>
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}
