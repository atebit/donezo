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
import type { AggregateRenderDescriptor } from "@/lib/cells/aggregate-descriptors";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import { useBoardStore } from "@/stores/board-store";
import { AggregateRender } from "./AggregateRender";

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
  // Slice C: use defaultAggregation first; fall back to aggregations[0]
  const kind = def.defaultAggregation ?? def.aggregations[0];

  if (kind === undefined) {
    return null;
  }

  const values = groupTasks.map((t) => def.fromRow(cells.get(`${t.id}:${col.id}`) ?? undefined));

  const config: unknown = (col.settings ?? {}) as unknown;
  const labels = labelsByColumn.get(col.id) ?? [];

  let result: string | AggregateRenderDescriptor;
  try {
    // Pass labels in config so label-aware aggregators (status, priority, tags)
    // can build distribution segments. Labels come from Zustand store (hydrated
    // by Slice F / Realtime), NOT from the aggregate signature — per spec.
    result = def.aggregate(values, kind, {
      ...(config as object),
      _labels: labels,
    } as Parameters<typeof def.aggregate>[2]);
  } catch {
    result = "—";
  }

  // String returns: wrap in a text descriptor for uniform rendering path
  const descriptor: AggregateRenderDescriptor =
    typeof result === "string" ? { kind: "text", value: result } : result;

  return (
    <div className="flex items-center justify-start px-2 w-full h-full overflow-hidden">
      <AggregateRender descriptor={descriptor} />
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
