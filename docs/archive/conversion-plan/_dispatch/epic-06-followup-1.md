# Epic 06 — Followup Round 1

## Review summary

- **Stage reviewed:** Stage 2 (server actions) — commits `0a8a7cc` (S5: groups) + `e162cb1` (S6: tasks).
- **Diff range:** `4fb669c..HEAD` on `epic/06-groups-tasks-table`.
- **Verdict:** **FOLLOWUP REQUIRED** — single small surgical fix.
- **`pnpm lint` / `pnpm typecheck`:** clean (verified by orchestrator).

### DoD items met

S5 (groups/actions.ts):
- All six actions present (`createGroup`, `renameGroup`, `recolorGroup`, `reorderGroup`, `duplicateGroup`, `deleteGroup`).
- Each starts with `"use server"` (file-level), wraps `withUser`, calls `requireBoardRole(boardId, "member")` exactly once, parses input via the S2 Zod schemas, calls `logActivity` after success.
- `lib/group-palette.ts` exists and is consumed by `createGroup` and `recolorGroup` for color whitelist enforcement.
- Soft-delete on `deleteGroup` (sets `deleted_at`); cascade-to-tasks left to the DB trigger per spec.
- `duplicateGroup` is the non-atomic multi-statement variant (decision (b) per spec line 559); uses `position + 0.5` per spec.
- Test file `tests/unit/group-actions.test.ts` exists with the four sketch cases (and additional ones) under `describe.skip`.
- Zero `as any`. Zero `adminClient` calls. All activity types match the `ActivityType` union exactly (`group.created`, `group.renamed`, `group.recolored`, `group.reordered`, `group.duplicated`, `group.deleted`).

S6 (tasks/actions.ts):
- All eight actions present (`createTask`, `renameTask`, `duplicateTask`, `deleteTask`, `moveTask`, `bulkDeleteTasks`, `bulkDuplicateTasks`, `bulkMoveTasksToGroup`).
- Each calls `requireBoardRole(boardId, "member")` exactly once, parses Zod, logs activity.
- Bulk safety: every bulk action loads affected tasks first, derives a single `boardId`, rejects mixed-board input with `{ code: "VALIDATION", message: "Tasks span multiple boards" }`. `requireBoardRole` is called once per resolved board.
- `moveTask` rejects cross-board moves with `{ code: "VALIDATION", message: "Cross-board move not allowed", field: "groupId" }`.
- `bulkMoveTasksToGroup` also enforces destination-group same-board membership.
- Insert payloads omit `board_id` and rely on the `task_board_id_consistency` BEFORE INSERT trigger. The three inserts use `// @ts-expect-error` with documented rationale (the generated `task.Insert` type marks `board_id` as required because it mirrors `NOT NULL`).
- `bulkMoveTasksToGroup` positions are sequential `max(destination) + i + 1`, matching the spec.
- All eight task activity types match the `ActivityType` union exactly.
- Test file `tests/unit/task-actions.test.ts` exists with the four sketch cases (and additional ones) under `describe.skip`.

### Auditor responses to executor's flagged decisions

1. **`// @ts-expect-error` for trigger-set `board_id` (S6).** **Acceptable.** Guardrail #15 prohibits `as any`; `// @ts-expect-error` is a different mechanism that is materially safer because (a) the suppression is statement-scoped, not expression-scoped, and (b) if the generated types ever change so that `board_id` becomes optional, TypeScript will fail the build because the suppression is no longer needed. The executor's three usages each carry a clear rationale comment. No change requested.
2. **S5 `duplicateGroup` writes `board_id` on task inserts (line 249); S6 does not.** **Followup required** — see Slice F1 below. Functionally identical at runtime (the trigger overwrites either way), but the codebase contradicts its own guardrail #20 and risks copy-paste propagation of the wrong pattern.
3. **`bulkDeleteTasks` activity log records `count: input.taskIds.length` rather than the affected-row count.** **Acceptable.** The DoD spec defines the activity payload as `{ count, taskIds }` without specifying derivation; logging the requested intent (input length) is consistent with how all other bulk operations record their input arrays. The actual UPDATE is correctly bounded by `.is("deleted_at", null)`, so no spurious soft-delete writes occur. No change requested.
4. **`duplicateGroup` uses `position + 0.5` instead of `positionBetween`.** Explicitly permitted by spec ("non-atomic, multi-statement, polish later"). No change requested.

