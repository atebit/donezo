"use client";

/**
 * AddViewMenu — trailing "+" dropdown in the view tabs bar.
 *
 * Items:
 *   - New table view     → ENABLED  → createView then switchView
 *   - New kanban view    → DISABLED → tooltip "Coming in Epic 12"
 *   - New calendar view  → DISABLED
 *   - New timeline view  → DISABLED
 *   - New dashboard view → DISABLED
 *   - New form view      → DISABLED
 *
 * Uses Base UI Menu + Tooltip (per stack defaults).
 *
 * Token mapping (component-system §1.4):
 *   - Trigger: 32px height, padding 0 8px, font 14px.
 *   - Menu item height: 32px, hover bg var(--color-surface-hover), radius 4px.
 *   - Disabled item: opacity 0.4, cursor not-allowed.
 */

import { Menu, Tooltip } from "@base-ui/react";
import type { LucideIcon } from "lucide-react";
import { Calendar, FormInput, Kanban, LayoutDashboard, Plus, Table2, Timeline } from "lucide-react";
import { toast } from "sonner";
import { createView } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions";
import { useBoardView } from "@/hooks/use-board-view";
import { cn } from "@/lib/utils";

interface AddViewMenuProps {
  boardId: string;
}

interface ViewTypeItem {
  kind: string;
  label: string;
  Icon: LucideIcon;
  enabled: boolean;
}

const VIEW_TYPES: ViewTypeItem[] = [
  { kind: "table", label: "New table view", Icon: Table2, enabled: true },
  { kind: "kanban", label: "New kanban view", Icon: Kanban, enabled: false },
  { kind: "calendar", label: "New calendar view", Icon: Calendar, enabled: false },
  { kind: "timeline", label: "New timeline view", Icon: Timeline, enabled: false },
  { kind: "dashboard", label: "New dashboard view", Icon: LayoutDashboard, enabled: false },
  { kind: "form", label: "New form view", Icon: FormInput, enabled: false },
];

export function AddViewMenu({ boardId }: AddViewMenuProps) {
  const { switchView } = useBoardView();

  async function handleCreateTable() {
    try {
      const result = await createView({
        boardId,
        kind: "table",
        name: "New view",
        isShared: false,
        config: {},
      });
      if (result.ok && result.data) {
        switchView(result.data.id);
      } else if (!result.ok) {
        toast.error(result.error.message ?? "Failed to create view");
      }
    } catch {
      toast.error("Failed to create view");
    }
  }

  return (
    <Tooltip.Provider delay={400}>
      <Menu.Root>
        <Menu.Trigger
          className={cn(
            "flex items-center gap-1.5 h-8 px-2 mx-1 my-auto rounded",
            "text-sm font-medium text-[color:var(--color-fg-muted)]",
            "hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)]",
            "transition-colors duration-[var(--motion-base,150ms)] cursor-pointer",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
          )}
          aria-label="Add a new view"
        >
          <Plus size={14} aria-hidden="true" />
          <span>Add view</span>
        </Menu.Trigger>
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
              {VIEW_TYPES.map(({ kind, label, Icon, enabled }) => {
                if (enabled) {
                  return (
                    <Menu.Item
                      key={kind}
                      onClick={handleCreateTable}
                      className={cn(
                        "flex items-center gap-2 h-8 px-2 rounded cursor-pointer",
                        "text-sm text-[color:var(--color-fg)]",
                        "hover:bg-[color:var(--color-surface-hover)]",
                        "transition-colors duration-[var(--motion-base,150ms)]",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
                        "outline-none",
                      )}
                    >
                      <Icon size={14} aria-hidden="true" />
                      {label}
                    </Menu.Item>
                  );
                }

                // Disabled item — wrapped in a Tooltip for "Coming in Epic 12".
                return (
                  <Tooltip.Root key={kind}>
                    <Tooltip.Trigger
                      render={
                        <button
                          type="button"
                          disabled
                          aria-disabled="true"
                          className={cn(
                            "flex items-center gap-2 h-8 px-2 rounded w-full",
                            "text-sm text-[color:var(--color-fg-muted)]",
                            "opacity-40 cursor-not-allowed select-none",
                          )}
                        />
                      }
                    >
                      <Icon size={14} aria-hidden="true" />
                      {label}
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Positioner side="right" sideOffset={6}>
                        <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm">
                          Coming in Epic 12
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                );
              })}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Tooltip.Provider>
  );
}
