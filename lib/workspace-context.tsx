"use client";
import { createContext, type ReactNode } from "react";
import type { Role } from "@/lib/authorization";

/** Boards loaded for the workspace sidebar. */
export type SidebarBoard = {
  id: string;
  name: string;
  is_private: boolean;
};

export type SidebarBoards = {
  starred: SidebarBoard[];
  boards: SidebarBoard[];
};

export type WorkspaceContextValue = {
  workspace: { id: string; slug: string; name: string };
  role: Role;
  sidebarBoards: SidebarBoards;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/** Provides workspace identity, role, and sidebar board lists to the subtree. */
export function WorkspaceProvider({
  workspace,
  role,
  sidebarBoards,
  children,
}: {
  workspace: WorkspaceContextValue["workspace"];
  role: Role;
  sidebarBoards: SidebarBoards;
  children: ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={{ workspace, role, sidebarBoards }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
