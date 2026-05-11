"use client";

/**
 * GroupFooter — aggregation row rendered below each non-collapsed group's tasks.
 *
 * Sits between the last task row and the add-task-footer in the virtualised
 * rows list (kind: "group-footer"). For each visible column it renders the
 * column's first available aggregation (per def.aggregations[0]). If a
 * column's type has no aggregations, the cell is left empty.
 *
 * Shape of aggregations field (per lib/cells/types.ts):
 *   CellTypeDef.aggregations: AggregationKind[]   — an array, NOT a Record.
 *   CellTypeDef.aggregate(values, kind, config): string
 *
 * Leading spacer (60 px) accounts for:
 *   • 6 px group-accent stripe (border-l-[6px] div in TaskRow)
 *   • ~22 px TaskDragHandle button (px-1 + 14 px icon)
 *   • 32 px BulkSelectCheckbox (w-[var(--size-cell-w-checkbox)])
 */

import { memo } from "react";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import { useBoardStore } from "@/stores/board-store";
import type { Group } from "./types";

interface GroupFooterProps {
  group: Group;
}

export const GroupFooter = memo(function GroupFooter({ group }: GroupFooterProps) {
  const tasks = useBoardStore((s) => s.tasks);
  const cells = useBoardStore((s) => s.cells);
  const columns = useBoardStore((s) => s.columns);
  const columnPrefsByBoard = useBoardStore((s) => s.columnPrefsByBoard);
  const boardId = useBoardStore((s) => s.boardId);
  const labelsByColumn = useBoardStore((s) => s.labelsByColumn);

  const boardPrefs = boardId ? (columnPrefsByBoard[boardId] ?? {}) : {};
  const visibleColumns = columns.filter((c) => !boardPrefs[c.id]?.hidden);

  // Title column identification — mirrors StickyHeader (S19) and TaskRow (S20).
  const textColumns = visibleColumns.filter((c) => c.type === "text");
  // textColumns.reduce is only called when textColumns.length > 0, so the
  // initial value is safe. We guard with a conditional to satisfy the linter.
  const titleColumn =
    textColumns.length > 0
      ? textColumns.reduce<(typeof textColumns)[0] | undefined>(
          (min, c) => (min === undefined || c.position < min.position ? c : min),
          undefined,
        )
      : visibleColumns[0];

  const groupTasks = tasks.filter((t) => t.group_id === group.id);

  return (
    <div className="h-9 flex items-center bg-[color:var(--color-surface)] border-b border-[color:var(--color-border-strong)]">
      {/* Leading spacer — matches the combined width of the TaskRow's leading
          slots (accent stripe 6px + drag handle ~22px + checkbox 32px = 60px). */}
      <div className="w-[60px] flex-shrink-0" aria-hidden="true" />

      {/* Title column slot — always empty; aggregations do not apply to titles. */}
      {titleColumn && (
        <div
          className="flex-shrink-0"
          style={{ width: boardPrefs[titleColumn.id]?.width ?? 336 }}
          aria-hidden="true"
        />
      )}

      {/* Per-column aggregation cells */}
      {visibleColumns
        .filter((c) => c.id !== titleColumn?.id)
        .map((col) => {
          const def = getCellDef(col.type as CellTypeId);

          // aggregations is AggregationKind[] — pick the first entry as default.
          const firstKind = def.aggregations[0];

          if (firstKind === undefined) {
            // No aggregation defined for this type — render empty cell.
            return (
              <div
                key={col.id}
                className="flex-shrink-0 border-l border-[color:var(--color-border-strong)]"
                style={{ width: boardPrefs[col.id]?.width ?? 140 }}
                aria-hidden="true"
              />
            );
          }

          // Compute typed values for this column across all tasks in the group.
          const values = groupTasks.map((t) =>
            def.fromRow(cells.get(`${t.id}:${col.id}`) ?? undefined),
          );

          // Retrieve labels for label-backed types (status, priority).
          // def.aggregate signature: (values: TValue[], kind: AggregationKind, config: TConfig) => string
          // config comes from column.settings (jsonb).
          const config: unknown = (col.settings ?? {}) as unknown;
          const labels = labelsByColumn.get(col.id) ?? [];

          let result: string;
          try {
            // The aggregate call is typed as (values: TValue[], kind, config) => string.
            // We pass labels as part of config for label-backed types that need them.
            // Most aggregate implementations only read `values` and `kind`; the
            // percent_by_label kind inspects config for label info. Cast to any at
            // the registry boundary — the registry already uses `CellTypeDef<any,any>`.
            result = def.aggregate(
              values,
              firstKind,
              // For label-backed types, merge labels into config so percent_by_label
              // can access them. Non-label types ignore the extra key.
              { ...(config as object), _labels: labels },
            ) as string;
          } catch {
            // Defensive: any aggregation throw renders a dash.
            result = "—";
          }

          return (
            <div
              key={col.id}
              className="flex-shrink-0 flex flex-col items-center justify-center border-l border-[color:var(--color-border-strong)] text-[14px] font-medium"
              style={{ width: boardPrefs[col.id]?.width ?? 140 }}
            >
              <span>{result}</span>
              <span className="text-[12px] text-[color:var(--color-fg-muted)]">{firstKind}</span>
            </div>
          );
        })}
    </div>
  );
});
