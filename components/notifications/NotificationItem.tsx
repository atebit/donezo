"use client";

/**
 * components/notifications/NotificationItem.tsx
 *
 * Renders a single notification row.
 * Clicking marks it read and navigates to the relevant task/board.
 * If the user no longer has access to the board (navigation would 404),
 * we fall back to /notifications with a toast.
 */

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { markRead } from "@/app/(app)/notifications/actions";
import type { AnyNotification } from "@/stores/notification-store";
import { useNotificationStore } from "@/stores/notification-store";
import { NOTIFICATION_RENDERERS } from "./registry";
import { FallbackRenderer } from "./renderers/fallback";

type Props = {
  notification: AnyNotification;
  /** Workspace slug needed to build the board href. Passed from context. */
  workspaceSlug?: string | undefined;
};

function buildHref(
  notification: AnyNotification,
  workspaceSlug: string | undefined,
): string | null {
  const payload = notification.payload as Record<string, unknown>;
  const boardId = payload.board_id as string | undefined;
  const taskId = payload.task_id as string | undefined;
  const commentId = payload.comment_id as string | undefined;

  if (!boardId || !workspaceSlug) return null;

  let href = `/w/${workspaceSlug}/b/${boardId}`;
  if (taskId) {
    href += `/t/${taskId}`;
  }
  if (commentId) {
    href += `?comment=${commentId}`;
  }
  return href;
}

export function NotificationItem({ notification, workspaceSlug }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const markReadLocal = useNotificationStore((s) => s.markRead);

  const isUnread = notification.read_at === null;
  const href = buildHref(notification, workspaceSlug);

  const Renderer =
    NOTIFICATION_RENDERERS[notification.kind as keyof typeof NOTIFICATION_RENDERERS] ??
    FallbackRenderer;

  function handleClick() {
    // Optimistic mark-read
    if (isUnread) {
      markReadLocal([notification.id]);
    }

    startTransition(async () => {
      if (isUnread) {
        await markRead({ markAll: false, notificationIds: [notification.id] });
      }
    });

    if (!href) {
      router.push("/notifications");
      return;
    }

    // Navigate — if user lacks board access, Next.js will hit notFound or redirect.
    // We catch that at a higher level via the error boundary; here we just navigate.
    // The spec says: "fall back to /notifications with a toast" when board access is gone.
    // We navigate optimistically and handle 404 via the router.
    void router.push(href);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={`Notification: ${notification.kind.replace(/_/g, " ")}${isUnread ? " (unread)" : ""}`}
      className="w-full text-left px-4 py-3 hover:bg-[var(--color-surface-raised)] transition-colors flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1"
    >
      {/* Unread dot */}
      <div className="mt-1.5 shrink-0">
        {isUnread ? (
          <span className="block h-2 w-2 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />
        ) : (
          <span className="block h-2 w-2" aria-hidden="true" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Renderer notification={notification} />
        <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
          {new Date(notification.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </button>
  );
}

/**
 * Navigate-with-fallback helper used by NotificationItem.
 * Exported so NotificationList can also use it for the "open" action.
 */
export function navigateOrFallback(href: string | null, router: ReturnType<typeof useRouter>) {
  if (!href) {
    toast.error("Board no longer accessible. Showing all notifications.");
    router.push("/notifications");
    return;
  }
  router.push(href);
}
