import { ItemDrawer } from "@/components/board/item-drawer/ItemDrawer";
import { BoardTableView } from "@/components/board/table/BoardTableView";

/**
 * Table view page — /w/[workspaceSlug]/b/[boardId]/table
 *
 * Data is hydrated by the board layout via <BoardDataProvider>.
 * This page renders <BoardTableView /> which gates between:
 *   - <BoardTable />    at ≥768px (md+)
 *   - <BoardCardList /> at <768px (mobile)
 *
 * Epic 12, Slice A — A.4 (relocated from [boardId]/page.tsx).
 * Epic 14, Slice D — mobile card list view.
 * Epic 16, Slice G — mount <ItemDrawer /> at the board surface level.
 */
export default function TablePage() {
  return (
    <>
      <BoardTableView />
      {/* Item-detail drawer — Zustand-driven, opens when a task row's speech-bubble
          affordance is clicked. Mounted here (not in the board layout) so it only
          appears on the table view where TaskRow renders. */}
      <ItemDrawer />
    </>
  );
}
