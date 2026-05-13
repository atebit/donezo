"use client";

/**
 * CalendarViewLoader
 *
 * Thin client component shim that dynamically imports <CalendarView /> with
 * ssr: false. This is required because react-big-calendar references `window`
 * at import time, which would cause a ReferenceError during SSR.
 *
 * The `ssr: false` option is only valid inside a "use client" component, not
 * inside an RSC page — hence this indirection layer.
 *
 * Epic 12, Slice C — C.1.
 */

import dynamic from "next/dynamic";

const CalendarView = dynamic(
  () => import("@/components/board/calendar/CalendarView").then((m) => m.CalendarView),
  { ssr: false },
);

export function CalendarViewLoader() {
  return <CalendarView />;
}
