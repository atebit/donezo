/**
 * ActivityList — stub for Slice E type-checking.
 * Slice D owns this file and will replace it with the full implementation.
 *
 * DO NOT edit this stub. Slice D will overwrite it entirely.
 */
"use client";

import type { ActivityRenderCtx } from "@/components/activity/renderers";
import type { ActivityRow } from "@/stores/types/comments";

interface ActivityListProps {
  scope: { kind: "task"; taskId: string } | { kind: "board"; boardId: string };
  /** Pre-fetched events. Parent decides where they come from. */
  events: ActivityRow[];
  ctx: ActivityRenderCtx;
}

export function ActivityList({ events }: ActivityListProps) {
  if (events.length === 0) {
    return null;
  }
  // Placeholder — Slice D replaces this with the full renderer
  return (
    <ul aria-label="Activity events">
      {events.map((e) => (
        <li key={e.id} className="py-2 text-sm text-[color:var(--color-fg-muted)]">
          {e.type} — {e.created_at}
        </li>
      ))}
    </ul>
  );
}
