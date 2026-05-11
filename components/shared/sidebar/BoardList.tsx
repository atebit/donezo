"use client";

import { useOptimistic, useTransition } from "react";
import { starBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/actions";
import { FavoritesEmpty } from "@/components/shared/empty-states/FavoritesEmpty";
import type { SidebarBoard } from "@/lib/workspace-context";
import { useSidebarStore } from "@/stores/sidebar-store";
import { BoardListItem } from "./BoardListItem";

export type { SidebarBoard };

export type OptimisticBoard = SidebarBoard & { starred: boolean };

type SidebarBoards = {
  starred: SidebarBoard[];
  boards: SidebarBoard[];
};

type BoardListProps = {
  workspaceSlug: string;
  activeBoardId?: string | undefined;
  initialBoards?: SidebarBoards | undefined;
};

type StarAction = { boardId: string; starred: boolean };

function applyStarAction(boards: OptimisticBoard[], action: StarAction): OptimisticBoard[] {
  return boards.map((b) => (b.id === action.boardId ? { ...b, starred: action.starred } : b));
}

export function BoardList({ workspaceSlug, activeBoardId, initialBoards }: BoardListProps) {
  const search = useSidebarStore((s) => s.search);
  const [, startTransition] = useTransition();

  // Flatten boards with starred flag for optimistic updates
  const allBoards: OptimisticBoard[] = [
    ...(initialBoards?.starred ?? []).map((b) => ({ ...b, starred: true })),
    ...(initialBoards?.boards ?? []).map((b) => ({ ...b, starred: false })),
  ];

  const [optimisticBoards, addOptimistic] = useOptimistic<OptimisticBoard[], StarAction>(
    allBoards,
    (current, action) => applyStarAction(current, action),
  );

  function handleToggleStar(boardId: string, currentlyStarred: boolean) {
    const nextStarred = !currentlyStarred;
    startTransition(async () => {
      addOptimistic({ boardId, starred: nextStarred });
      await starBoard({ boardId, starred: nextStarred });
    });
  }

  // Filter by search
  const filteredBoards = search
    ? optimisticBoards.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : optimisticBoards;

  const starredBoards = filteredBoards.filter((b) => b.starred);
  const regularBoards = filteredBoards.filter((b) => !b.starred);

  if (optimisticBoards.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <p style={{ fontSize: 13, color: "var(--color-fg-muted)", padding: "8px" }}>
          No boards yet
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Starred / Favorites section */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--color-fg-muted)",
            padding: "8px 8px 4px",
          }}
        >
          Favorites
        </div>
        {starredBoards.length === 0 && !search ? (
          <FavoritesEmpty />
        ) : starredBoards.length === 0 && search ? null : (
          <div className="flex flex-col">
            {starredBoards.map((board) => (
              <BoardListItem
                key={board.id}
                board={board}
                workspaceSlug={workspaceSlug}
                activeBoardId={activeBoardId}
                onToggleStar={handleToggleStar}
              />
            ))}
          </div>
        )}
      </div>

      {/* All boards section */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--color-fg-muted)",
            padding: "8px 8px 4px",
          }}
        >
          Boards
        </div>
        {regularBoards.length === 0 && search ? (
          <p
            style={{
              fontSize: 13,
              color: "var(--color-fg-muted)",
              padding: "4px 8px",
            }}
          >
            No boards match &ldquo;{search}&rdquo;
          </p>
        ) : (
          <div className="flex flex-col">
            {regularBoards.map((board) => (
              <BoardListItem
                key={board.id}
                board={board}
                workspaceSlug={workspaceSlug}
                activeBoardId={activeBoardId}
                onToggleStar={handleToggleStar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
