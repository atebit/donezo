"use client";

/**
 * ActivityList — renders a list of activity events.
 *
 * Accepts pre-fetched events from the parent component:
 *   - Task scope: parent passes selectTaskActivity(state, taskId) from the store.
 *   - Board scope: parent passes paginated state from listBoardActivity.
 *
 * Visual spec (component-system §4.2, dispatch D.5):
 *   Row height 60px, padding 8px 0, 1px bottom border var(--color-shadow-card).
 *   Avatar 30×30, font-size 16px.
 *
 * The scope prop differentiates rendering context but doesn't affect rendering —
 * it's available for analytics and a11y labeling.
 */

import type { ActivityRow } from "@/stores/types/comments";
import { ActivityItem } from "./ActivityItem";
import type { ActivityRenderCtx } from "./renderers/index";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityListProps {
  /** Scoping discriminant — "task" for the task drawer; "board" for the board modal. */
  scope: { kind: "task"; taskId: string } | { kind: "board"; boardId: string };
  /** Pre-fetched events — parent decides where they come from. */
  events: ActivityRow[];
  ctx: ActivityRenderCtx;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityList({ scope, events, ctx }: ActivityListProps) {
  if (events.length === 0) {
    return (
      <div className="text-center text-fg-muted text-sm py-8" data-testid="activity-list-empty">
        No activity yet.
      </div>
    );
  }

  const ariaLabel = scope.kind === "task" ? "Task activity" : "Board activity";

  return (
    <ul
      aria-label={ariaLabel}
      data-testid={`activity-list-${scope.kind}`}
      className="list-none p-0 m-0"
    >
      {events.map((event) => (
        <ActivityItem key={event.id} event={event} ctx={ctx} />
      ))}
    </ul>
  );
}
