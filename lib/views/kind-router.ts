import type { ViewRow } from "@/stores/types/views";

/**
 * Map a view.kind to its URL segment.
 * `table` maps to "" (the bare board route — `/b/[boardId]` with no suffix).
 * All other kinds map to themselves.
 */
export function viewKindToSegment(kind: string): string {
  if (kind === "table") return "";
  return kind; // kanban, calendar, timeline, dashboard, form
}

/**
 * Extract the view kind from a pathname.
 * Returns the kind string, or "table" when no alt-kind segment is present
 * (i.e. the bare board route `/w/<slug>/b/<id>`).
 *
 * Examples:
 *   /w/acme/b/board-123            → "table"
 *   /w/acme/b/board-123/kanban     → "kanban"
 *   /w/acme/b/board-123/kanban?view=abc → "kanban"
 *   /w/acme/b/board-123/calendar   → "calendar"
 */
export function kindFromPathname(pathname: string): string {
  const m = pathname.match(/\/b\/[^/]+\/([a-z]+)(?:$|\?)/);
  if (!m || m[1] === undefined) return "table";
  const seg: string = m[1];
  if (["kanban", "calendar", "timeline", "dashboard", "form"].includes(seg)) return seg;
  return "table";
}

/**
 * Build a full board view URL.
 * Produces: /w/<workspaceSlug>/b/<boardId>/<kindSegment>?view=<viewId>
 * For the table kind, produces: /w/<workspaceSlug>/b/<boardId>?view=<viewId>
 */
export function buildViewUrl(workspaceSlug: string, boardId: string, view: ViewRow): string {
  const seg = viewKindToSegment(view.kind);
  const base = `/w/${workspaceSlug}/b/${boardId}${seg ? `/${seg}` : ""}`;
  return `${base}?view=${view.id}`;
}
