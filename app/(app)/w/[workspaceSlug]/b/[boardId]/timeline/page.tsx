/**
 * Timeline view page — /w/[workspaceSlug]/b/[boardId]/timeline
 *
 * Data is hydrated by the board layout via <BoardDataProvider>.
 * This page renders <TimelineView /> which reads from the already-hydrated
 * board store.
 *
 * Epic 12, Slice D — D.1 (mirrors the table/page.tsx pattern).
 */
import { TimelineView } from "@/components/board/timeline/TimelineView";

export default function TimelinePage() {
  return <TimelineView />;
}
