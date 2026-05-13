"use client";

/**
 * DensityToggle — three-segment compact/default/spacious inline toggle.
 *
 * Emits `density: Density` on change. Prop-driven.
 * Visual fidelity: 32px tall buttons, 14px font, matches toolbar button spec.
 * Uses radio inputs styled as a segmented control for accessibility.
 */

import type { Density } from "@/lib/views/config-schema";

interface DensityToggleProps {
  /** Current density value. Defaults to "default" if undefined. */
  density: Density | undefined;
  /** Called when the density selection changes. */
  onChange: (next: Density) => void;
}

const SEGMENTS: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "spacious", label: "Spacious" },
];

export function DensityToggle({ density = "default", onChange }: DensityToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Table density"
      className="inline-flex items-center rounded border border-[color:var(--color-border-strong)] overflow-hidden"
    >
      {SEGMENTS.map(({ value, label }, idx) => {
        const isActive = density === value;
        const inputId = `density-${value}`;
        return (
          <label
            key={value}
            htmlFor={inputId}
            className={[
              "h-8 px-3 text-sm transition-colors cursor-pointer flex items-center",
              "focus-within:outline focus-within:outline-2 focus-within:outline-[color:var(--color-primary)] focus-within:outline-offset-[-2px]",
              idx > 0 ? "border-l border-[color:var(--color-border-strong)]" : "",
              isActive
                ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] font-medium"
                : "text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)]",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              type="radio"
              id={inputId}
              name="density"
              value={value}
              checked={isActive}
              onChange={() => onChange(value)}
              className="sr-only"
              aria-label={label}
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}
