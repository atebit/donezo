"use client";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// NoGroupsEmptyState
// ---------------------------------------------------------------------------

interface NoGroupsEmptyStateProps {
  onAddGroup: () => void;
}

export function NoGroupsEmptyState({ onAddGroup }: NoGroupsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="flex flex-col items-center gap-4 max-w-xs text-center p-8 rounded-xl border border-[color:var(--color-border-solid)] bg-[color:var(--color-surface)]">
        <p className="text-sm text-[color:var(--color-fg-muted)]">
          Add your first group to start organizing tasks.
        </p>
        <Button onClick={onAddGroup}>Add group</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoTasksInGroupHint
// ---------------------------------------------------------------------------

export function NoTasksInGroupHint() {
  return (
    <div className="px-4 py-2 text-sm text-[color:var(--color-fg-muted)]">
      No tasks yet — add one below.
    </div>
  );
}
