# Epic 08 — Followup Round 1

## Review summary

- Stage reviewed: `6112e2d..epic/08-realtime-presence` (all 8 slices merged).
- Verdict: FOLLOWUP REQUIRED
- Definition-of-done items met:
  - Postgres changes filtered per-board for `task`, `cell`, `group`, `column` (comment correctly deferred).
  - `board_id` denormalized on `cell` + `comment` with consistency triggers; migration + actions update correct.
  - Idempotent applies on `updated_at` (existing from Epic 06, intact).
  - Connection status indicator component exists with correct DOM behavior (`null` when connected, pill when not).
  - PresencePile component implements multi-tab dedupe via `selectPresentUserIds`.
  - Reconnect refetch uses `router.refresh()` on `reconnecting → SUBSCRIBED` (verified in `hooks/use-board-realtime.ts:182-189`).
  - `useBoardRealtime` mounts at board level via `BoardTable.tsx:261` (survives view switches in Epic 12 because BoardTable is per-view; documented risk acceptable for v1).
  - Hidden-tab pause for cursor + typing emit (`document.visibilityState !== 'visible'` gate in both broadcast hooks).
  - CONTRIBUTING.md "Realtime & writes" note present.
  - Cell DELETE handled correctly via parent-cascade in `applyTaskDelete` / `applyColumnDelete` / `applyGroupDelete`.
  - Outbox `outboxOverflow` is reset on flush (`lib/realtime/outbox.ts:124`).
  - `OutboxActionId` union matches registry (`renameTask` kept; `updateTaskFields` correctly removed with documentation).
  - Test infrastructure pattern (`describe.skip` + `@ts-expect-error vitest`) matches established repo convention.
- Definition-of-done items NOT met:
  - "Offline write queue: upsert-only, localStorage, last-write-wins, **banner UI**, **flush on reconnect**" — plumbing exists but is unwired. No call site uses `withOutbox`; the outbox is dead code at runtime.
  - "Two browsers on the same board see each other's cell edits, task adds, group reorders, comment posts within ~1s" — e2e cannot verify because selectors don't match DOM.
  - "Avatar pile shows everyone currently viewing the board" — component is correct but e2e selectors won't find it.
  - "Cursor dots ... work in the table" — e2e selectors broken.
- Other issues found:
  - `useTypingBroadcast` (`hooks/use-typing-broadcast.ts:62, 67-68`) calls `channel.subscribe()`, `channel.unsubscribe()`, and `supabase.removeChannel(channel)` on the **shared** board channel. When the hook unmounts, it tears down the channel for `useBoardRealtime` and `useCursorBroadcast` too — silently killing all realtime for the board. Latent today (no production caller); will explode the moment Epic 09's CommentComposer mounts.

## Followup slices

Three surgical fixes. Slices A and B can run in parallel; slice C touches multiple mutation sites and is sequenced last.

---

### Slice A: Fix `useTypingBroadcast` channel lifecycle

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/followup-1-typing-channel-lifecycle`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-typing-broadcast.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/use-typing-broadcast.test.ts`

