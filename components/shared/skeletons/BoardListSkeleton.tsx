import { Skeleton } from "@/components/ui/skeleton";

/**
 * BoardListSkeleton — loading placeholder for the mobile card list view.
 *
 * Matches the mobile task-card layout: status pill + title + meta row.
 * Server-safe: no "use client" — purely presentational.
 *
 * Uses static JSX repetition (no array.map with index keys) to keep biome happy.
 */

function ListCard() {
  return (
    <div
      className="rounded-[var(--radius-md)] border border-[color:var(--color-border-solid)] bg-[color:var(--color-surface)] p-3"
      style={{ minHeight: 72 }}
    >
      {/* Top row: status pill + title */}
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 flex-1 rounded" />
      </div>
      {/* Bottom row: meta cells */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-14 rounded" />
      </div>
    </div>
  );
}

export function BoardListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3" aria-hidden="true">
      <ListCard />
      <ListCard />
      <ListCard />
      <ListCard />
      <ListCard />
      <ListCard />
    </div>
  );
}
