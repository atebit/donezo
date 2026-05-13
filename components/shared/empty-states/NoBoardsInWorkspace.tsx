"use client";

import { IconLayout } from "@/lib/icons";
import { EmptyState } from "./EmptyState";

type NoBoardsInWorkspaceProps = {
  workspaceName: string;
  onCreate?: () => void;
};

export function NoBoardsInWorkspace({ workspaceName, onCreate }: NoBoardsInWorkspaceProps) {
  return (
    <EmptyState
      icon={IconLayout}
      title={`${workspaceName} is ready for its first board`}
      description="or pick a template — coming soon"
      action={
        onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="px-5 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Create board
          </button>
        ) : undefined
      }
    />
  );
}
