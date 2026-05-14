"use client";

/**
 * ItemDrawer — right-side inline item-detail drawer (Epic 16 / Slice G).
 *
 * Opens when the user clicks the speech-bubble affordance on a task row.
 * State is managed by useItemDrawerStore (Zustand). No routing.
 *
 * Visual spec (component-system §3.5):
 *   position fixed; top 0; right 0; height 100vh; min-width ~480px
 *   Bg var(--color-surface), border-left 1px solid var(--color-border)
 *
 * Tab strip: Updates | Files | Activity Log | + (disabled placeholder)
 *
 * Closes via: Esc key / outside-click (Base UI Dialog) / X button.
 */

import { Tooltip } from "@base-ui/react";
import { PlusIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import { type ItemDrawerTab, useItemDrawerStore } from "@/stores/item-drawer-store";

import { ActivityLogTab } from "./ActivityLogTab";
import { FilesTab } from "./FilesTab";
import { UpdatesTab } from "./UpdatesTab";

// ---------------------------------------------------------------------------
// Tab strip definition
// ---------------------------------------------------------------------------

interface TabDef {
  id: ItemDrawerTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: "updates", label: "Updates" },
  { id: "files", label: "Files" },
  { id: "activity", label: "Activity Log" },
];

// ---------------------------------------------------------------------------
// ItemDrawer
// ---------------------------------------------------------------------------

export function ItemDrawer() {
  const openItemId = useItemDrawerStore((s) => s.openItemId);
  const activeTab = useItemDrawerStore((s) => s.activeTab);
  const close = useItemDrawerStore((s) => s.close);
  const setActiveTab = useItemDrawerStore((s) => s.setActiveTab);

  // Look up the task from the board store for the header title
  const task = useBoardStore((s) => s.tasks.find((t) => t.id === openItemId) ?? null);
  // Track boardId so we can reset the drawer when the user navigates to a different board
  const boardId = useBoardStore((s) => s.boardId);
  const reset = useItemDrawerStore((s) => s.reset);

  const isOpen = openItemId !== null;

  // Reset when the active board changes (user navigates to a different board).
  // reset is a stable Zustand action reference; including it satisfies lint without causing re-runs.
  useEffect(() => {
    if (boardId !== null) {
      reset();
    }
  }, [boardId, reset]);

  // Focus the drawer panel on open for keyboard nav
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          "w-[600px] max-w-[100vw] p-0 flex flex-col",
          "bg-[color:var(--color-surface)]",
          "border-l border-[color:var(--color-border)]",
        )}
        data-testid="item-drawer"
      >
        {/* Accessible drawer title (visually hidden — header below is visible) */}
        <SheetTitle className="sr-only">
          {task?.title ? `${task.title} — details` : "Item details"}
        </SheetTitle>

        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center gap-2 px-6"
          style={{ paddingTop: 20, paddingBottom: 6, minHeight: 53 }}
        >
          <h2
            className="text-lg font-semibold text-[color:var(--color-fg-strong)] truncate flex-1"
            style={{ fontSize: 18 }}
          >
            {task?.title || "Untitled"}
          </h2>
          <button
            type="button"
            onClick={close}
            className="p-1 rounded hover:bg-[color:var(--color-surface-hover)] text-[color:var(--color-fg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
            aria-label="Close item details"
            data-testid="item-drawer-close"
          >
            <XIcon size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Tab strip */}
        <div
          className="flex-shrink-0 flex items-end px-6 border-b border-[color:var(--color-border)]"
          role="tablist"
          aria-label="Item sections"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-2 py-2 text-sm font-medium",
                  "rounded-tl rounded-tr",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]",
                  "hover:bg-[color:var(--color-surface-hover)]",
                  isActive
                    ? "text-[color:var(--color-primary)] border-b-2 border-[color:var(--color-primary)]"
                    : "text-[color:var(--color-fg-muted)]",
                )}
              >
                {tab.label}
              </button>
            );
          })}

          {/* Placeholder "+" tab — disabled with tooltip */}
          <Tooltip.Provider delay={200}>
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <span
                    role="tab"
                    aria-selected={false}
                    aria-disabled="true"
                    tabIndex={-1}
                    className={cn(
                      "inline-flex items-center px-2 py-2 text-sm font-medium",
                      "rounded-tl rounded-tr",
                      "opacity-40 cursor-not-allowed",
                      "text-[color:var(--color-fg-muted)]",
                    )}
                  />
                }
              >
                <PlusIcon size={14} aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={4}>
                  <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]">
                    Custom item views coming soon.
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>

        {/* Tab content — scrollable */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}
          role="tabpanel"
          aria-label={`${activeTab} tab content`}
          tabIndex={-1}
          ref={panelRef}
        >
          <div className="p-6">
            {openItemId !== null && activeTab === "updates" && <UpdatesTab taskId={openItemId} />}
            {openItemId !== null && activeTab === "files" && <FilesTab taskId={openItemId} />}
            {openItemId !== null && activeTab === "activity" && (
              <ActivityLogTab taskId={openItemId} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
