"use client";

/**
 * GroupFooter — aggregation row rendered below each non-collapsed group's tasks.
 *
 * Epic 16 (Slice A): converted from flex row to CSS grid row sharing the
 * GridTemplateContext column template. Deduped column logic moved to
 * useVisibleColumns(). Top border uses var(--group-accent) set by GroupSection.
 *
 * FooterCell({col, groupTasks}) is the seam for Slice C to replace the
 * aggregation body without touching the layout container.
 */

import { memo } from "react";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import { useBoardStore } from "@/stores/board-store";

import { useGridTemplate } from "./grid-template-context";
import type { Column, Group } from "./types";
import { useVisibleColumns } from "./use-visible-columns";

interface GroupFooterProps {
  group: Group;
}

// ---------------------------------------------------------------------------
// FooterCell — seam for Slice C.
// Slice C replaces the body of this function to return type-aware descriptors.
// Only the body changes; the signature and call sites stay identical.
// ---------------------------------------------------------------------------
function FooterCell({
  col,
  groupTasks,
}: {
  col: Column;
  groupTasks: ReturnType<typeof useBoardStore.getState>["tasks"];
}) {
  const cells = useBoardStore((s) => s.cells);
  const labelsByColumn = useBoardStore((s) => s.labelsByColumn);

  const def = getCellDef(col.type as CellTypeId);
  const firstKind = def.aggregations[0];

  if (firstKind === undefined) {
    return null;
  }

  const values = groupTasks.map((t) => def.fromRow(cells.get(`${t.id}:${col.id}`) ?? undefined));

  const config: unknown = (col.settings ?? {}) as unknown;
  const labels = labelsByColumn.get(col.id) ?? [];

  let result: string;
  try {
    result = def.aggregate(values, firstKind, {
      ...(config as object),
      _labels: labels,
    }) as string;
  } catch {
    result = "—";
  }

  return (
    <div className="flex flex-col items-center justify-center text-[14px] font-medium w-full h-full">
      <span>{result}</span>
      <span className="text-[12px] text-[color:var(--color-fg-muted)]">{firstKind}</span>
    </div>
  );
}

export const GroupFooter = memo(function GroupFooter({ group }: GroupFooterProps) {
  const { gridTemplateColumns } = useGridTemplate();
  const { titleColumn, otherColumns, getColumnWidth } = useVisibleColumns();

  const tasks = useBoardStore((s) => s.tasks);
  const groupTasks = tasks.filter((t) => t.group_id === group.id);

  return (
    <div
      className="h-9 grid items-center bg-[color:var(--color-surface)] border-b border-[color:var(--color-border-strong)] border-t-[2px]"
      style={{
        gridTemplateColumns,
        borderTopColor: "var(--group-accent)",
      }}
    >
      {/* Checkbox track — empty */}
      <div className="h-full" />

      {/* Title column slot — always empty; aggregations do not apply to titles */}
      {titleColumn && (
        <div
          className="sticky left-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] h-full border-r border-[color:var(--color-border-strong)]"
          style={{ width: getColumnWidth(titleColumn) }}
          aria-hidden="true"
        />
      )}

      {/* Per-column aggregation cells */}
      {otherColumns.map((col) => (
        <div
          key={col.id}
          className="h-full flex items-center border-l border-[color:var(--color-border-strong)] overflow-hidden"
          style={{ width: getColumnWidth(col) }}
        >
          <FooterCell col={col} groupTasks={groupTasks} />
        </div>
      ))}

      {/* Add-column slot — empty */}
      <div className="h-full" />
    </div>
  );
});
