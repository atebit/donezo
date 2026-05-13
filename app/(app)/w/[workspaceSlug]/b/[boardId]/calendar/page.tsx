/**
 * Calendar view page — /w/[workspaceSlug]/b/[boardId]/calendar
 *
 * Data is hydrated by the board layout via <BoardDataProvider>.
 * This page renders <BoardCalendarAgenda /> which reads from the
 * already-hydrated board store and automatically switches to agenda
 * view on mobile (<768px) for a readable layout on small screens.
 *
 * Mirror of table/page.tsx — pure passthrough RSC.
 *
 * NOTE: react-big-calendar's CSS is imported inside <CalendarView /> (the
 * "use client" component), NOT here. Importing third-party CSS in an RSC
 * causes Turbopack/webpack to handle it differently; keeping it in the
 * client component is correct per spec gotcha #1.
 *
 * Epic 12, Slice C — C.1.
 * Epic 14, followup-1/F1 — wired BoardCalendarAgenda for mobile agenda view.
 */

import { BoardCalendarAgenda } from "@/components/board/calendar/BoardCalendarAgenda";

export default function CalendarPage() {
  return <BoardCalendarAgenda />;
}