**Reads (no write):**
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-cursor-broadcast.ts` (canonical pattern for emit-only broadcast hook)
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-realtime.ts` (owns shared channel lifecycle)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/channel.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/throttle.ts`

**Forbidden:** Any other file. Do not touch `useBoardRealtime` or `useCursorBroadcast`.

**Depends on:** none — parallel-safe with B and C.

**Spec:**

The current implementation of `useTypingBroadcast` calls `channel.subscribe()` on mount and `channel.unsubscribe()` + `supabase.removeChannel(channel)` on unmount. The board's realtime channel is owned by `useBoardRealtime`; tearing it down here kills postgres_changes, presence, and cursor broadcast for the entire board. The cursor hook gets this right — mirror that exactly.

Required behavior, matching `useCursorBroadcast`:

1. Acquire the channel via `supabase.channel(boardChannelName(boardId))`. Do NOT pass a config object; do NOT call `.subscribe()`. The channel is already subscribed by `useBoardRealtime`; Supabase's client deduplicates by topic.
2. Keep the throttled emit and visibility gate.
3. On unmount, **only** call `throttledRef.current?.cancel()`. Do NOT call `channel.unsubscribe()`. Do NOT call `supabase.removeChannel(channel)`. `useBoardRealtime` owns the lifecycle.
4. Add a comment above the cleanup mirroring `use-cursor-broadcast.ts:14-15`:
   ```ts
   // useBoardRealtime owns channel lifecycle; we only cancel pending sends here.
   ```

**Tests (update `tests/unit/use-typing-broadcast.test.ts`):**

- Remove the test at lines 230-239 (`"unmount calls channel.unsubscribe() and supabase.removeChannel()"`) — it codifies the bug.
- Replace with a test `"unmount does NOT call channel.unsubscribe() or supabase.removeChannel() — board channel is owned by useBoardRealtime"`:
  - After `unmount()`, assert `stubChannel.unsubscribe` was NOT called (`toHaveBeenCalledTimes(0)`).
  - Assert `mockRemoveChannel` was NOT called.
- Keep the existing test that asserts `send.cancel()` runs on unmount (the trailing-call suppression test at the surrounding lines).
- Also verify: hook does NOT call `channel.subscribe()` on mount (assert `stubChannel.subscribe.toHaveBeenCalledTimes(0)`).
- Existing throttle, visibility, and payload-shape tests should continue to pass against the updated implementation.

**Definition of done:**
- `use-typing-broadcast.ts` mirrors `use-cursor-broadcast.ts`'s cleanup pattern exactly.
- No production code path can tear down the shared board channel from outside `useBoardRealtime`.
- Tests assert the correct (non-destructive) lifecycle.
- `pnpm typecheck` clean.

**Escalation triggers:**
- If you find another emit-only hook that also misuses the channel lifecycle, surface it; do not silently fix outside this slice's owns.

---

### Slice B: Wire e2e selectors via `data-testid` on components + cells

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/followup-1-e2e-testids`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/PresencePile.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/ConnectionStatus.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/CursorOverlay.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/TableCell.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/PresencePile.test.tsx` (update selectors if any current tests query DOM; otherwise leave)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/ConnectionStatus.test.tsx` (same)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/08-realtime.spec.ts` (only if a selector still needs adjusting after attributes land — verify, don't rewrite)

**Reads (no write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/TaskRow.tsx` (note: already carries `data-task-id` on the row; do NOT add another)

**Forbidden:** Any file outside the owns list. Do not refactor component internals; this is selector wiring only.

**Depends on:** none — parallel-safe with A and C.

**Spec:**

The Playwright spec at `tests/e2e/08-realtime.spec.ts` uses four `data-testid` selectors plus a compound `[data-task-id][data-column-id]` selector. None of them currently match DOM. Add the missing attributes with minimal surgery.

1. **`PresencePile.tsx`** —
   - On the outer `<span role="group">` (currently line 40-44), add `data-testid="presence-pile"`.
   - On each visible avatar's `Tooltip.Trigger`'s rendered `<span>` (the one with `style={index === 0 ? undefined : { marginLeft: -8 }}`, currently line 57-61), add `data-testid="presence-avatar"`. Do not add it to the `+N` surplus chip.

2. **`ConnectionStatus.tsx`** —
   - On the visible `<span role="status">` (currently line 27-43), add `data-testid="connection-status"`.
   - When the component returns `null` (connected state, line 22), no testid is needed.

3. **`CursorOverlay.tsx`** —
   - On each rendered dot `<span>` inside `visible.map((cursor) => ...)` (currently lines 63-75), add `data-testid="cursor-dot"`.
   - The wrapper `<div role="presentation">` does NOT need a testid; the e2e counts dot elements.

4. **`TableCell.tsx`** —
   - The e2e uses `[data-task-id="<t>"][data-column-id="<c>"]` as a SINGLE element selector. Today `data-task-id` is on `TaskRow` and `data-column-id` is only on `ColumnHeader`; no cell carries both. Add **both** `data-task-id={task.id}` and `data-column-id={column.id}` to the existing wrapper `<div className="relative">` (currently line 70). Do not change className or layout. Preserve the `<CursorOverlay />` and `<button>` children unchanged.

