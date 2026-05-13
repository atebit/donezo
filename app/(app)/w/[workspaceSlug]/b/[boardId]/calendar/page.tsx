/**
 * Calendar view page — /w/[workspaceSlug]/b/[boardId]/calendar
 *
 * Data is hydrated by the board layout via <BoardDataProvider>.
 * This page simply renders <CalendarView /> which reads from the
 * already-hydrated board store.
 *
 * Mirror of table/page.tsx — pure passthrough RSC.
 *
 * NOTE: react-big-calendar's CSS is imported inside <CalendarView /> (the
 * "use client" component), NOT here. Importing third-party CSS in an RSC
 * causes Turbopack/webpack to handle it differently; keeping it in the
 * client component is correct per spec gotcha #1.
 *
 * Epic 12, Slice C — C.1.
 */

import { CalendarView } from "@/components/board/calendar/CalendarView";

export default function CalendarPage() {
  return <CalendarView />;
}
