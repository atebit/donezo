"use client";
import { createContext, type ReactNode } from "react";
import type { Role } from "@/lib/authorization";

export type BoardContextValue = {
  board: {
    id: string;
    name: string;
    description: string;
    is_private: boolean;
    workspace_id: string;
    created_by: string | null;
    deleted_at: string | null;
  };
  role: Role;
  isStarred: boolean;
  /** Current authenticated user's id — used by cursor broadcast (Epic 08 S6). */
  userId: string;
  /**
   * The workspace id for this board — exposed so the topbar global-search
   * palette (Slice G) can pass it to `globalSearch` without re-reading the
   * URL or making an extra server round-trip.
   */
  workspaceId: string;
};

export const BoardContext = createContext<BoardContextValue | null>(null);

/** Provides board identity, role, star state, current user id, and workspace id to the subtree. */
export function BoardProvider({
  board,
  role,
  isStarred,
  userId,
  children,
}: {
  board: BoardContextValue["board"];
  role: Role;
  isStarred: boolean;
  userId: string;
  children: ReactNode;
}) {
  return (
    <BoardContext.Provider
      value={{ board, role, isStarred, userId, workspaceId: board.workspace_id }}
    >
      {children}
    </BoardContext.Provider>
  );
}
