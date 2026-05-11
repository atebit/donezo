"use client";

import { useEffect, useRef, useState } from "react";
import { useBoardStore } from "@/stores/board-store";

import { AddGroupFooter } from "./AddGroupFooter";
import { NoGroupsEmptyState } from "./EmptyStates";
import { GroupSection } from "./GroupSection";
import type { TableData } from "./types";

interface BoardTableProps {
  boardId: string;
  initial: TableData;
}

export function BoardTable({ boardId, initial }: BoardTableProps) {
  const hydratedRef = useRef(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);

  // Hydrate the store once on mount (StrictMode-safe ref guard prevents
  // double-hydration from the dev-mode double-invocation of effects).
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      useBoardStore.getState().hydrate({
        boardId,
        groups: initial.groups,
        tasks: initial.tasks,
        cells: initial.cells,
      });
    }

    return () => {
      useBoardStore.getState().reset();
    };
  }, [boardId, initial.groups, initial.tasks, initial.cells]);

  const groups = useBoardStore((s) => s.groups);
  const tasks = useBoardStore((s) => s.tasks);

  if (groups.length === 0) {
    return (
      <>
        <NoGroupsEmptyState onAddGroup={() => setIsAddGroupOpen(true)} />
        <AddGroupFooter
          boardId={boardId}
          editingOpen={isAddGroupOpen}
          onEditingOpenChange={setIsAddGroupOpen}
        />
      </>
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <GroupSection
          key={group.id}
          group={group}
          tasks={tasks.filter((t) => t.group_id === group.id)}
        />
      ))}
      <AddGroupFooter
        boardId={boardId}
        editingOpen={isAddGroupOpen}
        onEditingOpenChange={setIsAddGroupOpen}
      />
    </div>
  );
}
