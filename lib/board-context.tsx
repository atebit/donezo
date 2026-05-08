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
};

export const BoardContext = createContext<BoardContextValue | null>(null);

/** Provides board identity, role, and star state to the subtree. */
export function BoardProvider({
  board,
  role,
  isStarred,
  children,
}: {
  board: BoardContextValue["board"];
  role: Role;
  isStarred: boolean;
  children: ReactNode;
}) {
  return (
    <BoardContext.Provider value={{ board, role, isStarred }}>{children}</BoardContext.Provider>
  );
}
