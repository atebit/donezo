"use client";

/**
 * TimelineScaleSwitcher — segmented control for selecting the timeline scale.
 *
 * Scale options: Day / Week / Month / Quarter / Year.
 * Renders as a horizontal button group; active scale is highlighted with the
 * primary colour. The onChange callback receives the new scale value, which
 * the parent persists to `view.config.timeline.scale`.
 *
 * Epic 12, Slice D.
 */

import { cn } from "@/lib/utils";
import type { Scale } from "./timeline-math";

interface TimelineScaleSwitcherProps {
  scale: Scale;
  onChange: (next: Scale) => void;
}

const SCALES: { value: Scale; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

export function TimelineScaleSwitcher({ scale, onChange }: TimelineScaleSwitcherProps) {
  return (
    <fieldset
      aria-label="Timeline scale"
      className="flex items-center rounded overflow-hidden border border-[color:var(--color-border-strong)] divide-x divide-[color:var(--color-border-strong)] p-0"
      style={{ border: "1px solid var(--color-border-strong)", padding: 0, margin: 0 }}
    >
      {SCALES.map(({ value, label }) => {
        const isActive = value === scale;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(value)}
            className={cn(
              "px-3 h-7 text-xs font-medium transition-colors cursor-pointer select-none",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
              "focus-visible:outline-[color:var(--color-primary)]",
              isActive
                ? "bg-[color:var(--color-primary)] text-white"
                : "bg-[color:var(--color-surface)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)]",
            )}
          >
            {label}
          </button>
        );
      })}
    </fieldset>
  );
}
