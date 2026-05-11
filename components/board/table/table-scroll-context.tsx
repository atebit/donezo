"use client";

import { createContext, useContext } from "react";

/**
 * TableScrollContext — exposes imperative scroll utilities from the
 * virtualized board table to consumers (e.g. S18 keyboard navigation).
 *
 * Provider is mounted inside <BoardTable />. Consumers must be rendered
 * inside the board table subtree.
 */

export type TableScrollContextValue = {
  /**
   * Scrolls the virtualizer so that the task with the given id is centered
   * in the scroll viewport.
   *
   * No-op if the taskId is not found in the current flattened rows (e.g. the
   * task belongs to a collapsed group, or the group/task has been deleted).
   */
  scrollToTaskId: (taskId: string) => void;
};

export const TableScrollContext = createContext<TableScrollContextValue | null>(null);

/**
 * useTableScroll — typed hook for reading the TableScrollContext.
 *
 * Throws if used outside of a <BoardTable /> subtree so that missing-provider
 * bugs surface immediately in development.
 */
export function useTableScroll(): TableScrollContextValue {
  const v = useContext(TableScrollContext);
  if (!v) {
    throw new Error("useTableScroll must be used inside <BoardTable>");
  }
  return v;
}
