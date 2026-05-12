"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Database } from "@/lib/supabase/types";
import type { AttachmentRow } from "@/stores/types/attachments";
import type { ActivityRow, CommentReactionRow, CommentRow } from "@/stores/types/comments";
import type {
  ConnectionStatus,
  CursorPayload,
  OutboxEntry,
  PresenceState,
  TypingPayload,
} from "@/stores/types/realtime";

type Group = Database["public"]["Tables"]["group"]["Row"];
type Task = Database["public"]["Tables"]["task"]["Row"];
type Cell = Database["public"]["Tables"]["cell"]["Row"];
type Column = Database["public"]["Tables"]["column"]["Row"];
type Label = Database["public"]["Tables"]["label"]["Row"];

export type BoardState = {
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

  // Epic 08 — Realtime + outbox state
  // Transient fields
  connection: ConnectionStatus;
  presence: PresenceState;
  cursors: Map<string, CursorPayload>; // key: user_id; one cursor per user
  typingByContext: Map<string, TypingPayload[]>; // key: context string
  outboxOverflow: boolean;

  // Persisted field
  outbox: OutboxEntry[];

  // ============================================================================
  // Epic 09 — Comments + reactions + activity
  // All maps are transient — never persisted.
  // ============================================================================
  commentsByTask: Map<string, CommentRow[]>; // sorted oldest-first
  reactionsByComment: Map<string, CommentReactionRow[]>;
  activityByTask: Map<string, ActivityRow[]>; // newest-first

  // Comments — idempotency on (id, updated_at). Same row, older updated_at → ignored.
  applyCommentUpsert: (comment: CommentRow) => void;
  applyCommentUpsertReplaceTemp: (tempId: string, real: CommentRow) => void;
  applyCommentDelete: (commentId: string) => void;
  hydrateCommentsForTask: (taskId: string, comments: CommentRow[]) => void;

  // Reactions — idempotency on PK tuple (comment_id, user_id, emoji). No updated_at.
  applyReactionInsert: (reaction: CommentReactionRow) => void;
  applyReactionDelete: (commentId: string, userId: string, emoji: string) => void;
  hydrateReactionsForComments: (reactions: CommentReactionRow[]) => void;

  // Activity — idempotency on id.
  applyActivityInsert: (activity: ActivityRow) => void;
  hydrateActivityForTask: (taskId: string, events: ActivityRow[]) => void;

  // ============================================================================
  // Epic 10 — Attachments state
  // All maps are transient — never persisted.
  // ============================================================================
  attachmentsByTask: Map<string, AttachmentRow[]>; // sorted oldest-first

  // Hydrate all attachments for the entire board (called on board-page mount).
  hydrateAttachmentsForBoard: (rows: AttachmentRow[]) => void;
  // Upsert a single attachment row. Idempotent on id; skips rows where is_uploaded=false.
  applyAttachmentUpsert: (row: AttachmentRow) => void;
  // Remove an attachment by id. No-op if unknown.
  applyAttachmentDelete: (attachmentId: string) => void;

  // connection
  setConnectionStatus: (status: ConnectionStatus) => void;

  // presence
  setPresence: (state: PresenceState) => void;

  // cursors
  setCursor: (payload: CursorPayload) => void;
  clearCursor: (userId: string) => void;
  pruneExpiredCursors: (now: number, ttlMs: number) => void; // remove cursors where now - at > ttlMs

  // typing
  setTyping: (payload: TypingPayload) => void;
  pruneExpiredTyping: (now: number, ttlMs: number) => void; // typically ttlMs = 5000

  // outbox
  enqueueOutbox: (entry: Omit<OutboxEntry, "id" | "enqueuedAt">) => void; // generates id + enqueuedAt
  dequeueOutbox: (entryId: string) => void;
  clearOutbox: () => void;
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

  // Epic 08 — Realtime + outbox state (transient portion)
  connection: "connected" as ConnectionStatus,
  presence: {} as PresenceState,
  cursors: new Map<string, CursorPayload>(), // key: user_id; one cursor per user
  typingByContext: new Map<string, TypingPayload[]>(), // key: context string
  outboxOverflow: false,

  // Epic 09 — Comments + reactions + activity (transient)
  commentsByTask: new Map<string, CommentRow[]>(),
  reactionsByComment: new Map<string, CommentReactionRow[]>(),
  activityByTask: new Map<string, ActivityRow[]>(),

  // Epic 10 — Attachments (transient)
  attachmentsByTask: new Map<string, AttachmentRow[]>(),
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
      // Epic 08 — persisted outbox (additive; older entries hydrate with outbox: [])
      outbox: [] as OutboxEntry[],

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
      // reset — clears transient state but PRESERVES collapsedByBoard,
      // columnPrefsByBoard, AND outbox (all persisted slices).
      // Navigating boards must not drop a queued offline mutation.
      // Epic 09: also clears commentsByTask, reactionsByComment, activityByTask.
      // Epic 10: also clears attachmentsByTask.
      // ------------------------------------------------------------------
      reset() {
        const { collapsedByBoard, columnPrefsByBoard, outbox } = get();
        set({
          ...transientInitial,
          collapsedByBoard,
          columnPrefsByBoard,
          outbox,
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

      // ================================================================
      // Epic 08 — Realtime + outbox state
      // ================================================================

      // ------------------------------------------------------------------
      // setConnectionStatus — updates the connection status field.
      // ------------------------------------------------------------------
      setConnectionStatus(status) {
        set({ connection: status });
      },

      // ------------------------------------------------------------------
      // setPresence — overwrites the entire presence state wholesale.
      // Supabase already gives the canonical snapshot; no merge needed.
      // ------------------------------------------------------------------
      setPresence(state) {
        set({ presence: state });
      },

      // ------------------------------------------------------------------
      // setCursor — upserts the cursor for a given user_id (one cursor
      // per user; overwrites any existing position for that user).
      // ------------------------------------------------------------------
      setCursor(payload) {
        const { cursors } = get();
        const next = new Map(cursors);
        next.set(payload.user_id, payload);
        set({ cursors: next });
      },

      // ------------------------------------------------------------------
      // clearCursor — removes the cursor entry for a given user_id.
      // ------------------------------------------------------------------
      clearCursor(userId) {
        const { cursors } = get();
        const next = new Map(cursors);
        next.delete(userId);
        set({ cursors: next });
      },

      // ------------------------------------------------------------------
      // pruneExpiredCursors — removes cursors where now - at > ttlMs.
      // Called periodically by the hook to garbage-collect stale cursors.
      // ------------------------------------------------------------------
      pruneExpiredCursors(now, ttlMs) {
        const { cursors } = get();
        const next = new Map(cursors);
        for (const [userId, cursor] of next) {
          if (now - cursor.at > ttlMs) {
            next.delete(userId);
          }
        }
        set({ cursors: next });
      },

      // ------------------------------------------------------------------
      // setTyping — appends or updates a typing entry for (context, user_id).
      // De-dupes by user_id: newer `at` overwrites older for same user.
      // ------------------------------------------------------------------
      setTyping(payload) {
        const { typingByContext } = get();
        const existing = typingByContext.get(payload.context) ?? [];

        // De-dupe: replace existing entry for this user_id if present
        const withoutUser = existing.filter((e) => e.user_id !== payload.user_id);
        const next = new Map(typingByContext);
        next.set(payload.context, [...withoutUser, payload]);
        set({ typingByContext: next });
      },

      // ------------------------------------------------------------------
      // pruneExpiredTyping — removes typing entries where now - at > ttlMs
      // (typically ttlMs = 5000). Cleans up empty context keys.
      // ------------------------------------------------------------------
      pruneExpiredTyping(now, ttlMs) {
        const { typingByContext } = get();
        const next = new Map(typingByContext);
        for (const [context, entries] of next) {
          const fresh = entries.filter((e) => now - e.at <= ttlMs);
          if (fresh.length === 0) {
            next.delete(context);
          } else {
            next.set(context, fresh);
          }
        }
        set({ typingByContext: next });
      },

      // ------------------------------------------------------------------
      // enqueueOutbox — generates id + enqueuedAt and pushes an entry.
      // 4MB serialized size cap: if exceeded, sets outboxOverflow = true
      // and does NOT enqueue (S8 owns the toast; this slice sets the flag).
      // ------------------------------------------------------------------
      enqueueOutbox(entry) {
        const { outbox } = get();

        // Check serialized size before pushing (4MB conservative cap)
        const OUTBOX_SIZE_CAP = 4 * 1024 * 1024; // 4MB in chars
        const currentSize = JSON.stringify(outbox).length;
        if (currentSize >= OUTBOX_SIZE_CAP) {
          set({ outboxOverflow: true });
          return;
        }

        const newEntry: OutboxEntry = {
          ...entry,
          id: crypto.randomUUID(),
          enqueuedAt: Date.now(),
        };

        // Also guard after adding the entry
        const candidate = [...outbox, newEntry];
        if (JSON.stringify(candidate).length > OUTBOX_SIZE_CAP) {
          set({ outboxOverflow: true });
          return;
        }

        set({ outbox: candidate });
      },

      // ------------------------------------------------------------------
      // dequeueOutbox — removes the entry with the given id.
      // ------------------------------------------------------------------
      dequeueOutbox(entryId) {
        const { outbox } = get();
        set({ outbox: outbox.filter((e) => e.id !== entryId) });
      },

      // ------------------------------------------------------------------
      // clearOutbox — empties the entire outbox (e.g. after successful flush).
      // ------------------------------------------------------------------
      clearOutbox() {
        set({ outbox: [] });
      },

      // ================================================================
      // Epic 09 — Comments + reactions + activity
      // ================================================================

      // ------------------------------------------------------------------
      // applyCommentUpsert — idempotent on (id, updated_at).
      // Same id + same or older updated_at → no-op (stale Realtime echo).
      // Keeps each task's list sorted oldest-first (by created_at, then id).
      // ------------------------------------------------------------------
      applyCommentUpsert(comment) {
        const { commentsByTask } = get();
        const existing = commentsByTask.get(comment.task_id) ?? [];
        const idx = existing.findIndex((c) => c.id === comment.id);

        let next: CommentRow[];
        if (idx === -1) {
          // New comment — append and sort oldest-first
          next = [...existing, comment].sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
              a.id.localeCompare(b.id),
          );
        } else {
          const existingComment = existing[idx];
          if (existingComment && existingComment.updated_at >= comment.updated_at) {
            // Stale Realtime echo — skip
            return;
          }
          next = [...existing];
          next[idx] = comment;
          // Re-sort after update (created_at won't change, but be safe)
          next.sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
              a.id.localeCompare(b.id),
          );
        }

        const nextMap = new Map(commentsByTask);
        nextMap.set(comment.task_id, next);
        set({ commentsByTask: nextMap });
      },

      // ------------------------------------------------------------------
      // applyCommentUpsertReplaceTemp — swaps the optimistic comment that
      // was inserted with a temp id for the real server-confirmed row.
      // Preserves position in the task's comment list.
      // ------------------------------------------------------------------
      applyCommentUpsertReplaceTemp(tempId, real) {
        const { commentsByTask } = get();
        // We need to find which task's list contains the temp entry
        for (const [taskId, comments] of commentsByTask) {
          const idx = comments.findIndex((c) => c.id === tempId);
          if (idx !== -1) {
            const next = [...comments];
            next[idx] = real;
            // Re-sort to guarantee order after the swap
            next.sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
                a.id.localeCompare(b.id),
            );
            const nextMap = new Map(commentsByTask);
            nextMap.set(taskId, next);
            set({ commentsByTask: nextMap });
            return;
          }
        }
        // Temp not found — treat as a regular upsert
        get().applyCommentUpsert(real);
      },

      // ------------------------------------------------------------------
      // applyCommentDelete — hard delete (Q2): removes the comment from
      // its task's list. Also clears any reactions for this comment.
      // ------------------------------------------------------------------
      applyCommentDelete(commentId) {
        const { commentsByTask, reactionsByComment } = get();

        const nextComments = new Map(commentsByTask);
        for (const [taskId, comments] of nextComments) {
          const filtered = comments.filter((c) => c.id !== commentId);
          if (filtered.length !== comments.length) {
            nextComments.set(taskId, filtered);
            break; // comment ids are unique across tasks
          }
        }

        // Clean up reactions for the deleted comment
        const nextReactions = new Map(reactionsByComment);
        nextReactions.delete(commentId);

        set({ commentsByTask: nextComments, reactionsByComment: nextReactions });
      },

      // ------------------------------------------------------------------
      // hydrateCommentsForTask — replaces the entire comment list for a
      // given task. Used when loading the task drawer for the first time.
      // ------------------------------------------------------------------
      hydrateCommentsForTask(taskId, comments) {
        const { commentsByTask } = get();
        const sorted = [...comments].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
            a.id.localeCompare(b.id),
        );
        const nextMap = new Map(commentsByTask);
        nextMap.set(taskId, sorted);
        set({ commentsByTask: nextMap });
      },

      // ------------------------------------------------------------------
      // applyReactionInsert — idempotent on PK tuple (comment_id, user_id, emoji).
      // Reactions have no updated_at; same PK = no-op.
      // ------------------------------------------------------------------
      applyReactionInsert(reaction) {
        const { reactionsByComment } = get();
        const existing = reactionsByComment.get(reaction.comment_id) ?? [];

        // Idempotency check: same PK tuple already present → no-op
        const alreadyExists = existing.some(
          (r) =>
            r.comment_id === reaction.comment_id &&
            r.user_id === reaction.user_id &&
            r.emoji === reaction.emoji,
        );
        if (alreadyExists) return;

        const nextMap = new Map(reactionsByComment);
        nextMap.set(reaction.comment_id, [...existing, reaction]);
        set({ reactionsByComment: nextMap });
      },

      // ------------------------------------------------------------------
      // applyReactionDelete — removes the reaction matching the PK tuple
      // (comment_id, user_id, emoji). No-op if not found.
      // ------------------------------------------------------------------
      applyReactionDelete(commentId, userId, emoji) {
        const { reactionsByComment } = get();
        const existing = reactionsByComment.get(commentId);
        if (!existing) return;

        const filtered = existing.filter((r) => !(r.user_id === userId && r.emoji === emoji));
        if (filtered.length === existing.length) return; // nothing removed — no-op

        const nextMap = new Map(reactionsByComment);
        nextMap.set(commentId, filtered);
        set({ reactionsByComment: nextMap });
      },

      // ------------------------------------------------------------------
      // hydrateReactionsForComments — bulk-populates reactions for a set
      // of comments. Groups by comment_id; replaces any existing entries.
      // ------------------------------------------------------------------
      hydrateReactionsForComments(reactions) {
        const { reactionsByComment } = get();
        const nextMap = new Map(reactionsByComment);

        // Group by comment_id
        const grouped = new Map<string, CommentReactionRow[]>();
        for (const reaction of reactions) {
          const list = grouped.get(reaction.comment_id) ?? [];
          list.push(reaction);
          grouped.set(reaction.comment_id, list);
        }

        // Merge: replace each comment's reactions with the fresh set
        for (const [commentId, list] of grouped) {
          nextMap.set(commentId, list);
        }

        set({ reactionsByComment: nextMap });
      },

      // ------------------------------------------------------------------
      // applyActivityInsert — idempotent on id. Activity is append-only.
      // Keeps each task's list sorted newest-first (by created_at desc).
      // ------------------------------------------------------------------
      applyActivityInsert(activity) {
        const { activityByTask } = get();
        const taskId = activity.task_id;
        if (!taskId) {
          // Board-level activity with no task_id — store under a sentinel key
          const key = `board:${activity.board_id}`;
          const existing = activityByTask.get(key) ?? [];
          if (existing.some((a) => a.id === activity.id)) return; // idempotent
          const next = [activity, ...existing].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
          const nextMap = new Map(activityByTask);
          nextMap.set(key, next);
          set({ activityByTask: nextMap });
          return;
        }

        const existing = activityByTask.get(taskId) ?? [];
        if (existing.some((a) => a.id === activity.id)) return; // idempotent

        // Prepend and sort newest-first
        const next = [activity, ...existing].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const nextMap = new Map(activityByTask);
        nextMap.set(taskId, next);
        set({ activityByTask: nextMap });
      },

      // ------------------------------------------------------------------
      // hydrateActivityForTask — replaces the entire activity list for a
      // given task. Used when loading the Activity tab in the task drawer.
      // ------------------------------------------------------------------
      hydrateActivityForTask(taskId, events) {
        const { activityByTask } = get();
        const sorted = [...events].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const nextMap = new Map(activityByTask);
        nextMap.set(taskId, sorted);
        set({ activityByTask: nextMap });
      },

      // ================================================================
      // Epic 10 — Attachments state
      // ================================================================

      // ------------------------------------------------------------------
      // hydrateAttachmentsForBoard — bulk-populates attachmentsByTask for
      // all tasks on the board. Replaces existing entries. Only keeps rows
      // where is_uploaded=true (callers should pre-filter, but we guard
      // here too for safety). Sorted oldest-first within each task.
      // ------------------------------------------------------------------
      hydrateAttachmentsForBoard(rows) {
        const { attachmentsByTask } = get();
        const nextMap = new Map(attachmentsByTask);

        // Group by task_id
        const grouped = new Map<string, AttachmentRow[]>();
        for (const row of rows) {
          if (!row.is_uploaded) continue; // guard: skip non-uploaded
          const list = grouped.get(row.task_id) ?? [];
          list.push(row);
          grouped.set(row.task_id, list);
        }

        // Sort each group oldest-first and set in the map
        for (const [taskId, list] of grouped) {
          list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          nextMap.set(taskId, list);
        }

        set({ attachmentsByTask: nextMap });
      },

      // ------------------------------------------------------------------
      // applyAttachmentUpsert — idempotent on id.
      // Skips rows where is_uploaded=false (catches the two-stage upload
      // window where the row exists but the file isn't committed yet).
      // On UPDATE that flips is_uploaded true → the insert path handles it.
      // Produces a new outer Map + new inner array per touched task so that
      // Zustand change detection (reference equality) fires correctly.
      // ------------------------------------------------------------------
      applyAttachmentUpsert(row) {
        if (!row.is_uploaded) return; // skip non-uploaded rows

        const { attachmentsByTask } = get();
        const existing = attachmentsByTask.get(row.task_id) ?? [];
        const idx = existing.findIndex((a) => a.id === row.id);

        let next: AttachmentRow[];
        if (idx === -1) {
          // New attachment — append and sort oldest-first
          next = [...existing, row].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
        } else {
          const existingRow = existing[idx];
          // Idempotent: same id + same created_at → no-op
          if (existingRow && existingRow.created_at === row.created_at) {
            return;
          }
          next = [...existing];
          next[idx] = row;
          // Re-sort after update
          next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }

        const nextMap = new Map(attachmentsByTask);
        nextMap.set(row.task_id, next);
        set({ attachmentsByTask: nextMap });
      },

      // ------------------------------------------------------------------
      // applyAttachmentDelete — removes an attachment by id.
      // No-op if the id is not found in any task's list.
      // Produces a new outer Map + new inner array per touched task.
      // ------------------------------------------------------------------
      applyAttachmentDelete(attachmentId) {
        const { attachmentsByTask } = get();
        const nextMap = new Map(attachmentsByTask);

        for (const [taskId, attachments] of nextMap) {
          const filtered = attachments.filter((a) => a.id !== attachmentId);
          if (filtered.length !== attachments.length) {
            nextMap.set(taskId, filtered);
            break; // attachment ids are unique across tasks
          }
        }

        set({ attachmentsByTask: nextMap });
      },
    }),
    {
      name: "donezo:board-collapsed:v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : localStorage,
      ),
      // Persisted slices: collapsedByBoard, columnPrefsByBoard, outbox.
      // Storage key name is historical (was collapse-only); not renamed to preserve
      // existing entries. outbox added in Epic 08 — older entries hydrate with outbox: [].
      partialize: (state) => ({
        collapsedByBoard: state.collapsedByBoard,
        columnPrefsByBoard: state.columnPrefsByBoard,
        outbox: state.outbox,
      }),
      // On rehydration, re-derive collapsedGroupIds for the active board (if any).
      // columnPrefsByBoard is consumed lazily — no re-derivation needed.
      // outbox defaults to [] if missing (older clients that pre-date Epic 08).
      onRehydrateStorage: () => (state) => {
        if (state && !Array.isArray(state.outbox)) {
          state.outbox = [];
        }
        if (!state?.boardId) return;
        const ids = state.collapsedByBoard[state.boardId] ?? [];
        state.collapsedGroupIds = new Set(ids);
      },
    },
  ),
);

