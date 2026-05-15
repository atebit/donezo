"use client";

import { useShallow } from "zustand/react/shallow";
import { selectEffectiveConfig, useBoardStore } from "@/stores/board-store";
import type { Column } from "./types";

const DEFAULT_TITLE_WIDTH = 336;
const DEFAULT_COLUMN_WIDTH = 140;

// The primary/title column is whichever text column comes first; its cells
// render the task title (not the column's own values), so its name is
// cosmetic. The header always shows this fixed label instead of the
// underlying column's name.
export const TITLE_COLUMN_LABEL = "Task";

export interface VisibleColumnsResult {
  visibleColumns: Column[];
  titleColumn: Column | undefined;
  otherColumns: Column[];
  getColumnWidth: (col: Column) => number;
}

export function useVisibleColumns(): VisibleColumnsResult {
  const columns = useBoardStore(
    useShallow((s) => [...s.columns].sort((a, b) => a.position - b.position)),
  );

  const { boardId, columnPrefsByBoard } = useBoardStore(
    useShallow((s) => ({ boardId: s.boardId, columnPrefsByBoard: s.columnPrefsByBoard })),
  );

  const effectiveConfig = useBoardStore(selectEffectiveConfig);

  const boardPrefs = boardId ? (columnPrefsByBoard[boardId] ?? {}) : {};

  const visibleColumns = columns.filter((col) => {
    if (effectiveConfig.columnVisibility && col.id in effectiveConfig.columnVisibility) {
      return effectiveConfig.columnVisibility[col.id] !== false;
    }
    return !boardPrefs[col.id]?.hidden;
  });

  const textColumns = visibleColumns.filter((c) => c.type === "text");
  const titleColumn: Column | undefined =
    textColumns.length > 0
      ? textColumns.reduce<Column | undefined>(
          (min, c) => (min === undefined || c.position < min.position ? c : min),
          undefined,
        )
      : visibleColumns[0];

  const otherColumns = titleColumn
    ? visibleColumns.filter((c) => c.id !== titleColumn.id)
    : visibleColumns;

  const getColumnWidth = (col: Column): number => {
    if (effectiveConfig.columnWidths && col.id in effectiveConfig.columnWidths) {
      const viewWidth = effectiveConfig.columnWidths[col.id];
      if (viewWidth !== undefined) return viewWidth;
    }
    const pref = boardPrefs[col.id]?.width;
    if (pref !== undefined) return pref;
    return col.id === titleColumn?.id ? DEFAULT_TITLE_WIDTH : DEFAULT_COLUMN_WIDTH;
  };

  return { visibleColumns, titleColumn, otherColumns, getColumnWidth };
}
