"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Database } from "@/lib/supabase/types";

type Group = Database["public"]["Tables"]["group"]["Row"];
type Task = Database["public"]["Tables"]["task"]["Row"];
type Cell = Database["public"]["Tables"]["cell"]["Row"];
type Column = Database["public"]["Tables"]["column"]["Row"];
type Label = Database["public"]["Tables"]["label"]["Row"];

type BoardState = {
  boardId: string | null;
  groups: Group[];
  tasks: Task[];
  cells: Map<string, Cell>; // key: `${task_id}:${column_id}`
  columns: Column[]; // sorted by position
  labelsByColumn: Map<string, Label[]>; // key: column_id; values sorted by position
  columnPrefsByBoard: Record<string, Record<string, { width?: number; hidden?: boolean }>>; // persisted
  sortColumnId: string | null; // ephemeral per-tab sort (per Q30)
  sortDirection: "asc" | "desc" | null;
  selection: Set<string>; // task ids
  draggingTaskId: string | null;
  draggingGroupId: string | null;
  collapsedGroupIds: Set<string>; // per Q5(a) — in-memory, re-derived on hydration
  collapsedByBoard: Record<string, string[]>; // serialized form persisted to localStorage
  editingTaskId: string | null; // for inline title edit
  tempIdMap: Map<string, string>; // tempId → realId, populated on server reconciliation

  // Hydration (called once when the board page mounts)
  hydrate: (args: {
    boardId: string;
    groups: Group[];
    tasks: Task[];
    cells: Cell[];
    columns?: Column[]; // NEW — optional for backward-compat with existing callers
    labels?: Label[]; // NEW — optional for backward-compat with existing callers
  }) => void;

  // Resets transient state; PRESERVES collapsedByBoard + columnPrefsByBoard (persisted slices)
  reset: () => void;

  // Structural mutations — all IDEMPOTENT (applying the same row twice is a no-op)
  applyGroupUpsert: (group: Group) => void;
  applyGroupDelete: (groupId: string) => void;
  applyTaskUpsert: (task: Task) => void;
  applyTaskUpsertReplaceTemp: (tempId: string, real: Task) => void;
  applyTaskDelete: (taskId: string) => void;
  applyCellUpsert: (cell: Cell) => void;

  // Column mutations — all IDEMPOTENT on updated_at
  applyColumnUpsert: (column: Column) => void;
  applyColumnUpsertReplaceTemp: (tempId: string, real: Column) => void;
  applyColumnDelete: (columnId: string) => void;

  // Label mutations — all IDEMPOTENT on updated_at
  applyLabelUpsert: (label: Label) => void;
  applyLabelDelete: (labelId: string) => void;

  // Per-board column prefs (width + visibility)
  setColumnWidth: (columnId: string, width: number) => void;
  toggleColumnHidden: (columnId: string) => void;

  // Ephemeral sort (per Q30 — not persisted, clears on tab close)
  setSort: (columnId: string | null, direction: "asc" | "desc" | null) => void;

  // UI actions
  toggleGroupCollapse: (groupId: string) => void;
  setSelection: (next: Set<string>) => void;
  toggleSelection: (taskId: string) => void;
  selectGroup: (groupId: string, checked: boolean) => void;
  selectAll: (checked: boolean) => void;
  clearSelection: () => void;
  setDraggingTask: (taskId: string | null) => void;
  setDraggingGroup: (groupId: string | null) => void;
  setEditingTask: (taskId: string | null) => void;
};

