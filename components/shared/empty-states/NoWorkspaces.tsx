"use client";

import { IconUsers } from "@/lib/icons";
import { EmptyState } from "./EmptyState";

type NoWorkspacesProps = {
  onCreate?: () => void;
};

export function NoWorkspaces({ onCreate }: NoWorkspacesProps) {
  return (
    <EmptyState
      icon={IconUsers}
      title="Welcome to Donezo"
      description="Create your first workspace to get started."
      action={
        onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="mt-2 px-5 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Create workspace
          </button>
        ) : undefined
      }
    />
  );
}
