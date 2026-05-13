/**
 * calendar-localizer.ts — date-fns localizer for react-big-calendar.
 *
 * Hardcoded to en-US. Locale support is deferred to Epic 14.
 *
 * C.1 / C.7 — Slice C (Calendar view).
 */

import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import { dateFnsLocalizer } from "react-big-calendar";

const locales = {
  "en-US": enUS,
};

export const calendarLocalizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: enUS }),
  getDay,
  locales,
});
