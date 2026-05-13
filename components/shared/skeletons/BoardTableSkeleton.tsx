import { Skeleton } from "@/components/ui/skeleton";

/**
 * BoardTableSkeleton — loading placeholder for the board table view.
 *
 * Matches ~36px row height (--size-cell-h token) to avoid CLS on hydration.
 * Server-safe: no "use client" — purely presentational.
 *
 * Uses static JSX repetition (no array.map with index keys) to keep biome happy.
 */

function ColumnCells() {
  return (
    <>
      <Skeleton className="h-9 w-36 rounded-none" />
      <Skeleton className="h-9 w-36 rounded-none" />
      <Skeleton className="h-9 w-36 rounded-none" />
      <Skeleton className="h-9 w-36 rounded-none" />
    </>
  );
}

function TaskRow() {
  return (
    <div className="flex items-center gap-px" style={{ height: 36 }}>
      <Skeleton className="h-9 w-80 rounded-none" />
      <ColumnCells />
    </div>
  );
}

function GroupSection() {
  return (
    <div className="mb-4">
      {/* Group header */}
      <div className="flex items-center gap-2 mb-px" style={{ height: 36 }}>
        <Skeleton className="h-9 rounded-none" style={{ width: 4 }} />
        <Skeleton className="h-5 w-32 rounded" />
      </div>
      <TaskRow />
      <TaskRow />
      <TaskRow />
      <TaskRow />
    </div>
  );
}

export function BoardTableSkeleton() {
  return (
    <div className="w-full overflow-hidden" aria-hidden="true">
      {/* Column header row */}
      <div className="flex items-center gap-px mb-px" style={{ height: 36 }}>
        <Skeleton className="h-9 w-80 rounded-none" />
        <ColumnCells />
      </div>

      {/* Group rows */}
      <GroupSection />
      <GroupSection />
    </div>
  );
}
