# Epic 07 — Followup Round 1

## Review summary

- **Stage reviewed:** Stage 4 (slices S15–S18). Commit range `f9b8532..HEAD`. Four commits: `33935a7` (S15), `c3eb121` (S16), `f9aac16` (S17), `fddc61d` (S18).
- **Verdict:** FOLLOWUP REQUIRED (one surgical fix; everything else CLEAN or correctly deferred to Stage 5).

### Definition-of-done items met

- **S15** — `<TableCell />` dispatcher and `<CellEditor />` orchestrator both exist with the required contracts. Optimistic update + rollback + toast + derived-type short-circuit all present. The 3 in-folder popover editors (`long_text`, `link`, `location`) were normalized to content-only (no inner `<Popover.Root>`); orchestrator wraps consistently.
- **S16** — `<AddColumnModal />` multi-step picker → configure flow with admin-gated `<AddColumnButton />` + disabled+tooltip for non-admins. Optimistic temp-id + `applyColumnUpsertReplaceTemp` flow correct.
- **S17** — `<ColumnHeader />`, `<ColumnHeaderMenu />` (9 items, sub-dialogs for change-type and delete with typed-name `CONFIRM`/`DELETE` confirms), `<LabelEditorModal />` (dnd-kit vertical reorder, recolor via swatch popover, inline rename, delete, add) all created. Filter is disabled with "Coming in epic 11" tooltip (guardrail #25). Admin gating on Delete column and Settings/LabelEditorModal trigger.
- **S18** — `<ColumnReorder />` (horizontal SortableContext + `useColumnSortable` hook), `<ColumnResize />` (wrapper + handle), `useColumnResize` hook with RAF-debounced store writes and [60, 600] width clamp. Pointer-capture acquired on pointerdown.
- **Guardrails** — #5 (Base UI Menu/Dialog/Popover/Tooltip primitives), #8 (no `window.confirm`; typed-name dialog pattern), #11 (tempId for column create + label create), #17 (admin gating present on column + label CRUD), #25 (Filter stub permitted), #26 (file scope respected — no slice touched another's files), #32 (column prefs persisted via existing store slice).
- **Lint + typecheck** — confirmed clean per orchestrator briefing (290 files).

### Definition-of-done items NOT met

1. **`duplicateColumn` action's optimistic-store update is broken at runtime.** See "Followup slice F1" below for details.

### Other observations (intentionally NOT followups)

- **`onEditLabels` not passed from `CellEditor` to `StatusEditor` / `PriorityEditor`.** The "Edit Labels" footer button in `StatusLabelEditor` is gracefully hidden when `onEditLabels` is undefined. Users edit labels via the column header menu's `Settings` item → `LabelEditorModal`. This is option (b) from the briefing and is acceptable for v1 — no user-facing breakage. Track in epic followups (orchestrator's list, not a slice spec) if we ever want the in-cell-popover path back.
- **`members` is undefined in `CellEditor` and `TableCell`.** Documented limitation; cells fall back to count-badge / initials. Real fix is to expose member roster from `BoardContext`, which is cross-cutting (also affects MemberStack consumers in epic 06). Not a Stage 4 / epic 07 concern.
- **`currentUserId` async-resolved with one-tick race window.** Documented; only affects `VoteEditor` for the first ~ms after mount. Acceptable.
- **`<div data-resize-handle>` slot in S17's `ColumnHeader` and `<ColumnResize>` wrapper from S18 are two competing handle implementations.** S18 spec explicitly hands off pointer wiring to S18's hook; S19/S20 (Stage 5) must compose the final wiring. Decision deferred to Stage 5 dispatch — flag in Stage 5 spec, do not fix in Stage 4.
- **`as any` casts in `CellEditor.tsx` (4 sites) and `TableCell.tsx` (1 site) for `def.Editor` / `def.Cell` heterogeneous dispatch.** Borderline against guardrail #15 (which prefers `// @ts-expect-error`). Each cast has a `biome-ignore` rationale. The orchestrator dispatch genuinely cannot be typed without a per-type generic dispatch wrapper. Same precedent as epic 06's `BulkActionBar` heterogeneous editor dispatch. Accepted as-is. Do not refactor.

