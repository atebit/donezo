"use client";

/**
 * BoardTimelineMobile — mobile fallback for the timeline view.
 *
 * The Gantt-style timeline relies on precise pixel calculations, horizontal
 * drag/resize, and wide viewport widths that make it unusable on small screens.
 * Rather than attempt a degraded timeline, this component renders a clear
 * empty state telling the user to use desktop.
 *
 * Rendered only when `<md:` (viewport < 768px) — see TimelineView.tsx.
 *
 * Epic 14, Slice E.
 */

import { EmptyState } from "@/components/shared/empty-states/EmptyState";
import { IconClock } from "@/lib/icons";

export function BoardTimelineMobile() {
  return (
    <div
      className="flex flex-1 items-center justify-center min-h-0"
      data-testid="timeline-mobile-fallback"
    >
      <EmptyState
        icon={IconClock}
        title="Timeline works best on desktop"
        description="Rotate your device or switch to another view to see the timeline."
      />
    </div>
  );
}
