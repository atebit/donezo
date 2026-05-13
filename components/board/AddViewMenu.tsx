"use client";

/**
 * AddViewMenu — trailing "+" dropdown in the view tabs bar.
 *
 * Items:
 *   - New table view     → ENABLED → createView then switchView
 *   - New kanban view    → ENABLED → createView then switchView
 *   - New calendar view  → ENABLED → createView then switchView
 *   - New timeline view  → ENABLED → createView then switchView
 *   - New dashboard view → ENABLED → createView then switchView
 *   - New form view      → ENABLED → createView then switchView
 *
 * On click, each kind creates a view row with a kind-specific default config
 * stub (per A.10). The per-kind container detects an empty config and shows
 * a picker / empty-state on first render.
 *
 * Uses Base UI Menu (per stack defaults).
 *
 * Token mapping (component-system §1.4):
 *   - Trigger: 32px height, padding 0 8px, font 14px.
 *   - Menu item height: 32px, hover bg var(--color-surface-hover), radius 4px.
 */

import { Menu } from "@base-ui/react";
import type { LucideIcon } from "lucide-react";
import { Calendar, FormInput, Kanban, LayoutDashboard, Plus, Table2, Timeline } from "lucide-react";
import { toast } from "sonner";
import { createView } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions";
import { useBoardView } from "@/hooks/use-board-view";
import { cn } from "@/lib/utils";
import { defaultConfigForKind } from "@/lib/views/config-schema";

interface AddViewMenuProps {
  boardId: string;
}

interface ViewTypeItem {
  kind: string;
  label: string;
  Icon: LucideIcon;
}

const VIEW_TYPES: ViewTypeItem[] = [
  { kind: "table", label: "New table view", Icon: Table2 },
  { kind: "kanban", label: "New kanban view", Icon: Kanban },
  { kind: "calendar", label: "New calendar view", Icon: Calendar },
  { kind: "timeline", label: "New timeline view", Icon: Timeline },
  { kind: "dashboard", label: "New dashboard view", Icon: LayoutDashboard },
  { kind: "form", label: "New form view", Icon: FormInput },
];

export function AddViewMenu({ boardId }: AddViewMenuProps) {
  const { switchView } = useBoardView();

  async function handleCreateView(kind: string) {
    try {
      const config = defaultConfigForKind(kind);
      const result = await createView({
        boardId,
        kind,
        name: `New ${kind} view`,
        isShared: false,
        config,
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
            {VIEW_TYPES.map(({ kind, label, Icon }) => (
              <Menu.Item
                key={kind}
                onClick={() => void handleCreateView(kind)}
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
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
