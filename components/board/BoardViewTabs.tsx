"use client";

import { Tooltip } from "@base-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBoard } from "@/hooks/use-board";
import { cn } from "@/lib/utils";

type Tab = {
  label: string;
  /** Path segment appended to the board base URL, or null for the board root */
  segment: string | null;
  enabled: boolean;
};

const TABS: Tab[] = [
  { label: "Table", segment: null, enabled: true },
  { label: "Kanban", segment: "kanban", enabled: false },
  { label: "Calendar", segment: "calendar", enabled: false },
  { label: "Timeline", segment: "timeline", enabled: false },
  { label: "Dashboard", segment: "dashboard", enabled: false },
];

export function BoardViewTabs() {
  // useBoard is called purely to confirm we are inside BoardProvider;
  // the boardId is derived from the URL pathname for navigation.
  useBoard();
  const pathname = usePathname();

  // Reconstruct the board base URL from the current pathname.
  // The pathname is something like /w/<slug>/b/<id> or /w/<slug>/b/<id>/kanban
  const boardBaseMatch = pathname.match(/^(\/w\/[^/]+\/b\/[^/]+)/);
  const boardBase = boardBaseMatch ? boardBaseMatch[1] : "";

  return (
    <Tooltip.Provider delay={400}>
      <div
        className="flex items-end border-b border-[color:var(--color-border)] px-[38px]"
        role="tablist"
        aria-label="Board views"
      >
        {TABS.map((tab) => {
          const href: string = tab.segment ? `${boardBase}/${tab.segment}` : boardBase || "/";

          // Determine active: for Table (segment null), match board base; for others match segment.
          const isActive = tab.segment
            ? pathname === `${boardBase}/${tab.segment}`
            : pathname === boardBase || pathname === `${boardBase}/`;

          if (!tab.enabled) {
            return (
              <Tooltip.Root key={tab.label}>
                <Tooltip.Trigger
                  render={
                    <span role="tab" aria-disabled="true" aria-selected={false} tabIndex={-1} />
                  }
                  className={cn(
                    "relative px-3 pb-2 pt-2 text-sm font-medium",
                    "opacity-50 cursor-not-allowed select-none",
                    "text-[color:var(--color-fg-muted)]",
                  )}
                >
                  {tab.label}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner sideOffset={4}>
                    <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm">
                      Coming soon
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          }

          return (
            <Link
              key={tab.label}
              href={href}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "relative px-3 pb-2 pt-2 text-sm font-medium transition-colors",
                "text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
                isActive &&
                  "text-[color:var(--color-fg)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[color:var(--color-primary)] after:rounded-t-sm",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </Tooltip.Provider>
  );
}
