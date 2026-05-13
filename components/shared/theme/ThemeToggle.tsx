"use client";

import { Menu } from "@base-ui/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { IconThemeDark, IconThemeLight, IconThemeSystem } from "@/lib/icons";

type ThemeOption = {
  value: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" }>;
};

/** Ordered menu options per spec: System, Light, Dark */
export const THEME_OPTIONS: ThemeOption[] = [
  { value: "system", label: "System", Icon: IconThemeSystem },
  { value: "light", label: "Light", Icon: IconThemeLight },
  { value: "dark", label: "Dark", Icon: IconThemeDark },
];

/**
 * ThemeToggle — a submenu (System / Light / Dark) for the account menu.
 *
 * SSR guard: renders a non-interactive placeholder until the component is
 * mounted on the client, preventing hydration mismatches caused by
 * next-themes reading localStorage only in the browser.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("account.theme");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pre-mount placeholder — renders identically on server and first client
  // paint, so React hydration does not see a mismatch.
  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          fontSize: 14,
          color: "var(--color-fg-muted)",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <IconThemeSystem size={16} aria-hidden />
        Theme
      </div>
    );
  }

  // THEME_OPTIONS[0] is always defined (non-empty array); the ?? fallback satisfies TS strict.
  // biome-ignore lint/style/noNonNullAssertion: THEME_OPTIONS is a non-empty literal array
  const active = THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[0]!;
  const ActiveIcon = active.Icon;

  return (
    <Menu.Root>
      <Menu.Trigger
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          width: "100%",
          borderRadius: "var(--radius-sm)",
          fontSize: 14,
          color: "var(--color-fg)",
          cursor: "pointer",
          background: "none",
          border: "none",
          textAlign: "left",
        }}
        className="hover:bg-[var(--color-surface-hover)] focus-visible:bg-[var(--color-surface-hover)] focus-visible:outline-none"
        aria-label="Change theme"
      >
        <ActiveIcon size={16} aria-hidden />
        Theme
        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "var(--color-fg-muted)",
          }}
        >
          {t(active.value)}
        </span>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          side="right"
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
              padding: "4px",
              minWidth: 140,
            }}
          >
            {THEME_OPTIONS.map(({ value, Icon }) => (
              <Menu.Item
                key={value}
                onClick={() => setTheme(value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  color: theme === value ? "var(--color-primary)" : "var(--color-fg)",
                  cursor: "pointer",
                  fontWeight: theme === value ? 500 : 400,
                }}
                className="hover:bg-[var(--color-surface-hover)] focus-visible:bg-[var(--color-surface-hover)] focus-visible:outline-none"
                aria-current={theme === value ? "true" : undefined}
              >
                <Icon size={16} aria-hidden />
                {t(value)}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
