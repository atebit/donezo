"use client";

/**
 * PopoverShell — shared Base UI Popover wrapper for filter/sort/hide/group/density popovers.
 *
 * Applies the visual chrome from component-system §1.4 / §3.1:
 *   - bg: var(--color-surface)
 *   - border: 1px solid var(--color-border-strong)
 *   - border-radius: 8px
 *   - shadow: var(--shadow-modal)
 *   - z-index: var(--z-popover)
 *
 * Usage:
 *   <PopoverShell trigger={<button>Filter</button>}>
 *     <FilterBuilder ... />
 *   </PopoverShell>
 */

import { Popover } from "@base-ui/react";
import type { ReactElement, ReactNode } from "react";

interface PopoverShellProps {
  /** The element that triggers the popover. Rendered as Popover.Trigger. */
  trigger: ReactElement;
  /** Popover content. */
  children: ReactNode;
  /** Controlled open state (optional). */
  open?: boolean;
  /** Called when the popover open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Side to position relative to trigger. Default: "bottom". */
  side?: "bottom" | "top" | "left" | "right";
  /** Alignment along the trigger's axis. Default: "start". */
  align?: "start" | "center" | "end";
  /** Pixel gap between trigger edge and popover. Default: 4. */
  sideOffset?: number;
}

export function PopoverShell({
  trigger,
  children,
  open,
  onOpenChange,
  side = "bottom",
  align = "start",
  sideOffset = 4,
}: PopoverShellProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger render={trigger} />
      <Popover.Portal>
        <Popover.Positioner side={side} align={align} sideOffset={sideOffset}>
          <Popover.Popup
            className="outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "8px",
              boxShadow: "var(--shadow-modal)",
              zIndex: "var(--z-popover)",
            }}
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
