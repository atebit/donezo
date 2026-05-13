import { BoardTable } from "@/components/board/table/BoardTable";

/**
 * Table view page — /w/[workspaceSlug]/b/[boardId]/table
 *
 * Data is hydrated by the board layout via <BoardDataProvider>.
 * This page simply renders <BoardTable /> which reads from the already-hydrated
 * board store.
 *
 * Epic 12, Slice A — A.4 (relocated from [boardId]/page.tsx).
 */
export default function TablePage() {
  return <BoardTable />;
}
