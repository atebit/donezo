"use client";

/**
 * ViewTabs — replaces BoardViewTabs.tsx.
 *
 * Renders one tab per saved view (sorted by `position`). Each tab:
 *   - Kind icon (Lucide): Table, Kanban, Calendar, Timeline, LayoutDashboard, FormInput
 *   - View name.
 *   - Active tab: 2px bottom border `--color-primary` per design-system.
 *   - Hover bg `--color-surface-hover`, radius `4px 4px 0 0`.
 *   - Active tab right-side chevron → opens <ViewTabDropdown>.
 * Trailing item: <AddViewMenu />.
 *
 * Token mapping (component-system §1.4):
 *   - Tab height: 36px (--size-cell-h).
 *   - Font: 14px / medium.
 *   - Active indicator: `after` pseudo with h-0.5 + --color-primary.
 *   - Hover: bg `var(--color-surface-hover)`.
 *   - Radius: 4px 4px 0 0 (top corners only).
 */

import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  ChevronDown,
  FormInput,
  Kanban,
  LayoutDashboard,
  Table2,
  Timeline,
} from "lucide-react";
import { useBoardView } from "@/hooks/use-board-view";
import { useLastViewPersistence } from "@/hooks/use-last-view-persistence";
import { cn } from "@/lib/utils";
import type { ViewRow } from "@/stores/types/views";

import { AddViewMenu } from "./AddViewMenu";
import { ViewTabDropdown } from "./ViewTabDropdown";

// ---------------------------------------------------------------------------
// Kind → icon mapping
// ---------------------------------------------------------------------------

const KIND_ICONS: Record<string, LucideIcon> = {
  table: Table2,
  kanban: Kanban,
  calendar: Calendar,
  timeline: Timeline,
  dashboard: LayoutDashboard,
  form: FormInput,
};

function KindIcon({ kind, size = 14 }: { kind: string; size?: number }) {
  const Icon = KIND_ICONS[kind] ?? Table2;
  return <Icon size={size} aria-hidden="true" className="flex-shrink-0" />;
}

// ---------------------------------------------------------------------------
// Single tab
// ---------------------------------------------------------------------------

interface ViewTabProps {
  view: ViewRow;
  isActive: boolean;
  onSwitch: () => void;
}

function ViewTab({ view, isActive, onSwitch }: ViewTabProps) {
  return (
    <div
      role="tab"
      aria-selected={isActive}
      className={cn(
        "relative flex items-center gap-1.5 h-9 px-3 cursor-pointer select-none",
        "text-sm font-medium",
        "rounded-t-[4px]",
        "transition-colors duration-[var(--motion-base,150ms)]",
        isActive
          ? "text-[color:var(--color-fg)]"
          : "text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)]",
        // Active bottom border (2px, primary color).
        isActive &&
          "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[color:var(--color-primary)] after:rounded-t-sm",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
      )}
      tabIndex={0}
      onClick={onSwitch}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSwitch();
        }
      }}
    >
      <KindIcon kind={view.kind} />
      <span className="truncate max-w-[120px]">{view.name}</span>

      {/* Active tab chevron → ViewTabDropdown */}
      {isActive && (
        <ViewTabDropdown view={view}>
          {/* Trigger button rendered inside ViewTabDropdown */}
          <button
            type="button"
            className={cn(
              "flex items-center justify-center w-4 h-4 ml-0.5 rounded",
              "text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]",
              "hover:bg-[color:var(--color-surface-hover)]",
              "transition-colors duration-[var(--motion-base,150ms)]",
              "cursor-pointer",
            )}
            aria-label={`Options for ${view.name}`}
            // Stop propagation so clicking the chevron doesn't also trigger tab switch.
            onClick={(e) => e.stopPropagation()}
          >
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        </ViewTabDropdown>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ViewTabs root
// ---------------------------------------------------------------------------

export function ViewTabs() {
  const { views, active, switchView } = useBoardView();

  // Persist last-viewed state per Q24 contract (debounce 750ms, flush on pagehide,
  // cap one write per 2s). boardId comes from the active view.
  const boardId = active?.board_id ?? views[0]?.board_id ?? "";
  useLastViewPersistence(boardId, active?.id ?? null);

  // Sort views by position (defensive — store should already deliver them sorted).
  const sorted = [...views].sort((a, b) => a.position - b.position);

  return (
    <div
      className="flex items-end border-b border-[color:var(--color-border)] px-[38px] overflow-x-auto"
      role="tablist"
      aria-label="Board views"
    >
      {sorted.map((view) => (
        <ViewTab
          key={view.id}
          view={view}
          isActive={active?.id === view.id}
          onSwitch={() => switchView(view.id)}
        />
      ))}
      {/* "+ Add view" trailing item */}
      <AddViewMenu boardId={boardId} />
    </div>
  );
}
