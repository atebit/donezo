"use client";

import { Popover } from "@base-ui/react";
import type { ReactElement } from "react";

import { colorToToken } from "@/components/board/table/group-color";
import { GROUP_PALETTE } from "@/lib/group-palette";

interface ColorPaletteProps {
  value: string;
  onChange: (color: string) => void;
  /** The element that opens the palette popover. Passed as the `render` prop to Popover.Trigger. */
  trigger: ReactElement;
}

/**
 * ColorPalette — a 4×3 grid of 12 group-accent swatches rendered inside a
 * Base UI Popover. Selecting a swatch calls onChange(hex) and closes the popover.
 *
 * Uses --color-group-N tokens exclusively; no raw hex in JSX (guardrail #1).
 */
export function ColorPalette({ value, onChange, trigger }: ColorPaletteProps) {
  return (
    <Popover.Root>
      <Popover.Trigger render={trigger} />
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start">
          <Popover.Popup className="z-[var(--z-popover)] rounded-[var(--radius-md)] bg-[color:var(--color-surface)] shadow-[var(--shadow-modal)] border border-[color:var(--color-border-strong)] p-2">
            <fieldset
              className="grid gap-1.5 border-0 p-0 m-0"
              style={{ gridTemplateColumns: "repeat(4, 22px)", width: "max-content" }}
              aria-label="Group color palette"
            >
              {GROUP_PALETTE.map((swatch, i) => {
                const token = colorToToken(swatch);
                const isSelected = swatch.toLowerCase() === value.toLowerCase();
                return (
                  <Popover.Close
                    key={swatch}
                    onClick={() => onChange(swatch)}
                    aria-label={`Color ${i + 1}`}
                    aria-pressed={isSelected}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      backgroundColor: `var(${token})`,
                      flexShrink: 0,
                    }}
                    className={[
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1",
                      isSelected ? "ring-2 ring-[color:var(--color-primary)] ring-offset-1" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                );
              })}
            </fieldset>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
