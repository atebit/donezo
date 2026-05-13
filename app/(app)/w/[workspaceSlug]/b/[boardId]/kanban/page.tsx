/**
 * Kanban view page — /w/[workspaceSlug]/b/[boardId]/kanban
 *
 * RSC shell — mirrors table/page.tsx. Data is hydrated by <BoardDataProvider>
 * in the board layout (layout.tsx). This page passes the initial snapshot to
 * <KanbanBoard /> which reads live state from the board store.
 *
 * The `initial` prop is used only on first mount (hydration is idempotent and
 * keyed on boardId). Subsequent renders driven by Realtime updates come from
 * the store, not `initial`.
 *
 * Epic 12, Slice B.
 */

import { KanbanBoard } from "@/components/board/kanban/KanbanBoard";
import { loadBoardSnapshot } from "@/lib/board/load-board-snapshot";

export default async function KanbanPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; boardId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { boardId } = await params;
  const sp = await searchParams;
  const viewId = typeof sp.view === "string" ? sp.view : undefined;

  const snap = await loadBoardSnapshot({ boardId, searchParamViewId: viewId });

  return (
    <KanbanBoard
      boardId={boardId}
      initial={{
        groups: snap.groups,
        tasks: snap.tasks,
        cells: snap.cells,
        columns: snap.columns,
        attachments: snap.attachments,
        views: snap.views,
        activeViewId: snap.activeViewId,
        currentUserId: snap.currentUserId,
        workspaceMembers: snap.workspaceMembers,
      }}
    />
  );
}
