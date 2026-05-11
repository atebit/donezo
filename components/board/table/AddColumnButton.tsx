"use client";

import { Tooltip } from "@base-ui/react";
import { Plus } from "lucide-react";

/**
 * AddColumnButton — disabled button with "Coming in epic 07" tooltip.
 *
 * Per Q8=(a): disabled (aria-disabled="true"), NOT a toast stub (guardrail #25).
 * Appended at the right edge of <StickyHeader /> by S13.
 */
export function AddColumnButton() {
  return (
    <Tooltip.Provider delay={200}>
      <Tooltip.Root>
        <Tooltip.Trigger render={<span />} className="inline-flex" aria-disabled="true">
          <button
            type="button"
            aria-disabled="true"
            aria-label="Add column"
            tabIndex={-1}
            onClick={(e) => e.preventDefault()}
            className="h-9 w-9 flex items-center justify-center rounded-[var(--radius-xs)] text-[color:var(--color-fg-muted)] opacity-40 cursor-not-allowed focus-visible:outline-none"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={4}>
            <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]">
              Coming in epic 07
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
