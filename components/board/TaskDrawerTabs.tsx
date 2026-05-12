"use client";

/**
 * TaskDrawerTabs — tab strip for the task drawer.
 *
 * Visual spec (component-system §3.5):
 *   - Padding 0 24px, 1px solid var(--color-border) bottom.
 *   - Each tab: padding 8px, weight 500, font-size 14px.
 *   - Hover: bg var(--color-surface-hover), only top corners round (4px 4px 0 0).
 *   - Active: bottom border 2px solid var(--color-primary).
 *
 * Tabs: Updates | Activity | Files
 */

import { cn } from "@/lib/utils";

export type TaskDrawerTab = "updates" | "activity" | "files";

interface TabDef {
  id: TaskDrawerTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: "updates", label: "Updates" },
  { id: "activity", label: "Activity" },
  { id: "files", label: "Files" },
];

interface TaskDrawerTabsProps {
  activeTab: TaskDrawerTab;
  onChange: (tab: TaskDrawerTab) => void;
}

export function TaskDrawerTabs({ activeTab, onChange }: TaskDrawerTabsProps) {
  return (
    <div
      className="flex items-end px-6 border-b border-[color:var(--color-border)]"
      role="tablist"
      aria-label="Task sections"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-2 py-2 text-sm font-medium",
              "rounded-tl rounded-tr focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]",
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
    </div>
  );
}
