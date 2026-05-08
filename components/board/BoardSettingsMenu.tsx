"use client";

import { Menu } from "@base-ui/react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { duplicateBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/actions";
import { setBoardPrivacy } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions";
import { BoardArchiveConfirmModal } from "@/components/board/BoardArchiveConfirmModal";
import { BoardDeleteConfirmModal } from "@/components/board/BoardDeleteConfirmModal";
import { useBoard } from "@/hooks/use-board";
import { useWorkspace } from "@/hooks/use-workspace";
import { ROLE_RANK } from "@/lib/authorization";
import { IconArchive, IconCopy, IconDelete, IconLock, IconMore, IconSettings } from "@/lib/icons";

interface BoardSettingsMenuProps {
  /** Called when "Set description" is selected — opens description modal */
  onOpenDescription: () => void;
  /** Called when "Rename" is selected — focus the title input */
  onRename: () => void;
}

export function BoardSettingsMenu({ onOpenDescription, onRename }: BoardSettingsMenuProps) {
  const { board, role } = useBoard();
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const roleRank = ROLE_RANK[role];
  const isAdmin = roleRank >= ROLE_RANK.admin;
  const isOwner = role === "owner";

  const handleDuplicate = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await duplicateBoard({ boardId: board.id });
        if (result && "boardId" in result) {
          toast.success("Board duplicated.");
          router.push(`/w/${workspace.slug}/b/${result.boardId}`);
        }
      } catch {
        toast.error("Failed to duplicate board.");
      }
    });
  }, [board.id, workspace.slug, router]);

  const handleTogglePrivacy = useCallback(() => {
    startTransition(async () => {
      try {
        await setBoardPrivacy({ boardId: board.id, isPrivate: !board.is_private });
        toast.success(board.is_private ? "Board is now public." : "Board is now private.");
      } catch {
        toast.error("Failed to update board privacy.");
      }
    });
  }, [board.id, board.is_private]);

  const handleArchiveSuccess = useCallback(() => {
    setArchiveOpen(false);
    router.push(`/w/${workspace.slug}`);
  }, [workspace.slug, router]);

  const handleDeleteSuccess = useCallback(() => {
    setDeleteOpen(false);
    router.push(`/w/${workspace.slug}`);
  }, [workspace.slug, router]);

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          aria-label="Board settings"
          className="inline-flex items-center justify-center rounded p-1 hover:bg-[color:var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]"
        >
          <IconMore size={16} className="text-[color:var(--color-fg-muted)]" />
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner
            side="bottom"
            align="end"
            sideOffset={4}
            style={{ zIndex: "var(--z-popover)" }}
          >
            <Menu.Popup
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-modal)",
                padding: "8px",
                minWidth: 180,
              }}
            >
              {/* Rename — all members */}
              <Menu.Item
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:bg-[color:var(--color-surface-hover)] focus-visible:outline-none cursor-pointer"
                onClick={onRename}
              >
                Rename
              </Menu.Item>

              {/* Set description — all members */}
              <Menu.Item
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:bg-[color:var(--color-surface-hover)] focus-visible:outline-none cursor-pointer"
                onClick={onOpenDescription}
              >
                <IconSettings size={14} />
                Set description
              </Menu.Item>

              {/* Duplicate — member+ */}
              <Menu.Item
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:bg-[color:var(--color-surface-hover)] focus-visible:outline-none cursor-pointer disabled:opacity-50"
                disabled={isPending}
                onClick={handleDuplicate}
              >
                <IconCopy size={14} />
                Duplicate
              </Menu.Item>

              {/* Toggle privacy — admin+ */}
              {isAdmin && (
                <Menu.Item
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:bg-[color:var(--color-surface-hover)] focus-visible:outline-none cursor-pointer disabled:opacity-50"
                  disabled={isPending}
                  onClick={handleTogglePrivacy}
                >
                  <IconLock size={14} />
                  {board.is_private ? "Make public" : "Make private"}
                </Menu.Item>
              )}

              {/* Archive — admin+ */}
              {isAdmin && (
                <Menu.Item
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:bg-[color:var(--color-surface-hover)] focus-visible:outline-none cursor-pointer"
                  onClick={() => setArchiveOpen(true)}
                >
                  <IconArchive size={14} />
                  Archive
                </Menu.Item>
              )}

              {/* Delete — workspace owner only */}
              {isOwner && (
                <Menu.Item
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none cursor-pointer"
                  onClick={() => setDeleteOpen(true)}
                >
                  <IconDelete size={14} />
                  Delete permanently
                </Menu.Item>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {/* Modals rendered outside the menu so they survive menu close */}
      <BoardArchiveConfirmModal
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onSuccess={handleArchiveSuccess}
      />
      <BoardDeleteConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={handleDeleteSuccess}
      />
    </>
  );
}
