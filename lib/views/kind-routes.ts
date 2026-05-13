/**
 * kind-routes.ts — pure helpers for mapping between view kinds and URL paths.
 *
 * These are the canonical functions imported by `useBoardView` and any per-kind
 * page that needs to build or parse kind-aware board URLs.
 *
 * Canonical path structure: /w/<workspaceSlug>/b/<boardId>/<kind>?view=<viewId>
 *   - `table` maps to the `/table` segment (not the bare board route).
 *   - All other kinds map to themselves.
 */

import type { ViewKind } from "@/lib/views/config-schema";

const KNOWN_KINDS: ViewKind[] = ["table", "kanban", "calendar", "timeline", "dashboard", "form"];

/**
 * Extract the view kind from a pathname.
 * Returns the kind string, or "table" when no matching kind segment is present.
 *
 * Examples:
 *   /w/acme/b/board-123/table          → "table"
 *   /w/acme/b/board-123/kanban         → "kanban"
 *   /w/acme/b/board-123/kanban?view=x  → "kanban"
 */
export function kindFromPath(pathname: string): ViewKind {
  const m = pathname.match(/\/b\/[^/]+\/([a-z]+)(?:[/?]|$)/);
  if (!m) return "table";
  const seg = m[1] as ViewKind;
  if (KNOWN_KINDS.includes(seg)) return seg;
  return "table";
}

/**
 * Build a full board view URL for a given kind.
 *
 * Produces: /w/<workspaceSlug>/b/<boardId>/<kind>?view=<viewId>
 */
export function pathForKind(
  kind: ViewKind,
  workspaceSlug: string,
  boardId: string,
  viewId?: string,
): string {
  const base = `/w/${workspaceSlug}/b/${boardId}/${kind}`;
  return viewId ? `${base}?view=${viewId}` : base;
}
