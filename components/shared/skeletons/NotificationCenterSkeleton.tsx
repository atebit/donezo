import { Skeleton } from "@/components/ui/skeleton";

/**
 * NotificationCenterSkeleton — loading placeholder for the notifications page.
 *
 * Matches the NotificationList layout: date-group header + notification rows.
 * Server-safe: no "use client" — purely presentational.
 *
 * Uses static JSX repetition (no array.map with index keys) to keep biome happy.
 */

function NotificationRow() {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[color:var(--color-border)]">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
      <Skeleton className="h-3 w-12 rounded shrink-0" />
    </div>
  );
}

function NotificationGroup() {
  return (
    <div className="mb-4">
      <Skeleton className="h-3 w-20 mb-3 rounded" />
      <NotificationRow />
      <NotificationRow />
      <NotificationRow />
      <NotificationRow />
    </div>
  );
}

export function NotificationCenterSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto p-4" aria-hidden="true">
      {/* Page title */}
      <Skeleton className="h-8 w-40 mb-6 rounded" />
      <NotificationGroup />
      <NotificationGroup />
    </div>
  );
}
