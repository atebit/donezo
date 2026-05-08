"use client";
import { useContext } from "react";
import { WorkspaceContext, type WorkspaceContextValue } from "@/lib/workspace-context";

/** Throws if used outside <WorkspaceProvider>. */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

/** Returns null if outside <WorkspaceProvider> (safe variant for topbar/breadcrumbs). */
export function useWorkspaceMaybe(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
