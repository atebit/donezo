/**
 * Shared helpers for activity renderers.
 * Internal to the renderers/ directory — not re-exported from index.ts.
 */

import type React from "react";
import type { ProfileRow } from "./index";

// ---------------------------------------------------------------------------
// ActivityLine — the inline sentence format for activity rows.
// ---------------------------------------------------------------------------

interface ActivityLineProps {
  /** Resolved display name for the actor. */
  actor: string;
  children: React.ReactNode;
}

/**
 * Renders "Actor did something" — the canonical inline sentence for activity items.
 * Children contain the action description (verb + context).
 */
export function ActivityLine({ actor, children }: ActivityLineProps) {
  return (
    <span className="text-sm text-fg" data-testid="activity-line">
      <span className="font-medium">{actor}</span> {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// resolveActor — look up a display name from the profiles map.
// ---------------------------------------------------------------------------

export function resolveActor(
  actorId: string | null | undefined,
  profiles: Map<string, ProfileRow>,
): string {
  if (!actorId) return "Someone";
  const p = profiles.get(actorId);
  return p?.display_name ?? p?.email ?? "Someone";
}

// ---------------------------------------------------------------------------
// getPayloadField — safe JSON payload accessor.
// ---------------------------------------------------------------------------

export function getPayloadField<T = unknown>(payload: unknown, key: string): T | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  return (payload as Record<string, unknown>)[key] as T | undefined;
}
