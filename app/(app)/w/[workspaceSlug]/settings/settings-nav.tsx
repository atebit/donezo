"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "General", segment: "general" },
  { label: "Members", segment: "members" },
  { label: "Billing", segment: "billing", disabled: true },
];

export function SettingsNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings navigation" className="flex flex-col gap-0.5">
      {navItems.map((item) => {
        const href = `/w/${workspaceSlug}/settings/${item.segment}`;
        const isActive = pathname.includes(`/settings/${item.segment}`);

        if (item.disabled) {
          return (
            <span
              key={item.segment}
              title="Coming soon"
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-[color:var(--color-fg-muted)] cursor-not-allowed opacity-50 select-none"
            >
              {item.label}
              <span className="ml-2 text-xs rounded px-1.5 py-0.5 bg-[color:var(--color-surface-hover)] text-[color:var(--color-fg-muted)]">
                Soon
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.segment}
            href={href}
            className={[
              "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-[color:var(--color-surface-active)] text-[color:var(--color-fg-strong)]"
                : "text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)]",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
