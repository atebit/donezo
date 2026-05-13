"use client";

/**
 * TaskCard — shared card renderer used by Kanban / Calendar / Timeline.
 *
 * Visual contract:
 *   - bg white (var(--color-surface)), radius 4px, shadow var(--shadow-card),
 *     font 13px, padding 8px.
 *   - Title row; configured cells stacked below (up to 5, 36px each).
 *   - Comment count badge top-right (14×13, bg var(--color-primary)).
 *   - Clicking the card calls onClick(task.id) → opens drawer via Link intercept.
 *
 * Defaults when `cardStyle` is undefined: show title only, no extra cells,
 * avatars off, due date off.
 */

import type { Cell, Column, Task } from "@/components/board/table/types";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import type { CardStyle } from "@/lib/views/config-schema";

interface TaskCardProps {
  task: Task;
  /** Map from `${task_id}:${column_id}` to the Cell row. */
  cellsByKey: Map<string, Cell>;
  columns: Column[];
  cardStyle: CardStyle | undefined;
  /** When provided, called on card click. */
  onClick?: (taskId: string) => void;
  /** Optional drag attributes from the parent (dnd-kit useDraggable). */
  dragAttributes?: Record<string, unknown>;
  /** Optional drag listeners from the parent (dnd-kit useDraggable). */
  dragListeners?: Record<string, unknown>;
}

export function TaskCard({
  task,
  cellsByKey,
  columns,
  cardStyle,
  onClick,
  dragAttributes,
  dragListeners,
}: TaskCardProps) {
  // Resolve the up-to-5 visible columns in declared order.
  const visibleCols = (cardStyle?.visibleColumnIds ?? [])
    .slice(0, 5)
    .map((id) => columns.find((c) => c.id === id))
    .filter((c): c is Column => Boolean(c));

  function handleClick() {
    if (onClick) {
      onClick(task.id);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Task: ${task.title}`}
      className="w-full text-left bg-[color:var(--color-surface)] rounded border border-[color:var(--color-border)] shadow-[var(--shadow-card)] p-2 cursor-pointer select-none"
      style={{ fontSize: "13px" }}
      // biome-ignore lint/suspicious/noExplicitAny: dnd-kit drag attributes/listeners are untyped at usage site
      {...((dragAttributes as any) ?? {})}
      // biome-ignore lint/suspicious/noExplicitAny: dnd-kit drag attributes/listeners are untyped at usage site
      {...((dragListeners as any) ?? {})}
    >
      {/* Title row */}
      <div className="font-medium text-[color:var(--color-fg)] truncate leading-[36px]">
        {task.title}
      </div>

      {/* Configured cell rows (read-only, up to 5) */}
      {visibleCols.map((col) => {
        const cellKey = `${task.id}:${col.id}`;
        const cell = cellsByKey.get(cellKey);
        // biome-ignore lint/suspicious/noExplicitAny: getCellDef returns CellTypeDef<any,any> per registry typing
        const def = getCellDef(col.type as CellTypeId) as any;

        let value: unknown = null;
        try {
          value = def.fromRow(cell ?? undefined);
        } catch {
          // If fromRow throws (e.g. type not yet implemented), skip this cell.
          return null;
        }

        const config = col.settings ?? {};

        // def.Cell expects { value, config, row } per CellTypeDef contract.
        // biome-ignore lint/suspicious/noExplicitAny: heterogeneous cell values; narrowing happens inside each Cell component
        const CellComponent = def.Cell as React.ComponentType<any>;

        return (
          <div
            key={col.id}
            className="h-9 flex items-center overflow-hidden bg-[color:var(--color-surface-info)] rounded px-1 mt-1"
          >
            <CellComponent value={value} config={config} row={task} />
          </div>
        );
      })}
    </button>
  );
}
