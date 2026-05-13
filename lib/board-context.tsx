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
  /**
   * The workspace slug — used by `useBoardView.switchView` to build cross-kind
   * navigation URLs without parsing the current pathname.
   * Set by `[boardId]/layout.tsx`.
   */
  workspaceSlug: string;
};

export const BoardContext = createContext<BoardContextValue | null>(null);

/** Provides board identity, role, star state, current user id, workspace id, and workspace slug to the subtree. */
export function BoardProvider({
  board,
  role,
  isStarred,
  userId,
  workspaceSlug,
  children,
}: {
  board: BoardContextValue["board"];
  role: Role;
  isStarred: boolean;
  userId: string;
  /** The workspace URL slug — from the [workspaceSlug] route param. */
  workspaceSlug: string;
  children: ReactNode;
}) {
  return (
    <BoardContext.Provider
      value={{ board, role, isStarred, userId, workspaceId: board.workspace_id, workspaceSlug }}
    >
      {children}
    </BoardContext.Provider>
  );
}
