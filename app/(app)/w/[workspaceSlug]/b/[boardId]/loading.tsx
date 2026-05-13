import { BoardTableSkeleton } from "@/components/shared/skeletons/BoardTableSkeleton";

/**
 * Board route loading skeleton.
 *
 * Shown while app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx is loading.
 * Defaults to the table skeleton — it's the most common board view.
 * ~36px row height matches --size-cell-h to avoid CLS on hydration.
 */
export default function BoardLoading() {
  return (
    <div className="flex-1 overflow-auto px-4 pt-4">
      <BoardTableSkeleton />
    </div>
  );
}
