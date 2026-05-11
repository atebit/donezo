import { WorkspaceLogoTile } from "@/components/shared/WorkspaceLogoTile";
import type { CurrentUser } from "@/lib/auth/current-user";
import { UserMenu } from "./UserMenu";

type MainSidebarProps = {
  user: CurrentUser;
};

/**
 * Main navigation rail — 66px wide, dark nav background.
 * Contains brand glyph (top), navigation tools (middle), user menu (bottom).
 */
export function MainSidebar({ user }: MainSidebarProps) {
  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: "var(--size-rail-main)",
        minWidth: "var(--size-rail-main)",
        height: "100%",
        backgroundColor: "var(--color-surface-nav)",
        display: "flex",
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

      {/* Spacer — middle tools area (Search/Notifications disabled) */}
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
        {/* Search tool — disabled (not yet implemented) */}
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

        {/* Notifications tool — disabled (not yet implemented) */}
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
