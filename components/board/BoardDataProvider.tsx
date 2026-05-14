"use client";

/**
 * BoardDataProvider — hydrates the board store and mounts Realtime ONCE per board.
 *
 * Lifted from BoardTable.tsx so alt-view pages (kanban, calendar, timeline,
 * dashboard, form) can sit inside the same data substrate without each one
 * re-hydrating.
 *
 * Mount contract:
 *   - The provider is mounted by the board layout (layout.tsx) wrapping {children}.
 *   - It is keyed on `boardId` at the layout level so navigating between view
 *     kinds within the same board does NOT remount the provider.
 *   - A new board navigation (different boardId) triggers a full remount.
 *
 * Hydration order (matches the original BoardTable.tsx order):
 *   1. hydrate({ boardId, groups, tasks, cells })
 *   2. hydrateAttachmentsForBoard(attachments)
 *   3. hydrateViewsForBoard(boardId, views)
 *   4. setActiveViewId(activeViewId)
 *
 * Realtime:
 *   - useBoardRealtime(boardId, userId) is called here once. When the provider
 *     stays mounted across kind navigation (which it does because the layout
 *     is a persistent RSC wrapper), the realtime subscription stays open.
 *
 * Outbox flushing:
 *   - The 'online' and Zustand 'connected' triggers that flush the outbox are
 *     also mounted here (moved from BoardTable).
 */

import { type ReactNode, useEffect, useRef } from "react";
import { MigrateLegacyColumnPrefs } from "@/components/board/MigrateLegacyColumnPrefs";
import type { TableData } from "@/components/board/table/types";
import { useBoardRealtime } from "@/hooks/use-board-realtime";
import { flushOutbox } from "@/lib/realtime/outbox";
import type { Database } from "@/lib/supabase/types";
import { useBoardStore } from "@/stores/board-store";

type LabelRow = Database["public"]["Tables"]["label"]["Row"];

interface BoardDataProviderProps {
  boardId: string;
  userId: string;
  initial: TableData;
  /**
   * Labels for all status/priority columns on this board.
   * Passed separately (not via TableData) to keep the TableData type stable
   * while Slice A refactors table layout concerns.
   *
   * Without this, labelsByColumn is always empty after page load, causing:
   *   (a) all status/priority cells to render gray (label not resolvable), and
   *   (b) the "same-type column independence" regression where two status columns
   *       appear to share state because neither can resolve its own label set.
   *
   * Slice F root-cause fix — epic 16.
   */
  labels?: LabelRow[];
  children: ReactNode;
}

export function BoardDataProvider({
  boardId,
  userId,
  initial,
  labels,
  children,
}: BoardDataProviderProps) {
  const hydratedRef = useRef<string | null>(null);

  // Mount the board-scoped Realtime subscription (postgres_changes + presence +
  // broadcast). This hook owns channel lifecycle; cleanup on unmount.
  // Since the provider stays mounted across intra-board kind navigation,
  // the subscription is opened once per board and only closes when leaving
  // the board entirely.
  useBoardRealtime(boardId, userId);

  // Flush any queued outbox entries on reconnect or when the browser comes back online.
  // Moved from BoardTable so alt-view pages don't each attach their own listener.
  useEffect(() => {
    const onOnline = () => {
      void flushOutbox();
    };
    window.addEventListener("online", onOnline);

    // Zustand v5: subscribe(listener) receives (state, prevState).
    const unsub = useBoardStore.subscribe((state, prevState) => {
      if (prevState.connection !== "connected" && state.connection === "connected") {
        void flushOutbox();
      }
    });

    return () => {
      window.removeEventListener("online", onOnline);
      unsub();
    };
  }, []);

  // StrictMode-safe hydration keyed on boardId.
  // Using a ref (not state) so the hydration check doesn't trigger a re-render.
  //
  // The dep array deliberately ONLY includes boardId — initial.* is bootstrap data
  // passed once from the server; it is NOT reactive state. Changing the initial
  // prop on the same boardId must NOT re-hydrate (that would lose optimistic state).
  //
  // biome-ignore lint/correctness/useExhaustiveDependencies: boardId is the only re-hydration trigger; initial.* is bootstrap data
  useEffect(() => {
    if (hydratedRef.current === boardId) return;
    hydratedRef.current = boardId;

    const store = useBoardStore.getState();
    store.hydrate({
      boardId,
      groups: initial.groups,
      tasks: initial.tasks,
      cells: initial.cells,
      columns: initial.columns,
      labels: labels ?? [],
    });
    // Epic 10 — hydrate board-level attachments (idempotent, filters non-uploaded)
    store.hydrateAttachmentsForBoard(initial.attachments ?? []);
    // Epic 11 / Slice F — hydrate server-resolved views and the initial active view id.
    if (initial.views && initial.views.length > 0) {
      store.hydrateViewsForBoard(boardId, initial.views);
    }
    if (initial.activeViewId !== undefined) {
      store.setActiveViewId(initial.activeViewId ?? null);
    }

    return () => {
      // Only reset when the boardId actually changes (different board), not on
      // intra-board kind navigation. The cleanup runs on unmount OR when boardId
      // changes; since the layout is keyed on boardId, a boardId change causes
      // a full remount which unmounts this effect and runs cleanup.
      if (hydratedRef.current === boardId) {
        store.reset();
        hydratedRef.current = null;
      }
    };
  }, [boardId]);

  return (
    <>
      {/* One-shot migration of legacy columnPrefsByBoard into the personal view
          config. Moved from BoardTable so it runs for all view kinds, not just table. */}
      <MigrateLegacyColumnPrefs boardId={boardId} currentUserId={userId} />
      {children}
    </>
  );
}
