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
 *
 * Epic 08 S6: on mouseenter/focus, broadcasts the current user's cursor to
 * other board participants via useCursorBroadcast. CursorOverlay renders other
 * users' cursor dots inside the cell's top-right corner.
 */

import { memo, useState } from "react";
import { CursorOverlay } from "@/components/board/CursorOverlay";
import type { Column, Task } from "@/components/board/table/types";
import { useBoard } from "@/hooks/use-board";
import { useCursorBroadcast } from "@/hooks/use-cursor-broadcast";
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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const columnType = column.type as CellTypeId;
  const def = getCellDef(columnType);

  const cellRow = useBoardStore((s) => s.cells.get(`${task.id}:${column.id}`));
  // biome-ignore lint/suspicious/noExplicitAny: def is heterogeneous; TValue is narrowed at the def level
  const value = def.fromRow(cellRow as any);
  const config = (column.settings ?? {}) as never;

  // Epic 08 S6: cursor broadcast.
  // boardId is read from the store (hydrated at board mount time).
  const boardId = useBoardStore((s) => s.boardId);
  // userId comes from BoardContext — populated by the layout server component.
  const { userId } = useBoard();
  const { emit } = useCursorBroadcast(boardId ?? "", userId);

  // Cast to a looser component type so we can pass optional contract props
  // (columnId, members) that individual Cell components accept but that
  // CellTypeDef.Cell's generic signature doesn't declare.
  // biome-ignore lint/suspicious/noExplicitAny: intentional boundary cast — each Cell component declares these as optional in its own interface
  const CellComponent = def.Cell as React.ComponentType<any>;

  const isPopoverMode = def.editorMode === "popover";

  // Inline-mode editors (text, number, email, …) replace the cell content
  // in place — no anchor needed.
  if (editing && !isPopoverMode) {
    return (
      <div className="relative" data-task-id={task.id} data-column-id={column.id}>
        <CellEditor task={task} column={column} anchorEl={null} onClose={() => setEditing(false)} />
        <CursorOverlay taskId={task.id} columnId={column.id} />
      </div>
    );
  }

  // Popover-mode editors (status, date, person, …) float over the cell. The
  // button MUST stay mounted while editing so it remains the anchor for
  // Popover.Positioner — if we swap it out for <CellEditor /> the captured
  // anchorEl becomes a detached node and Base UI falls back to viewport (0,0).
  return (
    // Relative wrapper required for CursorOverlay's absolute positioning.
    <div className="relative" data-task-id={task.id} data-column-id={column.id}>
      <button
        type="button"
        onClick={(e) => {
          setAnchorEl(e.currentTarget);
          setEditing(true);
        }}
        onMouseEnter={() => emit(task.id, column.id)}
        onFocus={() => emit(task.id, column.id)}
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
      {editing && (
        <CellEditor
          task={task}
          column={column}
          anchorEl={anchorEl}
          onClose={() => setEditing(false)}
        />
      )}
      {/* Cursor overlay — renders other users' colored dots in cell top-right */}
      <CursorOverlay taskId={task.id} columnId={column.id} />
    </div>
  );
}

export const TableCell = memo(TableCellInner);
TableCell.displayName = "TableCell";
