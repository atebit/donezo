"use client";

import { useWorkspaceMaybe } from "@/hooks/use-workspace";
import { IconMenu } from "@/lib/icons";
import { useSidebarStore } from "@/stores/sidebar-store";
import { Breadcrumbs } from "./Breadcrumbs";

/**
 * Application topbar — breadcrumbs on desktop, hamburger + workspace name on mobile.
 * Search, notifications, and account menu live in the sidebar.
 */
export function Topbar() {
  const workspaceCtx = useWorkspaceMaybe();
  const workspaceName = workspaceCtx?.workspace.name;
  const setMobileSidebarOpen = useSidebarStore((s) => s.setMobileSidebarOpen);

  return (
    <header
      style={{
        height: 48,
        borderBottom: "1px solid var(--color-border-strong)",
        padding: "0 24px",
      }}
      className="flex items-center w-full shrink-0 bg-[var(--color-surface)]"
    >
      {/* Mobile: hamburger + workspace name */}
      <div className="flex md:hidden items-center gap-3 flex-1">
        <button
          type="button"
          aria-label="Open workspace sidebar"
          onClick={() => setMobileSidebarOpen(true)}
          style={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-fg-muted)",
            cursor: "pointer",
            flexShrink: 0,
          }}
          className="hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:bg-[var(--color-surface-hover)]"
          data-testid="topbar-mobile-hamburger"
        >
          <IconMenu size={20} aria-hidden="true" />
        </button>

        {workspaceName ? (
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--color-fg)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {workspaceName}
          </span>
        ) : null}
      </div>

      {/* Desktop: breadcrumbs */}
      <div className="hidden md:flex flex-1 items-center">
        <Breadcrumbs />
      </div>
    </header>
  );
}
