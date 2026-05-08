"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/actions";
import { useBoard } from "@/hooks/use-board";

interface BoardDeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BoardDeleteConfirmModal({
  open,
  onOpenChange,
  onSuccess,
}: BoardDeleteConfirmModalProps) {
  const { board } = useBoard();
  const [confirmName, setConfirmName] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputId = useId();

  const nameMatches = confirmName === board.name;

  function handleDelete() {
    if (!nameMatches) return;
    startTransition(async () => {
      try {
        await deleteBoard({ boardId: board.id, confirmName });
        onSuccess();
      } catch {
        toast.error("Failed to delete board. Please try again.");
      }
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmName("");
    onOpenChange(next);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-surface p-6 shadow-[var(--shadow-modal)] focus:outline-none"
          aria-labelledby="delete-confirm-title"
        >
          <Dialog.Title
            id="delete-confirm-title"
            className="mb-2 text-base font-semibold text-[color:var(--color-fg-strong)]"
          >
            Delete board permanently?
          </Dialog.Title>
          <p className="mb-4 text-sm text-[color:var(--color-fg-muted)]">
            This action <strong className="text-[color:var(--color-fg)]">cannot be undone</strong>.
            All data in <strong className="text-[color:var(--color-fg)]">{board.name}</strong> will
            be permanently deleted.
          </p>

          <div className="mb-5 flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium text-[color:var(--color-fg)]">
              Type <strong>{board.name}</strong> to confirm
            </label>
            <input
              id={inputId}
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={board.name}
              className="rounded-md border border-[color:var(--color-border-strong)] bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              disabled={!nameMatches || isPending}
              onClick={handleDelete}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
