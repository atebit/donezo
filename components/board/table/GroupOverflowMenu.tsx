"use client";

/**
 * GroupOverflowMenu — overflow action menu for a group header row.
 *
 * Items:
 *   1. Rename    — calls focusGroupTitle(group.id) via setTimeout(0) so the focus
 *                  runs after Base UI Popover's focus-restore (F4.1).
 *   2. Recolor   — toggles an inline swatch grid *inside the same menu*. We do
 *                  NOT use a nested Popover here: Base UI does not close the
 *                  parent menu when a child popover opens, which produced two
 *                  overlapping popovers and a detached swatch grid. Selecting a
 *                  swatch applies the color optimistically and closes the menu.
 *   3. Duplicate — pessimistic; router.refresh() re-hydrates new group + tasks.
 *   4. Delete    — Base UI Dialog confirm; optimistic; revert on error.
 *
 * Menu open state is controlled so action items can close the popover before
 * opening a dialog (avoids nesting interactive elements from Popover.Close).
 */

import { Dialog, Popover } from "@base-ui/react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteGroup,
  duplicateGroup,
  recolorGroup,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions";
import { MenuList, MenuListItem } from "@/components/ui/menu-list";
import { GROUP_PALETTE } from "@/lib/group-palette";
import { useBoardStore } from "@/stores/board-store";

import { colorToToken } from "./group-color";
import { useTableKeyboard } from "./table-keyboard-context";
import type { Group } from "./types";

interface GroupOverflowMenuProps {
  group: Group;
}

export function GroupOverflowMenu({ group }: GroupOverflowMenuProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recolorOpen, setRecolorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { focusGroupTitle } = useTableKeyboard();

  const taskCount = useBoardStore((s) => s.tasks.filter((t) => t.group_id === group.id).length);

  const closeMenu = () => {
    setMenuOpen(false);
    setRecolorOpen(false);
  };

  // ---------------------------------------------------------------------------
  // Recolor handler — optimistic, revert on error
  // ---------------------------------------------------------------------------
  const handleColorChange = (color: string) => {
    const snapshot = group;
    closeMenu();

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
    closeMenu();
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
      <Popover.Root
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) setRecolorOpen(false);
        }}
      >
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
              <MenuList className="min-w-[180px]">
                {/* Rename — closes the popover then defers focus via setTimeout(0).
                    The deferral is required because Base UI Popover restores focus
                    to its trigger when it closes; a synchronous focus() call would
                    be overridden by that restore. setTimeout(0) sequences our call
                    after the popover's focus-restore in the microtask queue. */}
                <MenuListItem
                  onClick={() => {
                    closeMenu();
                    setTimeout(() => focusGroupTitle(group.id), 0);
                  }}
                >
                  Rename
                </MenuListItem>

                {/* Recolor — toggles the inline swatch grid below (no nested
                    popover; see file header). */}
                <MenuListItem
                  onClick={() => setRecolorOpen((v) => !v)}
                  aria-expanded={recolorOpen}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-[3px]"
                      style={{ backgroundColor: `var(${colorToToken(group.color)})` }}
                    />
                    Recolor
                  </span>
                  <ChevronRight
                    size={14}
                    aria-hidden="true"
                    className={`text-[color:var(--color-fg-muted)] transition-transform ${
                      recolorOpen ? "rotate-90" : ""
                    }`}
                  />
                </MenuListItem>

                {recolorOpen && (
                  <fieldset
                    aria-label="Group color palette"
                    className="grid grid-cols-6 gap-1.5 border-0 p-0 m-0 px-2 py-2"
                  >
                    {GROUP_PALETTE.map((swatch, i) => {
                      const isSelected = swatch.toLowerCase() === group.color.toLowerCase();
                      return (
                        <button
                          key={swatch}
                          type="button"
                          onClick={() => handleColorChange(swatch)}
                          aria-label={`Color ${i + 1}`}
                          aria-pressed={isSelected}
                          className={`h-6 w-6 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--color-surface)] ${
                            isSelected
                              ? "ring-2 ring-[color:var(--color-primary)] ring-offset-1 ring-offset-[color:var(--color-surface)]"
                              : "ring-1 ring-inset ring-[color:var(--color-border-strong)]"
                          }`}
                          style={{
                            backgroundColor: `var(${colorToToken(swatch)})`,
                          }}
                        />
                      );
                    })}
                  </fieldset>
                )}

                {/* Duplicate */}
                <MenuListItem onClick={handleDuplicate}>Duplicate</MenuListItem>

                {/* Delete — close menu then open confirm dialog */}
                <MenuListItem
                  onClick={() => {
                    closeMenu();
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
