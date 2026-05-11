"use client";

/**
 * TableCell — per-cell dispatcher for the board table.
 *
 * Renders a cell's read-mode via the CellTypeDef's <Cell /> component.
 * On click, switches to edit-mode via <CellEditor />. On editor close,
 * switches back to read-mode.
 *
 * Memoized: only re-renders when value, config, task.id, task.updated_at,
 * column.id, or column.settings change.
 *
 * Optional contract props (columnId, members) are passed through to def.Cell
 * even though they're not declared in CellTypeDef.Cell — structural
 * compatibility allows extra props; each Cell component declares them as
 * optional in its own interface. We cast the component ref to accept
 * `Record<string, unknown>` at the one JSX call site to avoid spreading `as any`.
 */

import { memo, useState } from "react";
import type { Column, Task } from "@/components/board/table/types";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import { useBoardStore } from "@/stores/board-store";

import { CellEditor } from "./CellEditor";

interface TableCellProps {
  task: Task;
  column: Column;
}

function TableCellInner({ task, column }: TableCellProps) {
  const [editing, setEditing] = useState(false);

  const columnType = column.type as CellTypeId;
  const def = getCellDef(columnType);

  const cellRow = useBoardStore((s) => s.cells.get(`${task.id}:${column.id}`));
  // biome-ignore lint/suspicious/noExplicitAny: def is heterogeneous; TValue is narrowed at the def level
  const value = def.fromRow(cellRow as any);
  const config = (column.settings ?? {}) as never;

  if (editing) {
    return <CellEditor task={task} column={column} onClose={() => setEditing(false)} />;
  }

  // Cast to a looser component type so we can pass optional contract props
  // (columnId, members) that individual Cell components accept but that
  // CellTypeDef.Cell's generic signature doesn't declare.
  // biome-ignore lint/suspicious/noExplicitAny: intentional boundary cast — each Cell component declares these as optional in its own interface
  const CellComponent = def.Cell as React.ComponentType<any>;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="cursor-pointer w-full text-left p-0 border-0 bg-transparent"
      aria-label={`Edit ${column.name ?? column.type} cell`}
    >
      {/*
        columnId — StatusCell / PriorityCell use this for label lookup
        members  — PersonCell / UpdatedByCell / CreatedByCell use this for avatar resolution;
                   undefined here → cells fall back to count-badge or initials display
      */}
      <CellComponent
        value={value}
        config={config}
        row={task}
        columnId={column.id}
        members={undefined}
      />
    </button>
  );
}

export const TableCell = memo(TableCellInner);
TableCell.displayName = "TableCell";
