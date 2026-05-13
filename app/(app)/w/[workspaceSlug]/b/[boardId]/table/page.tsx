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
 */
export default function TablePage() {
  return <BoardTableView />;
}
