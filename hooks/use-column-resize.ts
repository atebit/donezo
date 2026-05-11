"use client";

/**
 * useColumnResize — pointer-event drag hook for column width resizing.
 *
 * Lifecycle:
 *   1. onPointerDown  — captures startX and startWidth; acquires pointer capture
 *                       on the handle element so move/up fire even if the pointer
 *                       leaves the element.
 *   2. onPointerMove  — computes the new width (clamped to [MIN_WIDTH, MAX_WIDTH])
 *                       and schedules a single store write per animation frame via
 *                       requestAnimationFrame to batch rapid pointer events.
 *   3. onPointerUp    — releases the drag state; cancels any pending RAF.
 *
 * Width is persisted to localStorage (Zustand persist middleware) via
 * `useBoardStore.getState().setColumnWidth(columnId, width)`.
 * The consumer (ColumnResize.tsx) passes `currentWidth` down from the store on
 * each render so the resize handle stays in sync.
 *
 * Pointer capture note: `setPointerCapture` is broadly supported (all modern
 * browsers). Older browsers that lack it will still work — the pointer-up event
 * will simply not fire if the pointer leaves the window, leaving `startRef`
 * non-null. This is a known v1 limitation and ships as-is per the spec.
 */

import { useRef } from "react";

import { useBoardStore } from "@/stores/board-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum column width in pixels. */
export const MIN_WIDTH = 60;

/** Maximum column width in pixels. */
export const MAX_WIDTH = 600;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useColumnResize(columnId: string, currentWidth: number) {
  /** Stores the pointer's X at drag start and the column width at drag start. */
  const startRef = useRef<{ x: number; width: number } | null>(null);

  /** Tracks the pending requestAnimationFrame id (null when no frame is queued). */
  const rafRef = useRef<number | null>(null);

  /** Stores the latest computed width so the RAF callback reads a fresh value. */
  const pendingWidthRef = useRef<number | null>(null);

  // -------------------------------------------------------------------------
  // onPointerDown — begin resize
  // -------------------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, width: currentWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  // -------------------------------------------------------------------------
  // onPointerMove — update width during resize
  // -------------------------------------------------------------------------
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startRef.current) return;

    const delta = e.clientX - startRef.current.x;
    const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startRef.current.width + delta));

    pendingWidthRef.current = next;

    // Schedule a store write for the next animation frame (debounce rapid events).
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingWidthRef.current !== null) {
          useBoardStore.getState().setColumnWidth(columnId, pendingWidthRef.current);
        }
      });
    }
  };

  // -------------------------------------------------------------------------
  // onPointerUp — end resize
  // -------------------------------------------------------------------------
  const handlePointerUp = () => {
    startRef.current = null;

    // Cancel any pending RAF — the final width has already been committed (or
    // the user released without moving, in which case no write is needed).
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  };
}
