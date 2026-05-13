"use client";

/**
 * BoardCalendarAgenda — mobile-first calendar wrapper.
 *
 * On mobile (<768px): forces `view="agenda"` and `defaultView="agenda"` on
 * react-big-calendar so the calendar renders a vertical list of dated tasks
 * instead of the month grid (which is too dense for small screens).
 *
 * On desktop (≥768px): delegates to <CalendarView /> unchanged; the user's
 * persisted view mode (month / week / day / agenda) is respected.
 *
 * Epic 14, Slice E.
 */

import { useMediaQuery } from "@/hooks/use-media-query";
import { CalendarView } from "./CalendarView";

/**
 * Mobile-aware calendar entry point.
 * Import this instead of `CalendarView` from board routes so that mobile
 * users automatically get the agenda layout.
 */
export function BoardCalendarAgenda() {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Pass a `forceMobileAgenda` flag down so CalendarView can flip the view.
  // On desktop this prop is absent and CalendarView behaves identically to before.
  return <CalendarView forceMobileAgenda={!isDesktop} />;
}
