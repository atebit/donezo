# Epic 08 — Realtime & Presence

## Goal

Make the board live: when one user edits a cell, reorders a group, or types a comment, every other user viewing the same board sees it within a second. Layer on Presence (who's viewing now) and Broadcast (cursors, typing). Establish the concurrency model so we don't trade live updates for lost data.

## Why this is its own epic

Realtime correctness is subtle: subscription lifecycle, optimistic-update reconciliation, presence cleanup, late-joiner snapshots, and the "should I apply my own echo" question all need consistent answers. Doing it once, well, beats half-fixing it inside [06](06-groups-tasks-table.md).

## In scope

- Supabase Realtime subscription per board: Postgres Changes on `task`, `cell`, `group`, `column`, `comment`.
- Presence channel per board: who's connected, last-seen, current-viewing-task.
- Broadcast channel per board: cursor positions (table view), typing indicators (comment threads).
- Subscription lifecycle: connect on board mount, disconnect on unmount, resubscribe on reconnect.
- Reconciliation: apply server changes idempotently into the Zustand store from [06](06-groups-tasks-table.md).
- Self-echo handling: ignore changes the current client just made (mostly — see below).
- Late-joiner sync: a user connecting mid-session gets the current state.
- Connectivity status indicator (online / reconnecting / offline).
- Per-cell concurrency model and conflict resolution.

## Out of scope

- Notifications ([13](13-notifications.md)).
- Comment realtime is here; comment writes themselves are [09](09-comments-activity.md).
- CRDT-based concurrent editing of the same long-text cell. Long-text cells are last-write-wins per save; Tiptap collaborative editing is a future concern.

## Dependencies

[02](02-supabase-schema.md) (publication setup), [06](06-groups-tasks-table.md) (the store the realtime payloads feed), [07](07-column-system.md) (cell value codec).

## Architecture & design choices

### Three Realtime channels per board

Supabase Realtime supports three patterns on one or many channels:

1. **Postgres Changes** — server pushes INSERT/UPDATE/DELETE notifications based on the publication. Used for canonical data: tasks, cells, groups, columns, comments.
2. **Presence** — clients announce themselves; everyone in the channel sees the membership list. Used for "who's viewing this board."
3. **Broadcast** — clients send arbitrary messages to other clients; not persisted. Used for cursors and typing.

We multiplex onto **one channel per board** (`board:<boardId>`) to keep connection count low. The channel handles all three patterns.

### Why one channel per board, not per table

Supabase Realtime quotas count concurrent channels per project. One channel per board × N viewers per board × M boards open across users → still well within a Pro tier's 500 concurrent channels for an internal tool. If usage scales, we can split per table later.

### Subscription wiring

```ts
// hooks/use-board-realtime.ts
"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

export function useBoardRealtime(boardId: string, store: BoardStore, userId: string) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`board:${boardId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: userId },
      },
    });

    // 1) Postgres changes
    const subscribeToTable = (table: string, handler: (e: any) => void) =>
      channel.on("postgres_changes",
        { event: "*", schema: "public", table, filter: `board_id=eq.${boardId}` },
        handler);

    subscribeToTable("task", (e) => store.applyTaskChange(e));
    subscribeToTable("group", (e) => store.applyGroupChange(e));
    subscribeToTable("column", (e) => store.applyColumnChange(e));
    subscribeToTable("comment", (e) => store.applyCommentChange(e));

    // cell rows have task_id, not board_id; subscribe broadly + filter client-side
    channel.on("postgres_changes",
      { event: "*", schema: "public", table: "cell" },
      (e) => {
        const cellRow = e.new ?? e.old;
        if (store.knowsTask(cellRow.task_id)) store.applyCellChange(e);
      });

    // 2) Presence
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      store.setPresence(state);
    });

    // 3) Broadcast (cursors, typing)
    channel.on("broadcast", { event: "cursor" }, ({ payload }) => store.setCursor(payload));
    channel.on("broadcast", { event: "typing" }, ({ payload }) => store.setTyping(payload));

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: userId, online_at: Date.now() });
        store.setConnectionStatus("connected");
      }
      if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
        store.setConnectionStatus("reconnecting");
      }
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [boardId, userId]);
}
```

### Cell-row filter limitation

Postgres Changes filters are limited (`eq`, `neq`, etc., on a single column). `cell` rows don't have `board_id` directly. Two options:

- **Denormalize `board_id` onto `cell`.** Simple; one extra column. Cell rows are 99% writes-from-app; an extra column is cheap.
- **Subscribe to the entire `cell` publication and filter client-side.** Wasteful at scale.

**Choice: denormalize.** Add `board_id uuid not null references board(id)` to `cell` in a migration as part of this epic. Backfill via the FK from `task`. Update the cell upsert to set it.

Same applies to `comment` — already has `task_id`; we add `board_id` denormalization here for the same reason.

```sql
-- supabase/migrations/00000000000004_realtime_denormalization.sql
alter table public.cell add column board_id uuid not null references public.board(id) on delete cascade;
alter table public.comment add column board_id uuid not null references public.board(id) on delete cascade;
update public.cell set board_id = (select board_id from public.task where id = cell.task_id);
update public.comment set board_id = (select board_id from public.task where id = comment.task_id);
create index cell_board_idx on public.cell(board_id);
create index comment_board_idx on public.comment(board_id);
```

### Idempotent apply functions

The Zustand store ([06](06-groups-tasks-table.md)) exposes `applyTaskUpdate(task)`, `applyTaskDelete(taskId)`, `applyCellUpsert(cell)`, etc. Each is idempotent: apply the same row twice → same state. This means we can:

- Apply optimistic updates immediately.
- Apply server-action results when they return.
- Apply Realtime echoes when they arrive.

Order doesn't matter as long as we use *the freshest row*. The freshness check is on `updated_at`: if the incoming row's `updated_at` is older than the stored one, ignore.

```ts
applyTaskUpdate(task: Task) {
  const existing = this.tasks.get(task.id);
  if (existing && existing.updated_at >= task.updated_at) return;
  this.tasks.set(task.id, task);
}
```

This solves "I send change A; my echo arrives; I send change B (newer); echo of A arrives last" — the older echo is ignored.

### Self-echo policy

Supabase Realtime delivers a client's own changes back to it (Postgres Changes is a database-level subscription; it doesn't know which client wrote). Two policies:

1. **Apply self-echo unconditionally.** Simple. Idempotency makes it safe.
2. **Tag and skip self-echo.** Add `meta.actor_id` and ignore your own.

We use **Policy 1** for cells/tasks/groups — idempotency is robust, and applying your own echo brings you to the canonical server state (cleansing optimistic-only side effects).

For Broadcast, we set `broadcast: { self: false }` — there's no canonical state to reconcile; we don't want to see our own cursor.

### Optimistic-update reconciliation

The flow for a cell edit:

1. User changes cell.
2. `store.applyCellUpsert(optimisticCell)` — UI updates immediately.
3. Server action runs.
4. Server returns `{ ok: true, data: serverCell }`.
5. `store.applyCellUpsert(serverCell)` — overwrites optimistic with server-truth (same id; idempotent).
6. ~50ms later, Realtime echo arrives.
7. `store.applyCellUpsert(echoCell)` — same row; no-op due to `updated_at` freshness check.

If step 4 fails:

5'. Server returns `{ ok: false, error }`.
6'. `store.applyCellUpsert(prevServerCell)` — explicit rollback. We snapshotted `prevServerCell` before step 2.
7'. Toast.

### Presence model

Each user, on join, calls `channel.track({ user_id, online_at, viewing: { type: 'board' } })`. When they open a task drawer, `track({ ..., viewing: { type: 'task', task_id } })`.

The presence state is a `Record<userId, Array<{ user_id, online_at, viewing }>>` (multiple connections per user possible — multiple tabs).

Display:

- Top-of-board: avatar pile of users currently on the board (deduped by user). Small green dot.
- Task row: small dot if any user is currently `viewing.task_id === thisTaskId`.
- On hover: list of names.

### Broadcast: cursors

In the table view, broadcast the user's hovered or focused cell as `{ taskId, columnId }` every ~100ms (throttled). Other clients render a small colored dot in that cell. Color derived from user-id hash.

This is delightful but optional for v1. If shipping creates performance noise, gate behind a setting.

### Broadcast: typing indicators

In comment threads, when a user is typing, broadcast `{ taskId, userId }` every 2s. Other clients show "X is typing..." beneath the comment input. Stops when 5s elapse with no broadcast.

### Connection status

The store tracks `connection: 'connected' | 'reconnecting' | 'offline'`. The topbar shows a small indicator only when not `connected`:

- Reconnecting: yellow pulsing dot, "Reconnecting…"
- Offline: red dot, "You're offline. Changes will sync when you reconnect."

While offline, mutations are still queued via the Zustand store. On reconnect, the queue replays. (For v1, we **don't** queue offline writes — see open questions. Connection-loss UX shows the indicator only.)

### Late joiner / reconnect

When a client reconnects, it has potentially-stale state. Two approaches:

1. **Refetch the board on reconnect.** Simple, slightly heavier. RSC is already fast; refetching takes <500ms.
2. **Fetch only changes since last `updated_at`.** More efficient, more code.

We use **Approach 1** for v1. Reconnect → call `revalidateTag('board:<id>')` → RSC refetches → store hydrates with fresh data. Realtime resubscribes.

### Performance

- One channel per open board. Closing a board tab tears down the subscription.
- Cell-change events at scale (5000 tasks × 8 columns = 40,000 cells, all subscribed) — Postgres Changes handles this; the load is on the client to dispatch into the store. The store's `Map<string, Cell>` keyed by `${task_id}:${column_id}` is O(1).
- Throttle broadcast events to avoid 100/s message storms.
- Don't re-render the whole table on every cell update; the cell component is memoized on its own value (already from [07](07-column-system.md)).

### Security

Realtime authentication: clients pass their JWT to Supabase Realtime. Postgres Changes are filtered by RLS — clients only receive rows their session can SELECT. So a user not on a board's `board_member` (or workspace_member, depending on `is_private`) gets nothing.

Broadcast and Presence don't go through RLS — they're channel-scoped. Mitigations:
- Channel names include the board id (`board:<uuid>`). Knowing the id requires being in the workspace.
- Server-side, we don't trust broadcast payloads for state — they're advisory (cursors, typing).
- A board id is non-secret but unguessable; combined with the user needing a session that's a workspace member, this is acceptable.

For high-sensitivity boards in the future, we'd add a server-issued channel token (Edge Function check). Out of scope for v1.

### Server actions vs Realtime: who writes what

The flow is one-way: **server actions write; Realtime broadcasts**. We never write directly from the client to Supabase Realtime; we never write to the database from the client (RLS would technically allow it in places, but the architecture is "server actions only"). This keeps validation, activity logging, and authorization in one place.

Exception: presence and broadcast, which are non-persistent and per-tab UI state.

## Tasks

1. **Migration**: add `board_id` denormalization to `cell` and `comment`. Backfill. Add indexes.
2. **Update `setCellValue` server action** to populate `board_id`. Same for comment writes.
3. **Update `cell` and `comment` RLS** if they referenced board_id implicitly (no change needed, but verify). Confirm policies still work after denormalization.
4. **`useBoardRealtime` hook** in `hooks/use-board-realtime.ts` per spec.
5. **Extend Zustand store** with `applyTaskChange`, `applyGroupChange`, `applyColumnChange`, `applyCellChange`, `applyCommentChange`, all idempotent and `updated_at`-aware.
6. **Presence**: `setPresence`, `getPresence`. UI: avatar pile in board topbar; task-row dot.
7. **Broadcast**: cursor + typing. Throttled emitters. Renderers.
8. **Connection status indicator** in topbar.
9. **Reconnect-refetch** flow: on `SUBSCRIBED` after a `TIMED_OUT`, call `revalidateTag` on the board.
10. **Tests**:
    - Unit: idempotent apply (apply same row twice → state unchanged; apply older row → ignored).
    - Integration: spin up two clients via Playwright; client A edits a cell; client B sees it within 1s.
    - Integration: client A types in comment; client B sees typing indicator.
    - Integration: client A's tab loses connection (Playwright route abort); reconnects; state matches.
11. **Performance**: render 5000 tasks; emit 100 cell updates/s for 10s; FPS stays above 50.
12. **Document the "writes go through server actions; Realtime is read-only on the client" rule** in `CONTRIBUTING.md`.

## Definition of done

- Two browsers on the same board see each other's cell edits, task adds, group reorders, comment posts within ~1s.
- Avatar pile shows everyone currently viewing the board.
- Task rows show a dot when another user has the task drawer open.
- Cursor dots and typing indicators work in the table and comment threads respectively.
- Disconnecting wifi shows the offline banner; reconnecting clears it and the board state matches the server.
- A user with no access to a board does not receive realtime events for it (verified by RLS test in [04](04-authorization-rls.md) extended).
- The `applyXxxChange` family is idempotent under any apply order (proven by tests).

## Open questions

- **Offline write queue.** Worth doing? Without it, a flaky connection means lost edits. For an internal tool, the connection is usually fine; defer.
- **Mobile data usage.** Realtime over a slow connection is fine in volume but the cursor broadcast can chatter. Disable cursor broadcast on small viewports; keep presence + Postgres Changes always on.
- **Tab visibility.** Should we unsubscribe when the tab is hidden? Saves bandwidth but causes a "wake-up reload" when refocused. Recommend: keep subscription, but pause broadcast emit when hidden.
- **Concurrent long-text editing.** Two users typing in the same long-text cell will overwrite each other on save. Tiptap collaborative is large; defer until users complain. Document the limitation.
- **Realtime filter expression cap.** Supabase has a per-channel filter; we're using `board_id=eq.<id>` per table. If we wanted "subscribe to N specific tasks," we'd hit the cap. Not a concern at v1's scale.
- **Self-echo policy revisit.** If we observe redundant work, switch to tagging actor_id and skipping echoes. Idempotency means we can defer the optimization.
