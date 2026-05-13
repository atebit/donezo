"use client";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserMenu } from "@/components/shared/sidebar/UserMenu";
import { useWorkspaceMaybe } from "@/hooks/use-workspace";
import type { CurrentUser } from "@/lib/auth/current-user";
import { Breadcrumbs } from "./Breadcrumbs";
import { SearchStub } from "./SearchStub";

/**
 * Application topbar rendered by SidebarShell (Slice 8) above the main content area.
 * Height: 48px, items left-to-right: breadcrumbs, spacer, search, bell, account menu.
 */
export function Topbar({ user }: { user: CurrentUser }) {
  const workspaceCtx = useWorkspaceMaybe();
  const workspaceSlug = workspaceCtx?.workspace.slug;

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
      {/* Breadcrumbs — left side */}
      <Breadcrumbs />

      {/* Flex spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        <SearchStub />
        <NotificationBell {...(workspaceSlug !== undefined ? { workspaceSlug } : {})} />
        <UserMenu user={user} variant="small" />
      </div>
    </header>
  );
}
