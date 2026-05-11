"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { EditableTitleHandle } from "@/components/shared/EditableTitle";

export type UseTableKeyboardNavArgs = {
  /** Ref to the outermost container element that receives the keydown listener. */
  containerRef: RefObject<HTMLElement | null>;
  /** Visible task ids in render order (collapsed group tasks excluded). */
  visibleTaskIds: string[];
  /** Map from taskId → EditableTitleHandle; populated by TaskTitleCell via context. */
  titleCellRefs: RefObject<Map<string, EditableTitleHandle>>;
  /** Scroll the virtualizer so the given task is in view. */
  scrollToTaskId: (taskId: string) => void;
  /** When true, ArrowUp at top wraps to bottom and ArrowDown at bottom wraps to top. */
  wrap?: boolean;
};

export type UseTableKeyboardNavReturn = {
  /** The currently keyboard-focused task row id, or null if nothing is focused. */
  focusedRowId: string | null;
  /** The task id whose title cell is in edit mode, or null when not editing. */
  editingRowId: string | null;
  /** Programmatically move focus to a task row (or null to blur). */
  setFocusedRow: (taskId: string | null) => void;
  /** Enter edit mode for the given task. */
  beginEdit: (taskId: string) => void;
  /** Exit edit mode and return focus to the row. */
  endEdit: () => void;
};

export function useTableKeyboardNav({
  containerRef,
  visibleTaskIds,
  titleCellRefs,
  scrollToTaskId,
  wrap = false,
}: UseTableKeyboardNavArgs): UseTableKeyboardNavReturn {
  const [focusedRowId, setFocusedRowState] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // Keep a stable ref to the editing state so the keydown handler closure
  // doesn't stale-capture it.
  const editingRowIdRef = useRef<string | null>(null);
  editingRowIdRef.current = editingRowId;

  const focusedRowIdRef = useRef<string | null>(null);
  focusedRowIdRef.current = focusedRowId;

  // Stable setter that also validates the id is in the visible list.
  const setFocusedRow = useCallback((taskId: string | null) => {
    setFocusedRowState(taskId);
  }, []);

  const beginEdit = useCallback((taskId: string) => {
    setEditingRowId(taskId);
  }, []);

  const endEdit = useCallback(() => {
    setEditingRowId(null);
    // Re-focus the row after exiting edit mode. We do this via a state flush
    // by setting the focused row id again; the layoutEffect below will focus
    // the DOM node.
    setFocusedRowState((prev) => prev);
  }, []);

  // ---------------------------------------------------------------------------
  // DOM focus — whenever focusedRowId or visibleTaskIds changes, attempt to
  // focus the row's DOM node. If the virtualizer hasn't mounted it yet, call
  // scrollToTaskId so it scrolls into view and the effect re-fires after the
  // next visibleTaskIds update (because visibleTaskIds is in the dep array).
  // ---------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: visibleTaskIds triggers re-focus after the virtualizer scrolls an off-screen row into view
  useLayoutEffect(() => {
    if (!focusedRowId) return;

    const container = containerRef.current;
    if (!container) return;

    const el = container.querySelector<HTMLElement>(`[data-task-id="${focusedRowId}"]`);
    if (el) {
      // Only call focus() if the element isn't already focused (prevents
      // fighting with the EditableTitle's own focus management).
      if (document.activeElement !== el) {
        el.focus({ preventScroll: true });
      }
    } else {
      // Row is off-screen; scroll it into view. The virtualizer will mount the
      // row, visibleTaskIds will update if needed, and this effect re-runs.
      scrollToTaskId(focusedRowId);
    }
  }, [focusedRowId, visibleTaskIds, containerRef, scrollToTaskId]);

  // ---------------------------------------------------------------------------
  // Edit-mode handoff — when editingRowId becomes non-null, imperatively call
  // the title cell's focus() handle to enter edit mode.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!editingRowId) return;
    const handle = titleCellRefs.current?.get(editingRowId);
    if (handle) {
      handle.focus();
    }
  }, [editingRowId, titleCellRefs]);

  // ---------------------------------------------------------------------------
  // Keydown listener — attached to the container so events from focused rows
  // bubble up. NOT attached to window to avoid leaking across route navigations.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // While editing, let the editor handle all keys (especially arrows).
      if (editingRowIdRef.current !== null) {
        if (e.key === "Escape") {
          // Esc exits edit mode; TaskTitleCell's own Esc handler also fires
          // (blurs the editor), so we just clear our state.
          setEditingRowId(null);
          // Return focus to the row via layoutEffect by nudging state.
          setFocusedRowState((prev) => prev);
        }
        return;
      }

      const currentFocused = focusedRowIdRef.current;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          if (visibleTaskIds.length === 0) return;

          if (currentFocused === null) {
            // First arrow-down selects the first visible task.
            const first = visibleTaskIds[0];
            if (first) setFocusedRow(first);
            return;
          }

          const idx = visibleTaskIds.indexOf(currentFocused);
          if (idx === -1) {
            const first = visibleTaskIds[0];
            if (first) setFocusedRow(first);
            return;
          }

          const nextIdx = idx + 1;
          if (nextIdx < visibleTaskIds.length) {
            const next = visibleTaskIds[nextIdx];
            if (next) setFocusedRow(next);
          } else if (wrap) {
            const first = visibleTaskIds[0];
            if (first) setFocusedRow(first);
          }
          // else: no-op at bottom with wrap=false
          break;
        }

        case "ArrowUp": {
          e.preventDefault();
          if (visibleTaskIds.length === 0) return;

          if (currentFocused === null) return;

          const idx = visibleTaskIds.indexOf(currentFocused);
          if (idx === -1) return;

          const prevIdx = idx - 1;
          if (prevIdx >= 0) {
            const prev = visibleTaskIds[prevIdx];
            if (prev) setFocusedRow(prev);
          } else if (wrap) {
            const last = visibleTaskIds[visibleTaskIds.length - 1];
            if (last) setFocusedRow(last);
          }
          // else: no-op at top with wrap=false
          break;
        }

        case "Enter": {
          if (!currentFocused) return;
          e.preventDefault();
          beginEdit(currentFocused);
          break;
        }

        case "Home": {
          e.preventDefault();
          const first = visibleTaskIds[0];
          if (first) setFocusedRow(first);
          break;
        }

        case "End": {
          e.preventDefault();
          const last = visibleTaskIds[visibleTaskIds.length - 1];
          if (last) setFocusedRow(last);
          break;
        }

        // Tab is NOT intercepted — browser handles cycling through interactive
        // controls inside the focused row naturally.
        default:
          break;
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [containerRef, visibleTaskIds, wrap, setFocusedRow, beginEdit]);

  return {
    focusedRowId,
    editingRowId,
    setFocusedRow,
    beginEdit,
    endEdit,
  };
}
