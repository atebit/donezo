"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { Bell } from "lucide-react";

/**
 * Disabled notification bell placeholder.
 * Full notifications functionality lands in a future epic.
 */
export function NotificationBellStub() {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          aria-disabled="true"
          className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)] text-[var(--color-fg-muted)] opacity-50 cursor-not-allowed"
          onClick={(e) => e.preventDefault()}
        >
          <Bell size={16} aria-hidden />
          <span className="sr-only">Notifications (coming soon)</span>
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