**Tests:**

- Component unit tests (`PresencePile.test.tsx`, `ConnectionStatus.test.tsx`) should continue to pass unchanged unless they queried the same nodes with different selectors. Verify by reading the test files; if they pass without modification, leave them alone.
- The Playwright spec at `tests/e2e/08-realtime.spec.ts` should be left as-is unless a selector mismatch remains. The selectors are: `[data-testid='presence-pile']`, `[data-testid='presence-avatar']`, `[data-testid='connection-status']`, `[data-testid='cursor-dot']`, and `[data-task-id="<id>"][data-column-id="<id>"]`. After this slice, all five resolve to real DOM nodes.

**Definition of done:**
- All five e2e selectors resolve to real DOM nodes.
- No layout, styling, accessibility, or behavior change to any component.
- Existing unit tests still pass (verify by reading them; do not run them).
- `pnpm typecheck` clean.

**Escalation triggers:**
- If a unit test currently asserts the absence of these data attributes, stop and report — that would mean a deliberate design choice we're about to violate.

---

### Slice C: Wire outbox into mutation call sites

**Owner:** epic-executor (sonnet)
**Branch:** `epic/08-realtime-presence/followup-1-outbox-wiring`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/CellEditor.tsx` (wrap `setCellValue` call)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/TaskTitleCell.tsx` (wrap `renameTask` call)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx` (wrap `renameGroup` call at the `GroupHeaderRow.handleRename` site — line 158)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BulkActionBar.tsx` (wrap `bulkSetCellValue` call at line 388)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/outbox-wiring.test.tsx` (new — verifies each call site goes through `withOutbox`)

**Reads (no write):**
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/outbox.ts` (`withOutbox` signature + behavior)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/realtime/outbox-registry.ts` (registry; confirm action ids match)
- `/Volumes/SSD1T/DEV WORK/donezo/stores/types/realtime.ts` (`OutboxActionId` union)

**Forbidden:** Any server-action file. Any new export from `outbox.ts`. Do not change the `withOutbox` signature.

**Depends on:** Slice A and Slice B may merge in either order; this slice should sequence after both to avoid editing `BoardTable.tsx` in parallel with B (B does not edit BoardTable, but C does). In practice: run C after Stage 1's A+B parallel pass merges.

> Orchestrator note: A and B don't touch `BoardTable.tsx` or any of C's owned files, so A+B+C can theoretically all run in parallel. However, recent epic history shows BoardTable edits collide frequently; sequencing C after A+B is the safer schedule.

**Spec:**

The outbox plumbing (`withOutbox`, `flushOutbox`, registry, banner) exists but is never invoked because no mutation site is wrapped. The DoD bullet "Offline write queue: ... banner UI, flush on reconnect" requires the four upsert-style call sites to go through `withOutbox`. Wrap each one with the matching `OutboxActionId`.

**General pattern at each call site:**

Before (today):
```ts
const result = await setCellValue({ taskId, columnId, value });
```

After:
```ts
const wrappedSetCellValue = withOutbox("setCellValue", setCellValue);
const result = await wrappedSetCellValue({ taskId, columnId, value });
```

Two implementation notes:

- `withOutbox` returns `(...args) => Promise<TReturn | { queued: true }>`. Caller code must handle the `queued: true` branch: treat it as a soft success — the optimistic update already applied locally, and the outbox will replay on reconnect. Do NOT call the existing rollback path on `queued: true`; only on a thrown error.
- The wrapped function should be created **once** per call site (module-level constant or memoized via `useMemo`), not on every render. `withOutbox` itself is stable; the returned function captures the action reference at wrap-time.

**Per-site instructions:**

1. **`components/cells/CellEditor.tsx`** (line 129 — `setCellValue`):
   - Import `withOutbox` from `@/lib/realtime/outbox` and `setCellValue` (already imported).
   - At module scope (outside any component): `const wrappedSetCellValue = withOutbox("setCellValue", setCellValue);`
   - Replace `await setCellValue(...)` with `await wrappedSetCellValue(...)`.
   - In the success branch (the existing `if (result.ok) { ... }` or equivalent — read the file to confirm shape), add a guard: if the result indicates `queued: true` (i.e. the result is `{ queued: true }` rather than the normal `{ ok, data }` shape), treat as success and skip any explicit "server returned canonical row" reconciliation (the optimistic update already applied). Do not toast.
   - On thrown error, the existing toast/rollback runs unchanged.

2. **`components/board/table/TaskTitleCell.tsx`** (line 52 — `renameTask`):
   - Same pattern. Module-level `wrappedRenameTask`. Handle `queued: true` as soft success.

3. **`components/board/table/BoardTable.tsx`** (line 158 — `renameGroup` inside `GroupHeaderRow.handleRename`):
   - Same pattern. Module-level `wrappedRenameGroup`. Handle `queued: true`.
   - Do not touch the realtime mount effect or outbox flush trigger at lines 251-288.

4. **`components/board/table/BulkActionBar.tsx`** (line 388 — `bulkSetCellValue`):
   - Same pattern. Module-level `wrappedBulkSetCellValue`. Handle `queued: true`.

**Result-shape detection.** `withOutbox` returns either the action's original return or `{ queued: true }`. The simplest discriminator at the call site is:
```ts
const result = await wrappedAction(args);
if (result && typeof result === "object" && "queued" in result && (result as { queued?: boolean }).queued === true) {
  // Soft success — optimistic update already applied; outbox will flush on reconnect.
  return;
}
// Else: normal action-result shape (e.g. { ok, data } or { ok, error }); existing handling.
```

Encapsulate that check as a tiny helper if it improves readability (`function isQueued(r: unknown): r is { queued: true }`), but do not export it — keep it local to each file or factor into a single helper inside `lib/realtime/outbox.ts` only if necessary. **Do not** add a new export from `outbox.ts` if it would force editing the public API; inline the check.

**Tests (`tests/unit/outbox-wiring.test.tsx`):**

This is a new test file that proves the wrappers are in place. It does NOT need to render the components in full — it can mock the server actions and verify that the wrapped path runs.

For each of the four call sites:
- Mock the corresponding server action to track invocation.
- Mock `useBoardStore.getState()` so `connection: 'offline'` is set.
- Trigger the wrapped call (the easiest way: import the wrapped constant indirectly via the component, OR factor each `wrappedXxx` into a small adjacent module so the test can import it directly — your call. If you choose the adjacent-module factoring, that's allowed; add `lib/realtime/wrapped-actions.ts` to owns).
- Assert: the underlying action was NOT called; `enqueueOutbox` WAS called with the right `actionId` and `args`.
- Then flip connection to `'connected'` and assert the underlying action IS called.

Even with `describe.skip` (vitest deferred to Epic 15), this is the codified proof that wrapping happened.

**Definition of done:**
- All four mutation call sites route through `withOutbox` with the correct `OutboxActionId`.
- `queued: true` is treated as soft success at each call site (no false-positive error toast or rollback).
- The Outbox banner will actually render when offline-then-mutate happens.
- `tests/unit/outbox-wiring.test.tsx` exists, follows the repo's `describe.skip` + `@ts-expect-error vitest` pattern, and asserts the wrapping at each site.
- `pnpm typecheck` clean.

**Escalation triggers:**
- If a call site's surrounding logic relies on the server action's return shape in a way that's incompatible with `{ queued: true }` (e.g. immediately reads `result.data` without checking `ok`), stop and surface — the discriminator approach may need a per-site adaptation.
- If `withOutbox`'s generic return type fails to narrow correctly inside one of the components (TypeScript inference around discriminated unions), surface and propose a `lib/realtime/outbox.ts` helper export (`isQueuedResult`) as a one-line addition; do not silently widen with `any`.
- If `BulkActionBar.tsx`'s call at line 388 is actually inside an unusual structure (e.g. multiple sequential mutations), surface; the goal is one wrap per server-action call.

---

## Open questions for the user

None. All three slices are scoped from concrete code-level gaps with unambiguous fixes per the epic doc DoD.

