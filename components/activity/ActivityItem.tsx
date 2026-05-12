"use client";

/**
 * ActivityItem — renders a single activity log row.
 *
 * Visual spec (component-system §4.2, dispatch D.5):
 *   - Row height 60px, padding 8px 0, 1px bottom border var(--color-shadow-card).
 *   - Avatar 30×30, font-size 16px.
 *   - Uses the activity renderer registry to produce the inline sentence.
 *   - Falls back to generic "[actor] performed [type]" with <details> for unknown types.
 */

import { Avatar } from "@/components/shared/Avatar";
import type { ActivityRow } from "@/stores/types/comments";
import { type ActivityRenderCtx, activityRenderers } from "./renderers/index";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityItemProps {
  event: ActivityRow;
  ctx: ActivityRenderCtx;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityItem({ event, ctx }: ActivityItemProps) {
  const renderer = activityRenderers[event.type];

  // Resolve actor profile for the avatar
  const actorProfile = event.actor_id ? ctx.profiles.get(event.actor_id) : undefined;
  const actorName = actorProfile?.display_name ?? actorProfile?.email ?? "Someone";

  // Format timestamp
  let timeLabel = "";
  try {
    timeLabel = new Date(event.created_at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    timeLabel = event.created_at;
  }

  return (
    <li
      className="flex items-center gap-3 border-b border-[color:var(--color-shadow-card)]"
      style={{ minHeight: 60, padding: "8px 0", fontSize: 16 }}
      data-testid={`activity-item-${event.id}`}
    >
      {/* Avatar */}
      <div className="shrink-0">
        <Avatar src={actorProfile?.avatar_url ?? null} displayName={actorName} size={30} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {renderer ? (
          renderer(event, ctx)
        ) : (
          // Generic fallback for unknown activity types
          <GenericActivityFallback event={event} actorName={actorName} />
        )}
      </div>

      {/* Timestamp */}
      <time className="text-xs text-fg-muted shrink-0" dateTime={event.created_at}>
        {timeLabel}
      </time>
    </li>
  );
}

// ---------------------------------------------------------------------------
// GenericActivityFallback — shown when no renderer is registered for a type.
// ---------------------------------------------------------------------------

interface GenericActivityFallbackProps {
  event: ActivityRow;
  actorName: string;
}

function GenericActivityFallback({ event, actorName }: GenericActivityFallbackProps) {
  return (
    <span className="text-sm text-fg" data-testid="activity-fallback">
      <span className="font-medium">{actorName}</span> performed{" "}
      <code className="text-xs bg-[color:var(--color-surface-hover)] px-1 py-0.5 rounded">
        {event.type}
      </code>
      {event.payload && (
        <details className="inline-block ml-2">
          <summary className="text-xs text-fg-muted cursor-pointer hover:text-fg">
            (details)
          </summary>
          <pre className="text-xs bg-[color:var(--color-surface-hover)] p-2 rounded mt-1 max-w-[400px] overflow-auto">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </details>
      )}
    </span>
  );
}
