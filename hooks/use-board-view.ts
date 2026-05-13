"use client";

/**
 * useBoardView — canonical hook for the view state machine.
 *
 * Reads URL params (?view, ?f, ?s, ?g, ?q, ?d) and syncs them with the
 * board store's active view and draft config.
 *
 * Design notes:
 * - URL is the source of truth for draft state. The hook decodes URL params
 *   on mount and whenever the URL changes.
 * - `applyDraft` is debounced 200 ms to avoid history thrash on rapid edits.
 * - `router.replace()` is used (not push) so URL changes don't litter history.
 * - Every multi-field store selector uses `useShallow` per the
 *   donezo-zustand-v5-selectors MEMORY note.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { saveView } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions";
import { useBoard } from "@/hooks/use-board";
import type { Role } from "@/lib/authorization";
import {
  DensitySchema as densitySchemaValidator,
  GroupBySchema,
  parseViewConfig,
  type ViewConfig,
  type ViewKind,
} from "@/lib/views/config-schema";
import { kindFromPath, pathForKind } from "@/lib/views/kind-routes";
import {
  decodeFilterTree,
  decodeSortKeys,
  encodeFilterTree,
  encodeSortKeys,
  URL_PARAM_KEYS,
} from "@/lib/views/url-codec";
import {
  selectActiveView,
  selectEffectiveConfig,
  selectHasDraftEdits,
  selectViewsForBoard,
  useBoardStore,
} from "@/stores/board-store";
import type { ViewRow } from "@/stores/types/views";

export interface UseBoardViewResult {
  /** The view row currently selected (from URL → last → default). */
  active: ViewRow | null;
  /** The merged config: draft overrides on top of view.config. */
  effective: ViewConfig;
  /** Has the user edited the active view's config? */
  hasUnsavedChanges: boolean;
  /** Apply a partial config patch to the draft. */
  applyDraft: (patch: Partial<ViewConfig>) => void;
  /** Clear the draft (reverts to saved view.config). */
  resetDraft: () => void;
  /**
   * Persist the current effective config back to the active view.
   * Placeholder — the actual server action is wired in Slice E.
   * Throws if called before Slice E is wired.
   */
  save: () => Promise<void>;
  /** Switch the active view; clears draft and pushes ?view=<id>. */
  switchView: (viewId: string) => void;
  /** All views for the current board, sorted by position. */
  views: ViewRow[];
  /** Current user's board role. */
  role: Role;
}

/**
 * Debounce helper — returns a stable callback that defers `fn` by `delayMs`.
 * The timer resets on each call within the delay window.
 */
function useDebounced<T extends (...args: never[]) => unknown>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );
}

