# Epic 08 Dispatch — Realtime & Presence

## Preconditions

- Branched from `main` at commit `6112e2d` (Epic 07 merged). Epic branch: `epic/08-realtime-presence`.
- Depends on (all merged): Epic 02 (schema + Realtime publication), Epic 04 (RLS), Epic 05 (workspaces/boards + board header), Epic 06 (groups/tasks/table + Zustand board store), Epic 07 (column system + cell registry).
- Env: existing `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are sufficient. No new env vars in this epic.
- Verified present (read by orchestrator before plan freeze):
  - `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts` — Zustand store with `persist` middleware, `partialize` for `collapsedByBoard` + `columnPrefsByBoard`, and idempotent `applyXxxUpsert/Delete` methods all keyed on `updated_at`. This is the extension point for S1.
  - `/Volumes/SSD1T/DEV WORK/donezo/components/board/BoardHeaderClient.tsx` — single edit site for the topbar (S3+S4).
  - `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx` (mount/hydrate logic around line 242–266) — single mount site for the realtime hook + outbox flush (S5).
  - `/Volumes/SSD1T/DEV WORK/donezo/components/cells/TableCell.tsx` — integration point for cursor hover/focus emit (S6).
  - `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506224930_initial_schema.sql` — defines `public.cell` (lines 204–235), `public.comment` (lines 243–258), and the reference trigger pattern `task_board_id_consistency` (lines 398–408). S0 mirrors that pattern.
  - `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts` — `setCellValue` and `bulkSetCellValue`; S0 updates these to write `board_id`.
  - `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/` — directory exists, empty. S2 owns it.
  - `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/client.ts` — exports `createClient()` (browser).
  - Realtime publication is already set up at the end of the initial schema migration (lines 450–455) — `task`, `cell`, `group`, `column`, `comment`, `notification` are already members of `supabase_realtime`. S0 does not re-add.

## Stage 1 — Parallel slices

---

### Slice S0: Realtime denormalization migration + cell/comment `board_id`

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/s0-realtime-denorm`
**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/<NEW_TIMESTAMP>_realtime_denormalization.sql` (new file; pick a timestamp later than `20260511075330`)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts` (update `setCellValue` + `bulkSetCellValue` upsert payloads to include `board_id`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/types.ts` (regenerated)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/cell-actions.test.ts` (extend existing tests to assert `board_id` is set on upsert)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/board_id_consistency.spec.sql` (new pgTAP test for the new triggers)

**Reads (no write):**
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506224930_initial_schema.sql` — pattern reference at lines 398–408 (`task_board_id_consistency`).
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts` — to add `board_id: col.board_id` to upsert payloads.

**Forbidden:** Any file outside the list above. No changes to RLS policy files (existing policies remain valid since they reason via `task → group → board`; the new `board_id` is defense-in-depth only). Do not touch the `comment` server actions — Epic 09 owns writes; this slice just adds the column so 09 has it ready.

**Depends on:** none (Stage 1 starts here).

**Spec (self-contained — executor will not see this conversation):**

1. **Migration SQL.** Create `supabase/migrations/<TIMESTAMP>_realtime_denormalization.sql`. Use a timestamp greater than `20260511075330` (e.g. `20260512000000`). Contents, in this order:
   ```sql
   -- Epic 08 — denormalize board_id onto cell + comment so Realtime postgres_changes
   -- can filter board_id=eq.<id>. Defense-in-depth consistency triggers mirror the
   -- existing task_board_id_consistency pattern.

   -- 1. Add columns (nullable initially so backfill can run before NOT NULL is enforced).
   alter table public.cell    add column board_id uuid references public.board(id) on delete cascade;
   alter table public.comment add column board_id uuid references public.board(id) on delete cascade;

   -- 2. Backfill from task.board_id (task already carries it, kept in sync by task_board_id_consistency).
   update public.cell    set board_id = (select board_id from public.task where id = cell.task_id);
   update public.comment set board_id = (select board_id from public.task where id = comment.task_id);

   -- 3. Enforce NOT NULL post-backfill.
   alter table public.cell    alter column board_id set not null;
   alter table public.comment alter column board_id set not null;

   -- 4. Indexes for the filter and for FK joins.
   create index cell_board_idx    on public.cell(board_id);
   create index comment_board_idx on public.comment(board_id);

   -- 5. Defense-in-depth consistency triggers — mirror task_board_id_consistency
   --    pattern from the initial schema migration (lines 398–408). These derive
   --    board_id from the parent task on insert/update, so even a buggy server
   --    action that forgets to set board_id cannot break the invariant.
   create or replace function public.cell_board_id_consistency()
   returns trigger language plpgsql as $$
   begin
     new.board_id = (select board_id from public.task where id = new.task_id);
     return new;
   end $$;

   create trigger cell_board_id_consistency
     before insert or update of task_id on public.cell
     for each row execute function public.cell_board_id_consistency();

   create or replace function public.comment_board_id_consistency()
   returns trigger language plpgsql as $$
   begin
     new.board_id = (select board_id from public.task where id = new.task_id);
     return new;
   end $$;

   create trigger comment_board_id_consistency
     before insert or update of task_id on public.comment
     for each row execute function public.comment_board_id_consistency();
   ```
   Note that the publication entries for `cell` and `comment` are already in the initial migration (lines 451, 454) — do not re-add them.

2. **Update `setCellValue` and `bulkSetCellValue` in `cells/actions.ts`** to include `board_id: col.board_id` in the upsert payload. The trigger will overwrite it on the server, but writing it from the action is faster and self-documenting. Apply to both the single upsert path and the bulk payload mapping. Do not change any other behavior in the file. Keep the `@ts-expect-error` comments intact.

3. **Regenerate types** by running `pnpm supabase gen types typescript --local > lib/supabase/types.ts` (or the equivalent project script — check `/Volumes/SSD1T/DEV WORK/donezo/package.json` for the canonical name; typically `pnpm db:types`). Commit the regenerated `types.ts`. `cell.board_id` and `comment.board_id` must appear as non-null in the generated `Row` types.

4. **Tests.**
   - Extend `tests/unit/cell-actions.test.ts`: assert that the upsert payload passed to `supabase.from('cell').upsert(...)` contains `board_id` matching the column's board, in both `setCellValue` and `bulkSetCellValue` mocked-supabase tests.
   - Create `tests/policies/board_id_consistency.spec.sql` (pgTAP). Two assertions: (a) inserting a `cell` with the wrong `board_id` results in the row landing with the task's `board_id` (trigger overwrites); (b) same for `comment`. Follow the style of existing pgTAP tests under `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/`.

**Tests:**
- `pnpm test -- cell-actions` passes with extended assertions.
- `supabase test db` (pgTAP runner used by the repo) passes the new consistency spec.
- `pnpm tsc --noEmit` is clean against the regenerated types.

**Definition of done:**
- Migration applies cleanly on a fresh DB and on an existing DB with data.
- `cell.board_id` and `comment.board_id` are `not null` and indexed.
- Triggers overwrite incorrect `board_id` values on insert/update of `task_id`.
- `setCellValue` + `bulkSetCellValue` set `board_id` in the upsert payload.
- Generated types reflect the new columns; no other code in the repo fails typecheck against the regen.
- New pgTAP test passes locally.

**Escalation triggers:**
- If `pnpm tsc --noEmit` surfaces breakage in code outside this slice's file scope after type regen — stop, return a `needs-direction` report listing the failing files. Do not edit them.
- If existing RLS policies reference `cell` or `comment` in a way that the new `board_id` should be used (rather than the current `task → group → board` join), surface as a question.
- If the migration timestamp conflicts with another stage's migration, surface as a coordination issue.

---

### Slice S1: Board store — connection, presence, cursors, typing, outbox slices

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/s1-store-extensions`
**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts` (extend in place)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/board-store.test.ts` (extend with new state-shape tests; the existing file is yours to add to, not to overwrite)
- `/Volumes/SSD1T/DEV WORK/donezo/stores/types/realtime.ts` (new — type definitions for presence/cursor/typing/outbox payloads)

**Reads (no write):**
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/types.ts` — for `Database` row types.

**Forbidden:** Any other store file (`sidebar-store.ts`), any component, any hook. Do not import from `@/lib/realtime` — that's S2's territory and the import would create a dependency cycle at module load.

**Depends on:** none (parallel-safe — only edits store and store-local types).

**Spec:**

You are extending the existing Zustand `useBoardStore` to hold the additional client state Realtime needs: connection status, presence membership, cursor positions, typing-indicator state (keyed by context), and an offline outbox. All new state must be transient with the **exception of `outbox`**, which is the second persisted slice (in addition to the existing `collapsedByBoard` and `columnPrefsByBoard`).

1. **Create `stores/types/realtime.ts`** with these exact exported types:
   ```ts
   export type ConnectionStatus = "connected" | "reconnecting" | "offline";

   // viewing.type is "board" today; "task" is forward-compat for Epic 09 (task drawer).
   // task_id is only set when type === "task".
   export type PresenceViewing =
     | { type: "board" }
     | { type: "task"; task_id: string };

   export type PresenceEntry = {
     user_id: string;
     online_at: number; // epoch ms
     viewing: PresenceViewing;
   };

   // Supabase Realtime presence state: keyed by presence key (we use userId),
   // each value is an array of one entry per active tab/connection for that user.
   export type PresenceState = Record<string, PresenceEntry[]>;

   // Broadcast: cursor position in the table view.
   export type CursorPayload = {
     user_id: string;
     task_id: string;
     column_id: string;
     at: number; // epoch ms — used to expire stale cursors
   };

   // Broadcast: typing indicator. `context` is opaque (e.g. `comment:<task_id>`).
   export type TypingPayload = {
     user_id: string;
     context: string;
     at: number; // epoch ms — used to expire after 5s
   };

   // ----- Outbox -----
   // Queueable actions: upsert-style only. Inserts/deletes do NOT queue and must
   // error immediately when offline (handled by S8's wrapper, not by the store).
   export type OutboxActionId =
     | "setCellValue"
     | "bulkSetCellValue"
     | "renameGroup"
     | "renameTask"
     | "updateTaskFields"; // any future task-field upsert

   export type OutboxEntry = {
     id: string; // uuid v4 generated client-side ONLY for de-duplication of the outbox itself; NOT a DB id
     actionId: OutboxActionId;
     args: unknown[]; // serialized server-action args; server action validates via Zod on flush
     optimisticUpdatedAt: number; // epoch ms, used purely for ordering/visibility
     enqueuedAt: number; // epoch ms
   };
   ```

2. **Extend `BoardState`** in `stores/board-store.ts` with these new fields and actions. Place them in a logical group with a banner comment "// Epic 08 — Realtime + outbox state". Do NOT alter any existing field, action, or method.

   New transient fields (added to `transientInitial`):
   ```ts
   connection: "connected" as ConnectionStatus,
   presence: {} as PresenceState,
   cursors: new Map<string, CursorPayload>(), // key: user_id; one cursor per user
   typingByContext: new Map<string, TypingPayload[]>(), // key: context string
   ```

   New persisted field (NOT in `transientInitial`; alongside `collapsedByBoard`/`columnPrefsByBoard`):
   ```ts
   outbox: [] as OutboxEntry[],
   ```

   New actions on the state interface:
   ```ts
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
   ```

3. **Multi-tab dedupe for presence display.** `setPresence` stores the raw state as-given by Supabase. Add a derived selector helper to the same file (exported, not on the store interface):
   ```ts
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
   ```
   In Epic 08 we only use `selectPresentUserIds`. `selectUsersViewingTask` is exported but unused — Epic 09 will consume it. Add a `// epic 09 will consume` comment above it.

4. **Persistence extension.** The existing `persist` config uses `partialize` to persist `collapsedByBoard` and `columnPrefsByBoard`. Extend `partialize` to also persist `outbox`. Bump nothing — the storage key stays `donezo:board-collapsed:v1` (preserve existing localStorage entries; new field is additive). Document this in a comment above `partialize`:
   ```ts
   // Persisted slices: collapsedByBoard, columnPrefsByBoard, outbox.
   // Storage key name is historical (was collapse-only); not renamed to preserve
   // existing entries. outbox added in Epic 08 — older entries hydrate with outbox: [].
   ```
   In `onRehydrateStorage`, if `state` is missing `outbox` (older clients), default it to `[]`:
   ```ts
   if (state && !Array.isArray(state.outbox)) {
     state.outbox = [];
   }
   ```

5. **Outbox size cap.** localStorage has a ~5MB browser quota shared across this key. In `enqueueOutbox`, before pushing, check if the serialized JSON length of `outbox` would exceed ~4MB (4 * 1024 * 1024 chars; conservative). If so, **do not enqueue**; instead set a one-time flag `outboxOverflow: true` on the store and toast via the action wrapper (S8 owns the toast; this slice just sets the flag). Add `outboxOverflow: boolean` to transient state.

6. **Reset behavior.** Extend `reset()` to preserve `outbox` in addition to the existing persisted slices. (Navigating boards must not drop a queued offline mutation.)

7. **Idempotency.** None of the new actions need `updated_at`-style idempotency — they're all UI/transport state. `setPresence` overwrites wholesale (Supabase already gives the canonical state). `setCursor` overwrites per user_id. `setTyping` appends to the per-context list and de-dupes by user_id (one typing entry per user per context — newer `at` overwrites older).

**Tests:**
Extend `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/board-store.test.ts`. Add a new `describe('Epic 08 — realtime state', ...)` block:
- `setConnectionStatus` transitions.
- `setPresence` overwrites; `selectPresentUserIds` returns deduped keys.
- `setCursor` upserts per user_id; `pruneExpiredCursors` removes old ones.
- `setTyping` de-dupes per (context, user_id); `pruneExpiredTyping` clears stale.
- `enqueueOutbox` generates `id` + `enqueuedAt`; `dequeueOutbox` removes by id; `clearOutbox` empties.
- `enqueueOutbox` refuses to push when serialized outbox > 4MB; sets `outboxOverflow: true`. (Construct a giant args payload to exercise this.)
- `reset()` preserves `outbox`.
- Rehydration with no `outbox` field defaults to `[]` (mock localStorage via the existing harness in the test file).

**Definition of done:**
- All new fields and actions present and typed.
- `partialize` includes `outbox` alongside the existing two slices.
- `selectPresentUserIds` exported.
- `outboxOverflow` flag set on cap breach.
- `pnpm test -- board-store` passes; `pnpm tsc --noEmit` clean.

**Escalation triggers:**
- If the existing `persist` config's storage key is renamed by a parallel slice or a recent commit, stop and report.
- If `selectUsersViewingTask` requires a different shape because Epic 09's drawer routing has already been spec'd to use room IDs etc. — surface as a question.

---

### Slice S2: `useBoardRealtime` hook + channel helpers + throttle util + reconnect refresh

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/s2-realtime-hook`
**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-realtime.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/channel.ts` (new — channel name helper + subscribe helper)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/throttle.ts` (new — small leading+trailing throttle util)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/types.ts` (new — re-export of payload types from `stores/types/realtime.ts` for hook consumers)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/use-board-realtime.test.ts` (new — mocked Supabase client)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/realtime-throttle.test.ts` (new)

**Reads (no write):**
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/client.ts` (uses `createClient`)
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts` (calls store actions only; do not modify)
- `/Volumes/SSD1T/DEV WORK/donezo/stores/types/realtime.ts` (created by S1; import types from here)

**Forbidden:** Any UI component, any route, the store file. Do not write tests that depend on a real Supabase connection.

**Depends on:** S1 (the hook reads/writes store fields S1 adds; the executor must wait for S1 to merge OR be unblocked by orchestrator with merge-base coordination). Mark as **sequenced after S1** if S1 hasn't landed by the time this slice starts.

> Orchestrator note: S2 reads S1's symbols. Run S2 after S1 lands on the epic branch, or instruct S2's executor to rebase onto the post-S1 epic-branch tip. Do not parallelize S2 and S1.

**Spec:**

The hook owns the entire board-scoped Realtime lifecycle: postgres_changes for `task`/`cell`/`group`/`column`, presence for membership, and broadcast for cursors/typing. It is consumed by `BoardTable.tsx` (S5).

1. **`lib/realtime/channel.ts`** — small helper module:
   ```ts
   export function boardChannelName(boardId: string): string {
     return `board:${boardId}`;
   }
   ```

2. **`lib/realtime/throttle.ts`** — leading+trailing throttle (no external deps):
   ```ts
   /**
    * throttle(fn, wait) — invokes fn at most once per `wait` ms.
    * Leading edge fires immediately; trailing edge fires the last call if any
    * occurred during the throttle window. Returns a function with a `.cancel()`
    * method to clear any pending trailing call.
    */
   export function throttle<TArgs extends unknown[]>(
     fn: (...args: TArgs) => void,
     wait: number,
   ): ((...args: TArgs) => void) & { cancel: () => void };
   ```
   Implement with `setTimeout` + a last-args ref. Tests exercise: leading call fires synchronously; trailing call fires after `wait`; rapid calls are coalesced; `cancel()` clears pending timer.

3. **`hooks/use-board-realtime.ts`** — signature:
   ```ts
   "use client";
   export function useBoardRealtime(boardId: string, userId: string): void;
   ```

   Behavior — implement inside a single `useEffect` keyed on `[boardId, userId]`:

   a. Create a Supabase browser client via `createClient()`.

   b. Open one channel named `boardChannelName(boardId)` with config:
   ```ts
   { broadcast: { self: false }, presence: { key: userId } }
   ```

   c. **Postgres changes subscriptions** — one `channel.on('postgres_changes', ...)` per table, all using `filter: 'board_id=eq.<boardId>'`:
      - `task` → on `*` event, dispatch to store: INSERT/UPDATE → `applyTaskUpsert(e.new)`, DELETE → `applyTaskDelete(e.old.id)`.
      - `group` → INSERT/UPDATE → `applyGroupUpsert(e.new)`, DELETE → `applyGroupDelete(e.old.id)`.
      - `column` → INSERT/UPDATE → `applyColumnUpsert(e.new)`, DELETE → `applyColumnDelete(e.old.id)`.
      - `cell` → with `filter: 'board_id=eq.<boardId>'` (now possible after S0). INSERT/UPDATE → `applyCellUpsert(e.new)`. DELETE: no store method exists for cells; skip (cells are upserts in our model; deletion happens via column or task delete cascades, which the parent table's DELETE event covers via store cascade in `applyColumnDelete`/`applyTaskDelete`). Log a `console.warn` in dev mode if a `cell` DELETE event is received.
      - **DO NOT subscribe to `comment` in Epic 08.** That is explicitly deferred to Epic 09. Add a comment in the hook: `// comment postgres_changes deferred to epic 09`.

   d. **Presence** — `channel.on('presence', { event: 'sync' }, () => { store.setPresence(channel.presenceState() as PresenceState); })`. Also listen for `join` and `leave` events but the handler is a no-op; the `sync` event always carries the canonical state and is what we render against.

   e. **Broadcast** — two subscriptions:
      - `channel.on('broadcast', { event: 'cursor' }, ({ payload }) => store.setCursor(payload as CursorPayload))`
      - `channel.on('broadcast', { event: 'typing' }, ({ payload }) => store.setTyping(payload as TypingPayload))`

   f. **Subscribe + lifecycle.** Call `channel.subscribe(async (status) => { ... })`. Status transitions:
      - `SUBSCRIBED`:
        - If `previousStatus === 'reconnecting'`, call `router.refresh()` (from `useRouter` of `next/navigation`) BEFORE marking connected. This re-runs the RSC tree on `BoardPage` and rehydrates the store via `BoardTable`'s mount-time `hydrate` call. **No `revalidateTag`, no server action, no cache layer.**
        - `store.setConnectionStatus('connected')`.
        - `await channel.track({ user_id: userId, online_at: Date.now(), viewing: { type: 'board' } })` — note `viewing` shape per Q3 (forward-compat for Epic 09 task drawer).
      - `TIMED_OUT` or `CHANNEL_ERROR`: `store.setConnectionStatus('reconnecting')`. Also `store.setPresence({})` so stale avatars clear.
      - `CLOSED`: only fires on intentional unsubscribe; no action.
   
   Track `previousStatus` in a `useRef` so the `SUBSCRIBED` handler can detect the reconnect transition.

   g. **Cleanup** — return `() => { channel.unsubscribe(); supabase.removeChannel(channel); }`.

   h. **Cursor expiry sweeper.** Also start a `setInterval` (every 2s) that calls `useBoardStore.getState().pruneExpiredCursors(Date.now(), 5000)` and `pruneExpiredTyping(Date.now(), 5000)`. Clear the interval in cleanup. (Bandwidth note: the throttled emit guarantees regular refreshes for active users, so a 5s TTL is comfortable.)

   i. **No imports from React Server Components.** The hook is `"use client"`. `useRouter` from `next/navigation`.

4. **Window/tab note.** S2 does NOT add a visibility-state pause for subscriptions themselves — per Q5 we keep subscriptions live on hidden tabs. The emit-side pause for cursor/typing belongs to S6 and S7 respectively.

**Tests:**
Mock `@supabase/ssr` so `createClient` returns a stub channel with chainable `.on(...)`, `.subscribe(cb)`, `.track(payload)`, `.unsubscribe()`, and `presenceState()`. Use `vitest`'s fake timers. Verify:
- All postgres_changes subscriptions are registered with `filter: 'board_id=eq.<boardId>'` and event `'*'`.
- `cell` table subscription is registered (not skipped post-S0).
- `comment` subscription is NOT registered.
- On `SUBSCRIBED`, `track` is called with `{ user_id, online_at, viewing: { type: 'board' } }` and store `setConnectionStatus('connected')`.
- On `TIMED_OUT`, store `setConnectionStatus('reconnecting')` and presence is cleared.
- On `TIMED_OUT → SUBSCRIBED`, `router.refresh()` is called (mock `useRouter`).
- The sweeper interval calls `pruneExpiredCursors` and `pruneExpiredTyping` every 2s.
- Cleanup calls `channel.unsubscribe()` and `removeChannel`.

Separate `realtime-throttle.test.ts`:
- Leading call fires synchronously.
- Repeated calls within `wait` are coalesced; last args win on trailing.
- `cancel()` prevents trailing fire.

**Definition of done:**
- Hook compiles and is exported. Channel name uses `board:<id>` exactly (matches Supabase config naming convention used throughout the app).
- All store dispatches are typed (no `any`).
- Mocked test suite passes; >90% branch coverage on the hook.
- `router.refresh()` only fires on the reconnect transition, not on the first subscribe.
- Comment subscription verifiably absent.

**Escalation triggers:**
- If `applyTaskDelete` / `applyGroupDelete` / `applyColumnDelete` signatures from the existing store differ from "takes a string id" — stop, report. (Verified at plan time: they take `taskId: string`, `groupId: string`, `columnId: string`. Confirm before dispatching.)
- If a `*_DELETE` postgres_changes event's `e.old` does not include `id` (Supabase publication setup affects this) — stop, report. Default expectation: `id` is the PK and is present in `old` for DELETE.

---

### Slice S3+S4 (merged): Topbar realtime UI — `PresencePile` + `ConnectionStatus`

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/s3-topbar-presence`
**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/PresencePile.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/ConnectionStatus.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/OutboxBanner.tsx` (new — but only the file shell with a placeholder export; S8 will implement the body)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/BoardHeaderClient.tsx` (single edit — add the three new components into the header layout)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/PresencePile.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/ConnectionStatus.test.tsx` (new)

**Reads (no write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/shared/Avatar.tsx` — `Avatar` accepts `src`, `displayName`, `email`, `size: 22 | 24 | 26 | 30 | 37.4`, `borderColor`, `className`.
- `/Volumes/SSD1T/DEV WORK/donezo/components/shared/MemberStack.tsx` — visual reference for the avatar pile (you are NOT extending it; presence avatars need a "live" treatment per epic doc — green dot or ring).
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts` — read connection + presence; do not modify.
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/design-system.md` — for tokens.
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/component-system.md` — for any legacy "who's here" pattern (if listed).

**Forbidden:** Any other component file. Do not modify `MemberStack.tsx` or `Avatar.tsx`. Do not implement the body of `OutboxBanner.tsx` — leave it as a placeholder return-null with a `// implemented in S8` comment so S8 can fill it in without re-creating the file.

**Depends on:** S1 (reads new store fields). Sequence after S1 lands.

**Spec:**

The board topbar needs three new pieces of UI:
- A **PresencePile** showing avatars of users currently viewing the board (deduped per user across tabs).
- A **ConnectionStatus** indicator that is invisible when `connected` and renders a small pill/dot+label when `reconnecting` or `offline`.
- An **OutboxBanner** that is implemented in S8 but whose component file is created here so the header edit can be done once.

1. **`PresencePile.tsx`** — props:
   ```ts
   interface PresencePileProps {
     members: Array<{ id: string; displayName: string | null; email: string | null; avatarUrl: string | null }>;
     currentUserId: string;
     max?: number; // default 4 (matches existing MemberStack default)
   }
   ```
   Behavior:
   - Read presence: `const presentIds = useBoardStore(selectPresentUserIds)` (use the exported selector from S1).
   - Filter out the current user from the displayed pile (`currentUserId`).
   - Resolve each `present_id` against `members[id]`. If a present user is not in the members list (race condition: just-joined invitee), render an Avatar with `displayName=null, email=null` (fallback `?` initial).
   - Render avatars left-to-right with `-ml-2` overlap (mirror MemberStack's visual rhythm). Use `Avatar` size `24` and `borderColor="white"` for the overlap halo.
   - Add a small **green dot** (`bg-[color:var(--color-success)]`, 8px) absolute-positioned at the bottom-right of each avatar to indicate "live". Use the legacy "online" green from design tokens; if no `--color-success` token exists, use `bg-green-500` and add a TODO comment to map to a design token. (Check `design-system.md` for the canonical online green; the legacy SCSS has `$gradient-green` and a "viewed/online" color.)
   - If `presentIds.length > max`, render a `+N` chip with the same shape, same overlap.
   - Tooltip on hover: each avatar shows the member's displayName/email. Use existing tooltip pattern (Base UI / shadcn — check `components/ui/` for what's already imported elsewhere in the topbar). If no tooltip primitive is already in use, use a `title` attribute for v1 and add a TODO; do not introduce a new dependency.

2. **`ConnectionStatus.tsx`** — no props. Reads `connection` from the store. Render:
   - `connected` → `null` (invisible).
   - `reconnecting` → small pill: yellow pulsing dot + "Reconnecting…". Tailwind: `animate-pulse bg-yellow-500`.
   - `offline` → small pill: red dot + "You're offline. Changes will sync when you reconnect." Tailwind: `bg-red-500`.
   - Use `role="status"` and `aria-live="polite"`.
   - Use design-system tokens (`var(--color-warning)` / `var(--color-danger)`) if defined; else map to tailwind colors with a TODO.

3. **`OutboxBanner.tsx`** — placeholder:
   ```tsx
   "use client";
   // Implemented in S8. Returning null keeps the header layout stable for S3+S4 to wire.
   export function OutboxBanner() { return null; }
   ```

4. **Edit `BoardHeaderClient.tsx`** — one edit, in one place:
   - Add imports for `PresencePile`, `ConnectionStatus`, `OutboxBanner`.
   - Get `currentUserId` from a new prop on `BoardHeaderClientProps`:
     ```ts
     interface BoardHeaderClientProps {
       members: Member[];
       createdByName: string | null;
       currentUserId: string; // new — provided by BoardHeader.tsx server component
     }
     ```
   - Update the BoardHeader server component (`/Volumes/SSD1T/DEV WORK/donezo/components/board/BoardHeader.tsx`) to read the current user via existing helpers (look for the pattern already used — likely `await getSessionUser()` or similar in `lib/auth/`) and pass `currentUserId` down. **This is part of this slice's owned writes** — add `components/board/BoardHeader.tsx` to your owns list at top.
   - Render order inside the `<header>` element, immediately before the existing `MemberStack` line at `BoardHeaderClient.tsx:133`:
     ```tsx
     <PresencePile members={memberStackItems.map(m => ({...m}))} currentUserId={currentUserId} />
     <ConnectionStatus />
     <OutboxBanner />
     ```
   - Keep `MemberStack` as-is. The two stacks coexist for now — `MemberStack` is "board members" (durable), `PresencePile` is "live now" (transient). Add a comment above the PresencePile call: `// live presence — green-dotted avatars of users on this board right now (Epic 08)`.

   **Update owns list addendum:** add `/Volumes/SSD1T/DEV WORK/donezo/components/board/BoardHeader.tsx` to the writeable file list. Forbidden expansion: do not touch the auth helper itself.

**Tests:**
- `PresencePile.test.tsx`: render with a store containing 0, 1, 3, 8 present users; verify visible avatar count = min(N, max), `+N` chip shows when overflow, current user excluded, missing-member fallback works.
- `ConnectionStatus.test.tsx`: render with each of the three states; assert the `null`/visible-pill/visible-pill outputs, the aria-live attribute, and that the offline message string matches the spec.

**Definition of done:**
- Three new components exist and compile.
- `BoardHeader.tsx` passes `currentUserId` down; `BoardHeaderClient.tsx` renders the three new pieces.
- `PresencePile` reads from the store via `selectPresentUserIds`; never renders the current user; correctly resolves members; falls back gracefully on unknown presence ids.
- `ConnectionStatus` returns `null` when connected (no DOM noise).
- `OutboxBanner` exists as a placeholder; S8 will fill it in by editing the file body, not re-creating it.
- Component tests pass.

**Escalation triggers:**
- If `design-system.md` has explicit tokens for `--color-success` / `--color-warning` / `--color-danger`, use them. If not, surface as a question — do NOT invent token names.
- If the legacy `frontend/` component-system reference shows a different layout for the presence pile (e.g. it sits on a separate row, not inline), surface that and stop. The epic doc says "top-of-board: avatar pile" without further detail; an existing legacy pattern wins if one exists.

---

### Slice S6: Cursor broadcast — emitter hook + overlay renderer + TableCell integration

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/s6-cursors`
**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-cursor-broadcast.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/CursorOverlay.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/cursor-color.ts` (new — user_id → stable hex color)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/TableCell.tsx` (single edit — add hover/focus handlers that call the emit hook + render the overlay)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/use-cursor-broadcast.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/cursor-color.test.ts` (new)

**Reads (no write):**
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/client.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/throttle.ts` (from S2)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/channel.ts` (from S2)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/TableCell.tsx` — file is in your owns list because you edit it; do not edit any other cell file.

**Forbidden:** Any cell-type implementation under `components/cells/<type>/`. Any other board component except `TableCell.tsx`. Do not modify `useBoardRealtime` (S2) — the cursor emit uses its OWN channel reference acquired the same way (one channel per board; Supabase deduplicates by channel name within a client).

**Depends on:** S1, S2. Sequence after both.

**Spec:**

Two parts: **emit** the current user's cursor (the cell they're hovering or focusing) to other clients, and **render** other users' cursors as colored dots inside the relevant cell.

1. **`lib/realtime/cursor-color.ts`** — pure function:
   ```ts
   /** Returns a stable hex color string for a user_id. Uses a tiny hash → HSL. */
   export function cursorColorForUser(userId: string): string;
   ```
   Implementation: hash userId to a number (e.g. sum char codes mod 360), produce `hsl(<h>, 70%, 50%)`. Avoid h=0..20 (red conflicts with offline indicator) — shift the hue out of that band. Test that two distinct user_ids produce distinct hues most of the time, that the same user_id always returns the same color, and that no output is in the red band.

2. **`hooks/use-cursor-broadcast.ts`** — emit-only hook (subscribing to incoming cursors is already done by `useBoardRealtime` in S2):
   ```ts
   "use client";
   export function useCursorBroadcast(boardId: string, userId: string): {
     emit: (taskId: string, columnId: string) => void;
   };
   ```
   Behavior:
   - Inside the hook, obtain the same channel reference: `supabase.channel(boardChannelName(boardId))`. Supabase's client caches channels by name; calling `.channel()` with the same name twice returns the same instance. (Confirm by reading the Supabase JS docs if uncertain; the documented behavior is "deduplicated by topic".)
   - Wrap a throttled emitter (use `throttle` from S2, `wait = 100ms`):
     ```ts
     const send = throttle((taskId: string, columnId: string) => {
       if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return; // Q5: pause emit on hidden tabs
       channel.send({
         type: 'broadcast',
         event: 'cursor',
         payload: { user_id: userId, task_id: taskId, column_id: columnId, at: Date.now() } satisfies CursorPayload,
       });
     }, 100);
     ```
   - Return `{ emit: send }`.
   - On unmount, call `send.cancel()`. Do NOT call `removeChannel` — `useBoardRealtime` owns the lifecycle.

3. **`components/board/CursorOverlay.tsx`** — renders cursor dots for a single cell:
   ```tsx
   interface CursorOverlayProps {
     taskId: string;
     columnId: string;
   }
   export function CursorOverlay({ taskId, columnId }: CursorOverlayProps): JSX.Element | null;
   ```
   Reads `cursors: Map<string, CursorPayload>` from the store; filters entries where `task_id === taskId && column_id === columnId`; for each match, renders an absolutely-positioned 8px colored dot (color from `cursorColorForUser(user_id)`) in the cell's top-right corner. If multiple users are on the same cell, stack them with a 4px horizontal offset (cap at 3 visible; render `+N` text beyond).
   - `position: absolute; top: 2px; right: 2px; pointer-events: none; z-index: 1;`
   - `role="presentation"` on the wrapper — these are non-interactive decorations.

4. **Edit `components/cells/TableCell.tsx`**:
   - Add `boardId` to TableCellProps. The caller (`TaskRow.tsx`) already has `boardId` via the page context — verify by checking how `boardId` flows from `BoardTable.tsx` → `TaskRow.tsx` → `TableCell`. If `TaskRow` doesn't currently have it, you may need to thread it through. **If threading `boardId` through `TaskRow.tsx` is required, that is in your owns list — add `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/TaskRow.tsx`.** If `BoardTable` already passes `boardId` to `TaskRow`, just consume it.
   - Get the current `userId`. Use the existing `useBoard` hook from `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board.ts` — verify whether it exposes the user id; if not, add it (this is acceptable scope expansion since `use-board.ts` is the natural place; if it does not currently provide a user id and adding it would touch unrelated logic, surface as a needs-direction).
   - In `TableCellInner`, call `const { emit } = useCursorBroadcast(boardId, userId)`.
   - On the `<button>` add `onMouseEnter={() => emit(task.id, column.id)}` and `onFocus={() => emit(task.id, column.id)}`.
   - Wrap the button (or place a sibling inside the wrapper div) with `<CursorOverlay taskId={task.id} columnId={column.id} />`. The overlay needs a positioned parent — wrap the existing button in a `<div className="relative">` if it isn't already positioned. Inspect the current cell structure and preserve all existing className behavior.

5. **Performance.** Throttle is 100ms; that caps each user at 10 emits/s. Pruning runs in S2's interval. No additional rAF needed.

**Tests:**
- `cursor-color.test.ts`: stable per user_id; out of red hue band.
- `use-cursor-broadcast.test.ts`: mock supabase channel; assert `send` is throttled (10 rapid calls within 100ms result in ≤2 channel.send calls — leading + trailing); assert payload shape; assert visibility-hidden suppresses emit; assert unmount calls `cancel`.

**Definition of done:**
- Cursor emit hook compiles; throttled correctly; respects visibility.
- CursorOverlay renders zero-DOM when no cursors match.
- TableCell hover/focus triggers emit without regressing the edit-mode flow (clicking still opens the editor; the emit fires on enter/focus, not on click).
- Color helper produces stable, non-red hues.
- Unit tests pass.

**Escalation triggers:**
- If `useBoard` does not expose the current user's id and adding it would require touching unrelated context-provider plumbing — stop, report.
- If Supabase JS client does NOT deduplicate channels by topic (it should, but if the version pinned in the repo behaves differently), stop and report. The fallback is to pass the channel handle down from S5's mount site as a context — that's a different architecture and needs orchestrator approval.

---

### Slice S7: Typing broadcast plumbing (hooks only — no UI consumer)

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/s7-typing`
**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-typing-broadcast.ts` (new — emitter)
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-typing-indicator.ts` (new — reader)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/use-typing-broadcast.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/use-typing-indicator.test.ts` (new)

**Reads (no write):**
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/stores/types/realtime.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/channel.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/throttle.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/client.ts`

**Forbidden:** Any component file. There is NO UI consumer in Epic 08 — Epic 09 will consume these hooks when the comment input lands. Do not import these hooks anywhere outside their own tests.

**Depends on:** S1, S2. Sequence after both.

**Spec:**

Ship the plumbing for typing indicators as a library, ready for Epic 09. Two hooks: emitter and reader.

1. **`hooks/use-typing-broadcast.ts`**:
   ```ts
   "use client";
   /**
    * Emits a typing event for a given context (e.g. `comment:<task_id>`).
    * Throttled to one emit per 2000ms. Pauses on hidden tabs.
    *
    * Returns an `emit()` function the caller invokes on every keystroke;
    * the throttle handles the rest. No automatic "stopped typing" event —
    * the reader hook expires entries after 5s of silence.
    *
    * Epic 08 ships this as plumbing only. Epic 09's CommentComposer is the
    * first caller.
    */
   export function useTypingBroadcast(args: {
     boardId: string;
     userId: string;
     context: string; // e.g. `comment:<task_id>`
   }): { emit: () => void };
   ```
   Implementation mirrors `useCursorBroadcast`: get the same-named channel, throttle to 2000ms, payload `{ user_id, context, at: Date.now() } satisfies TypingPayload`, gate on `document.visibilityState === 'visible'`. Cancel on unmount.

2. **`hooks/use-typing-indicator.ts`**:
   ```ts
   "use client";
   /**
    * Returns the list of OTHER users currently typing in the given context.
    * Self is filtered out. Stale entries (> 5s) are excluded via the store's
    * pruneExpiredTyping sweeper (run by useBoardRealtime).
    */
   export function useTypingIndicator(args: {
     userId: string;     // current user, to filter self
     context: string;
   }): Array<{ user_id: string; at: number }>;
   ```
   Implementation: subscribe to `typingByContext` via `useBoardStore`, look up the context list, filter out `user_id === userId`, return.

3. **Tests.**
   - `use-typing-broadcast.test.ts`: throttled at 2000ms; visibility-hidden suppresses; channel.send payload shape correct; unmount cancels.
   - `use-typing-indicator.test.ts`: with store seeded to `typingByContext: { 'comment:t1': [{u1, at1}, {u2, at2}] }` and `userId: 'u1'`, hook returns only `[{u2, at2}]`.

**Definition of done:**
- Both hooks compile, are exported from their own files, and have no callers in production code yet.
- Tests cover throttle, visibility-pause, self-filter, context-isolation.
- Hooks documented with a JSDoc note: "First consumer lands in Epic 09 (CommentComposer)."

**Escalation triggers:**
- None expected. If the channel deduplication concern from S6 surfaces here, same escalation path.

---

### Slice S8: Offline write queue — outbox flush logic, action wrapper, banner UI

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/s8-outbox`
**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/outbox.ts` (new — `withOutbox(actionId, action)` wrapper + `flushOutbox()` function + `isOnline()` helper)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/outbox-registry.ts` (new — maps `OutboxActionId` → the server-action function to call on flush)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/OutboxBanner.tsx` (REPLACE the placeholder body created by S3+S4; do not re-create the file)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/outbox.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/OutboxBanner.test.tsx` (new)

**Reads (no write):**
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts` — `setCellValue`, `bulkSetCellValue`.
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions.ts` — `renameGroup`.
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions.ts` — `renameTask` (find the exact export name; if it's `updateTask` or similar, use that and update the `OutboxActionId` union in S1's `stores/types/realtime.ts`).
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts` — read `outbox`, `connection`, call `enqueueOutbox` / `dequeueOutbox` / `clearOutbox`.

**Forbidden:** Server action files themselves — do not modify them. The wrapper is a client-side decoration applied at the call site. Do not change the existing connection-status logic (S2 owns it). Do not write to any new server action.

**Depends on:** S1 (store + types), S2 (uses `connection` field from store). Sequence after both. **S8 does NOT need S3+S4 to merge** — only the `OutboxBanner.tsx` file must already exist (S3+S4 creates the placeholder). If S3+S4 hasn't merged yet, coordinate with the orchestrator.

**Spec:**

This slice ships the offline write queue per the locked-in decisions: upsert-style mutations only, localStorage persistence (already wired by S1's `partialize`), last-write-wins on flush, yellow banner UI.

1. **`lib/realtime/outbox.ts`**:
   ```ts
   "use client";

   /** Returns navigator.onLine; SSR-safe (true on server). */
   export function isOnline(): boolean;

   /**
    * Wrap an upsert-style server action so that, if offline, the call is
    * enqueued in the store's outbox instead of throwing the network error.
    * Inserts and deletes must NOT use this wrapper — they should error
    * immediately when offline (their callers toast the error).
    *
    * @param actionId  the OutboxActionId tag used to replay on flush
    * @param action    the server action function (the actual reference, not a string)
    */
   export function withOutbox<TArgs extends unknown[], TReturn>(
     actionId: OutboxActionId,
     action: (...args: TArgs) => Promise<TReturn>,
   ): (...args: TArgs) => Promise<TReturn | { queued: true }>;

   /**
    * Replays all queued entries in submission order.
    * Called by S5's mount-time effect on connection 'connected' transition
    * and on window 'online' events.
    *
    * On per-entry failure: toasts the error and DROPS the entry (no infinite retry).
    * Returns the count of successfully flushed entries and the count of dropped entries.
    */
   export async function flushOutbox(): Promise<{ flushed: number; dropped: number }>;
   ```

   Implementation notes:
   - `withOutbox` checks `useBoardStore.getState().connection`. If `'offline'` OR `!isOnline()`, call `enqueueOutbox({ actionId, args, optimisticUpdatedAt: Date.now() })` and return `{ queued: true }` immediately. Caller's UI can treat `queued: true` as a soft success (the optimistic update already applied via the store's `applyXxxUpsert` happens BEFORE the wrapped action is invoked — that's the caller's responsibility, not the wrapper's).
   - If online, invoke the action; on network error (`TypeError: Failed to fetch` heuristic, or any error whose `message` matches `/network|fetch/i`), enqueue + return `{ queued: true }`. On any OTHER error (validation, auth), re-throw — those are real errors and the caller's existing toast logic handles them.
   - On overflow (`outboxOverflow: true` is set by the store), toast: "Offline queue is full — recent changes won't sync. Reconnect to flush." Do not enqueue. Return a thrown error so the caller's catch path runs.

2. **`lib/realtime/outbox-registry.ts`** — the registry that `flushOutbox` consults:
   ```ts
   import { setCellValue, bulkSetCellValue } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions";
   import { renameGroup } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions";
   // ... and renameTask / updateTaskFields if those exist with those names

   export const outboxRegistry: Record<OutboxActionId, (...args: unknown[]) => Promise<unknown>> = {
     setCellValue: setCellValue as (...a: unknown[]) => Promise<unknown>,
     bulkSetCellValue: bulkSetCellValue as (...a: unknown[]) => Promise<unknown>,
     renameGroup: renameGroup as (...a: unknown[]) => Promise<unknown>,
     renameTask: renameTask as (...a: unknown[]) => Promise<unknown>,
     updateTaskFields: /* if exists */ as (...a: unknown[]) => Promise<unknown>,
   };
   ```
   If `renameTask` / `updateTaskFields` don't exist under those exact names, **read** the actions directory and adapt the `OutboxActionId` union accordingly. Coordinate with S1 to keep the union in sync — if you need to amend the union after S1 merged, do it in this slice's diff (touching `stores/types/realtime.ts` is therefore allowed for this narrow purpose; add it to your owns).

3. **`components/board/OutboxBanner.tsx`** — replace the placeholder body:
   ```tsx
   "use client";
   import { useBoardStore } from "@/stores/board-store";
   export function OutboxBanner() {
     const count = useBoardStore((s) => s.outbox.length);
     if (count === 0) return null;
     return (
       <div role="status" aria-live="polite"
            className="inline-flex items-center gap-2 px-3 py-1 text-xs rounded
                       bg-yellow-100 text-yellow-900 border border-yellow-300">
         <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
         Syncing {count} pending change{count === 1 ? '' : 's'}…
       </div>
     );
   }
   ```
   Use design-system warning tokens if defined (`var(--color-warning-bg)`, etc.); otherwise tailwind colors with a TODO comment, matching the same handling rule from S3+S4.

4. **Flush trigger.** The actual mount-time call to `flushOutbox()` (on window `online` event + on store `connection` transitioning to `connected`) is owned by **S5**. S8 only exports `flushOutbox`. Document this clearly in a comment at the top of `outbox.ts`:
   ```ts
   // Flush is triggered by hooks/board mount in S5; this module only exports the function.
   ```

**Tests:**
- `outbox.test.ts`:
  - `withOutbox` enqueues when offline (mock `useBoardStore` connection = 'offline').
  - `withOutbox` enqueues when online but action throws a network error.
  - `withOutbox` re-throws when action throws a validation error.
  - `withOutbox` refuses to enqueue when `outboxOverflow` is true; throws.
  - `flushOutbox` replays entries in submission order (set up 3 entries; mock registry actions to record call order; assert).
  - `flushOutbox` drops an entry whose action throws; toasts; continues with the next.
  - `flushOutbox` returns `{ flushed, dropped }` counts.
- `OutboxBanner.test.tsx`: hidden when count=0; visible with correct text for count=1, count=5; correct aria-live.

**Definition of done:**
- `withOutbox` is callable as a wrapper around any of the supported actions.
- Banner renders correctly based solely on `outbox.length`.
- `flushOutbox` is exported but not invoked from this slice's files.
- localStorage persistence proven by an integration-style test that writes to the store, reads `localStorage['donezo:board-collapsed:v1']`, and confirms the outbox blob is present.
- No insert/delete server action is wrapped (verify: the registry contains only the documented action ids).

**Escalation triggers:**
- If the actions directory exposes function names that differ from the spec's `OutboxActionId` union (e.g. no `updateTaskFields`), stop, list the actual exports, and propose the corrected union as a delta — do not silently rename.
- If you find that any existing call site of the wrapped actions already throws toasts on network failure that would interfere with the `withOutbox` swallow, surface that and propose either (a) leaving those sites un-wrapped, or (b) updating those sites within S5's slice (not yours).

---

## Stage 2 — Sequential

### Slice S5: Mount realtime hook + outbox flush trigger + e2e + CONTRIBUTING note

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/s5-mount-and-e2e`
**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx` (single edit — mount `useBoardRealtime` + `flushOutbox` trigger)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/08-realtime.spec.ts` (new — Playwright 2-client tests)
- `/Volumes/SSD1T/DEV WORK/donezo/CONTRIBUTING.md` (append a section; create if missing)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/BoardTable-realtime-mount.test.tsx` (new — verify the hook is invoked on mount with correct args; not a full BoardTable re-test)

**Reads (no write):**
- All previous slice outputs.
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` — to understand how `boardId` is passed to BoardTable. If `BoardTable` needs to receive `userId` and currently does not, pass it as a new prop from the page; **`page.tsx` is added to your owns list** for this single edit.

**Forbidden:** Any other component or hook. The implementations of useBoardRealtime, hooks, components, store, and migration are frozen by the time this slice runs.

**Depends on:** ALL of S0, S1, S2, S3+S4, S6, S7, S8. **Sequential — must run only after all Stage 1 slices land on the epic branch.**

**Spec:**

1. **Mount `useBoardRealtime`** in `BoardTable.tsx`. The existing component already runs a hydration effect (line ~252–266). Add a sibling effect or call the hook at the top of the component:
   ```ts
   useBoardRealtime(boardId, userId); // userId is a new prop
   ```
   `userId` becomes a new `BoardTableProps` field. Plumb from `page.tsx` (RSC) — read the user via the existing `lib/auth` helper (look for the pattern used by other pages like `account/page.tsx` or the BoardHeader).

2. **Mount flush trigger.** Inside `BoardTable.tsx`, add a `useEffect` that:
   - Listens for `window` `online` event → `flushOutbox()`.
   - Subscribes to the store's `connection` field → on transition to `'connected'`, `flushOutbox()`.
   - Cleans up on unmount.
   ```ts
   useEffect(() => {
     const onOnline = () => { void flushOutbox(); };
     window.addEventListener('online', onOnline);
     const unsub = useBoardStore.subscribe((s) => s.connection, (curr, prev) => {
       if (prev !== 'connected' && curr === 'connected') void flushOutbox();
     });
     return () => { window.removeEventListener('online', onOnline); unsub(); };
   }, []);
   ```
   Note: `useBoardStore.subscribe` with a selector is the Zustand v4 API. Confirm the version pinned in `package.json` supports it; if not, fall back to the v5 `subscribeWithSelector` middleware or a manual `subscribe((state) => ...)` with prev/curr tracking inside the effect.

3. **Playwright e2e** at `tests/e2e/08-realtime.spec.ts`. Use the existing test harness pattern from `tests/e2e/06-board-table.spec.ts`. Spawn two browser contexts (two users; reuse the seed fixtures). Tests:
   - **Live cell edit.** Both users open board B. User A edits cell (t1, c1) to value V. Within 1500ms, User B's DOM reflects V.
   - **Live task add.** User A adds a task. User B sees it appear within 1500ms.
   - **Presence pile.** Both users on the board → both see 1 avatar each (the other user) in `PresencePile`. User A navigates away → User B's pile shows 0.
   - **Connection status.** Force-offline User A's context via `context.setOffline(true)`. The yellow "Reconnecting…" or red "offline" pill appears in A's topbar within 5s. Restore online → pill disappears within 10s, and a `router.refresh()` re-fetch occurs (verify by editing a cell on User B while A is offline; on A's reconnect, A sees the new value).
   - **Cursor dot.** User A hovers cell (t1, c1). Within 500ms, User B sees a colored dot in cell (t1, c1).

   Keep tests deterministic — use `expect.poll` for the time-bounded assertions; do not use raw `setTimeout`.

4. **CONTRIBUTING.md note.** Add a section "Realtime & writes":
   > Donezo's writes go through server actions only. Realtime is read-only on the client — postgres_changes events feed the Zustand store via idempotent `applyXxxUpsert` methods, gated on `updated_at`. Never write to the database directly from the client. Presence and broadcast (cursors, typing) are non-persistent advisory state; the server does not trust them.

5. **Unit test.** `BoardTable-realtime-mount.test.tsx` mocks `useBoardRealtime` and `flushOutbox`, renders `BoardTable`, and asserts:
   - `useBoardRealtime` is called with `(boardId, userId)`.
   - `flushOutbox` is called when the mocked store transitions to `connected`.
   - Listeners are removed on unmount.

**Tests:**
- `pnpm test:e2e -- 08-realtime` passes locally with the local Supabase stack running (`pnpm supabase start` + `pnpm dev`).
- `pnpm test -- BoardTable-realtime-mount` passes.

**Definition of done:**
- The board page mounts both realtime + outbox flush wiring exactly once.
- All Playwright assertions pass.
- CONTRIBUTING.md contains the realtime invariant.

**Escalation triggers:**
- If the Zustand store version does not support `subscribe(selector, listener)` — surface and ask whether to install `subscribeWithSelector` middleware or roll a manual diff.
- If Playwright's `context.setOffline(true)` does not suspend Supabase Realtime in the way the spec expects (Realtime uses websockets; offline blocks them), the connection-status test might be flaky — surface and propose using `context.route` to block the websocket URL pattern instead.
- If `userId` plumbing through `page.tsx` requires changes to the auth helper, stop and surface.

---

## Followups (post-merge)

These are explicitly not blockers for declaring Epic 08 done; record for the orchestrator's backlog:

- Tooltip primitive: if S3+S4 fell back to `title` attribute, introduce a proper tooltip (Base UI `@base-ui/react/popover` or shadcn `Tooltip`) in a separate followup.
- Design-system tokens: if `--color-success/warning/danger` were missing, propose additions to `design-system.md` and a token migration follow-up.
- Per-channel auth tokens (Q11) — deferred to a future security epic.
- Long-text concurrent editing (Tiptap collaborative) — deferred indefinitely; document the LWW limitation in user-facing docs.
- Mobile data: disable cursor broadcast on small viewports (epic 14 mobile pass).
- Cell DELETE postgres_changes event handling — log-only today; if observed in practice, add a `applyCellDelete(taskId, columnId)` to the store.

## Risk notes

- **Channel deduplication assumption.** S6 and S7 rely on Supabase's JS client returning the same channel object for repeated `createClient().channel('board:<id>')` calls. This is documented behavior but if the pinned version regresses, S2 would need to expose its channel handle via a React context, which is an architectural change. Escalation paths in S6/S7 cover this.
- **Outbox replay reordering.** Last-write-wins per cell + strict submission-order replay means a queued cell edit will land AFTER any concurrent online edits during the offline window — i.e. the offline user's stale value clobbers the newer value. This is acceptable per the locked decision; document it in CONTRIBUTING.md as part of S5's note.
- **Stage 1 ordering nuance.** Although S0/S1/S2/S3+S4/S6/S7/S8 are described as "Stage 1 parallel," S2 reads S1, and S6/S7/S8 read S1 and S2. True parallelism is **only** S0 with the rest. The orchestrator should run S0 in true parallel; S1 starts immediately; once S1 lands, S2 starts; once S2 lands, S6/S7/S8 may run in parallel. S3+S4 needs S1 only. This is closer to a wave schedule than a single stage — execute in waves: **Wave A: S0 + S1**, **Wave B: S2 + S3+S4** (both depend only on S1), **Wave C: S6 + S7 + S8** (depend on S2), **Wave D: S5**.
- **Type regen failures.** S0's type regen could surface latent issues in other files. The escalation trigger is in S0; expect a possible mini-followup to clean up downstream typecheck errors.
- **pgTAP runner availability.** If `supabase test db` is not wired in this repo's `package.json`, S0's pgTAP test may need a runner script first. Check `package.json` scripts before assuming.
- **Cursor color & color-blindness.** Hash-to-HSL doesn't guarantee distinguishable colors for users with color vision deficiency. Acceptable for an internal tool; surface as a future a11y task.
- **Comment subscription deferral (Q8).** S2 explicitly skips the `comment` postgres_changes listener. Epic 09 must add it; flag this in the Epic 09 dispatch plan.
