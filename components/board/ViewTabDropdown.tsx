"use client";

/**
 * ViewTabDropdown — context menu for the active view tab.
 *
 * Menu items:
 *   - Rename    → opens an inline Base UI Dialog with an <EditableTitle>
 *   - Duplicate → duplicateView then switchView to new view
 *   - Save changes (gated: draft exists + permission)
 *   - Reset to saved (gated: draft exists)
 *   - Delete (gated: admin+ for shared / owner for personal;
 *             never last shared table view)
 *
 * Authorization:
 *   - shared (is_shared = true or owner_id = null) → admin+ required for
 *     Save, Delete. Rename + Duplicate are allowed for any role.
 *   - personal (owner_id = currentUserId) → owner-only for Save/Delete.
 *
 * Uses Base UI Menu + Dialog (per stack defaults: @base-ui/react).
 *
 * Token mapping (component-system §1.4):
 *   - Menu item height: 32px, hover bg var(--color-surface-hover), radius 4px.
 *   - Dialog: radius 8px, shadow var(--shadow-modal), bg var(--color-surface).
 */

import { Dialog, Menu } from "@base-ui/react";
import { Copy, Pencil, RefreshCw, Save, Trash2 } from "lucide-react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  deleteView,
  duplicateView,
  renameView,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions";
import { EditableTitle, type EditableTitleHandle } from "@/components/shared/EditableTitle";
import { useBoard } from "@/hooks/use-board";
import { useBoardView } from "@/hooks/use-board-view";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import type { ViewRow } from "@/stores/types/views";

interface ViewTabDropdownProps {
  view: ViewRow;
  /** The chevron trigger button (rendered via Menu.Trigger). */
  children: ReactNode;
}

export function ViewTabDropdown({ view, children }: ViewTabDropdownProps) {
  const { hasUnsavedChanges, resetDraft, save, switchView, role } = useBoardView();
  const { userId } = useBoard();
  const [renameOpen, setRenameOpen] = useState(false);
  const editableRef = useRef<EditableTitleHandle>(null);

  // ---------------------------------------------------------------------------
  // Authorization helpers
  // ---------------------------------------------------------------------------

  // For shared/system rows: admin+ required.
  // For personal rows: must be the owner.
  const isSharedOrSystem = view.is_shared || view.owner_id == null;
  const isPersonalOwner = !isSharedOrSystem && view.owner_id === userId;

  const canModify = isSharedOrSystem ? role === "admin" || role === "owner" : isPersonalOwner;

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handleDuplicate = useCallback(async () => {
    try {
      const result = await duplicateView({ viewId: view.id });
      if (result.ok && result.data) {
        useBoardStore.getState().applyViewUpsert(result.data);
        switchView(result.data.id);
        toast.success(`Duplicated as "${result.data.name}"`);
      } else if (!result.ok) {
        toast.error(result.error.message ?? "Failed to duplicate view");
      }
    } catch {
      toast.error("Failed to duplicate view");
    }
  }, [view.id, switchView]);

  const handleSave = useCallback(async () => {
    try {
      await save();
      toast.success("View saved");
    } catch {
      // save() may throw if Slice E is not yet wired — surface a user-friendly message.
      toast.error("Failed to save view");
    }
  }, [save]);

  const handleReset = useCallback(() => {
    resetDraft();
  }, [resetDraft]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete view "${view.name}"? This cannot be undone.`)) return;
    try {
      const result = await deleteView({ viewId: view.id });
      if (result.ok) {
        useBoardStore.getState().applyViewDelete(view.id);
        toast.success("View deleted");
        // After deletion, the hook will fall through to the next available view.
        // Clear draft so we don't carry stale state.
        resetDraft();
      } else if (!result.ok) {
        toast.error(result.error.message ?? "Failed to delete view");
      }
    } catch {
      toast.error("Failed to delete view");
    }
  }, [view.id, view.name, resetDraft]);

  const handleRenameCommit = useCallback(
    async (name: string) => {
      try {
        const result = await renameView({ viewId: view.id, name });
        if (result.ok && result.data) {
          useBoardStore.getState().applyViewUpsert(result.data);
          toast.success("View renamed");
        } else if (!result.ok) {
          toast.error(result.error.message ?? "Failed to rename view");
        }
      } catch {
        toast.error("Failed to rename view");
      }
      setRenameOpen(false);
    },
    [view.id],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Menu.Root>
        <Menu.Trigger render={children as React.ReactElement} />
        <Menu.Portal>
          <Menu.Positioner sideOffset={4} align="start">
            <Menu.Popup
              className="outline-none min-w-[180px] p-1"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "8px",
                boxShadow: "var(--shadow-modal)",
                zIndex: "var(--z-popover)",
              }}
            >
              {/* Rename */}
              <Menu.Item onClick={() => setRenameOpen(true)} className={menuItemCn()}>
                <Pencil size={14} aria-hidden="true" />
                Rename
              </Menu.Item>

              {/* Duplicate */}
              <Menu.Item onClick={handleDuplicate} className={menuItemCn()}>
                <Copy size={14} aria-hidden="true" />
                Duplicate
              </Menu.Item>

              {/* Save changes — gated: draft exists + permission */}
              {hasUnsavedChanges && canModify && (
                <Menu.Item onClick={handleSave} className={menuItemCn()}>
                  <Save size={14} aria-hidden="true" />
                  Save changes
                </Menu.Item>
              )}

              {/* Reset to saved — gated: draft exists */}
              {hasUnsavedChanges && (
                <Menu.Item onClick={handleReset} className={menuItemCn()}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Reset to saved
                </Menu.Item>
              )}

              {/* Separator before destructive action */}
              {canModify && <hr className="my-1 border-[color:var(--color-border-strong)]" />}

              {/* Delete — gated: admin+ for shared, owner for personal */}
              {canModify && (
                <Menu.Item
                  onClick={handleDelete}
                  className={menuItemCn("text-[color:var(--color-danger,#ef4444)]")}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Delete
                </Menu.Item>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {/* Rename Dialog — Base UI Dialog with EditableTitle */}
      <Dialog.Root open={renameOpen} onOpenChange={setRenameOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop
            className="fixed inset-0 bg-black/30"
            style={{ zIndex: "calc(var(--z-popover) + 1)" }}
          />
          <Dialog.Popup
            className="fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 p-4 outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "8px",
              boxShadow: "var(--shadow-modal)",
              zIndex: "calc(var(--z-popover) + 2)",
              minWidth: "280px",
            }}
          >
            <Dialog.Title className="text-sm font-semibold text-[color:var(--color-fg)] mb-3">
              Rename view
            </Dialog.Title>
            <EditableTitle
              ref={editableRef}
              initialValue={view.name}
              onCommit={handleRenameCommit}
              variant="body"
              ariaLabel="View name"
              placeholder="View name"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                className={cn(
                  "h-8 px-3 text-sm rounded cursor-pointer",
                  "text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]",
                  "hover:bg-[color:var(--color-surface-hover)]",
                  "transition-colors duration-[var(--motion-base,150ms)]",
                )}
              >
                Cancel
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared menu-item style helper
// ---------------------------------------------------------------------------

function menuItemCn(extra?: string): string {
  return cn(
    "flex items-center gap-2 h-8 px-2 rounded cursor-pointer",
    "text-sm text-[color:var(--color-fg)]",
    "hover:bg-[color:var(--color-surface-hover)]",
    "transition-colors duration-[var(--motion-base,150ms)]",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
    "outline-none",
    extra,
  );
}
