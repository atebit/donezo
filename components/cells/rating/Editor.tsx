"use client";

/**
 * RatingEditor — inline star-click editor for the "rating" cell type.
 *
 * Contract (from CellTypeDef.Editor):
 *   - Clicking the Nth star sets value = N; clicking the same N twice clears (value = null).
 *   - Emit onChange(value) immediately on every click — no Enter/blur needed.
 *   - Emit onClose() after committing, so the orchestrator closes the editor.
 *   - Esc closes WITHOUT committing.
 *   - NO server-action calls. NO Supabase imports.
 */

import { Star } from "lucide-react";
import { useRef, useState } from "react";

import type { RatingConfig } from "./def";

interface RatingEditorProps {
  value: number | null;
  config: RatingConfig;
  onChange: (next: number | null) => void;
  onClose: () => void;
}

export function Editor({ value, config, onChange, onClose }: RatingEditorProps) {
  const max = config.max ?? 5;
  const [hovered, setHovered] = useState<number | null>(null);
  const filled = value ?? 0;
  const effectiveFilled = hovered !== null ? hovered : filled;

  // Ref for the first star button so we can auto-focus it
  const firstStarRef = useRef<HTMLButtonElement>(null);

  const handleStarClick = (starIndex: number) => {
    if (starIndex === filled) {
      // Click the same star a second time → clear the rating
      onChange(null);
    } else {
      onChange(starIndex);
    }
    onClose();
  };

  return (
    <fieldset
      className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 gap-0.5 border border-[color:var(--color-primary)] bg-[color:var(--color-surface)] outline-none cursor-pointer m-0 p-0"
      aria-label="Rating editor"
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({ length: max }, (_, i) => {
        const starIndex = i + 1;
        const isFilled = starIndex <= effectiveFilled;
        return (
          <button
            key={starIndex}
            ref={starIndex === 1 ? firstStarRef : undefined}
            type="button"
            className="p-0 border-none bg-transparent cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-primary)] rounded-sm"
            aria-label={`Rate ${starIndex} of ${max}`}
            aria-pressed={starIndex <= filled}
            onMouseEnter={() => setHovered(starIndex)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onClose();
              }
            }}
            onClick={() => handleStarClick(starIndex)}
          >
            <Star
              style={{
                width: 16,
                height: 16,
                color: isFilled ? "var(--color-label-yellow)" : "var(--color-fg-subtle)",
                fill: isFilled ? "currentColor" : "none",
                transition: "color 80ms ease, fill 80ms ease",
              }}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </fieldset>
  );
}