// ============================================================================
// Selector helpers (Epic 08 — Realtime)
// ============================================================================

/** Returns the deduped list of user_ids currently present (one entry per user, regardless of tab count). */
export function selectPresentUserIds(state: BoardState): string[] {
  return Object.keys(state.presence).filter((uid) => (state.presence[uid] ?? []).length > 0);
}

/** Returns deduped user_ids currently viewing a specific task (any tab). */
export function selectUsersViewingTask(state: BoardState, taskId: string): string[] {
  const out: string[] = [];
  for (const [uid, entries] of Object.entries(state.presence)) {
    if (entries.some((e) => e.viewing.type === "task" && e.viewing.task_id === taskId)) {
      out.push(uid);
    }
  }
  return out;
}

// ============================================================================
// Selectors — Epic 09: Comments + reactions + activity
// ============================================================================

/** All comments for a task, oldest-first. (Flat — no threading per Q1.) */
export function selectCommentsForTask(state: BoardState, taskId: string): CommentRow[] {
  return state.commentsByTask.get(taskId) ?? [];
}

/** Grouped reactions for a comment with counts + selfReacted flag. */
export function selectGroupedReactions(
  state: BoardState,
  commentId: string,
  currentUserId: string,
): Array<{ emoji: string; count: number; selfReacted: boolean }> {
  const reactions = state.reactionsByComment.get(commentId) ?? [];

  // Group by emoji
  const grouped = new Map<string, { count: number; selfReacted: boolean }>();
  for (const reaction of reactions) {
    const entry = grouped.get(reaction.emoji) ?? { count: 0, selfReacted: false };
    entry.count += 1;
    if (reaction.user_id === currentUserId) {
      entry.selfReacted = true;
    }
    grouped.set(reaction.emoji, entry);
  }

  return Array.from(grouped.entries()).map(([emoji, { count, selfReacted }]) => ({
    emoji,
    count,
    selfReacted,
  }));
}

