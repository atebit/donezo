"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { listBoardActivity } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions";
import { ActivityList } from "@/components/activity/ActivityList";
import { BoardActivityFilters } from "@/components/activity/BoardActivityFilters";
// Slice D — parallel; may not resolve until merge
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ActivityRenderCtx } from "@/components/activity/renderers";
import { useBoard } from "@/hooks/use-board";
import { IconClose } from "@/lib/icons";
import type { ActivityFilters } from "@/lib/validations/activity";
import type { ActivityRow } from "@/stores/types/comments";

type Member = {
  id: string;
  displayName: string | null;
  email: string | null;
};

interface BoardActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Board members for actor filter. Provided by parent to avoid redundant fetches. */
  members?: Member[];
  /** Render context forwarded to <ActivityList /> (columns, labels, profiles). */
  ctx: ActivityRenderCtx;
}

export function BoardActivityModal({
  open,
  onOpenChange,
  members = [],
  ctx,
}: BoardActivityModalProps) {
  const { board } = useBoard();
  const [events, setEvents] = useState<ActivityRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<ActivityFilters>({});
  const [isPending, startTransition] = useTransition();

  /** Fetch first page (or re-fetch on filter change). */
  function fetchFirstPage(nextFilters: ActivityFilters) {
    startTransition(async () => {
      const result = await listBoardActivity({
        boardId: board.id,
        filters: nextFilters,
        cursor: null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setEvents(result.data.events);
      setCursor(result.data.nextCursor);
      setHasMore(result.data.nextCursor !== null);
    });
  }

  /** Append next page. */
  function fetchNextPage() {
    if (!cursor) return;
    startTransition(async () => {
      const result = await listBoardActivity({
        boardId: board.id,
        filters,
        cursor,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setEvents((prev) => [...prev, ...result.data.events]);
      setCursor(result.data.nextCursor);
      setHasMore(result.data.nextCursor !== null);
    });
  }

  /** When the modal opens, fetch the first page. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only re-fetch when open transitions to true
  useEffect(() => {
    if (open) {
      fetchFirstPage(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** When filters change, reset and re-fetch. */
  function handleFiltersChange(next: ActivityFilters) {
    setFilters(next);
    setEvents([]);
    setCursor(null);
    setHasMore(false);
    fetchFirstPage(next);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-[720px] max-h-[80vh] rounded-xl bg-surface shadow-[var(--shadow-modal)] focus:outline-none flex flex-col overflow-hidden"
          aria-labelledby="board-activity-modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--color-border)] shrink-0">
            <Dialog.Title
              id="board-activity-modal-title"
              className="text-base font-semibold text-[color:var(--color-fg-strong)]"
            >
              Board activity
            </Dialog.Title>
            <Dialog.Close
              className="rounded p-1 hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
              aria-label="Close activity modal"
            >
              <IconClose size={16} />
            </Dialog.Close>
          </div>

          {/* Filters */}
          <div className="shrink-0">
            <BoardActivityFilters
              value={filters}
              onChange={handleFiltersChange}
              members={members}
            />
          </div>

          {/* Activity list — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-2">
            {isPending && events.length === 0 && (
              <p className="py-8 text-center text-sm text-[color:var(--color-fg-muted)]">
                Loading…
              </p>
            )}
            {!isPending && events.length === 0 && (
              <p className="py-8 text-center text-sm text-[color:var(--color-fg-muted)]">
                No activity yet.
              </p>
            )}
            {events.length > 0 && (
              <ActivityList
                scope={{ kind: "board", boardId: board.id }}
                events={events}
                ctx={ctx}
              />
            )}
          </div>

          {/* Footer — Load more */}
          {hasMore && (
            <div className="shrink-0 border-t border-[color:var(--color-border)] px-6 py-3 flex justify-center">
              <button
                type="button"
                onClick={fetchNextPage}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]"
              >
                {isPending ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
