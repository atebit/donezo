"use client";

import { Menu } from "@base-ui/react";
import Link from "next/link";
import { useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";
import { Avatar } from "@/components/shared/Avatar";
import type { CurrentUser } from "@/lib/auth/current-user";
import { IconLogOut, IconSettings } from "@/lib/icons";

type UserMenuProps = {
  user: CurrentUser;
  variant?: "main" | "small";
};

export function UserMenu({ user, variant = "main" }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();
  const avatarSize: 37.4 | 26 = variant === "main" ? 37.4 : 26;

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
    });
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Account menu"
        className="flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        <Avatar
          src={user.avatarUrl}
          displayName={user.displayName}
          email={user.email}
          size={avatarSize}
          borderColor="white"
        />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          side="right"
          align="end"
          sideOffset={8}
          style={{ zIndex: "var(--z-popover)" }}
        >
          <Menu.Popup
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-modal)",
              padding: "8px",
              minWidth: 180,
            }}
          >
            {/* User info header */}
            <div
              style={{
                padding: "8px 8px 10px",
                borderBottom: "1px solid var(--color-border)",
                marginBottom: 4,
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-fg-strong)",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {user.displayName ?? user.email}
              </p>
              {user.displayName && (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--color-fg-muted)",
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {user.email}
                </p>
              )}
            </div>

            {/* Account settings link */}
            <Menu.Item
              render={<Link href="/account" />}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                fontSize: 14,
                color: "var(--color-fg)",
                cursor: "pointer",
                textDecoration: "none",
              }}
              className="hover:bg-[var(--color-surface-hover)] focus-visible:bg-[var(--color-surface-hover)] focus-visible:outline-none"
            >
              <IconSettings size={16} aria-hidden="true" />
              Account settings
            </Menu.Item>

            {/* Theme toggle — disabled, epic 14 owns dark mode */}
            <Menu.Item
              disabled
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                fontSize: 14,
                color: "var(--color-fg-muted)",
                cursor: "not-allowed",
                opacity: 0.5,
              }}
              title="Coming soon"
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
                ◑
              </span>
              Theme
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: "var(--color-fg-subtle)",
                  background: "var(--color-surface-info)",
                  padding: "1px 6px",
                  borderRadius: "var(--radius-pill)",
                }}
              >
                Coming soon
              </span>
            </Menu.Item>

            {/* Divider */}
            <hr
              style={{
                border: "none",
                borderTop: "1px solid var(--color-border)",
                margin: "4px 0",
              }}
            />

            {/* Sign out */}
            <Menu.Item
              onClick={handleSignOut}
              disabled={isPending}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                fontSize: 14,
                color: "var(--color-label-red)",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
              className="hover:bg-[var(--color-surface-hover)] focus-visible:bg-[var(--color-surface-hover)] focus-visible:outline-none"
            >
              <IconLogOut size={16} aria-hidden="true" />
              Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
