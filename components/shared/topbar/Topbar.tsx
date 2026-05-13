"use client";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserMenu } from "@/components/shared/sidebar/UserMenu";
import { useWorkspaceMaybe } from "@/hooks/use-workspace";
import type { CurrentUser } from "@/lib/auth/current-user";
import { IconMenu } from "@/lib/icons";
import { useSidebarStore } from "@/stores/sidebar-store";
import { Breadcrumbs } from "./Breadcrumbs";
import { SearchStub } from "./SearchStub";

/**
 * Application topbar rendered by SidebarShell above the main content area.
 * Height: 48px (--height-topbar).
 *
 * Desktop (md+): breadcrumbs, spacer, search, bell, account menu.
 * Mobile (<md): hamburger, workspace name, bell, avatar.
 */
export function Topbar({ user }: { user: CurrentUser }) {
  const workspaceCtx = useWorkspaceMaybe();
  const workspaceSlug = workspaceCtx?.workspace.slug;
  const workspaceName = workspaceCtx?.workspace.name;
  const setMobileSidebarOpen = useSidebarStore((s) => s.setMobileSidebarOpen);

  return (
    <header
      style={{
        height: 48,
        borderBottom: "1px solid var(--color-border-strong)",
        padding: "0 24px",
        gap: 16,
      }}
      className="flex items-center w-full shrink-0 bg-[var(--color-surface)]"
    >
      {/* Mobile layout: hamburger + workspace name */}
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

      {/* Desktop layout: breadcrumbs */}
      <div className="hidden md:flex flex-1 items-center">
        <Breadcrumbs />
      </div>

      {/* Right side controls — always visible */}
      <div className="flex items-center gap-2">
        {/* Search — desktop only */}
        <div className="hidden md:flex">
          <SearchStub />
        </div>
        <NotificationBell {...(workspaceSlug !== undefined ? { workspaceSlug } : {})} />
        <UserMenu user={user} variant="small" />
      </div>
    </header>
  );
}
