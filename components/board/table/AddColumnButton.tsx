"use client";

import { Tooltip } from "@base-ui/react";
import { Plus } from "lucide-react";
import { useState } from "react";

import { useBoard } from "@/hooks/use-board";
import { ROLE_RANK } from "@/lib/authorization/roles";
import { AddColumnModal } from "./AddColumnModal";

/**
 * AddColumnButton — opens AddColumnModal for admins/owners.
 * For viewers/members: renders disabled with a tooltip ("Admins can add columns").
 *
 * Role gate: ROLE_RANK["admin"] = 3 — any role with rank >= 3 can add columns.
 */
export function AddColumnButton() {
  const { role } = useBoard();
  const [open, setOpen] = useState(false);

  const canAdd = ROLE_RANK[role] >= ROLE_RANK.admin;

  if (!canAdd) {
    return (
      <Tooltip.Provider delay={200}>
        <Tooltip.Root>
          <Tooltip.Trigger render={<span />} className="inline-flex" aria-disabled="true">
            <button
              type="button"
              aria-disabled="true"
              aria-label="Add column"
              tabIndex={-1}
              onClick={(e) => e.preventDefault()}
              className="h-9 w-9 flex items-center justify-center rounded-[var(--radius-xs)] text-[color:var(--color-fg-muted)] opacity-40 cursor-not-allowed focus-visible:outline-none"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={4}>
              <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]">
                Admins can add columns
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Add column"
        onClick={() => setOpen(true)}
        className="h-9 w-9 flex items-center justify-center rounded-[var(--radius-xs)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
      </button>

      <AddColumnModal open={open} onOpenChange={setOpen} />
    </>
  );
}
