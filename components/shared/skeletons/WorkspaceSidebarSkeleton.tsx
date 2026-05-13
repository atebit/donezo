import { Skeleton } from "@/components/ui/skeleton";

/**
 * WorkspaceSidebarSkeleton — loading placeholder for the workspace sidebar.
 *
 * Matches WorkspaceSidebar layout: workspace switcher + board list groups.
 * Server-safe: no "use client" — purely presentational.
 *
 * Uses static JSX repetition (no array.map with index keys) to keep biome happy.
 */

function SidebarRow() {
  return <Skeleton className="h-8 w-full rounded-[var(--radius-sm)]" />;
}

export function WorkspaceSidebarSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 p-3"
      style={{ width: "var(--size-rail-workspace, 230px)" }}
      aria-hidden="true"
    >
      {/* Workspace switcher header */}
      <div className="flex items-center gap-2 px-2 py-1">
        <Skeleton className="h-7 w-7 rounded-[var(--radius-sm)]" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>

      {/* Divider */}
      <Skeleton className="h-px w-full rounded-none" />

      {/* Starred boards section */}
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-16 rounded mb-1" />
        <SidebarRow />
        <SidebarRow />
      </div>

      {/* All boards section */}
      <div className="flex flex-col gap-1 mt-2">
        <Skeleton className="h-3 w-20 rounded mb-1" />
        <SidebarRow />
        <SidebarRow />
        <SidebarRow />
        <SidebarRow />
      </div>
    </div>
  );
}
