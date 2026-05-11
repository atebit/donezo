"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "General", segment: "general" },
  { label: "Members", segment: "members" },
];

export function BoardSettingsNav({
  workspaceSlug,
  boardId,
}: {
  workspaceSlug: string;
  boardId: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Board settings navigation" className="flex flex-col gap-0.5">
      {navItems.map((item) => {
        const href = `/w/${workspaceSlug}/b/${boardId}/settings/${item.segment}`;
        const isActive = pathname.includes(`/settings/${item.segment}`);

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
