"use client";

/**
 * UpdatesTab — comments tab for the inline item drawer (Epic 16 / Slice G).
 *
 * Read-only view of comments already hydrated into the board store via the
 * task-drawer route (epic 09). The full composer lives in the route-based
 * TaskDrawer; here we show a read-only list with a "Open full view" link
 * and stub the composer with a notice per the slice spec.
 *
 * Forbidden scope: comments composer logic.
 */

import { formatDistanceToNow } from "date-fns";
import { MessageSquareIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { selectCommentsForTask, useBoardStore } from "@/stores/board-store";

interface UpdatesTabProps {
  taskId: string;
}

export function UpdatesTab({ taskId }: UpdatesTabProps) {
  const comments = useBoardStore(useShallow((s) => selectCommentsForTask(s, taskId)));

  if (comments.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center"
        data-testid="updates-tab-empty"
      >
        <MessageSquareIcon
          className="text-[color:var(--color-fg-muted)] opacity-40"
          size={32}
          aria-hidden="true"
        />
        <p className="text-sm text-[color:var(--color-fg-muted)] max-w-[240px]">
          No updates yet — share progress, mention a teammate, or upload a file to get things
          moving.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="updates-tab-list">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="rounded border border-[color:var(--color-border-strong)] p-3"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-[color:var(--color-fg-muted)]">
              {comment.author_id ?? "Unknown"}
            </span>
            <time
              dateTime={comment.created_at}
              className="text-xs text-[color:var(--color-fg-muted)]"
            >
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </time>
          </div>
          <p className="text-sm text-[color:var(--color-fg)] whitespace-pre-wrap break-words">
            {comment.body_text}
          </p>
        </div>
      ))}
    </div>
  );
}
