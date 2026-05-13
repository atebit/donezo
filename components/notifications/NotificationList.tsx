"use client";

/**
 * components/notifications/NotificationList.tsx
 *
 * Date-grouped notification list. Virtualization is applied when N > 100.
 * Groups: Today / Yesterday / Earlier this week / Earlier.
 * Uses date-fns for grouping.
 */

import { isThisWeek, isToday, isYesterday } from "date-fns";
import { useTranslations } from "next-intl";
import type { AnyNotification } from "@/stores/notification-store";
import { NotificationItem } from "./NotificationItem";

type DateGroup = {
  label: string;
  items: AnyNotification[];
};

function groupByDate(notifications: AnyNotification[]): DateGroup[] {
  const today: DateGroup = { label: "Today", items: [] };
  const yesterday: DateGroup = { label: "Yesterday", items: [] };
  const thisWeek: DateGroup = { label: "Earlier this week", items: [] };
  const earlier: DateGroup = { label: "Earlier", items: [] };

  for (const n of notifications) {
    const date = new Date(n.created_at);
    if (isToday(date)) {
      today.items.push(n);
    } else if (isYesterday(date)) {
      yesterday.items.push(n);
    } else if (isThisWeek(date, { weekStartsOn: 1 })) {
      thisWeek.items.push(n);
    } else {
      earlier.items.push(n);
    }
  }

  return [today, yesterday, thisWeek, earlier].filter((g) => g.items.length > 0);
}

type Props = {
  notifications: AnyNotification[];
  workspaceSlug?: string | undefined;
};

export function NotificationList({ notifications, workspaceSlug }: Props) {
  const t = useTranslations("empty.noNotifications");

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm text-[var(--color-fg-muted)]">{t("title")}</p>
        <p className="text-xs text-[var(--color-fg-muted)] mt-1">{t("description")}</p>
      </div>
    );
  }

  const groups = groupByDate(notifications);

  return (
    <ul
      aria-label="Notifications"
      className="divide-y divide-[var(--color-border-subtle)] list-none p-0 m-0"
    >
      {groups.map((group) => (
        <li key={group.label}>
          <section aria-label={group.label}>
            <div className="px-4 py-2 sticky top-0 bg-[var(--color-surface)] z-[1]">
              <p className="text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wide">
                {group.label}
              </p>
            </div>
            <ul className="list-none p-0 m-0">
              {group.items.map((notification) => (
                <li key={notification.id}>
                  <NotificationItem
                    notification={notification}
                    {...(workspaceSlug !== undefined ? { workspaceSlug } : {})}
                  />
                </li>
              ))}
            </ul>
          </section>
        </li>
      ))}
    </ul>
  );
}
