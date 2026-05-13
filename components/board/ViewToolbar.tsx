"use client";

/**
 * ViewToolbar — the row below <ViewTabs>.
 *
 * Layout (component-system §1.4):
 *   [Filter (N)] [Sort (N)] [Hide (N)] [Group: <name>] [Density] [Search ──] [💾 Save] [↺ Reset]
 *
 * Token mapping:
 *   - Button height: 32px (h-8).
 *   - Padding: 0 8px (px-2).
 *   - Font: 14px.
 *   - Hover: bg var(--color-surface-hover).
 *   - Radius: 4px (rounded).
 *   - Gap between buttons: 5px (gap-[5px]).
 *   - Save/Reset: visible only when hasUnsavedChanges is true.
 *   - Save: additionally gated by permission (admin+ for shared, owner for personal).
 *
 * All five popovers are from Slice C:
 *   FilterBuilder, SortBuilder, ColumnVisibilityPanel, GroupByPicker, DensityToggle.
 *
 * Count badges on Filter/Sort/Hide show the number of active items.
 */

import { Filter, Group, LayoutList, RefreshCw, Save, SortAsc } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { ColumnVisibilityPanel } from "@/components/filters/ColumnVisibilityPanel";
import { DensityToggle } from "@/components/filters/DensityToggle";
import { FilterBuilder } from "@/components/filters/FilterBuilder";
import { GroupByPicker } from "@/components/filters/GroupByPicker";
import { PopoverShell } from "@/components/filters/PopoverShell";
import { SortBuilder } from "@/components/filters/SortBuilder";
import { useBoard } from "@/hooks/use-board";
import { useBoardView } from "@/hooks/use-board-view";
import { cn } from "@/lib/utils";
import type { FilterTree, GroupBy } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";

import { InlineSearchBar } from "./InlineSearchBar";

// ---------------------------------------------------------------------------
// Count helpers
// ---------------------------------------------------------------------------

/** Count top-level filter comparisons in a flat AND tree. */
function countFilters(filter: FilterTree | undefined): number {
  if (!filter) return 0;
  if (filter.kind === "comparison") return 1;
  if (filter.kind === "and" || filter.kind === "or") {
    return filter.clauses.reduce((sum, c) => sum + countFilters(c), 0);
  }
  return 0;
}

function countHidden(visibility: Record<string, boolean> | undefined): number {
  if (!visibility) return 0;
  return Object.values(visibility).filter((v) => v === false).length;
}

function groupByLabel(
  groupBy: GroupBy | undefined,
  columns: { id: string; name: string }[],
): string {
  if (!groupBy || groupBy.kind === "native") return "";
  const col = columns.find((c) => c.id === groupBy.columnId);
  return col?.name ?? "";
}

// ---------------------------------------------------------------------------
// Shared toolbar button style
// ---------------------------------------------------------------------------

function toolbarBtnCn(extra?: string): string {
  return cn(
    "flex items-center gap-[5px] h-8 px-2 rounded cursor-pointer select-none",
    "text-sm font-medium text-[color:var(--color-fg-muted)]",
    "hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)]",
    "transition-colors duration-[var(--motion-base,150ms)]",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
    "whitespace-nowrap",
    extra,
  );
}

