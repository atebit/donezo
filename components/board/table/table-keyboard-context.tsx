"use client";

import { createContext, useContext } from "react";
import type { EditableTitleHandle } from "@/components/shared/EditableTitle";
import type { UseTableKeyboardNavReturn } from "@/hooks/use-table-keyboard-nav";

/**
 * Context value type — extends the keyboard nav hook's return with methods
 * for TaskTitleCell / GroupHeaderRow to register their EditableTitleHandle refs
 * so the controller can imperatively trigger edit mode (e.g. via overflow-menu
 * Rename items).
 */
type TableKeyboardContextValue = UseTableKeyboardNavReturn & {
  /**
   * Called by TaskTitleCell on mount (ref !== null) and unmount (ref === null)
   * to keep the titleCellRefs map up to date.
   */
  registerTitleCellRef: (taskId: string, ref: EditableTitleHandle | null) => void;
  /**
   * Called by GroupHeaderRow on mount (ref !== null) and unmount (ref === null)
   * to keep the groupTitleRefs map up to date.
   */
  registerGroupTitleRef: (groupId: string, ref: EditableTitleHandle | null) => void;
  /**
   * Imperatively focuses (enters edit mode on) the EditableTitle for the given
   * task id. Called by TaskOverflowMenu's Rename item.
   */
  focusTaskTitle: (taskId: string) => void;
  /**
   * Imperatively focuses (enters edit mode on) the EditableTitle for the given
   * group id. Called by GroupOverflowMenu's Rename item.
   */
  focusGroupTitle: (groupId: string) => void;
};

export const TableKeyboardContext = createContext<TableKeyboardContextValue | null>(null);

/**
 * useTableKeyboard — typed consumer hook.
 *
 * Throws if used outside of a <BoardTable /> subtree so that missing-provider
 * bugs surface immediately in development.
 */
export function useTableKeyboard(): TableKeyboardContextValue {
  const v = useContext(TableKeyboardContext);
  if (!v) {
    throw new Error("useTableKeyboard must be used inside <BoardTable>");
  }
  return v;
}
