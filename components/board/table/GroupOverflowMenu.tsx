"use client";

/**
 * GroupOverflowMenu — overflow action menu for a group header row.
 *
 * Mounted inside the inline <GroupHeaderRow> helper in BoardTable.tsx,
 * replacing the S8 placeholder button. GroupSection.tsx is orphaned and
 * left untouched per the S13 scope contract.
 *
 * Items:
 *   1. Rename  — no-op pending S14's imperative focus API on EditableTitle.
 *                // TODO(S14): wire imperative focus via EditableTitle ref.
 *   2. Recolor — opens <ColorPalette> (its own nested Popover); optimistic update.
 *   3. Duplicate — pessimistic; router.refresh() re-hydrates new group + tasks.
 *   4. Delete  — Base UI Dialog confirm; optimistic; revert on error.
 *
 * Rename path chosen: no-op (menu closes silently). EditableTitle does NOT
 * expose a defaultEditing prop or imperative ref in its current S13-era shape;
 * that API is deferred to S14. See done report for rationale.
 *
 * Menu open state is controlled so action items can close the popover before
 * opening a dialog (avoids nesting interactive elements from Popover.Close).
 */

import { Dialog, Popover } from "@base-ui/react";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteGroup,
  duplicateGroup,
  recolorGroup,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions";
import { MenuList, MenuListItem } from "@/components/ui/menu-list";
import { useBoardStore } from "@/stores/board-store";

import { ColorPalette } from "./ColorPalette";
import type { Group } from "./types";

interface GroupOverflowMenuProps {
  group: Group;
}

export function GroupOverflowMenu({ group }: GroupOverflowMenuProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const taskCount = useBoardStore((s) => s.tasks.filter((t) => t.group_id === group.id).length);

  // ---------------------------------------------------------------------------
  // Recolor handler — optimistic, revert on error
  // ---------------------------------------------------------------------------
  const handleColorChange = (color: string) => {
    const snapshot = group;
    setMenuOpen(false);

    useBoardStore.getState().applyGroupUpsert({
      ...group,
      color,
      updated_at: new Date().toISOString(),
    });

    startTransition(async () => {
      const result = await recolorGroup({ groupId: group.id, color });
      if (!result.ok) {
        useBoardStore.getState().applyGroupUpsert({
          ...snapshot,
          updated_at: new Date().toISOString(),
        });
        toast.error(result.error.message ?? "Failed to recolor group.");
      } else {
        useBoardStore.getState().applyGroupUpsert(result.data);
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Duplicate handler — pessimistic; router.refresh() re-hydrates
  // ---------------------------------------------------------------------------
  const handleDuplicate = () => {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await duplicateGroup({ groupId: group.id });
      if (result.ok) {
        useBoardStore.getState().applyGroupUpsert(result.data);
        // The new group's tasks were cloned server-side but are not returned
        // by the action. Fall back to a full page refresh to re-fetch all data.
        router.refresh();
      } else {
        toast.error(result.error.message ?? "Failed to duplicate group.");
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Delete handler — optimistic, revert group on error (tasks were never
  // actually deleted server-side on failure, so they reappear on next refresh)
  // ---------------------------------------------------------------------------
  const handleDeleteConfirm = () => {
    const snapshot = group;
    setDeleteDialogOpen(false);

    useBoardStore.getState().applyGroupDelete(group.id);

    startTransition(async () => {
      const result = await deleteGroup({ groupId: group.id });
      if (!result.ok) {
        // Revert the group. Tasks will reappear on next router.refresh() since
        // the server-side delete never happened.
        useBoardStore.getState().applyGroupUpsert({
          ...snapshot,
          updated_at: new Date().toISOString(),
        });
        toast.error(result.error.message ?? "Failed to delete group.");
      }
    });
  };

  return (
    <>
      {/* Delete confirm dialog — rendered outside the popover so it can open
          after the popover closes */}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop
            className="fixed inset-0 z-[var(--z-modal)] bg-[color:var(--color-overlay)]"
            style={{ backdropFilter: "blur(2px)" }}
          />
          <Dialog.Popup
            className="fixed left-1/2 top-1/2 z-[var(--z-modal)] -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-modal)] focus:outline-none"
            aria-labelledby="group-delete-title"
          >
            <Dialog.Title
              id="group-delete-title"
              className="mb-2 text-base font-semibold text-[color:var(--color-fg-strong)]"
            >
              Delete group &ldquo;{group.name}&rdquo;?
            </Dialog.Title>
            <p className="mb-5 text-sm text-[color:var(--color-fg-muted)]">
              This soft-deletes the group and its {taskCount} task
              {taskCount === 1 ? "" : "s"}.
            </p>
            <div className="flex justify-end gap-2">
              <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none">
                Cancel
              </Dialog.Close>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 focus-visible:outline-none"
              >
                Delete
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Overflow menu trigger + controlled popover */}
      <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Popover.Trigger
          render={<button type="button" />}
          aria-label={`Group menu: ${group.name}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)] ml-1 flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-[var(--radius-xs)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={4} align="start">
            <Popover.Popup className="z-[var(--z-popover)]">
              <MenuList>
                {/* Rename — no-op pending S14 imperative focus API on EditableTitle */}
                {/* TODO(S14): wire imperative focus via EditableTitle ref         */}
                <MenuListItem
                  onClick={() => {
                    setMenuOpen(false);
                    // no-op: EditableTitle does not yet expose an imperative
                    // "enter edit mode" API. S14 will add a focusTitle() ref
                    // and wire this menu item to call it. Menu closes silently.
                  }}
                >
                  Rename
                </MenuListItem>

                {/* Recolor — ColorPalette is its own nested Popover.
                    handleColorChange closes the outer menu when a swatch is selected. */}
                <ColorPalette
                  value={group.color}
                  onChange={handleColorChange}
                  trigger={<MenuListItem type="button">Recolor</MenuListItem>}
                />

                {/* Duplicate */}
                <MenuListItem onClick={handleDuplicate}>Duplicate</MenuListItem>

                {/* Delete — close menu then open confirm dialog */}
                <MenuListItem
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteDialogOpen(true);
                  }}
                  className="text-destructive hover:bg-destructive/10"
                >
                  Delete
                </MenuListItem>
              </MenuList>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
