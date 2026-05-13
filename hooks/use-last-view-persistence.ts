"use client";

/**
 * useLastViewPersistence — writes the active view ID to profile.last_view_per_board
 * whenever the active view changes, following the Q24 contract:
 *
 *   - Debounce 750ms after the last view-switch event.
 *   - Flush on `pagehide` (browser close / tab switch).
 *   - Cap one write per 2s (MIN_WRITE_INTERVAL_MS).
 *
 * Called from ViewTabs so that last-view is persisted across board page loads
 * without touching the realtime hook or the layout RSC.
 */

import { useCallback, useEffect, useRef } from "react";
import { setLastViewForBoard } from "@/app/(app)/account/last-view-actions";

const DEBOUNCE_MS = 750;
const MIN_WRITE_INTERVAL_MS = 2000;

export function useLastViewPersistence(boardId: string, activeViewId: string | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef = useRef<number>(0);
  const pendingRef = useRef<{ boardId: string; viewId: string } | null>(null);

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;

    const now = Date.now();
    const elapsed = now - lastWriteRef.current;
    if (elapsed < MIN_WRITE_INTERVAL_MS) return; // cap writes

    lastWriteRef.current = now;
    // Fire and forget — preference persistence; errors are non-fatal.
    setLastViewForBoard({ boardId: pending.boardId, viewId: pending.viewId }).catch(() => {
      // Silent — this is a best-effort UX preference write.
    });
  }, []);

  const schedule = useCallback(
    (bid: string, vid: string) => {
      pendingRef.current = { boardId: bid, viewId: vid };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [flush],
  );

  // Schedule a write whenever activeViewId changes.
  useEffect(() => {
    if (!activeViewId) return;
    schedule(boardId, activeViewId);
  }, [boardId, activeViewId, schedule]);

  // Flush on pagehide (tab close / navigation away).
  useEffect(() => {
    const handlePageHide = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      flush();
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [flush]);
}
