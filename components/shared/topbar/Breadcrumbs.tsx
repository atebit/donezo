"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBoardMaybe } from "@/hooks/use-board";
import { useWorkspaceMaybe } from "@/hooks/use-workspace";

type Crumb = {
  label: string;
  href: string;
};

/**
 * Parses the current pathname into breadcrumb segments.
 *
 * Supported path trees:
 * - `/account`                                    → Account
 * - `/w/<slug>`                                   → <workspace name>
 * - `/w/<slug>/settings/general`                  → <workspace name> › Settings › General
 * - `/w/<slug>/settings/members`                  → <workspace name> › Settings › Members
 * - `/w/<slug>/settings/**`                       → <workspace name> › Settings › <section>
 * - `/w/<slug>/b/<boardId>`                       → <workspace name> › <board name>
 * - `/w/<slug>/b/<boardId>/settings`              → <workspace name> › <board name> › Settings
 * - `/w/<slug>/b/<boardId>/<view>`                → <workspace name> › <board name> › <view>
 */
function useBreadcrumbs(): Crumb[] {
  const pathname = usePathname();
  const workspaceCtx = useWorkspaceMaybe();
  const boardCtx = useBoardMaybe();

  const segments = pathname.split("/").filter(Boolean);

  // /account
  if (segments[0] === "account") {
    return [{ label: "Account", href: "/account" }];
  }

  // /w/<slug>/...
  if (segments[0] === "w" && segments[1]) {
    const slug = segments[1];
    const workspaceName = workspaceCtx?.workspace.name ?? slug;
    const workspaceHref = `/w/${slug}`;

    const crumbs: Crumb[] = [{ label: workspaceName, href: workspaceHref }];

    // /w/<slug>/settings/...
    if (segments[2] === "settings") {
      crumbs.push({ label: "Settings", href: `${workspaceHref}/settings` });
      const section = segments[3];
      if (section) {
        const sectionLabel = section.charAt(0).toUpperCase() + section.slice(1);
        crumbs.push({ label: sectionLabel, href: `${workspaceHref}/settings/${section}` });
      }
      return crumbs;
    }

    // /w/<slug>/b/<boardId>/...
    if (segments[2] === "b" && segments[3]) {
      const boardId = segments[3];
      const boardName = boardCtx?.board.name ?? boardId;
      const boardHref = `${workspaceHref}/b/${boardId}`;

      crumbs.push({ label: boardName, href: boardHref });

      const subSection = segments[4];
      if (subSection) {
        const sectionLabel = subSection.charAt(0).toUpperCase() + subSection.slice(1);
        crumbs.push({ label: sectionLabel, href: `${boardHref}/${subSection}` });
      }
      return crumbs;
    }

    // /w/<slug> (workspace home)
    return crumbs;
  }

  // Fallback: no breadcrumbs
  return [];
}

export function Breadcrumbs() {
  const crumbs = useBreadcrumbs();

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            {index > 0 && (
              <ChevronRight
                size={14}
                aria-hidden
                className="shrink-0 text-[var(--color-fg-muted)]"
              />
            )}
            {isLast ? (
              <span
                className="text-sm font-medium text-[var(--color-fg)] truncate max-w-[200px]"
                aria-current="page"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors truncate max-w-[200px]"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
