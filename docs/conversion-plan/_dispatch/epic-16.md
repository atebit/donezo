---

# Epic 16 — Board Grid Remediation — Dispatch Plan

**Status:** approved 2026-05-13 by the user after planning + audit pass.

**Canonical epic doc:** [`docs/conversion-plan/16-board-remediation.md`](../16-board-remediation.md)

**Branch:** `epic/16-board-remediation` (off `main`, after epic 15 follow-up commit `368f266`).

**Dependency epics merged:** 01–15. Data model, server actions, RLS, Realtime, activity log, cell registry, observability + test harness all in place.

---

## Preconditions verified

- `main` is clean (only untracked file at planning time was the epic doc itself).
- Epic 15 PR merged (#52); follow-up bugfix commits `368f266`, `8712698`, `cff8945`, `721763b`, `70e6d0f` landed.
- Cell registry at `lib/cells/registry.ts` exports all 26 cell types from `components/cells/*/def.ts`. None are stubbed.
- `AggregationKind` union in `lib/cells/types.ts` already includes `range`, `count_unique`, `percent_by_label`, `percent_checked`, `sum`, `min`, `max`, `avg`, `median`, `count`, `count_non_empty`. No new kinds required.
- `CellEditor.tsx` confirmed broken at line 198: a hidden `<span>` is rendered as `Popover.Trigger` with no anchor → Base UI Positioner falls back to viewport `(0,0)`.
- `BoardTable`, `StickyHeader`, `TaskRow`, `GroupFooter` all use `display: flex` row layouts with **three duplicated** `visibleColumns / titleColumn / otherColumns / getColumnWidth` blocks. This is the canonical source of the column-alignment bug.
- `GroupFooter` already calls `def.aggregate(values, firstKind, …)` — but `firstKind = def.aggregations[0]` resolves to `"count"` for nearly every type, which is why every cell type currently shows `N count`.
- **Workspace context bug — root cause confirmed:** `WorkspaceProvider` is mounted inside `app/(app)/w/[workspaceSlug]/layout.tsx`. `SidebarShell` (and thus `WorkspaceSidebar` + `WorkspaceSwitcher`) is mounted by the *outer* `app/(app)/layout.tsx`. The sidebar tree sits **outside** the provider tree, so `useWorkspaceMaybe()` returns `null` and the switcher falls back to "Select workspace".
- `createView` server action does not check for name collisions before insert.
- `DensityToggle` lives inside the primary `ViewToolbar` row.
- `colorToToken(group.color)` is read directly by `TaskRow` and `GroupHeaderRow` — there is no shared `--group-accent` CSS variable wiring today.
- All 26 cell `def.ts` files share a uniform `aggregations: AggregationKind[]` shape — adding a `defaultAggregation` field is type-safe and additive.
- **Same-type-columns bug** (user-reported): the obvious key plumbing is correct. `TableCell` reads via `cells.get(\`${task.id}:${column.id}\`)` (`components/cells/TableCell.tsx:46`). `CellEditor` writes optimistically with `task.id + column.id` and calls `wrappedSetCellValue({ taskId, columnId, value })` (`components/cells/CellEditor.tsx:127-138`). `applyCellUpsert` keys `${task_id}:${column_id}` (`stores/board-store.ts:429-440`). The server action upserts with `onConflict: "task_id,column_id"`. **Root cause is elsewhere** — see Slice F.

---

## Open questions — answered

1. **View-name collision policy (epic doc Q1)** → **Auto-suffix `(2)`**. `createView` runs `uniqueName(desired, existing)` and inserts the deduped name. Matches Google Drive / Figma.
2. **Stretch item-detail drawer (epic doc Q2)** → **IN SCOPE.** Promoted from stretch to a full slice (Slice G). Sequences after Slice A because it adds a hover affordance to `TaskRow` (Slice A's file).
3. **Per-group column header repeat (epic doc Q3)** → **Always repeat.** Full Monday parity. Virtualization makes the cost free in practice.
4. **Title column in cell registry (epic doc Q4)** → **OUT OF SCOPE** for this epic per doc; user did not override. Revisit later.
5. **Pink/red gradient banner in screenshot 2 (epic doc Q5)** → **DO NOT investigate.** Confirmed not our code; almost certainly Next.js dev-mode HMR overlay. File a follow-up only if a clean prod build reproduces it.
6. **Empty-cell placeholder scope (audit Q6)** → **All editable-value cells** drop the `"Empty"` placeholder. Status / priority get the dashed empty tile per spec.
7. **Sticky-left under CSS grid (audit Q7)** → not a user-facing decision; Slice A owns verifying behavior in Safari.
8. **Density-toggle target menu (audit Q8)** → **Inside `ViewTabDropdown`** (per-view dropdown). Density is per-view; `ViewTabDropdown` is already the per-view settings entry point.

---

## Slices

Seven slices across three stages. Slice A is the spine — others rebase on it. B, D, F run in parallel with A. C and G sequence after A (file overlap on `GroupFooter.tsx` and `TaskRow.tsx` respectively). E (smoke harness) runs last.

### Stage 1 — parallel: A, B, D, F

### Stage 2 — sequenced after A: C, G (themselves parallel)

### Stage 3 — sequenced after A-D, C, F, G: E

---

## Slice A — Grid spine + group-accent CSS variable + per-group column header

**Owner:** epic-executor (sonnet)

**Branch:** `epic/16-board-remediation/a-grid-spine`

**Scope (writes):**
- `components/board/table/BoardTable.tsx`
- `components/board/table/StickyHeader.tsx`
- `components/board/table/TaskRow.tsx`
- `components/board/table/GroupFooter.tsx` (layout container only — leave a `FooterCell({col, groupTasks})` seam for Slice C to fill)
- `components/board/table/AddTaskFooter.tsx`
- `components/board/table/AddGroupFooter.tsx`
- `components/board/table/TableVirtualizer.tsx` (only if needed to thread the column-template through virtualized children — prefer context)
- `components/board/table/types.ts` (extend `RowEntry` with a new `group-column-header` kind)
- **new:** `components/board/table/GroupSection.tsx` — wraps `<GroupHeader />`, `<GroupColumnHeader />`, task rows, `<GroupFooter />`, `<AddTaskFooter />`. Sets `style={{ "--group-accent": `var(${colorToToken(group.color)})` }}` on the section root.
- **new:** `components/board/table/GroupColumnHeader.tsx` — per-group column header repeat. Same icon+name pattern as `ColumnHeader` but passive (no menu, no reorder, no resize). Top border = `var(--group-accent)`.
- **new:** `components/board/table/grid-template-context.ts` — React context exposing `gridTemplateColumns` string + `useGridTemplate()` hook.
- **new:** `components/board/table/use-visible-columns.ts` — one shared hook returning `{ visibleColumns, titleColumn, otherColumns, getColumnWidth }`. Consumes effective view config first, falls back to legacy `columnPrefsByBoard`.

**Forbidden scope:** `lib/cells/**`, `components/cells/**`, `components/shared/sidebar/**`, `app/(app)/**`, `components/board/View*.tsx`, `components/board/AddViewMenu.tsx`, `components/board/ViewToolbar.tsx`.

**Dependencies on other slices:** none — lands first.

**Spec:**

1. Replace the three flex strips with one CSS grid that owns the column axis. `grid-template-columns` is derived from `[checkbox, title, ...other, addColumnSlot]` where each track is `minmax(${MIN}px, ${getColumnWidth(col)}px)`. Width constants: `--size-cell-w-checkbox`, `--size-cell-w-task` (336px), `--size-cell-w` (140px). MIN_WIDTH = 80; TITLE_MIN_WIDTH = 200.
2. Expose `gridTemplateColumns` via React context (`GridTemplateContext`) from `BoardTable.tsx`. Memoize for stable identity.
3. `use-visible-columns.ts` replaces the three duplicated implementations in `StickyHeader`, `TaskRow`, and `GroupFooter`. All three call this hook — no inline copies left.
4. `StickyHeader` becomes a single `display: grid` row sharing the template. Board-level checkbox is the first cell; title column is a grid item with `position: sticky; left: 0; z-index: var(--z-sticky)`; `<ColumnReorder>` children are grid items (each `<ColumnResize>` still wraps a `<ColumnHeader>`, but the flex parent goes away).
5. `TaskRow` becomes `display: grid` with the shared template. **Remove the standalone 6px accent stripe div.** Replace with `box-shadow: inset 6px 0 0 0 var(--group-accent)` on the row container so the stripe lives on the row and doesn't consume a grid track (preserves alignment with the header that has no stripe).
6. `GroupFooter` becomes `display: grid` with the shared template. Title slot remains empty. The body of `FooterCell({col, groupTasks})` returns the current "first aggregation kind" string output unchanged — Slice C replaces this body. **Hide the footer when `tasks.length === 0`** by skipping the `RowEntry` push in `BoardTable.tsx`'s `rows` memo.
7. `GroupSection.tsx` wraps `<GroupHeader />`, `<GroupColumnHeader />`, `{tasks…}`, `<GroupFooter />`, `<AddTaskFooter />`. Sets `--group-accent` once.
8. `GroupColumnHeader.tsx` renders a passive (no menu, no reorder, no resize) header inside each group. Reads the shared grid template via context. Top border = `var(--group-accent)`.
9. Update `TableVirtualizer`'s flat `RowEntry` list to insert a `group-column-header` row after every non-collapsed `group-header`. Add the new kind to `RowEntry` in `components/board/table/types.ts`.
10. Update `GroupHeaderRow` (inside `BoardTable.tsx`) and any other group-themed surface to read `var(--group-accent)` instead of `colorToToken(group.color)` directly.
11. Sticky behavior preserved: `position: sticky; top: 0` on `StickyHeader`; `position: sticky; left: 0` on the title cell of every grid row.

**Important context from memory:**
- `donezo-zustand-v5-selectors.md` — selectors returning fresh objects/arrays must be wrapped in `useShallow`. The new `use-visible-columns.ts` must comply.

**Definition of done:**
- One CSS grid (or grid-template-columns shared via context) is the single owner of the column axis.
- Header column-N x-position equals every task row column-N x-position equals group footer column-N x-position. (Slice E codifies this as a Playwright assertion; Slice A only demonstrates it locally.)
- Per-group color appears on group title, row left stripe (box-shadow inset), and footer top border via `var(--group-accent)` (set in exactly one place: `GroupSection`).
- Empty groups render header + column header repeat but no footer aggregate row.
- `pnpm typecheck` and `pnpm lint` pass.
- Vitest: `use-visible-columns.test.ts` covering visibility, title-column resolution, fallback to legacy prefs.

**Escalation triggers:**
- TanStack Virtual cannot expose a `display: contents` row without breaking measurement → escalate; the safer alternative is each row being its own grid container that reads the shared template from context.
- Sticky-left fails with grid in Safari → escalate before working around.

---

## Slice B — Cell editor anchor fix

**Owner:** epic-executor (sonnet)

**Branch:** `epic/16-board-remediation/b-editor-anchor`

**Scope (writes):**
- `components/cells/CellEditor.tsx`
- `components/cells/TableCell.tsx` (capture cell DOM node ref / `event.currentTarget` on click; pass to `CellEditor` as `anchorEl: HTMLElement | null`)

**Forbidden scope:** any specific editor (`components/cells/{status,priority,date,…}/Editor.tsx`) — those are slot-rendered, untouched.

**Dependencies on other slices:** none.

**Spec:**

1. Replace the broken `<Popover.Trigger render={<span />} style={{ display: "none" }} … />` pattern with Base UI's controlled anchor: `<Popover.Positioner anchor={anchorEl} sideOffset={0} align="start">`.
2. Keep the `<Popover.Portal>` wrapper. (Memory `donezo-base-ui-popover-portal.md`: missing it throws Base UI error #45 during SSR and breaks page-level `redirect()`.)
3. **Anchor source — preferred:** `TableCell` captures `event.currentTarget` on the click that opens the editor and passes a `HTMLElement | null` ref/value to `CellEditor` as a new prop `anchorEl`. This avoids DOM-attribute lookups and stale-DOM races after virtualizer recycling.
4. **Fallback:** `document.querySelector(\`[data-task-id="${task.id}"][data-column-id="${column.id}"]\`)` on editor mount. Use only if (3) is infeasible.
5. Ensure cell DOM nodes carry `data-task-id` and `data-column-id` attributes (already present in `TableCell.tsx:70`).

**Definition of done:**
- No hidden `<span>` triggers in `CellEditor.tsx`.
- Opening any cell editor (status, priority, person, date, number, text, …) renders the popover next to the triggering cell at both 1280×800 and 1920×1080 viewports. Slice E codifies this as a Playwright test.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- Base UI's `Popover.Positioner anchor` prop signature changed since the version pinned in `package.json` — escalate with the installed version.

---

## Slice D — Sidebar workspace context + view-name dedupe + active-tab styling + density toggle relocation

**Owner:** epic-executor (sonnet)

**Branch:** `epic/16-board-remediation/d-sidebar-views`

**Scope (writes):**
- `app/(app)/layout.tsx` — restructure so `WorkspaceProvider` wraps `SidebarShell`
- `app/(app)/w/[workspaceSlug]/layout.tsx` — adjust accordingly (likely keep here but pass workspace + boards as props that bubble into the outer SidebarShell render slot, or have the workspace layout own the `SidebarShell` mount — see Spec)
- `components/shared/sidebar/SidebarShell.tsx` — accept the active workspace + sidebarBoards as props; wrap children in `WorkspaceProvider`
- `components/shared/sidebar/WorkspaceSidebar.tsx` — remove the "Select a workspace" fallback when context is present
- `components/shared/sidebar/WorkspaceSwitcher.tsx` — drop the `?? "Select workspace"` fallback (it will always be set once wiring is fixed)
- `components/shared/sidebar/MainSidebar.tsx` — accept workspace prop pass-through
- `app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions.ts` — add `uniqueName` dedupe to `createView`
- **new:** `lib/views/unique-name.ts` — `uniqueName(desired, existing): string` pure function
- `components/board/ViewTabs.tsx` — confirm active-tab visual treatment paints; harden to the design token in `component-system.md` §1.4 (2px bottom border or equivalent)
- `components/board/ViewToolbar.tsx` — remove `<DensityToggle />` from the primary toolbar
- `components/board/ViewTabDropdown.tsx` — add density selector inside the per-view dropdown (radio group with Compact / Default / Spacious)

**Forbidden scope:** `components/board/table/**`, `components/cells/**`, `lib/cells/**`.

**Dependencies on other slices:** none.

**Spec:**

1. **Workspace wiring root cause:** `WorkspaceProvider` mounted by `app/(app)/w/[workspaceSlug]/layout.tsx`; `SidebarShell` mounted by outer `app/(app)/layout.tsx`. Sidebar sits outside the provider tree. Fix preference (in order):
   - **Preferred:** restructure so the workspace layout owns the `SidebarShell` mount with `WorkspaceProvider` above it. The outer `app/(app)/layout.tsx` keeps any non-workspace chrome (auth guard, theme, sonner toaster).
   - **Acceptable fallback:** thread the active workspace + sidebarBoards as **props** from the workspace layout into a `SidebarShell` rendered by the outer layout (server-prop drill). `SidebarShell` then mounts its own provider scope around the sidebar subtree. Use this only if (a) is more disruptive than expected.
   - **If the layout restructure ripples into auth guards or layout boundaries beyond the sidebar:** escalate with the proposed topology before implementing.
2. `uniqueName(desired, existing)` algorithm: if `desired` not in `existing` → return `desired`. Else find the smallest `n ≥ 2` such that `\`${desired} (${n})\`` is not in `existing`. Pure function, unit-tested.
3. `createView` action: after parsing input, query `view.name` for the board, compute `uniqueName(input.name, existing)`, insert with the deduped name. No schema change.
4. `ViewTabs.tsx`: confirm the active-tab indicator paints. If invisible, add the 2px bottom border per `component-system.md` §1.4.
5. Move density toggle out of `ViewToolbar` and into `ViewTabDropdown` as a Compact / Default / Spacious radio group.

**Definition of done:**
- On `/w/<slug>/b/<id>`, sidebar workspace switcher shows the active workspace name (not "Select workspace"). `BoardList` renders that workspace's boards.
- The "Select a workspace…" copy never shows while a workspace is active.
- Creating two views named "Main table" via the UI yields "Main table" and "Main table (2)".
- Active view tab is visibly different from inactive tabs.
- `<DensityToggle />` no longer appears in `ViewToolbar`. It appears inside the active view's dropdown.
- Vitest: `unique-name.test.ts` covers no-collision, single-collision, multi-collision.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- Layout restructure required to land `WorkspaceProvider` above `SidebarShell` is broader than expected (auth, role guards re-order).

---

## Slice F — Same-type-columns independence bug

**Owner:** epic-executor (sonnet)

**Branch:** `epic/16-board-remediation/f-cell-independence`

**Symptom:** When a board has two columns of the same type (e.g., two `status` columns) on the same task row, changing the value in one column visually updates the value in the other column on that row. The two cells should be fully independent.

**Audit-confirmed state of the obvious key plumbing:**
- `TableCell` reads via `cells.get(\`${task.id}:${column.id}\`)` — correct.
- `CellEditor` writes via `applyCellUpsert({task_id, column_id, …})` with the correct ids — correct.
- `applyCellUpsert` keys the store map by `${cell.task_id}:${cell.column_id}` — correct.
- Server action `setCellValue` upserts with `onConflict: "task_id,column_id"` — correct.
- React `key={col.id}` on the cells list in `TaskRow.tsx:143` — correct.

**The bug is therefore NOT in the obvious key plumbing.** Investigation is the first task.

**Scope (writes):** TBD — bounded by the root cause. Most likely files (in priority order):
- `components/cells/status/Cell.tsx` and `components/cells/status/Editor.tsx` (label rendering path)
- `lib/cells/status/def.ts` and any `labelsByColumn` lookup
- `stores/board-store.ts` (Realtime payload routing / label store wiring)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (RSC column + cell hydration — verify columns arrive with distinct ids and cells route correctly)
- `hooks/use-realtime-board.ts` or wherever Realtime cell payloads are applied

**Forbidden scope:** any DB schema change (the schema is correct — `cell` PK is `(task_id, column_id)` and `column.id` is `uuid v4`). If the fix would require a schema change, **escalate** instead.

**Dependencies on other slices:** none — fully parallel.

**Spec:**

1. **Reproduce first.** Seed a board with two `status` columns (distinct ids, both populated with the default label set). Add 3 tasks. Set column A's cell to "Done" on task 1 — observe whether column B's cell on task 1 also flips. If reproducible, snapshot the `cells` Map and the `columns` array from the store at each step (e.g., via a temporary `window.__boardStore = useBoardStore` hook in dev).
2. **Identify root cause.** Investigate the top-three hypotheses in order:
   - **(a) Status label rendering path.** `StatusCell` resolves a label by `columnId`. Trace where the labels for that column come from (a `labels` store slice keyed by column_id, or a per-column `column.settings.labels` array). If labels are keyed by *type* anywhere, both columns share the same label list and visually appear to share values when one is "set."
   - **(b) Realtime payload routing.** Server action returns the correct (task_id, column_id) row; check whether the Supabase Realtime `postgres_changes` channel echoes a payload with a column_id that gets remapped via type. Inspect `hooks/use-realtime-board.ts` or the equivalent subscription handler.
   - **(c) Column hydration shape.** The RSC `page.tsx` query for columns must return distinct ids for both same-type columns. Verify by inspecting the hydrated `columns` array via the dev hook from step 1. (Audit suggests this is unlikely — `createColumn` uses `.insert()` which generates fresh ids — but worth a 30-second confirmation.)
3. **Fix the root cause.** Surgical fix scoped to whichever file owns the bug. **Do not** introduce a workaround that papers over the symptom; root-cause the actual collision.
4. **Vitest unit test** for the store / label-store / Realtime handler (whichever is fixed) covering the two-same-type-columns-on-same-row case.
5. **Add a Playwright fixture** that seeds a board with two status columns and asserts independence after setting one. Coordinate with Slice E — E owns the smoke harness, but F should hand off a working assertion that E can absorb.
6. **Escalation triggers:**
   - Root cause requires a DB schema change → escalate (schema is correct per audit).
   - Root cause requires changes that overlap any other slice's scope → escalate to coordinate.
   - Root cause is not reproducible after 30 minutes of seeded attempts → escalate with the reproduction notes; the bug may be conditional on a state the smoke seed doesn't capture.

**Definition of done:**
- A board with two status columns on the same row allows independently setting / clearing each cell. Confirmed by manual smoke and a Vitest unit test for whichever store/handler was fixed.
- The same independence holds for two columns of any other identical type (priority, person, date, …) — Slice E generalizes the regression test.
- `pnpm typecheck` and `pnpm lint` pass.

---

## Slice C — Type-aware footer aggregation + status/priority empty tile + drop `"Empty"` placeholder

**Owner:** epic-executor (sonnet)

**Branch:** `epic/16-board-remediation/c-aggregation-cells`

**Sequenced AFTER Slice A** because both touch `GroupFooter.tsx`. Slice A leaves a `FooterCell({col, groupTasks})` seam; Slice C replaces its body.

**Scope (writes):**
- `lib/cells/types.ts` — add `defaultAggregation?: AggregationKind` to `CellTypeDef`; extend `aggregate` return type to `string | AggregateRenderDescriptor`.
- **new:** `lib/cells/aggregate-descriptors.ts` — exports `AggregateRenderDescriptor` discriminated union.
- All 26 `components/cells/*/def.ts` files — add `defaultAggregation` per the table below; update each `aggregate(...)` function to return the appropriate descriptor where structured payloads apply.
- `components/board/table/GroupFooter.tsx` — call `def.defaultAggregation ?? def.aggregations[0]`; branch on `descriptor.kind` to render the right visual.
- **new:** `components/board/table/AggregateRender.tsx` — switch component painting each descriptor kind.
- `components/cells/status/Cell.tsx` — unset state renders a 1px dashed-border tile (not a filled gray block).
- `components/cells/priority/Cell.tsx` — same dashed empty-tile treatment.
- `components/cells/text/Cell.tsx`, `components/cells/long_text/Cell.tsx`, `components/cells/number/Cell.tsx`, `components/cells/currency/Cell.tsx`, `components/cells/email/Cell.tsx`, `components/cells/phone/Cell.tsx`, `components/cells/link/Cell.tsx`, `components/cells/country/Cell.tsx`, `components/cells/location/Cell.tsx`, `components/cells/rating/Cell.tsx`, `components/cells/week/Cell.tsx`, `components/cells/date/Cell.tsx` — drop the `"Empty"` placeholder; render a blank cell that still hover-affords (hover outline already present).
- **new (if needed):** `components/cells/_shared/EmptyCellTile.tsx` — dashed empty-state tile, reused by status + priority.

**Forbidden scope:** layout files in Slice A's scope; `CellEditor.tsx`; sidebar/views.

**Dependencies on other slices:** sequential after Slice A on `GroupFooter.tsx`.

**Per-type `defaultAggregation`:**

| Cell type | `defaultAggregation` |
|---|---|
| `date`, `timeline` | `range` |
| `number`, `currency`, `rating` | `sum` |
| `status`, `priority`, `tags` | `percent_by_label` |
| `person` | `count_unique` |
| `text`, `long_text`, `link`, `email`, `phone`, `country`, `location` | `count_non_empty` (rendered as `N / M`) |
| `checkbox` | `percent_checked` |
| `file` | `sum` |
| `updated_by`, `created_by`, `created_at_col`, `formula`, `vote`, `week` | keep existing `aggregations[0]` |

**`AggregateRenderDescriptor` shape:**

```ts
type AggregateRenderDescriptor =
  | { kind: "text"; value: string }
  | { kind: "count_non_empty"; nonEmpty: number; total: number }
  | { kind: "label_distribution"; segments: { labelId: string; count: number; color: string; name: string }[] }
  | { kind: "date_range"; min: string | null; max: string | null }
  | { kind: "percent_checked"; pct: number; total: number }
  | { kind: "unique_count_avatars"; count: number; userIds: string[] };
```

`aggregate(values, kind, config)` returns `string | AggregateRenderDescriptor`. String returns continue to render as plain text — existing non-footer call sites are unaffected.

**Definition of done:**
- Group footer shows: range pill for date/timeline; sum (formatted) for number/currency/rating; stacked colored bar for status/priority/tags; `N / M` for text-family; percent for checkbox; sum (count of files) for file; avatar stack + count for person.
- Status and priority cells: colored pill when set; dashed empty tile when unset.
- Text + long_text + number + currency + email + phone + link + country + location + rating + week + date cells: no `"Empty"` text placeholder.
- Vitest unit tests for each new descriptor branch in `AggregateRender.tsx`.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- A descriptor type the doc didn't anticipate (e.g. file aggregation needs an icon next to the count) — escalate with the proposed extension.

---

## Slice G — Item-detail drawer scaffold

**Owner:** epic-executor (sonnet)

**Branch:** `epic/16-board-remediation/g-item-drawer`

**Sequenced AFTER Slice A** because it adds a row-hover affordance to `TaskRow.tsx` (Slice A's file).

**Scope (writes):**
- `components/board/table/TaskRow.tsx` — add the row-hover "open updates" speech-bubble affordance (icon-button visible on row hover; positioned per `component-system.md` §2.3).
- **new:** `components/board/item-drawer/ItemDrawer.tsx` — right-side drawer using Base UI Dialog or a Sheet primitive. Tab strip: Updates, Files, Activity Log, + (add tab placeholder).
- **new:** `components/board/item-drawer/UpdatesTab.tsx` — wired to existing comments data from epic 09. Read-only first; composer can be a stub or reuse the existing composer from 09 if present.
- **new:** `components/board/item-drawer/FilesTab.tsx` — wired to existing attachments data from epic 10.
- **new:** `components/board/item-drawer/ActivityLogTab.tsx` — wired to existing activity table from epic 09. Read-only chronological list with from/to per-cell change rendering. Filter UI is a follow-up.
- **new:** `stores/item-drawer-store.ts` — Zustand store for `openItemId | null` + active tab. Reset on board navigation.
- `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` — mount `<ItemDrawer />` at the board page level so it's available across the table.

**Forbidden scope:** comments composer logic, activity log filtering, new server actions, schema changes. Read-only consumption of existing data only.

**Dependencies on other slices:** sequential after Slice A on `TaskRow.tsx`.

**Spec:**

1. Row-hover affordance: a small speech-bubble icon-button at the left of the title cell on row hover. Click opens the drawer with that item.
2. Drawer is right-anchored, ~480px wide, slides in over `--motion-base`. Sheet primitive (Base UI Dialog) is acceptable.
3. Three tabs wired to data from epics 09/10. Each tab is server-rendered if practical; client-rendered if simpler. Updates and Activity Log can show "No updates yet" / "No activity yet" empty states matching `component-system.md`'s empty-state patterns.
4. The "+" tab is a placeholder for "add custom view" — render disabled with a tooltip "Custom item views coming soon."

**Definition of done:**
- Hovering a row reveals the open-drawer affordance. Clicking opens the drawer for that item.
- Drawer shows Updates / Files / Activity Log tabs with existing data populated.
- Drawer closes via Esc / outside-click / X button.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- Existing comments / activity / files data shape is insufficient to render — escalate; do NOT add new server actions or schema in this slice.

---

## Slice E — Smoke harness + Playwright tests + seed enhancement

**Owner:** epic-executor (sonnet)

**Branch:** `epic/16-board-remediation/e-smoke`

**Sequenced LAST.** Tests are written against the finished state from A + B + C + D + F + G.

**Scope (writes):**
- **new:** `tests/e2e/board-grid-alignment.spec.ts` — pixel-position alignment test.
- **new:** `tests/e2e/cell-editor-anchor.spec.ts` — popover anchor test at 1280×800 and 1920×1080.
- **new:** `tests/e2e/workspace-sidebar.spec.ts` — sidebar shows workspace + boards.
- **new:** `tests/e2e/view-name-dedupe.spec.ts` — duplicate-view auto-suffix `(2)`.
- **new:** `tests/e2e/same-type-columns-independence.spec.ts` — regression test for Slice F. Seed two status columns on the same row; assert setting one does not change the other.
- **new:** `tests/e2e/item-drawer.spec.ts` — hover row → open drawer → switch tabs.
- `supabase/seed.sql` OR `scripts/seed-remediation-board.ts` — seed a "remediation smoke board" with at least 3 groups (3 distinct accent colors), at least 1 column of every cell type, **at least 2 status columns**, and at least 3 tasks per group with mixed values (some set, some empty).
- **new:** `docs/conversion-plan/_dispatch/epic-16-smoke-checklist.md` — manual smoke checklist for the PR author to walk through and screenshot.

**Forbidden scope:** any production code under `components/`, `lib/`, `app/`, `stores/`.

**Dependencies on other slices:** runs after all others.

**Spec:**

1. **Alignment test:** navigate to the seeded board → use `locator.boundingBox()` to read x-positions of each column header cell, every task row's nth cell, and each group footer's nth cell. Assert all three sets are equal within ±1px.
2. **Anchor test:** click a status cell at row 3 col 4 at viewport 1280×800; assert popover bounding rect overlaps the cell's bounding rect and that popover's left edge is within ±8px of the cell's left edge. Repeat at 1920×1080.
3. **Sidebar test:** load board → assert workspace switcher button contains the workspace name (not "Select workspace") → assert `BoardList` contains at least one board.
4. **View dedupe test:** create-view twice with the same name via the UI; assert the second renders as "Main table (2)".
5. **Same-type-columns independence test:** seed two status columns; set column A's cell on task 1 to "Done"; assert column B's cell on task 1 is unchanged. Repeat for any two columns of the same type.
6. **Drawer test:** hover row 1 → click open affordance → assert drawer is visible → click "Files" tab → assert files content renders → press Esc → assert drawer closes.
7. **Smoke checklist** at `docs/conversion-plan/_dispatch/epic-16-smoke-checklist.md`: every cell type to visually verify, all 3+ groups colored, footer aggregations visually correct per type, popovers anchored, sidebar populated, active tab visible, density toggle absent from primary toolbar, no `"Empty"` text in editable-value cells, two status columns set independently.

**Definition of done:**
- All six new Playwright tests pass against a local `pnpm dev` build seeded with the remediation board.
- CI is green.
- Smoke checklist file exists; PR description includes screenshots referenced from it.

**Escalation triggers:**
- Seed/runner gap that prevents the alignment test from running deterministically in CI — escalate; consider Playwright's auth-fixture pattern + RPC seeding helper.

---

## Risk notes

- **Sticky-left + CSS grid in Safari**: spec-compliant but historically brittle when the parent has `overflow-x: auto` and no explicit `width`. Slice A must verify in Safari during local smoke.
- **TanStack Virtual + `display: contents`**: virtualizer measures container heights; if Slice A makes rows `display: contents`, measurement can break. Safer pattern: each row is a grid container reading the shared template from context. The header is sticky-top above the virtualizer, not inside it.
- **`box-shadow: inset 6px 0 0 0` for the group accent stripe**: keeps headers + footers aligned because no extra track is consumed. If the inset shadow doesn't visually read as a 6px solid stripe, fall back to an absolute-positioned `::before` on the row (still avoids consuming a grid track).
- **Workspace-provider restructure (Slice D)** could ripple into auth-guarded layout boundaries. Slice D has an explicit escalation trigger.
- **File overlap A↔C on `GroupFooter.tsx`** — mitigated by sequencing C after A. Slice A leaves a `FooterCell({col, groupTasks})` seam; Slice C replaces its body.
- **File overlap A↔G on `TaskRow.tsx`** — same pattern: G sequences after A.
- **Per-group column header repeat at 20+ groups** — virtualization makes the cost free in practice but call it out in smoke perf checks.
- **`useShallow` discipline** (memory `donezo-zustand-v5-selectors.md`): the new `use-visible-columns.ts` reads `columns` and prefs from the store; the executor must wrap any fresh-array/object selector in `useShallow` or reuse existing selectors. Stated explicitly in Slice A's spec.
- **Slice F is investigation-first.** Budget reproduce → root-cause → fix → test, not blind patching. Escalate if the fix would touch DB schema.

---

## Sequential follow-ups (after slices land)

1. **Smoke pass + screenshots in PR description** — manual step after all slices merge into the epic branch, before the epic → main PR. Owned by the orchestrator/PR author, not an executor.
2. **Followup review** — `epic-researcher` reviews the merged stage against the epic doc's §"Definition of done" and authors `docs/conversion-plan/_dispatch/epic-16-followup-1.md` if anything is incomplete. **The loop repeats until the review pass returns clean** (per `CLAUDE.md` §"Workflow — one epic at a time").

---

## Key files for executor reference

- `components/board/table/BoardTable.tsx`
- `components/board/table/StickyHeader.tsx`
- `components/board/table/TaskRow.tsx`
- `components/board/table/GroupHeader.tsx`
- `components/board/table/GroupFooter.tsx`
- `components/board/table/TableVirtualizer.tsx`
- `components/board/table/group-color.ts`
- `components/board/table/types.ts`
- `components/cells/CellEditor.tsx`
- `components/cells/TableCell.tsx`
- `components/cells/status/Cell.tsx`
- `components/cells/status/Editor.tsx`
- `components/cells/status/StatusLabelEditor.tsx`
- `components/cells/priority/Cell.tsx`
- `components/cells/text/Cell.tsx`
- `components/cells/long_text/Cell.tsx`
- `lib/cells/types.ts`
- `lib/cells/registry.ts`
- All 26 `components/cells/*/def.ts`
- `app/(app)/layout.tsx`
- `app/(app)/w/[workspaceSlug]/layout.tsx`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions.ts`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions.ts`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts`
- `components/shared/sidebar/SidebarShell.tsx`
- `components/shared/sidebar/WorkspaceSidebar.tsx`
- `components/shared/sidebar/WorkspaceSwitcher.tsx`
- `components/shared/sidebar/MainSidebar.tsx`
- `lib/workspace-context.tsx`
- `stores/board-store.ts`
- `components/board/ViewTabs.tsx`
- `components/board/ViewToolbar.tsx`
- `components/board/AddViewMenu.tsx`
- `components/board/ViewTabDropdown.tsx`
- `docs/conversion-plan/16-board-remediation.md`
- `docs/conversion-plan/component-system.md` (§1.4, §2.2, §2.3, §3.3, §3.9)
- `docs/conversion-plan/design-system.md` (`--color-group-1..12`, `--motion-base`, `--color-surface-active`)
