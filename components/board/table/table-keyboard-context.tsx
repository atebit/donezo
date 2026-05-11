"use client";

import { createContext, useContext } from "react";
import type { EditableTitleHandle } from "@/components/shared/EditableTitle";
import type { UseTableKeyboardNavReturn } from "@/hooks/use-table-keyboard-nav";

/**
 * Context value type — extends the keyboard nav hook's return with a method
 * for TaskTitleCell to register its EditableTitleHandle ref so the controller
 * can imperatively trigger edit mode.
 */
type TableKeyboardContextValue = UseTableKeyboardNavReturn & {
  /**
   * Called by TaskTitleCell on mount (ref !== null) and unmount (ref === null)
   * to keep the titleCellRefs map up to date.
   */
  registerTitleCellRef: (taskId: string, ref: EditableTitleHandle | null) => void;
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
