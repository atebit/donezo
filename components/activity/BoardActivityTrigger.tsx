"use client";

import { useState } from "react";
import { BoardActivityModal } from "@/components/activity/BoardActivityModal";
// Slice D — parallel; ctx build will be completed when Slice D merges
import type { ActivityRenderCtx } from "@/components/activity/renderers";
import { useBoard } from "@/hooks/use-board";
import { IconHistory } from "@/lib/icons";

/**
 * Board topbar trigger for the per-board Activity modal.
 * Reads boardId from useBoard(). Opens <BoardActivityModal>.
 *
 * ctx is built with empty maps here — full ctx (columns, labels, profiles) will
 * be threaded through from the parent once Slice D's renderers are available.
 * For v1, the modal renders events; renderers apply ctx to format cell values.
 */
const EMPTY_CTX: ActivityRenderCtx = {
  columns: new Map(),
  labelsByColumn: new Map(),
  profiles: new Map(),
};

export function BoardActivityTrigger() {
  const { board } = useBoard();
  const [open, setOpen] = useState(false);

  // boardId consumed from context — trigger is board-scoped
  void board.id;

  return (
    <>
      <button
        type="button"
        aria-label="View board activity"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]"
      >
        <IconHistory size={14} />
        Activity
      </button>

      <BoardActivityModal open={open} onOpenChange={setOpen} ctx={EMPTY_CTX} />
    </>
  );
}
