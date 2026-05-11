"use client";

import { useCallback, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { starBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/actions";
import { useBoard } from "@/hooks/use-board";
import { IconStar } from "@/lib/icons";
import { cn } from "@/lib/utils";

export function BoardStarToggle() {
  const { board, isStarred } = useBoard();
  const [optimisticStarred, setOptimisticStarred] = useOptimistic(isStarred);
  const [isPending, startTransition] = useTransition();

  const handleToggle = useCallback(() => {
    const next = !optimisticStarred;
    startTransition(async () => {
      setOptimisticStarred(next);
      try {
        await starBoard({ boardId: board.id, starred: next });
      } catch {
        toast.error("Failed to update star. Please try again.");
      }
    });
  }, [board.id, optimisticStarred, setOptimisticStarred]);

  return (
    <button
      type="button"
      aria-label={optimisticStarred ? "Unstar board" : "Star board"}
      aria-pressed={optimisticStarred}
      disabled={isPending}
      onClick={handleToggle}
      className={cn(
        "inline-flex items-center justify-center rounded p-1 transition-colors",
        "hover:bg-[color:var(--color-surface-hover)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
      )}
    >
      <IconStar
        size={16}
        className={cn(
          "transition-colors",
          optimisticStarred
            ? "fill-[color:var(--color-label-yellow)] stroke-[color:var(--color-label-yellow)]"
            : "fill-none stroke-[color:var(--color-fg-muted)]",
        )}
      />
    </button>
  );
}
