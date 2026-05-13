"use client";

import { useState } from "react";
import { CreateBoardModal } from "@/components/shared/CreateBoardModal";
import { NoBoardsInWorkspace } from "@/components/shared/empty-states/NoBoardsInWorkspace";
import { useWorkspace } from "@/hooks/use-workspace";
import { BoardCard } from "./BoardCard";

export function BoardCardGrid() {
  const { workspace, sidebarBoards } = useWorkspace();
  const [modalOpen, setModalOpen] = useState(false);

  // Combine starred + boards for the full list
  const allBoards = [...sidebarBoards.starred, ...sidebarBoards.boards];
  const starredSet = new Set(sidebarBoards.starred.map((b) => b.id));

  if (allBoards.length === 0) {
    return (
      <>
        <NoBoardsInWorkspace onCreate={() => setModalOpen(true)} />
        <CreateBoardModal open={modalOpen} onOpenChange={setModalOpen} />
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 16 }}>
        {allBoards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            workspaceSlug={workspace.slug}
            isStarred={starredSet.has(board.id)}
          />
        ))}
      </div>
      <CreateBoardModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
