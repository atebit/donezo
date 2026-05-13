/**
 * Timeline view page — /w/[workspaceSlug]/b/[boardId]/timeline
 *
 * RSC shell — mirrors kanban/page.tsx. Data is hydrated by <BoardDataProvider>
 * in the board layout (layout.tsx). This page renders <TimelineView /> which
 * reads live state from the board store.
 *
 * Epic 12, Slice D — D.1.
 */

import { TimelineView } from "@/components/board/timeline/TimelineView";

export default function TimelinePage() {
  return <TimelineView />;
}
