"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useTransition } from "react";
import { toast } from "sonner";
import { archiveBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/actions";
import { useBoard } from "@/hooks/use-board";

interface BoardArchiveConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BoardArchiveConfirmModal({
  open,
  onOpenChange,
  onSuccess,
}: BoardArchiveConfirmModalProps) {
  const { board } = useBoard();
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(async () => {
      try {
        await archiveBoard({ boardId: board.id });
        onSuccess();
      } catch {
        toast.error("Failed to archive board. Please try again.");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-surface p-6 shadow-[var(--shadow-modal)] focus:outline-none"
          aria-labelledby="archive-confirm-title"
        >
          <Dialog.Title
            id="archive-confirm-title"
            className="mb-2 text-base font-semibold text-[color:var(--color-fg-strong)]"
          >
            Archive board?
          </Dialog.Title>
          <p className="mb-5 text-sm text-[color:var(--color-fg-muted)]">
            <strong className="text-[color:var(--color-fg)]">{board.name}</strong> will be moved to
            the trash. You can restore it from the workspace trash.
          </p>
          <div className="flex justify-end gap-2">
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              disabled={isPending}
              onClick={handleArchive}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none disabled:opacity-50"
            >
              {isPending ? "Archiving…" : "Archive"}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