/** SSR-safe noop storage — used when `window` is not available. */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** The transient (non-persisted) initial state. */
const transientInitial = {
  boardId: null,
  groups: [] as Group[],
  tasks: [] as Task[],
  cells: new Map<string, Cell>(),
  columns: [] as Column[],
  labelsByColumn: new Map<string, Label[]>(),
  sortColumnId: null,
  sortDirection: null as "asc" | "desc" | null,
  selection: new Set<string>(),
  draggingTaskId: null,
  draggingGroupId: null,
  collapsedGroupIds: new Set<string>(),
  editingTaskId: null,
  tempIdMap: new Map<string, string>(),
};

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      ...transientInitial,
      collapsedByBoard: {} as Record<string, string[]>,
      columnPrefsByBoard: {} as Record<
        string,
        Record<string, { width?: number; hidden?: boolean }>
      >,

      // ------------------------------------------------------------------
      // hydrate — called once on mount with server-fetched data.
      // Preserves the already-rehydrated collapsedByBoard from localStorage,
      // and re-derives collapsedGroupIds for the active board.
      // Also accepts columns + labels (NEW in epic 07).
      // ------------------------------------------------------------------
      hydrate({ boardId, groups, tasks, cells, columns = [], labels = [] }) {
        const { collapsedByBoard } = get();
        const ids = collapsedByBoard[boardId] ?? [];

        const cellMap = new Map<string, Cell>();
        for (const cell of cells) {
          cellMap.set(`${cell.task_id}:${cell.column_id}`, cell);
        }

        // Build labelsByColumn map, sorted by position per column
        const labelMap = new Map<string, Label[]>();
        for (const label of labels) {
          const list = labelMap.get(label.column_id) ?? [];
          list.push(label);
          labelMap.set(label.column_id, list);
        }
        for (const list of labelMap.values()) {
          list.sort((a, b) => a.position - b.position);
        }

        // Sort columns by position
        const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

        set({
          boardId,
          groups,
          tasks,
          cells: cellMap,
          columns: sortedColumns,
          labelsByColumn: labelMap,
          collapsedGroupIds: new Set(ids),
          // Reset transient interaction state on board navigation
          selection: new Set(),
          draggingTaskId: null,
          draggingGroupId: null,
          editingTaskId: null,
          tempIdMap: new Map(),
          sortColumnId: null,
          sortDirection: null,
        });
      },

      // ------------------------------------------------------------------
      // reset — clears transient state but PRESERVES collapsedByBoard
      // AND columnPrefsByBoard (both are persisted slices)
      // ------------------------------------------------------------------
      reset() {
        const { collapsedByBoard, columnPrefsByBoard } = get();
        set({
          ...transientInitial,
          collapsedByBoard,
          columnPrefsByBoard,
        });
      },

      // ------------------------------------------------------------------
      // applyGroupUpsert — idempotent: same updated_at is a no-op
      // ------------------------------------------------------------------
      applyGroupUpsert(group) {
        const { groups } = get();
        const idx = groups.findIndex((g) => g.id === group.id);
        if (idx === -1) {
          set({ groups: [...groups, group] });
          return;
        }
        const existing = groups[idx];
        if (!existing || existing.updated_at >= group.updated_at) {
          // Not found (shouldn't happen) or stale Realtime echo — skip
          return;
        }
        const next = [...groups];
        next[idx] = group;
        set({ groups: next });
      },

      // ------------------------------------------------------------------
      // applyGroupDelete — cascades: removes the group AND all its tasks
      // (the DB cascade handles server-side; this mirrors it client-side)
      // ------------------------------------------------------------------
      applyGroupDelete(groupId) {
        const { groups, tasks, cells, selection } = get();

        // Collect task ids belonging to this group
        const removedTaskIds = new Set(
          tasks.filter((t) => t.group_id === groupId).map((t) => t.id),
        );

        // Remove stale cell entries for those tasks
        const nextCells = new Map(cells);
        for (const [key] of cells) {
          const taskId = key.split(":")[0] ?? "";
          if (removedTaskIds.has(taskId)) {
            nextCells.delete(key);
          }
        }

        // Clean selection
        const nextSelection = new Set(selection);
        for (const tid of removedTaskIds) {
          nextSelection.delete(tid);
        }

        set({
          groups: groups.filter((g) => g.id !== groupId),
          tasks: tasks.filter((t) => t.group_id !== groupId),
          cells: nextCells,
          selection: nextSelection,
        });
      },

      // ------------------------------------------------------------------
      // applyTaskUpsert — idempotent: same updated_at is a no-op
      // ------------------------------------------------------------------
      applyTaskUpsert(task) {
        const { tasks } = get();
        const idx = tasks.findIndex((t) => t.id === task.id);
        if (idx === -1) {
          set({ tasks: [...tasks, task] });
          return;
        }
        const existing = tasks[idx];
        if (!existing || existing.updated_at >= task.updated_at) {
          // Not found (shouldn't happen) or stale Realtime echo — skip
          return;
        }
        const next = [...tasks];
        next[idx] = task;
        set({ tasks: next });
      },

      // ------------------------------------------------------------------
      // applyTaskUpsertReplaceTemp — swaps the optimistic task that was
      // inserted with a temp id for the real server-confirmed row.
      // Preserves position in the tasks array. Records tempId → real.id
      // in tempIdMap for in-flight reconciliation.
      // ------------------------------------------------------------------
      applyTaskUpsertReplaceTemp(tempId, real) {
        const { tasks, tempIdMap } = get();
        const idx = tasks.findIndex((t) => t.id === tempId);
        if (idx === -1) {
          // Temp not found — treat as a regular upsert
          get().applyTaskUpsert(real);
          return;
        }
        const next = [...tasks];
        next[idx] = real; // preserves array position
        const nextTempIdMap = new Map(tempIdMap);
        nextTempIdMap.set(tempId, real.id);
        set({ tasks: next, tempIdMap: nextTempIdMap });
      },

      // ------------------------------------------------------------------
      // applyTaskDelete — removes task, its cells, clears from selection
      // ------------------------------------------------------------------
      applyTaskDelete(taskId) {
        const { tasks, cells, selection } = get();

        const nextCells = new Map(cells);
        for (const [key] of cells) {
          if (key.startsWith(`${taskId}:`)) {
            nextCells.delete(key);
          }
        }

        const nextSelection = new Set(selection);
        nextSelection.delete(taskId);

        set({
          tasks: tasks.filter((t) => t.id !== taskId),
          cells: nextCells,
          selection: nextSelection,
        });
      },

      // ------------------------------------------------------------------
      // applyCellUpsert — idempotent: same updated_at is a no-op
      // ------------------------------------------------------------------
      applyCellUpsert(cell) {
        const { cells } = get();
        const key = `${cell.task_id}:${cell.column_id}`;
        const existing = cells.get(key);
        if (existing && existing.updated_at >= cell.updated_at) {
          // Stale Realtime echo — skip
          return;
        }
        const next = new Map(cells);
        next.set(key, cell);
        set({ cells: next });
      },

      // ------------------------------------------------------------------
      // applyColumnUpsert — idempotent: same updated_at is a no-op.
      // CRITICAL: columns array is always kept sorted by position.
      // ------------------------------------------------------------------
      applyColumnUpsert(column) {
        const { columns } = get();
        const idx = columns.findIndex((c) => c.id === column.id);
        if (idx === -1) {
          // New column — insert and re-sort by position
          const next = [...columns, column].sort((a, b) => a.position - b.position);
          set({ columns: next });
          return;
        }
        const existing = columns[idx];
        if (!existing || existing.updated_at >= column.updated_at) {
          // Not found (shouldn't happen) or stale Realtime echo — skip
          return;
        }
        const next = [...columns];
        next[idx] = column;
        // Re-sort after update in case position changed
        next.sort((a, b) => a.position - b.position);
        set({ columns: next });
      },

      // ------------------------------------------------------------------
      // applyColumnUpsertReplaceTemp — swaps an optimistic temp-id column
      // for the real server-confirmed row. Symmetric to applyTaskUpsertReplaceTemp.
      // ------------------------------------------------------------------
      applyColumnUpsertReplaceTemp(tempId, real) {
        const { columns } = get();
        const idx = columns.findIndex((c) => c.id === tempId);
        if (idx === -1) {
          // Temp not found — treat as a regular upsert
          get().applyColumnUpsert(real);
          return;
        }
        const next = [...columns];
        next[idx] = real; // preserves array position
        // Re-sort to guarantee position ordering after the swap
        next.sort((a, b) => a.position - b.position);
        set({ columns: next });
      },

      // ------------------------------------------------------------------
      // applyColumnDelete — removes the column AND cascades:
      //   • clears cells where column_id === columnId (mirror applyGroupDelete)
      //   • clears labelsByColumn[columnId]
      // ------------------------------------------------------------------
      applyColumnDelete(columnId) {
        const { columns, cells, labelsByColumn } = get();

        // Cascade-clear cells for this column
        const nextCells = new Map(cells);
        for (const [key] of cells) {
          // cell key format: `${task_id}:${column_id}`
          if (key.endsWith(`:${columnId}`)) {
            nextCells.delete(key);
          }
        }

        // Cascade-clear labels for this column
        const nextLabelsByColumn = new Map(labelsByColumn);
        nextLabelsByColumn.delete(columnId);

        set({
          columns: columns.filter((c) => c.id !== columnId),
          cells: nextCells,
          labelsByColumn: nextLabelsByColumn,
        });
      },

      // ------------------------------------------------------------------
      // applyLabelUpsert — idempotent: same updated_at is a no-op.
      // Keeps the column's label list sorted by position.
      // ------------------------------------------------------------------
      applyLabelUpsert(label) {
        const { labelsByColumn } = get();
        const existing = labelsByColumn.get(label.column_id) ?? [];
        const idx = existing.findIndex((l) => l.id === label.id);

        let next: Label[];
        if (idx === -1) {
          // New label — append
          next = [...existing, label];
        } else {
          const existingLabel = existing[idx];
          if (existingLabel && existingLabel.updated_at >= label.updated_at) {
            // Stale echo — skip
            return;
          }
          next = [...existing];
          next[idx] = label;
        }

        // Re-sort by position
        next.sort((a, b) => a.position - b.position);

        const nextMap = new Map(labelsByColumn);
        nextMap.set(label.column_id, next);
        set({ labelsByColumn: nextMap });
      },

      // ------------------------------------------------------------------
      // applyLabelDelete — removes a label from its column's list.
      // ------------------------------------------------------------------
      applyLabelDelete(labelId) {
        const { labelsByColumn } = get();
        const nextMap = new Map(labelsByColumn);

        for (const [columnId, labels] of nextMap) {
          const filtered = labels.filter((l) => l.id !== labelId);
          if (filtered.length !== labels.length) {
            nextMap.set(columnId, filtered);
            break; // label ids are unique across columns
          }
        }

        set({ labelsByColumn: nextMap });
      },

      // ------------------------------------------------------------------
      // setColumnWidth — writes width pref for the current board's column.
      // No-op if boardId is null (defensive).
      // ------------------------------------------------------------------
      setColumnWidth(columnId, width) {
        const { boardId, columnPrefsByBoard } = get();
        if (!boardId) return;
        const boardPrefs = { ...(columnPrefsByBoard[boardId] ?? {}) };
        boardPrefs[columnId] = { ...boardPrefs[columnId], width };
        set({ columnPrefsByBoard: { ...columnPrefsByBoard, [boardId]: boardPrefs } });
      },

      // ------------------------------------------------------------------
      // toggleColumnHidden — flips the hidden pref for the current board's column.
      // No-op if boardId is null (defensive).
      // ------------------------------------------------------------------
      toggleColumnHidden(columnId) {
        const { boardId, columnPrefsByBoard } = get();
        if (!boardId) return;
        const boardPrefs = { ...(columnPrefsByBoard[boardId] ?? {}) };
        const current = boardPrefs[columnId]?.hidden ?? false;
        boardPrefs[columnId] = { ...boardPrefs[columnId], hidden: !current };
        set({ columnPrefsByBoard: { ...columnPrefsByBoard, [boardId]: boardPrefs } });
      },

      // ------------------------------------------------------------------
      // setSort — ephemeral per-tab sort state (per Q30).
      // Not persisted; clears on tab close / store re-create.
      // ------------------------------------------------------------------
      setSort(columnId, direction) {
        set({ sortColumnId: columnId, sortDirection: direction });
      },

      // ------------------------------------------------------------------
      // toggleGroupCollapse — updates both in-memory Set AND the
      // serialized collapsedByBoard[boardId] array in one set call,
      // which triggers the persist middleware to write to localStorage.
      // ------------------------------------------------------------------
      toggleGroupCollapse(groupId) {
        const { boardId, collapsedGroupIds, collapsedByBoard } = get();
        if (!boardId) return;

        const nextSet = new Set(collapsedGroupIds);
        if (nextSet.has(groupId)) {
          nextSet.delete(groupId);
        } else {
          nextSet.add(groupId);
        }

        set({
          collapsedGroupIds: nextSet,
          collapsedByBoard: {
            ...collapsedByBoard,
            [boardId]: Array.from(nextSet),
          },
        });
      },

      // ------------------------------------------------------------------
      // Selection actions
      // ------------------------------------------------------------------
      setSelection(next) {
        set({ selection: next });
      },

      toggleSelection(taskId) {
        const { selection } = get();
        const next = new Set(selection);
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        set({ selection: next });
      },

      selectGroup(groupId, checked) {
        const { tasks, selection } = get();
        const groupTaskIds = tasks.filter((t) => t.group_id === groupId).map((t) => t.id);
        const next = new Set(selection);
        if (checked) {
          for (const id of groupTaskIds) {
            next.add(id);
          }
        } else {
          for (const id of groupTaskIds) {
            next.delete(id);
          }
        }
        set({ selection: next });
      },

      selectAll(checked) {
        const { tasks } = get();
        if (checked) {
          set({ selection: new Set(tasks.map((t) => t.id)) });
        } else {
          set({ selection: new Set() });
        }
      },

      clearSelection() {
        set({ selection: new Set() });
      },

      setDraggingTask(taskId) {
        set({ draggingTaskId: taskId });
      },

      setDraggingGroup(groupId) {
        set({ draggingGroupId: groupId });
      },

      setEditingTask(taskId) {
        set({ editingTaskId: taskId });
      },
    }),
    {
      name: "donezo:board-collapsed:v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : localStorage,
      ),
      // NOTE: storage key name is historical (was collapse-only); now persists
      // both collapse state and column prefs. Don't rename — would orphan
      // existing localStorage entries.
      partialize: (state) => ({
        collapsedByBoard: state.collapsedByBoard,
        columnPrefsByBoard: state.columnPrefsByBoard,
      }),
      // On rehydration, re-derive collapsedGroupIds for the active board (if any).
      // columnPrefsByBoard is consumed lazily — no re-derivation needed.
      onRehydrateStorage: () => (state) => {
        if (!state?.boardId) return;
        const ids = state.collapsedByBoard[state.boardId] ?? [];
        state.collapsedGroupIds = new Set(ids);
      },
    },
  ),
);
