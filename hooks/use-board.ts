"use client";
import { useContext } from "react";
import { BoardContext, type BoardContextValue } from "@/lib/board-context";

/** Throws if used outside <BoardProvider>. */
export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside <BoardProvider>");
  return ctx;
}

/** Returns null if outside <BoardProvider> (safe variant for topbar/breadcrumbs). */
export function useBoardMaybe(): BoardContextValue | null {
  return useContext(BoardContext);
}
