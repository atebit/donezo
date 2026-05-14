"use client";

import { Menu } from "@base-ui/react";
import Link from "next/link";
import { WorkspaceLogoTile } from "@/components/shared/WorkspaceLogoTile";
import { IconChevronDown } from "@/lib/icons";

type Workspace = {
  id: string;
  slug: string;
  name: string;
};

type WorkspaceSwitcherProps = {
  workspaces: Workspace[];
  currentWorkspace?: Workspace | null;
};

export function WorkspaceSwitcher({ workspaces, currentWorkspace }: WorkspaceSwitcherProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Switch workspace"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "8px 12px",
          background: "transparent",
          border: "none",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          textAlign: "left",
        }}
        className="hover:bg-[var(--color-surface-hover)] focus-visible:bg-[var(--color-surface-hover)] focus-visible:outline-none"
      >
        <WorkspaceLogoTile workspaceName={currentWorkspace?.name ?? null} size={24} />
        <span
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-fg-strong)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentWorkspace?.name}
        </span>
        <IconChevronDown size={14} style={{ color: "var(--color-fg-muted)", flexShrink: 0 }} />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="start"
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
              minWidth: 200,
              maxWidth: 260,
            }}
          >
            {workspaces.length === 0 ? (
              <div
                style={{
                  padding: "8px",
                  fontSize: 13,
                  color: "var(--color-fg-muted)",
                }}
              >
                No workspaces found
              </div>
            ) : (
              workspaces.map((ws) => (
                <Menu.Item
                  key={ws.id}
                  render={<Link href={`/w/${ws.slug}`} />}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 13,
                    color: "var(--color-fg)",
                    fontWeight: ws.id === currentWorkspace?.id ? 600 : 400,
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                  className="hover:bg-[var(--color-surface-hover)] focus-visible:bg-[var(--color-surface-hover)] focus-visible:outline-none"
                >
                  <WorkspaceLogoTile workspaceName={ws.name} size={24} />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ws.name}
                  </span>
                </Menu.Item>
              ))
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
