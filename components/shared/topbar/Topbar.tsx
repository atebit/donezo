"use client";

import { Avatar } from "@/components/shared/Avatar";
import { Breadcrumbs } from "./Breadcrumbs";
import { NotificationBellStub } from "./NotificationBellStub";
import { SearchStub } from "./SearchStub";

/**
 * Application topbar rendered by SidebarShell (Slice 8) above the main content area.
 * Height: 48px, items left-to-right: breadcrumbs, spacer, search, bell, account menu slot.
 *
 * Account menu slot: placeholder Avatar button until Slice 8 wires in <UserMenu variant="small" />.
 */
export function Topbar() {
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
        <NotificationBellStub />

        {/* Account menu slot
            TODO: Slice 8 wires UserMenu here — replace this button with <UserMenu variant="small" /> */}
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <Avatar size={26} />
        </button>
      </div>
    </header>
  );
}