// ---------------------------------------------------------------------------
// Count badge
// ---------------------------------------------------------------------------

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[16px] h-4 px-1 rounded-full",
        "text-[10px] font-semibold",
        "bg-[color:var(--color-primary)] text-white",
        "leading-none",
      )}
    >
      {count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ViewToolbar
// ---------------------------------------------------------------------------

export function ViewToolbar() {
  const { effective, hasUnsavedChanges, applyDraft, resetDraft, save, role } = useBoardView();
  const { userId } = useBoard();
  const columns = useBoardStore(useShallow((s) => s.columns));

  // Active view info for permission check.
  const activeView = useBoardStore((s) => {
    if (!s.activeViewId) return null;
    const views = s.viewsByBoard.get(s.boardId ?? "") ?? [];
    return views.find((v) => v.id === s.activeViewId) ?? null;
  });

  // ---------------------------------------------------------------------------
  // Save / Reset permission
  // ---------------------------------------------------------------------------

  const isSharedOrSystem =
    activeView == null || activeView.is_shared || activeView.owner_id == null;
  const isPersonalOwner = !isSharedOrSystem && activeView?.owner_id === userId;

  const canSave = isSharedOrSystem ? role === "admin" || role === "owner" : isPersonalOwner;

  // ---------------------------------------------------------------------------
  // Counts for badges
  // ---------------------------------------------------------------------------

  const filterCount = useMemo(() => countFilters(effective.filter), [effective.filter]);
  const sortCount = useMemo(() => effective.sort?.length ?? 0, [effective.sort]);
  const hiddenCount = useMemo(
    () => countHidden(effective.columnVisibility),
    [effective.columnVisibility],
  );
  const currentGroupBy = effective.groupBy;
  const groupLabel = useMemo(
    () => groupByLabel(currentGroupBy, columns),
    [currentGroupBy, columns],
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    try {
      await save();
      toast.success("View saved");
    } catch {
      // save() now shows its own toast error via the hook; just swallow here.
    }
  };

  const handleReset = () => {
    resetDraft();
  };

  return (
    <div
      className="flex items-center gap-[5px] px-[38px] py-1 border-b border-[color:var(--color-border)]"
      role="toolbar"
      aria-label="View filters and options"
    >
      {/* ── Filter ── */}
      <PopoverShell
        trigger={
          <button type="button" className={toolbarBtnCn()}>
            <Filter size={14} aria-hidden="true" />
            Filter
            <CountBadge count={filterCount} />
          </button>
        }
        side="bottom"
        align="start"
      >
        <FilterBuilder
          filter={effective.filter}
          columns={columns}
          onChange={(next) => applyDraft({ filter: next })}
        />
      </PopoverShell>

      {/* ── Sort ── */}
      <PopoverShell
        trigger={
          <button type="button" className={toolbarBtnCn()}>
            <SortAsc size={14} aria-hidden="true" />
            Sort
            <CountBadge count={sortCount} />
          </button>
        }
        side="bottom"
        align="start"
      >
        <SortBuilder
          sort={effective.sort ?? []}
          columns={columns}
          onChange={(next) => applyDraft({ sort: next })}
        />
      </PopoverShell>

      {/* ── Hide ── */}
      <PopoverShell
        trigger={
          <button type="button" className={toolbarBtnCn()}>
            <LayoutList size={14} aria-hidden="true" />
            Hide
            <CountBadge count={hiddenCount} />
          </button>
        }
        side="bottom"
        align="start"
      >
        <ColumnVisibilityPanel
          columns={columns}
          columnVisibility={effective.columnVisibility ?? {}}
          {...(effective.columnOrder !== undefined && { columnOrder: effective.columnOrder })}
          onVisibilityChange={(next) => applyDraft({ columnVisibility: next })}
          onOrderChange={(next) => applyDraft({ columnOrder: next })}
        />
      </PopoverShell>

      {/* ── Group by ── */}
      <PopoverShell
        trigger={
          <button type="button" className={toolbarBtnCn()}>
            <Group size={14} aria-hidden="true" />
            {groupLabel ? `Group: ${groupLabel}` : "Group"}
          </button>
        }
        side="bottom"
        align="start"
      >
        <GroupByPicker
          groupBy={currentGroupBy}
          columns={columns}
          onChange={(next: GroupBy) => applyDraft({ groupBy: next })}
        />
      </PopoverShell>

      {/* ── Density ── (inline, not in a popover) */}
      <DensityToggle
        density={effective.density}
        onChange={(next) => applyDraft({ density: next })}
      />

      {/* ── Search (grows to fill remaining space) ── */}
      <InlineSearchBar />

      {/* ── Save / Reset (shown only when there are unsaved changes) ── */}
      {hasUnsavedChanges && canSave && (
        <button
          type="button"
          onClick={handleSave}
          className={cn(
            toolbarBtnCn(),
            "text-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]",
          )}
          aria-label="Save view changes"
        >
          <Save size={14} aria-hidden="true" />
          Save
        </button>
      )}

      {hasUnsavedChanges && (
        <button
          type="button"
          onClick={handleReset}
          className={toolbarBtnCn()}
          aria-label="Reset view to saved state"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Reset
        </button>
      )}
    </div>
  );
}
