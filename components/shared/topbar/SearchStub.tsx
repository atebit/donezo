"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { Search } from "lucide-react";

/**
 * Disabled search button placeholder.
 * Full search functionality lands in a future epic.
 */
export function SearchStub() {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          aria-disabled="true"
          className="flex items-center gap-2 px-3 h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-solid)] text-[var(--color-fg-muted)] opacity-50 cursor-not-allowed select-none text-sm bg-transparent"
          onClick={(e) => e.preventDefault()}
        >
          <Search size={14} aria-hidden />
          <span>Search</span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="bottom" sideOffset={6}>
            <Tooltip.Popup className="z-[var(--z-popover)] rounded-[var(--radius-sm)] bg-[var(--color-fg-strong)] px-2 py-1 text-xs text-white">
              Coming soon
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
