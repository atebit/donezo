"use client";

/**
 * MigrateLegacyColumnPrefs
 *
 * One-shot client component that folds per-board `columnPrefsByBoard` localStorage
 * data (column widths + visibility) into the user's personal view config.
 *
 * Migration contract (Epic 11 / Slice F, Q7):
 * 1. On first mount, check whether `columnPrefsByBoard[boardId]` has entries.
 * 2. If entries exist AND a personal view exists for the current user, call
 *    `saveView` with the folded config patch.
 * 3. On success, call `clearLegacyColumnPrefsForBoard(boardId)` to drop the
 *    localStorage entry so the migration never runs again for this board.
 *
 * Session sentinel: a Set keyed by boardId prevents re-running the migration
 * in the same session (e.g. if the component is remounted by StrictMode or
 * a navigation-triggered unmount/remount).
 *
 * Race safety: v1 accepts that a tab race could produce duplicate "My view"
 * rows (per Epic 11 risk note #7). No unique index on (board_id, owner_id, kind).
 */

import { useEffect, useRef } from "react";
import { saveView } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions";
import { migrateLegacyColumnPrefs, selectViewsForBoard, useBoardStore } from "@/stores/board-store";

/** Session-scoped sentinel — boards that have already been migrated this session. */
const migratedBoards = new Set<string>();

interface MigrateLegacyColumnPrefsProps {
  boardId: string;
  currentUserId: string;
}

export function MigrateLegacyColumnPrefs({
  boardId,
  currentUserId,
}: MigrateLegacyColumnPrefsProps) {
  // Guard against StrictMode double-invocation (the ref is stable across
  // the double-mount; the Set would catch it too, but the ref is cheaper).
  const ranRef = useRef(false);

  useEffect(() => {
    // Idempotency: skip if already migrated this session or in this effect run.
    if (ranRef.current || migratedBoards.has(boardId)) return;
    ranRef.current = true;

    const store = useBoardStore.getState();

    // Check if there are legacy prefs to migrate.
    const prefs = store.columnPrefsByBoard[boardId] ?? {};
    if (Object.keys(prefs).length === 0) {
      // Nothing to migrate — mark done and bail.
      migratedBoards.add(boardId);
      return;
    }

    // Find the personal view for this user on this board.
    const views = selectViewsForBoard(store, boardId);
    const personalView = views.find((v) => v.owner_id === currentUserId && !v.is_shared);

    if (!personalView) {
      // No personal view yet — this can happen if the auto-create hasn't
      // propagated to the store. Migration deferred; will retry on next mount.
      return;
    }

    // Extract the config patch from legacy prefs.
    const { columnWidths, columnVisibility } = migrateLegacyColumnPrefs(store, boardId);

    // Merge with the view's existing config — legacy prefs only fill in gaps
    // (don't overwrite values already stored in the view config).
    const existingConfig =
      personalView.config &&
      typeof personalView.config === "object" &&
      !Array.isArray(personalView.config)
        ? (personalView.config as Record<string, unknown>)
        : {};

    const mergedWidths = {
      ...(columnWidths as Record<string, number>),
      ...((existingConfig.columnWidths as Record<string, number> | undefined) ?? {}),
    };
    const mergedVisibility = {
      ...(columnVisibility as Record<string, boolean>),
      ...((existingConfig.columnVisibility as Record<string, boolean> | undefined) ?? {}),
    };

    const newConfig = {
      ...existingConfig,
      ...(Object.keys(mergedWidths).length > 0 ? { columnWidths: mergedWidths } : {}),
      ...(Object.keys(mergedVisibility).length > 0 ? { columnVisibility: mergedVisibility } : {}),
    };

    // Skip save if there's nothing meaningful to write.
    if (Object.keys(columnWidths).length === 0 && Object.keys(columnVisibility).length === 0) {
      migratedBoards.add(boardId);
      store.clearLegacyColumnPrefsForBoard(boardId);
      return;
    }

    // Fire-and-forget: save the migrated config. On success, clear the legacy prefs.
    void saveView({ viewId: personalView.id, config: newConfig }).then((result) => {
      if (result.ok) {
        // Update the store with the freshly saved view row.
        store.applyViewUpsert(result.data);
        store.clearLegacyColumnPrefsForBoard(boardId);
        migratedBoards.add(boardId);
      }
      // On failure: leave the legacy prefs in place — they'll be retried on
      // the next hard page load. The migration is idempotent so this is safe.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, currentUserId]);

  // This component renders nothing — it's a pure side-effect component.
  return null;
}
