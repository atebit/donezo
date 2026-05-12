"use client";

/**
 * CellEditor — orchestrator for all cell editor rendering.
 *
 * Responsibilities:
 *   1. Early-return (calls onClose) for derived types: updated_by, created_by,
 *      created_at_col, formula — these cells are read-only.
 *   2. For popover-mode editors: wraps the editor content in a Base UI Popover.
 *   3. For inline-mode editors: renders the editor directly.
 *   4. Manages the optimistic-update + server-action + revert + toast flow.
 *
 * currentUserId:
 *   The BoardContext does not expose userId. We resolve it via the Supabase
 *   browser client on first render and cache it in local state. Until resolved,
 *   currentUserId is undefined — the vote editor handles this gracefully by
 *   closing without mutation (its documented fallback per VoteEditor contract).
 *
 * members:
 *   The BoardContext does not expose the member roster. We pass undefined here;
 *   the person/updated_by/created_by cells fall back to count-badge or initials
 *   display per their documented fallback contracts.
 */

import { Popover } from "@base-ui/react";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import type { Column, Task } from "@/components/board/table/types";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import { wrappedSetCellValue } from "@/lib/realtime/wrapped-actions";
import { createClient } from "@/lib/supabase/client";
import { useBoardStore } from "@/stores/board-store";

// ---------------------------------------------------------------------------
// isQueuedResult — type-narrowing guard for withOutbox's queued branch.
// Kept local so it does not add a new export to lib/realtime/outbox.ts.
// ---------------------------------------------------------------------------
function isQueuedResult(r: unknown): r is { queued: true } {
  return (
    r !== null &&
    typeof r === "object" &&
    "queued" in r &&
    (r as { queued?: unknown }).queued === true
  );
}

// ---------------------------------------------------------------------------
// Derived types — editors never open for these; the orchestrator closes
// immediately so the user never sees an edit mode for computed columns.
// ---------------------------------------------------------------------------
const DERIVED_TYPES = new Set<CellTypeId>([
  "updated_by",
  "created_by",
  "created_at_col",
  "formula",
]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CellEditorProps {
  task: Task;
  column: Column;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// CellEditor
// ---------------------------------------------------------------------------

export function CellEditor({ task, column, onClose }: CellEditorProps) {
  // ── Derived-type guard ───────────────────────────────────────────────────
  const columnType = column.type as CellTypeId;
  useEffect(() => {
    if (DERIVED_TYPES.has(columnType)) {
      onClose();
    }
  }, [columnType, onClose]);

  if (DERIVED_TYPES.has(columnType)) {
    return null;
  }

  return <CellEditorInner task={task} column={column} onClose={onClose} />;
}

// Separated so we only run hooks when not derived (avoids conditional hook calls)
function CellEditorInner({ task, column, onClose }: CellEditorProps) {
  const columnType = column.type as CellTypeId;
  const def = getCellDef(columnType);

  // ── Current cell value from store ────────────────────────────────────────
  const cellKey = `${task.id}:${column.id}`;
  const cellRow = useBoardStore((s) => s.cells.get(cellKey));
  // biome-ignore lint/suspicious/noExplicitAny: def is heterogeneous; TValue is narrowed at the def level
  const currentValue = def.fromRow(cellRow as any);

  // ── Column config ─────────────────────────────────────────────────────────
  const config = (column.settings ?? {}) as never;

  // ── Current user id (for vote editor) ───────────────────────────────────
  // Resolved async via the Supabase browser client. Undefined until resolved;
  // the vote editor closes gracefully when currentUserId is absent.
  const currentUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const client = createClient();
    client.auth.getSession().then(({ data }) => {
      currentUserIdRef.current = data.session?.user.id;
    });
  }, []);

  // ── Server-action transition ──────────────────────────────────────────────
  const [, startTransition] = useTransition();

  // ── handleChange ─────────────────────────────────────────────────────────
  // biome-ignore lint/suspicious/noExplicitAny: TValue varies per cell type; narrowed by def.toRow
  const handleChange = (value: any) => {
    // 1. Snapshot the current cell row for rollback.
    const prev = useBoardStore.getState().cells.get(cellKey);

    // 2. Compute optimistic patch.
    const patch = def.toRow(value);

    // 3. Build optimistic cell row.
    const optimistic = {
      task_id: task.id,
      column_id: column.id,
      ...patch,
      updated_by: currentUserIdRef.current ?? null,
      updated_at: new Date().toISOString(),
      created_at: prev?.created_at ?? new Date().toISOString(),
    };

    // 4. Apply optimistic update.
    // biome-ignore lint/suspicious/noExplicitAny: CellRow has many optional value columns; optimistic has all required ones
    useBoardStore.getState().applyCellUpsert(optimistic as any);

    // 5. Fire server action (in transition for non-blocking UI).
    startTransition(async () => {
      const result = await wrappedSetCellValue({ taskId: task.id, columnId: column.id, value });
      // Soft success — optimistic update already applied; outbox will flush on reconnect.
      if (isQueuedResult(result)) return;
      if (result.ok) {
        useBoardStore.getState().applyCellUpsert(result.data);
      } else {
        // Revert optimistic update.
        if (prev) {
          useBoardStore.getState().applyCellUpsert(prev);
        }
        // If no prior row existed, the optimistic row will stay (stale) until
        // the next board hydration. A delete-cell store action would clean it
        // up cleanly but doesn't exist yet (followup item for S16/store).
        toast.error(result.error.message ?? "Couldn't save");
      }
    });
  };

  // ── handleEditorClose ────────────────────────────────────────────────────
  const handleEditorClose = () => {
    onClose();
  };

  // ── Shared editor props ──────────────────────────────────────────────────
  // We pass the optional contract props (columnId, members, currentUserId)
  // through spread. TypeScript structural compatibility allows extra props
  // on the editor even though CellTypeDef.Editor doesn't declare them —
  // each editor declares them as optional in its own interface.
  const editorProps = {
    value: currentValue,
    config,
    onChange: handleChange,
    onClose: handleEditorClose,
    // Optional extras threaded from orchestrator context:
    columnId: column.id, // StatusEditor, PriorityEditor use this for label lookup
    members: undefined, // No member roster in BoardContext; cells fall back gracefully
    currentUserId: currentUserIdRef.current, // VoteEditor uses this to toggle vote
    // Epic 10 — file editor needs the task row to derive taskId for upload context.
    // Other editors ignore this prop (structural compatibility via the `as any` cast below).
    row: task,
    task,
  };

  // ── Render based on editorMode ───────────────────────────────────────────
  if (def.editorMode === "popover") {
    return (
      <Popover.Root
        open
        onOpenChange={(open) => {
          if (!open) handleEditorClose();
        }}
      >
        {/*
          A hidden trigger is required by Base UI for positioning context.
          The cell click already happened; we open immediately with `open` prop.
        */}
        <Popover.Trigger render={<span />} style={{ display: "none" }} aria-hidden="true" />
        <Popover.Portal>
          <Popover.Positioner sideOffset={0} align="start">
            <Popover.Popup className="z-[var(--z-popover)] bg-[color:var(--color-surface)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-sm)] shadow-[var(--shadow-modal)]">
              {/* biome-ignore lint/suspicious/noExplicitAny: def.Editor is heterogeneous; props are structurally compatible */}
              <def.Editor {...(editorProps as any)} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  // Inline mode — render editor directly without a popover wrapper.
  // biome-ignore lint/suspicious/noExplicitAny: same rationale
  return <def.Editor {...(editorProps as any)} />;
}
