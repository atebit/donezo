import { redirect } from "next/navigation";
import { loadBoardSnapshot } from "@/lib/board/load-board-snapshot";

/**
 * Board index page — thin redirect RSC.
 *
 * Resolves the active view (URL → last_view_per_board → "Main table" → first)
 * and immediately redirects to the per-kind route:
 *   /w/<slug>/b/<id>/<kind>?view=<id>
 *
 * This makes `/w/.../b/<id>` always a 1-hop redirect. The per-kind routes
 * (table/page.tsx, kanban/page.tsx, etc.) contain the actual board body.
 *
 * Epic 12, Slice A — Q1 (open question 1 resolution).
 */
export default async function BoardIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; boardId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceSlug, boardId } = await params;
  const sp = await searchParams;

  // Normalize searchParams to string values (Next.js 15 delivers arrays when
  // a param appears multiple times; we take the first).
  const normalizedSp: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") normalizedSp[k] = v;
    else if (Array.isArray(v) && v.length > 0 && v[0] !== undefined) normalizedSp[k] = v[0];
  }

  const snap = await loadBoardSnapshot({
    boardId,
    searchParamViewId: normalizedSp.view,
  });

  const activeView = snap.views.find((v) => v.id === snap.activeViewId);
  const kind = activeView?.kind ?? "table";

  // Preserve all existing URL params (filter, sort, group, search, density, view).
  const urlParams = new URLSearchParams(normalizedSp);
  if (snap.activeViewId) {
    urlParams.set("view", snap.activeViewId);
  } else {
    urlParams.delete("view");
  }

  const qs = urlParams.toString();
  redirect(`/w/${workspaceSlug}/b/${boardId}/${kind}${qs ? `?${qs}` : ""}`);
}