### DoD items NOT met

- **Guardrail #20 letter-violation in `app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions.ts:249`** — task insert payload includes `board_id: sourceGroup.board_id`. Spirit is intact (trigger overrides); letter is not.

### Other issues found

None.

---

## Followup slices

### Slice F1 — Drop redundant `board_id` from `duplicateGroup` task insert

**Owner:** epic-executor (sonnet) · single-slice, no parallelism needed (1 file, ~5 LOC change).

**Files (only):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions.ts` (modify — one insert payload + remove `board_id` from the SELECT preceding it if no longer needed)

**Forbidden scope:**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions.ts`
- Any test file under `tests/unit/`
- Any other file.

**Spec:**

In `duplicateGroup` (currently lines ~241–263), the loop that inserts cloned tasks builds a payload like:

```ts
.insert({
  board_id: sourceGroup.board_id,   // ← REMOVE this line
  group_id: newGroup.id,
  title: sourceTask.title,
  position: sourceTask.position,
  created_by: userId,
  updated_by: userId,
})
```

Remove the explicit `board_id: sourceGroup.board_id` line. The `task_board_id_consistency` BEFORE INSERT trigger sets `board_id` from the parent group automatically (verified in `supabase/migrations/20260506224930_initial_schema.sql:399-408`).

The generated `task.Insert` type marks `board_id` as required, so the `.insert(payload)` call will need either:

- **(a) Preferred:** the same `// @ts-expect-error: task_board_id_consistency trigger sets board_id from group_id` comment pattern S6 uses on its three insert sites. Lift the payload into a named const above the call (`const taskPayload = { … };`) so the suppression sits on the `.insert(taskPayload)` line cleanly. Match the comment text S6 uses verbatim for codebase consistency.
- **(b)** Reorganise so the suppression is on the `.insert({…})` literal directly, if cleaner. Either is fine — match whichever S6 used at the equivalent site.

The `sourceGroup.board_id` value is still needed for `requireBoardRole`, the new-group insert (which DOES require `board_id` — `group.board_id` has no trigger), and the `logActivity` call. Do NOT remove `board_id` from the `select(...)` in step 1; only remove the field from the per-task insert payload in step 5.

**Definition of done:**
- Line 249 (`board_id: sourceGroup.board_id`) is removed from the task-insert payload inside the `for (const sourceTask of tasks)` loop.
- The task insert call carries a `// @ts-expect-error: task_board_id_consistency trigger sets board_id from group_id` comment matching S6's pattern verbatim.
- No other behavioural change. The cell insert loop, group insert, fetch queries, and `logActivity` call are untouched.
- `pnpm typecheck` and `pnpm lint` clean.
- `pnpm typecheck` confirms the `// @ts-expect-error` is actually needed (i.e. the suppression is not stale — if it is stale, the generated types may differ from what S6 saw and that's an escalation trigger, not a place to silently drop the suppression).

**Tests:** No test changes. The existing `duplicateGroup` test in `tests/unit/group-actions.test.ts` asserts on the insert call with `expect.objectContaining(...)` and on `taskCount`; removing one field from the payload does not invalidate the existing assertions.

**Escalation triggers:**
- If `pnpm typecheck` passes WITHOUT the `// @ts-expect-error` after removing `board_id`, that means the generated types already accept the partial insert. In that case, omit the suppression comment (don't add a stale `@ts-expect-error` — TypeScript will flag it as unused). Document in the done-report.
- If `pnpm typecheck` fails with a different error (not the missing `board_id` field), STOP and escalate — something else is going on.

**Guardrails applied:** #15 (no `as any` — same `// @ts-expect-error` pattern as S6), #20 (don't write `task.board_id` explicitly — this slice's whole purpose).

---

## Open questions for the user

None. The followup is mechanical and the executor has clear escalation paths.