export function useBoardView(): UseBoardViewResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { board, role, workspaceSlug } = useBoard();
  const boardId = board.id;

  // ---------------------------------------------------------------------------
  // Store selectors — all multi-field reads use useShallow
  // ---------------------------------------------------------------------------
  const { active, effective, hasUnsavedChanges } = useBoardStore(
    useShallow((s) => ({
      active: selectActiveView(s),
      effective: selectEffectiveConfig(s),
      hasUnsavedChanges: selectHasDraftEdits(s),
    })),
  );

  const views = useBoardStore(useShallow((s) => selectViewsForBoard(s, boardId)));

  // ---------------------------------------------------------------------------
  // Sync URL params → store on mount and URL change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const store = useBoardStore.getState();

    // 1. Resolve active view id from URL → lastViewByBoard → first view.
    const urlViewId = searchParams.get(URL_PARAM_KEYS.view);
    const lastViewId = store.lastViewByBoard[boardId];
    const boardViews = selectViewsForBoard(store, boardId);

    let resolvedViewId: string | null = null;
    if (urlViewId && boardViews.some((v) => v.id === urlViewId)) {
      resolvedViewId = urlViewId;
    } else if (lastViewId && boardViews.some((v) => v.id === lastViewId)) {
      resolvedViewId = lastViewId;
    } else {
      // Find the "Main table" (is_shared=true, name="Main table") or first by position.
      const mainTable = boardViews.find((v) => v.is_shared && v.name === "Main table");
      resolvedViewId = mainTable?.id ?? boardViews[0]?.id ?? null;
    }

    // Only update if different to avoid spurious re-renders.
    if (resolvedViewId !== store.activeViewId) {
      store.setActiveViewId(resolvedViewId);
    }

    // 2. Decode URL params into draftConfig if they differ from saved view config.
    const urlFilter = searchParams.get(URL_PARAM_KEYS.filter);
    const urlSort = searchParams.get(URL_PARAM_KEYS.sort);
    const urlGroupBy = searchParams.get(URL_PARAM_KEYS.groupBy);
    const urlSearch = searchParams.get(URL_PARAM_KEYS.search);
    const urlDensity = searchParams.get(URL_PARAM_KEYS.density);

    const hasUrlDraft = urlFilter || urlSort || urlGroupBy || urlSearch || urlDensity;

    if (hasUrlDraft) {
      const patch: Partial<ViewConfig> = {};

      if (urlFilter) {
        const decoded = decodeFilterTree(urlFilter);
        if (decoded) patch.filter = decoded;
      }
      if (urlSort) {
        const decoded = decodeSortKeys(urlSort);
        if (decoded) patch.sort = decoded;
      }
      if (urlGroupBy) {
        // groupBy is encoded as the columnId or "native".
        const raw =
          urlGroupBy === "native"
            ? { kind: "native" as const }
            : { kind: "column" as const, columnId: urlGroupBy };
        const parsed = GroupBySchema.safeParse(raw);
        if (parsed.success) patch.groupBy = parsed.data;
      }
      if (urlSearch) {
        patch.search = urlSearch;
        store.setInBoardSearch(urlSearch);
      }
      if (urlDensity) {
        const parsed = densitySchemaValidator.safeParse(urlDensity);
        if (parsed.success) patch.density = parsed.data;
      }

      // Merge patch with the active view's saved config.
      const activeView = boardViews.find((v) => v.id === resolvedViewId);
      const savedConfig = activeView ? parseViewConfig(activeView.config) : {};
      const merged = { ...savedConfig, ...patch };
      store.setDraftConfig(merged);
    } else {
      // No URL draft params — clear any existing draft.
      if (store.draftConfig !== null) {
        store.setDraftConfig(null);
      }
    }
  }, [boardId, searchParams]);

  // ---------------------------------------------------------------------------
  // applyDraft — merges a partial config patch, encodes to URL, debounced 200ms
  // ---------------------------------------------------------------------------
  const applyDraftImmediate = useCallback(
    (patch: Partial<ViewConfig>) => {
      const store = useBoardStore.getState();
      const current = store.draftConfig ?? selectEffectiveConfig(store);
      const next: ViewConfig = { ...current, ...patch };
      store.setDraftConfig(next);

      // Also sync sortKeys to store if patch includes sort.
      if (patch.sort !== undefined) {
        store.setSortKeys(patch.sort ?? []);
      }
      if (patch.search !== undefined) {
        store.setInBoardSearch(patch.search ?? "");
      }

      // Encode to URL params.
      const params = new URLSearchParams(searchParams.toString());

      // Strip all view params then re-add.
      for (const key of Object.values(URL_PARAM_KEYS)) {
        params.delete(key);
      }

      // Re-add view id if set.
      const viewId = store.activeViewId;
      if (viewId) params.set(URL_PARAM_KEYS.view, viewId);

      // Encode filter.
      if (next.filter) {
        const encoded = encodeFilterTree(next.filter);
        if (encoded) params.set(URL_PARAM_KEYS.filter, encoded);
      }
      // Encode sort.
      if (next.sort && next.sort.length > 0) {
        const encoded = encodeSortKeys(next.sort);
        if (encoded) params.set(URL_PARAM_KEYS.sort, encoded);
      }
      // Encode groupBy.
      if (next.groupBy) {
        const val = next.groupBy.kind === "native" ? "native" : next.groupBy.columnId;
        params.set(URL_PARAM_KEYS.groupBy, val);
      }
      // Encode search.
      if (next.search) {
        params.set(URL_PARAM_KEYS.search, next.search);
      }
      // Encode density.
      if (next.density) {
        params.set(URL_PARAM_KEYS.density, next.density);
      }

      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [searchParams, pathname, router],
  );

  const applyDraft = useDebounced(applyDraftImmediate, 200);

  // ---------------------------------------------------------------------------
  // resetDraft — clears draft config and strips URL params (keeps ?view only).
  // ---------------------------------------------------------------------------
  const resetDraft = useCallback(() => {
    useBoardStore.getState().setDraftConfig(null);
    useBoardStore.getState().setSortKeys([]);
    useBoardStore.getState().setInBoardSearch("");

    const params = new URLSearchParams();
    const viewId = useBoardStore.getState().activeViewId;
    if (viewId) params.set(URL_PARAM_KEYS.view, viewId);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }, [pathname, router]);

  // ---------------------------------------------------------------------------
  // save — calls saveView (Slice E) with the current effective config.
  // Wired in Slice D per the cross-slice TODO in the placeholder body.
  // ---------------------------------------------------------------------------
  const save = useCallback(async (): Promise<void> => {
    const store = useBoardStore.getState();
    const currentActive = selectActiveView(store);
    if (!currentActive) throw new Error("useBoardView.save: no active view");

    const currentEffective = selectEffectiveConfig(store);
    const result = await saveView({ viewId: currentActive.id, config: currentEffective });

    if (result.ok && result.data) {
      store.applyViewUpsert(result.data);
      store.setDraftConfig(null);
    } else if (!result.ok) {
      toast.error(result.error.message ?? "Failed to save view");
      throw new Error(result.error.message ?? "saveView failed");
    }
  }, []);

  // ---------------------------------------------------------------------------
  // switchView — clears draft, navigates to the target view.
  //
  // Cross-kind: when the target view's kind differs from the current URL kind,
  // uses router.push (adds history entry so the back button works correctly).
  // Same-kind: uses router.replace to avoid history bloat.
  //
  // The workspaceSlug is sourced from BoardContext (set by [boardId]/layout.tsx).
  // ---------------------------------------------------------------------------
  const switchView = useCallback(
    (viewId: string) => {
      // Clear draft state.
      useBoardStore.getState().setDraftConfig(null);
      useBoardStore.getState().setActiveViewId(viewId);
      useBoardStore.getState().setSortKeys([]);
      useBoardStore.getState().setInBoardSearch("");

      // Determine the target view's kind from the store.
      const store = useBoardStore.getState();
      const boardViews = selectViewsForBoard(store, boardId);
      const targetView = boardViews.find((v) => v.id === viewId);
      const targetKind = (targetView?.kind ?? "table") as ViewKind;

      // Build the target URL.
      const targetPath = pathForKind(targetKind, workspaceSlug, boardId, viewId);

      // Compare kinds: current kind from pathname vs target kind.
      const currentKind = kindFromPath(pathname);
      if (currentKind !== targetKind) {
        // Cross-kind navigation: push to add a history entry.
        router.push(targetPath);
      } else {
        // Same-kind navigation: replace to keep history clean.
        router.replace(targetPath);
      }
    },
    [pathname, router, boardId, workspaceSlug],
  );

  return {
    active,
    effective,
    hasUnsavedChanges,
    applyDraft,
    resetDraft,
    save,
    switchView,
    views,
    role,
  };
}
