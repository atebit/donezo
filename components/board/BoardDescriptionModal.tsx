"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateBoardDescription } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { useBoard } from "@/hooks/use-board";
import { useWorkspace } from "@/hooks/use-workspace";
import { IconClose } from "@/lib/icons";

interface BoardDescriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name of the board creator */
  createdByName: string | null;
  /** Total member count */
  memberCount: number;
}

export function BoardDescriptionModal({
  open,
  onOpenChange,
  createdByName,
  memberCount,
}: BoardDescriptionModalProps) {
  const { board } = useBoard();
  const { workspace } = useWorkspace();
  const [, startTransition] = useTransition();
  const [localDescription, setLocalDescription] = useState(board.description ?? "");

  const handleCommit = useCallback(
    async (next: string) => {
      startTransition(async () => {
        try {
          await updateBoardDescription({ boardId: board.id, description: next });
          setLocalDescription(next);
          toast.success("Description updated.");
        } catch {
          toast.error("Failed to update description.");
          throw new Error("Failed");
        }
      });
    },
    [board.id],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-[850px] h-[550px] rounded-xl bg-surface shadow-[var(--shadow-modal)] focus:outline-none flex overflow-hidden"
          aria-labelledby="board-description-modal-title"
        >
          {/* Left pane — editable description */}
          <div className="flex flex-1 flex-col gap-4 p-6 min-w-0">
            <div className="flex items-center justify-between">
              <Dialog.Title
                id="board-description-modal-title"
                className="text-base font-semibold text-[color:var(--color-fg-strong)]"
              >
                Board Description
              </Dialog.Title>
              <Dialog.Close
                className="rounded p-1 hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
                aria-label="Close description modal"
              >
                <IconClose size={16} />
              </Dialog.Close>
            </div>

            <div className="flex-1 overflow-y-auto">
              <EditableTitle
                initialValue={localDescription}
                onCommit={handleCommit}
                variant="body"
                placeholder="Add a description…"
                ariaLabel="Board description"
                className="min-h-[80px] w-full"
              />
            </div>
          </div>

          {/* Right pane — metadata */}
          <div
            className="flex w-[260px] shrink-0 flex-col gap-4 p-6 text-sm"
            style={{ backgroundColor: "var(--color-surface-info)" }}
          >
            <h3 className="font-semibold text-[color:var(--color-fg-strong)]">Details</h3>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-fg-muted)]">
                Created by
              </span>
              <span className="text-[color:var(--color-fg)]">{createdByName ?? "Unknown"}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-fg-muted)]">
                Members
              </span>
              <span className="text-[color:var(--color-fg)]">
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-fg-muted)]">
                Workspace
              </span>
              <span className="text-[color:var(--color-fg)]">{workspace.name}</span>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
