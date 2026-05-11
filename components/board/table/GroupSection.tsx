"use client";

import { useTransition } from "react";

import { renameGroup } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { useBoardStore } from "@/stores/board-store";

import { colorToToken } from "./group-color";
import { TaskRow } from "./TaskRow";
import type { Group, Task } from "./types";

interface GroupSectionProps {
  group: Group;
  tasks: Task[];
}

export function GroupSection({ group, tasks }: GroupSectionProps) {
  const [, startTransition] = useTransition();

  const isCollapsed = useBoardStore((s) => s.collapsedGroupIds.has(group.id));
  const colorToken = colorToToken(group.color);

  const handleRename = (nextValue: string) => {
    if (!nextValue) return;

    // Optimistic update — bump updated_at so the idempotency guard passes.
    useBoardStore.getState().applyGroupUpsert({
      ...group,
      name: nextValue,
      updated_at: new Date().toISOString(),
    });

    startTransition(async () => {
      const result = await renameGroup({ groupId: group.id, name: nextValue });
      if (!result.ok) {
        // Revert to the original group row.
        useBoardStore.getState().applyGroupUpsert({
          ...group,
          updated_at: new Date().toISOString(),
        });
      } else {
        // Sync to the authoritative server row.
        useBoardStore.getState().applyGroupUpsert(result.data);
      }
    });
  };

  return (
    <section className="group" data-group-id={group.id}>
      {/* Group header — sticky within the scroll container */}
      <div className="sticky top-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] flex items-center h-10 gap-1">
        {/* Collapse / expand arrow */}
        <button
          type="button"
          aria-label={isCollapsed ? "Expand group" : "Collapse group"}
          onClick={() => useBoardStore.getState().toggleGroupCollapse(group.id)}
          className="flex-shrink-0 flex items-center justify-center w-6 h-6 ml-[13px] transition-transform duration-[var(--motion-base)]"
          style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="fill-[color:var(--color-fg-muted)]"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Group title — colored in the group accent */}
        <span style={{ color: `var(${colorToken})` }}>
          <EditableTitle
            initialValue={group.name}
            variant="h4"
            onCommit={handleRename}
            ariaLabel="Group title"
          />
        </span>

        {/* Task count chip — revealed on hover */}
        <span
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)] text-sm text-[color:var(--color-fg-muted)] ml-1 flex-shrink-0"
          aria-hidden="true"
        >
          {tasks.length}
        </span>

        {/* Overflow menu placeholder — wired in S13 */}
        <button
          type="button"
          aria-label="Group menu (wired in S13)"
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)] ml-1 flex-shrink-0 text-[color:var(--color-fg-muted)]"
        >
          ⋯
        </button>
      </div>

      {/* Task rows — hidden when collapsed */}
      {!isCollapsed && tasks.map((task) => <TaskRow key={task.id} task={task} group={group} />)}
    </section>
  );
}