/** Activity events for a task, newest-first. */
export function selectTaskActivity(state: BoardState, taskId: string): ActivityRow[] {
  return state.activityByTask.get(taskId) ?? [];
}

// ============================================================================
// Selectors — Epic 10: Attachments
// ============================================================================

/**
 * Stable empty array returned when a task has no attachments.
 *
 * STABILITY CONTRACT: callers must NOT wrap this selector in useShallow — the
 * stable EMPTY_ARRAY reference is the mechanism that prevents infinite render
 * loops when the task has no attachments. Map.get() returns undefined for
 * missing tasks, and we return the same EMPTY_ARRAY reference every time,
 * so React bailout (Object.is equality) fires correctly.
 *
 * When attachments exist for the task, the inner array reference changes only
 * when the slice's action (applyAttachmentUpsert / applyAttachmentDelete /
 * hydrateAttachmentsForBoard) produces a new array — all three do so
 * unconditionally, satisfying Zustand v5 change detection.
 */
const EMPTY_ATTACHMENTS: AttachmentRow[] = [];

/** All attachments for a task, sorted oldest-first. Stable empty-array reference when none. */
export function selectAttachmentsForTask(state: BoardState, taskId: string): AttachmentRow[] {
  return state.attachmentsByTask.get(taskId) ?? EMPTY_ATTACHMENTS;
}
