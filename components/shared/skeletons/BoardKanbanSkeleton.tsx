import { Skeleton } from "@/components/ui/skeleton";

/**
 * BoardKanbanSkeleton — loading placeholder for the board kanban view.
 *
 * Renders a row of lane columns with stacked card-height placeholders.
 * Server-safe: no "use client" — purely presentational.
 *
 * Uses static JSX repetition (no array.map with index keys) to keep biome happy.
 */

function KanbanCard() {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border-solid)] bg-[color:var(--color-surface)] p-3 flex flex-col gap-2">
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-3 w-3/4 rounded" />
      <div className="flex gap-1 mt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

function KanbanLane() {
  return (
    <div className="flex flex-col gap-2 w-56 shrink-0">
      <Skeleton className="h-8 w-40 rounded" />
      <KanbanCard />
      <KanbanCard />
      <KanbanCard />
    </div>
  );
}

export function BoardKanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-hidden p-4" aria-hidden="true">
      <KanbanLane />
      <KanbanLane />
      <KanbanLane />
      <KanbanLane />
    </div>
  );
}
