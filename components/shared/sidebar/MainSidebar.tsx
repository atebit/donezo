"use client";

import { WorkspaceLogoTile } from "@/components/shared/WorkspaceLogoTile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { CurrentUser } from "@/lib/auth/current-user";
import { IconMenu } from "@/lib/icons";
import { useSidebarStore } from "@/stores/sidebar-store";
import { UserMenu } from "./UserMenu";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

type Workspace = {
  id: string;
  slug: string;
  name: string;
};

type MainSidebarProps = {
  user: CurrentUser;
  workspaces?: Workspace[];
};

/**
 * Main navigation rail — 66px wide on desktop, dark nav background.
 * On mobile (<768px): fixed-bottom row at 8vh height, gap 30px, tools hidden.
 * Hamburger button opens a Sheet (drawer) containing WorkspaceSidebar.
 */
export function MainSidebar({ user, workspaces = [] }: MainSidebarProps) {
  const mobileSidebarOpen = useSidebarStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useSidebarStore((s) => s.setMobileSidebarOpen);

  return (
    <>
      {/* Desktop: vertical rail */}
      <nav
        aria-label="Main navigation"
        className="hidden md:flex"
        style={{
          width: "var(--size-rail-main)",
          minWidth: "var(--size-rail-main)",
          height: "100%",
          backgroundColor: "var(--color-surface-nav)",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 12,
          paddingBottom: 12,
          flexShrink: 0,
          zIndex: "var(--z-rail)",
        }}
      >
        {/* Brand glyph */}
        <div
          style={{
            width: 56,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <WorkspaceLogoTile size={30} aria-label="Donezo" />
        </div>

        {/* Spacer — middle tools area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            paddingTop: 8,
          }}
        >
          <NavToolButton label="Search (coming soon)" disabled>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </NavToolButton>

          <NavToolButton label="Notifications (coming soon)" disabled>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </NavToolButton>
        </div>

        {/* User menu at bottom */}
        <div
          style={{
            width: 56,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <UserMenu user={user} variant="main" />
        </div>
      </nav>

      {/* Mobile: fixed-bottom row at 8vh height */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "8vh",
          backgroundColor: "var(--color-surface-nav)",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          zIndex: "var(--z-rail)",
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        {/* Hamburger to open workspace sidebar drawer */}
        <button
          type="button"
          aria-label="Open workspace sidebar"
          aria-expanded={mobileSidebarOpen}
          onClick={() => setMobileSidebarOpen(true)}
          style={{
            width: 42,
            height: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: "var(--radius-lg)",
            color: "var(--color-nav-icon)",
            cursor: "pointer",
          }}
          className="hover:bg-[var(--color-surface-nav-hover)] focus-visible:bg-[var(--color-surface-nav-hover)] focus-visible:outline-none"
          data-testid="mobile-hamburger"
        >
          <IconMenu size={24} aria-hidden="true" />
        </button>

        {/* User menu */}
        <UserMenu user={user} variant="main" />
      </nav>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          style={{ width: "100vw", maxWidth: "100vw", padding: 0 }}
          aria-label="Workspace navigation"
        >
          <WorkspaceSidebar workspaces={workspaces} mobileDrawerMode />
        </SheetContent>
      </Sheet>
    </>
  );
}

type NavToolButtonProps = {
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
};

function NavToolButton({ label, disabled, children }: NavToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      title={label}
      style={{
        width: 56,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: "var(--radius-sm)",
        color: "var(--color-fg-on-nav)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
      className={
        disabled
          ? undefined
          : "hover:bg-[var(--color-surface-nav-hover)] focus-visible:bg-[var(--color-surface-nav-hover)] focus-visible:outline-none"
      }
    >
      {children}
    </button>
  );
}