---

## Followup slices

### Followup slice F1 — fix `duplicateColumn` returned-label projection

**Owner:** epic-executor (sonnet) · **Sequential, single-file scope.**

**Files (only):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions.ts` (modify — `duplicateColumn` only)

**Forbidden scope:** any component, any other action, any store change.

**Problem:**

`duplicateColumn` in `app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions.ts` (current line ~218) currently does:

```ts
const { data: insertedLabels, error: labelInsertErr } = await supabase
  .from("label")
  .insert(sourceLabels.map((l) => ({ ...l, column_id: newColumn.id })))
  .select("id, name, color, position");
```

The `.select("id, name, color, position")` projection omits `column_id`, `created_at`, and `updated_at`. The returned shape is then handed back as `{ column: newColumn, labels: newLabels }` and consumed by `ColumnHeaderMenu.handleDuplicate`:

```ts
for (const label of result.data.labels) {
  applyLabelUpsert(label as Label);   // ← cast hides the issue
}
```

`applyLabelUpsert` (in `stores/board-store.ts:388`) buckets the label by `label.column_id`:

```ts
const existing = labelsByColumn.get(label.column_id) ?? [];
// ...
nextMap.set(label.column_id, next);
```

Because `label.column_id` is `undefined`, the duplicated labels never associate with the new column in the store; they end up in a `Map.set(undefined, ...)` bucket. The user has to refresh the board (re-hydrate) before the duplicated column shows its labels. The bug is silent — no error, no toast — and was hidden in code review by the `as Label` cast.

The same projection also strips `created_at` / `updated_at`, which breaks `applyLabelUpsert`'s idempotency check (`existingLabel.updated_at >= label.updated_at` becomes `undefined >= undefined` → false; benign but incorrect).

**Spec:**

1. In `duplicateColumn` (single function), replace the projection on the label insert select. Two acceptable forms:

   (a) Drop the projection entirely so the action returns the full `LabelRow`:
   ```ts
   .insert(sourceLabels.map((l) => ({ ...l, column_id: newColumn.id })))
   .select();
   ```

   (b) Or extend the projection explicitly:
   ```ts
   .select("id, column_id, name, color, position, created_at, updated_at");
   ```

   Prefer (a) — matches the `createColumn` precedent (line 70: `.insert(...).select()`) which already returns the full row, and is symmetric with `renameColumn`/`recolorLabel` (line 75/127 of labels actions).

2. Update the `newLabels` local variable's TypeScript type to `LabelRow[]` (it's currently typed as the narrow `Array<{ id: string; name: string; color: string; position: number }>`). Use the existing `LabelRow` type alias near the top of the file (or import `Database["public"]["Tables"]["label"]["Row"]` if no alias exists yet).

3. Verify the action's return type signature still satisfies callers. `ColumnHeaderMenu.handleDuplicate`'s cast `applyLabelUpsert(label as Label)` becomes structurally redundant — leave it in place (a removal would touch out-of-scope file). The cast simply becomes a true upcast.

**Definition of done:**
- `duplicateColumn` returns labels with full `LabelRow` shape (`id`, `column_id`, `name`, `color`, `position`, `created_at`, `updated_at`).
- The action's return type is `{ column: ColumnRow, labels: LabelRow[] }` (use existing type aliases).
- `pnpm typecheck` and `pnpm lint` pass.
- Manual verification (executor done report should call this out): duplicating a status column in dev now produces a new column whose labels appear immediately in the store without a page refresh.

**Escalation triggers:**
- If the type alias `LabelRow` doesn't already exist in this file and the existing `import type { Database } from "@/lib/supabase/types"` isn't there either: STOP and escalate. Don't introduce a new module-wide type alias as part of this surgical fix; instead use an inline `Database["public"]["Tables"]["label"]["Row"]` type reference. Do not create a new types barrel.

**Guardrails applied:** #14 (server actions return updated rows), #15 (no `as any` introduced — the cast in the consumer is left untouched; this fix removes the *need* for a cast), #26 (single-file scope).

---

## Open questions for the user

None. The single fix is mechanical and unambiguous.
