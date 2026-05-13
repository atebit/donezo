"use client";

/**
 * TimelineScaleSwitcher — segmented control for Day/Week/Month/Quarter/Year.
 *
 * Persists the selected scale to view.config.timeline.scale via applyDraft.
 */

import type { Scale } from "@/components/board/timeline/timeline-math";
import { useBoardView } from "@/hooks/use-board-view";

const SCALES: { value: Scale; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

interface TimelineScaleSwitcherProps {
  activeScale: Scale;
}

export function TimelineScaleSwitcher({ activeScale }: TimelineScaleSwitcherProps) {
  const { effective, applyDraft } = useBoardView();

  function handleScaleChange(scale: Scale) {
    applyDraft({
      timeline: {
        ...effective.timeline,
        timelineColumnId: effective.timeline?.timelineColumnId ?? null,
        scale,
        colorBy: effective.timeline?.colorBy ?? { kind: "none" },
      },
    });
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: no native HTML element for a button group; <div role="group"> is the correct ARIA pattern
    <div
      className="inline-flex items-center rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden"
      role="group"
      aria-label="Timeline scale"
    >
      {SCALES.map(({ value, label }) => {
        const isActive = activeScale === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => handleScaleChange(value)}
            aria-pressed={isActive}
            className={[
              "px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-[color:var(--color-primary)] text-white"
                : "text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)]",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
