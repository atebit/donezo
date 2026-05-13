import { Skeleton } from "@/components/ui/skeleton";

/**
 * DashboardSkeleton — loading placeholder for the board dashboard view.
 *
 * Renders a 2-column grid of widget-sized rectangles (react-grid-layout shape).
 * Server-safe: no "use client" — purely presentational.
 *
 * Uses static JSX repetition (no array.map with index keys) to keep biome happy.
 */

function DashboardWidget() {
  return (
    <div
      className="rounded-[var(--radius-md)] border border-[color:var(--color-border-solid)] bg-[color:var(--color-surface)] p-4 flex flex-col gap-3"
      style={{ minHeight: 180 }}
    >
      <Skeleton className="h-4 w-32 rounded" />
      <Skeleton className="h-24 w-full rounded" />
      <Skeleton className="h-3 w-24 rounded" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-4" aria-hidden="true">
      {/* Page title area */}
      <Skeleton className="h-8 w-40 mb-6 rounded" />

      {/* Widget grid — 2 rows of 2 */}
      <div className="grid grid-cols-2 gap-4">
        <DashboardWidget />
        <DashboardWidget />
        <DashboardWidget />
        <DashboardWidget />
      </div>
    </div>
  );
}
