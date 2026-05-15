I have everything I need. Now I'll produce the final dispatch plan. Given the size constraint and that the user wants a 1300-1500-line plan, I'll write a comprehensive plan as my final assistant message.

---

# Epic 07: Dynamic Column System — Dispatch Plan

**Status:** APPROVED (autonomous planning — user is asleep; user authorized self-resolution of all open questions)
**Source epic doc:** `docs/conversion-plan/07-column-system.md`
**Branch:** `epic/07-column-system` off **`epic/06-groups-tasks-table`** (current tip `ffdfa63`), NOT off `main`.
**PR target:** `main`. After epic 06 PR (#42) merges, the orchestrator MUST `git rebase --onto main epic/06-groups-tasks-table epic/07-column-system` so the PR diff narrows to epic-07 work only. The rebase happens once — before any epic-07 PR review begins.

---

## 1. Resolved decisions (autonomous)

Everything below was decided without user input per the overnight-autonomy authorization. Each line is a one-shot rationale; the user can override any of these in the morning by opening a followup spec.

- **Q1 (auto): `tags` is free-form (chosen in epic doc).** Stored as `cell.json_value = { values: string[] }`. No `tag` table. Document in code that "for typed/colored tags, use a status column" — matches epic-07 line 308–309.
- **Q2 (auto): subitems deferred** (epic doc line 436). Out of scope.
- **Q3 (auto): mirror / connect-boards / dependency deferred** (epic doc line 437). The DB `column.type` check constraint already excludes them — no schema change.
- **Q4 (auto): `formula` ships as a registered cell type with a "—" renderer + tooltip "coming soon"**. The DB schema does NOT include `formula` in the `column.type` check constraint (verified). Epic 07 ships a migration that adds `'formula'`, `'vote'`, `'week'`, `'location'` to the type check constraint (so the registry's `CellTypeId` union and the DB are consistent). Rationale: the epic doc lists 24 cell types in the registry; the DB currently allows 17. Either we trim the registry or we extend the constraint. The doc says "the type id is stable from day one" (line 313) — extend the DB. One single migration in slice S0.
- **Q5 (auto): number column suffix is a `config.suffix` field, NOT a separate "%" type** (matches epic doc recommendation line 440).
- **Q6 (auto): `location` is manual-input (lat/lng + optional label)** (matches epic doc line 441). Mapbox integration deferred to a future epic.
- **Q7 (auto): `week` ships in v1** (matches the epic doc's full registry; smallest deviation from the spec).
- **Q8 (auto): aggregations are board-level for v1** — no per-group override. The "preview only" group-by support epic doc mentions for the test scenario means the aggregation is computed inline per visible group on the client. No `view.config` aggregation override in this epic (defer to epic 11).
- **Q9 (auto): default seed labels for status (5+empty) and priority (4+empty) per epic-07 visual fidelity table** are added to `supabase/seed.sql` AND a backfill helper that the `createColumn` server action calls when `type === 'status' || type === 'priority'`. The table already has `Working on it / Done / Stuck` for the demo board — the seed is extended to add the missing two status labels (Waiting for review, Pending) and a priority column with its 4 labels. Empty-state pseudo-label is rendered via `--color-label-gray` when `cell.label_id is null`; no DB row needed for "empty".
- **Q10 (auto): "Apply column value" bulk action lights up in this epic.** Wired through `bulkSetCellValue({ taskIds, columnId, value })` per epic doc line 341. The button in `<BulkActionBar />` opens a column picker (only `status`, `person`, `date`, `checkbox`, `text`, `number`, `currency`, `priority`, `rating` — types whose value can be sensibly bulk-set) and dispatches the action.
- **Q11 (auto): Tiptap is NOT installed for `long_text` in this epic.** `long_text` ships as a multi-line `<textarea>` editor + plain string storage in `text_value`. Tiptap integration deferred to epic 09 (comments are the primary Tiptap consumer; doing it twice is wasteful). The `defaultConfig.richText` flag is registered as `false` for v1; when Tiptap lands, flipping it to `true` will swap the editor.
- **Q12 (auto): `country` cell uses a static ISO 3166 alpha-2 list, no flag SVG library.** Display as `[XX] Country Name`. Adding a flag library is deferred (epic 14 polish).
- **Q13 (auto): `file` cell ships as a stub** that links out to the Updates tab → "files coming in epic 10" message + the cell renders attachment count from a future `attachment` join. For epic 07, `<FileCell />` reads `cell.json_value.attachmentIds: string[]`, renders a clickable count badge that opens the task drawer (placeholder route), and the editor is disabled with a "Coming in epic 10" tooltip. This keeps the registry honest without faking storage. Rationale: the epic doc itself defers file uploads to epic 10 (line 287).
- **Q14 (auto): cell editor uses Base UI `<Popover>` (not `Dialog`) for popover-based editors** (status, person, date, timeline, link, tags, week, location). Inline editors (text, long_text, number, currency, email, phone, country, rating, checkbox) render directly inside the cell. Per the spec's "single `<CellEditor />` orchestrator" — orchestrator dispatches to popover-vs-inline based on `def.editorMode: "inline" | "popover"`.
- **Q15 (auto): column reorder uses dnd-kit `horizontalListSortingStrategy`** (already installed). Matches the epic doc (line 410).
- **Q16 (auto): column resize is per-user, persisted to localStorage in this epic** (NOT to `view.config` — that lands in epic 11). Storage key `donezo:column-widths:v1`, partitioned by `boardId`. Same `persist` middleware pattern as `collapsedByBoard`. When epic 11 ships saved views, a follow-up will migrate the localStorage entries into `view.config`. Documented for the epic-11 planner.
- **Q17 (auto): column visibility is hidden-vs-visible boolean per-user**, persisted to the same `donezo:column-widths:v1` localStorage key (one map: `Record<boardId, Record<columnId, { width?: number; hidden?: boolean }>>`). Migration to `view.config` deferred to epic 11.
- **Q18 (auto): change-type with a destructive conversion (e.g., `status → number` losing all values) shows a Base UI `<Dialog>` confirm with a typed-name pattern matching the epic-05 `BoardDeleteConfirmModal` reference**. No `window.confirm` (guardrail #8).
- **Q19 (auto): activity payload format for `task.cell_changed` matches the epic doc exactly** — `{ columnType, from, to }` where `from`/`to` are the registry-typed values (NOT the raw `cell` row). The activity feed renderer in epic 09 reads through the cell registry's `def.Cell` to render compact diffs.
- **Q20 (auto): `bulkSetCellValue` writes one row per `(taskId, columnId)` via `supabase.from("cell").upsert([...])` in a single batch insert** — not row-by-row. The cell PK is composite `(task_id, column_id)`, which Supabase upsert handles natively with `onConflict: "task_id,column_id"`. Single roundtrip for up to N tasks. Rejects mixed-board input (same safety check as epic 06's bulk task actions).
- **Q21 (auto): `<TableScrollContext>` and `<TableKeyboardContext>` are extended (NOT replaced) to include cell-level focus**. New context value adds `focusCell(taskId, columnId): void`. The keyboard nav controller learns ArrowLeft / ArrowRight to move between cells in a row. Cells register their refs analogously to how `TaskTitleCell` and `GroupHeaderRow` do today.
- **Q22 (auto): generated types currently have `column.settings` (not `config`) and `column.name` (not `title`).** Epic 07 server actions and the registry MUST use `settings` + `name` everywhere. The epic doc's prose uses `config` and `title` — that's the doc, not the schema. **Schema wins.** Where the doc says `config: jsonb`, code reads/writes `settings: jsonb`. Where the doc says `column.title`, code reads/writes `column.name`. Document this remapping at the top of `lib/cells/types.ts`.
- **Q23 (auto): aggregations render in a per-group footer row, NOT in a separate table footer**. The footer row is a new `RowEntry` kind: `"group-footer"`. Sits between `task` rows and `add-task-footer` per group. Height 36px. Renders one cell per visible column with the column's default aggregator output. Reuses the cell skeleton chrome.
- **Q24 (auto): `priority` shares the status implementation entirely** — same renderer, same editor, same label-id-backed value codec. The only difference is the seed label set. The registry registers `priority` as `def.id = "priority"` but with `Cell = StatusCell`, `Editor = StatusLabelEditor` (same components, different id). No `<PriorityCell />` file — duplication is anti-DRY. Epic doc doesn't require separate components.
- **Q25 (auto): `created_by`, `updated_by`, `created_at_col` are read-through derived cells**. Editor is disabled (no popover opens). `def.toRow` returns `{}` (no-op, never writes). `def.fromRow` reads from a parent-task projection passed via the cell renderer's `row` prop. The renderer reads `row.created_by`, `row.updated_by`, `row.created_at`, `row.updated_at` and the workspace-member profiles (cached by epic 05 in workspace context).
- **Q26 (auto): RLS for label INSERT/UPDATE/DELETE in the live migration is `>= admin`, NOT `>= member`** (verified in `supabase/migrations/20260507120100_rls_policies.sql`). The epic doc text suggests `>= member to add status options` but the migration enforces admin. Epic 07 ships with the **admin gating** (the migration is the source of truth). The "Add label" + "Edit Labels" UX path in the StatusLabelEditor is gated on `role >= admin`; for `member` users the buttons are disabled with a "Admins can edit labels" tooltip. If the user wants `member`-level label editing, they'll open a followup that includes a migration to relax the policy.
- **Q27 (auto): cell editor "Esc cancels" semantics are strict**: Esc reverts the editor's local state to the persistent value and closes the popover/inline editor WITHOUT firing the server action. "Enter saves" and "blur saves" fire the action with the new value. This matches the epic doc line 196 and the existing `<EditableTitle>` pattern.
- **Q28 (auto): cell-type icons come from `lucide-react`**. Mapping table in `lib/cells/icons.ts` → `text: Type`, `long_text: AlignLeft`, `status: Circle`, `priority: AlertCircle`, `person: Users`, `date: Calendar`, `timeline: BarChart2`, `number: Hash`, `currency: DollarSign`, `checkbox: CheckSquare`, `file: Paperclip`, `link: Link`, `tags: Tags`, `rating: Star`, `email: Mail`, `phone: Phone`, `country: Globe`, `vote: ThumbsUp`, `week: CalendarDays`, `location: MapPin`, `updated_by: UserCheck`, `created_by: UserPlus`, `created_at_col: Clock`, `formula: Function`. Each `def.icon = lucide<Name>`.
- **Q29 (auto): `column.duplicate` copies type, settings, and labels (for status/priority); does NOT copy cell values per the epic doc (line 218).** Server action: `duplicateColumn({ columnId })`. Inserts new column + (for label-backed columns) duplicates the labels.
- **Q30 (auto): column-header sort dropdown only updates a board-local `sortColumnId` UI state in the Zustand store**, no DB write. Persistence of sort order lands in epic 11. Why: epic 11 owns "saved views"; doing per-user sort in epic 07 would create a localStorage entry that epic 11 must migrate. Epic 07 ships sort as ephemeral (tab close → forgets).
- **Q31 (auto): column header dropdown's "Filter" item opens a disabled-with-tooltip placeholder — "Coming in epic 11"**. Same precedent as `<AddColumnButton />` in epic 06.
- **Q32 (auto): `lib/cells/registry.ts` is statically populated**. No dynamic `import()`; the bundle includes every cell type's editor/renderer. Lazy editor mounts (epic doc line 348) are achieved via React's `<Suspense>` + per-editor `React.lazy` only for the heaviest editors (`timeline` dual calendar, `tiptap`-when-it-lands). For v1, the simpler "everything is statically imported" path ships first; lazy-loading is a perf followup if profiling demands.
- **Q33 (auto): when changing a column from `status → text` and an existing cell has `label_id != null`, the conversion writes the label's `name` to `text_value` and nulls `label_id`**. Conversion is implemented in `convertTo` per the epic doc line 230. This is per-row in the server action, not a single SQL `update` (which would require a join + per-row label lookup).
- **Q34 (auto): the `<CellEditor />` orchestrator handles optimistic update + server action + rollback ONCE**. Per-type editors emit `onChange(value)` and `onClose()` only; the orchestrator is responsible for `applyCellUpsert` + `setCellValue` + revert. This keeps per-type editors thin (matches the epic doc line 200–202).
- **Q35 (auto): cell value codec `def.toRow(value)` MUST explicitly null all other value columns** (per epic doc line 187 — "other value columns must be explicitly nulled to clear stale values when the type was just converted"). E.g. `text.toRow("hello") → { text_value: "hello", number_value: null, boolean_value: null, date_value: null, date_end_value: null, json_value: null, label_id: null }`. The `cell_one_value_check` constraint enforces it at the DB level too.

---

## 2. Preconditions verified

Confirmed by reading the actual repo state on `epic/06-groups-tasks-table` (tip `ffdfa63`).

### Schema & RLS

- **`public."column"`** exists with columns: `id`, `board_id`, `name` (NOT `title`), `type` (text + check constraint listing 17 types — see below), `position numeric`, `settings jsonb default '{}'::jsonb` (NOT `config`), `created_at`, `updated_at`. NO `is_pinned`, NO `deleted_at` (columns are hard-deleted). Index: `column_board_pos_idx (board_id, position)`. Trigger: `column_set_updated_at`.
- **`column.type` check constraint** allows exactly: `text, long_text, status, priority, person, date, timeline, number, currency, checkbox, file, link, tags, rating, created_at_col, updated_by, created_by`. **DOES NOT include**: `email, phone, country, vote, week, location, formula`. **Epic 07 must extend the check constraint** (resolved decision Q4) before the registry can ship those types. Single new migration in S0.
- **`public.label`** exists: `id`, `column_id` (FK with `on delete cascade`), `name` (NOT `title`), `color text not null`, `position numeric`, `created_at`, `updated_at`. No uniqueness constraint on `(column_id, name)`.
- **`public.cell`** PK is `(task_id, column_id)`. Polymorphic value columns: `text_value`, `number_value`, `boolean_value`, `date_value`, `date_end_value`, `label_id`, `json_value`. Constraint `cell_one_value_check`: `num_nonnulls(text_value, number_value, boolean_value, date_value, label_id, json_value) <= 1` (`date_end_value` is the auxiliary timeline-end and not counted). The constraint allows `<= 1` (i.e., zero or one), so an empty cell is valid and equals "all value columns null."
- **RLS policies (live in `20260507120100_rls_policies.sql`):**
  - `column_select`: any role on the board.
  - `column_insert / update / delete`: `>= admin` (NOT member). Epic 07 server actions must call `requireBoardRole(boardId, "admin")`.
  - `label_select`: any role.
  - `label_insert / update / delete`: `>= admin` (NOT member, per resolved decision Q26).
  - `cell_select`: any role.
  - `cell_modify` (`for all`): `>= member`.
- **Realtime publication** already includes `cell` and `column` (from the initial schema, line 466–469). Epic 08 owns subscriptions; epic 07 only needs to ensure the store's `applyCellUpsert` accepts a Realtime payload of the same shape.

### TypeScript types

- `lib/supabase/types.ts` includes `Database['public']['Tables']['column'].Row` with `name`, `settings`, `type` typed as the check-constraint union. After the S0 migration, `pnpm db:types` MUST be run; the union must extend to include `'email' | 'phone' | 'country' | 'vote' | 'week' | 'location' | 'formula'` so the registry compiles.
- `Database['public']['Tables']['cell'].Row` matches the polymorphic shape. `Database['public']['Tables']['label'].Row` exposes `name + color + position + column_id`.

### Existing components & infrastructure

- **`components/board/table/StickyHeader.tsx`** has a single hard-coded "Name" header + `<AddColumnButton />` (disabled, "Coming in epic 07" tooltip). Epic 07 must replace this with a dynamic header row that maps over `columns` and adds a header per visible column.
- **`components/board/table/TaskRow.tsx`** renders only the title cell (`<TaskTitleCell>`). Epic 07 must add a per-column cell render slot inside the row, after the title cell.
- **`components/board/table/AddColumnButton.tsx`** is a disabled tooltip stub. Epic 07 must replace it with a functional button that opens the `<AddColumnModal />`.
- **`page.tsx`** already loads `columns` (and `cells`) from the DB and passes them in `initial.columns` and `initial.cells` to `<BoardTable>`. Epic 07 just needs to USE them.
- **`<BoardTable />`** already hydrates the store with `cells` (Map keyed by `${taskId}:${columnId}`). The store has `applyCellUpsert(cell)` (idempotent on `updated_at`). Epic 07 wires the optimistic write path through it.
- **`stores/board-store.ts`** does NOT currently track `columns`. Epic 07 must add `columns: Column[]` to the state, plus `applyColumnUpsert`, `applyColumnDelete`, `applyColumnReorder` (compatible with future Realtime) and `applyLabelUpsert`, `applyLabelDelete`.
- **`lib/cells/.gitkeep`** exists; the registry directory is a placeholder.
- **`components/cells/{text,status,person,date}/`** exist as empty directories. Epic 07 fills these out plus adds `long_text`, `priority`, `timeline`, `number`, `currency`, `checkbox`, `file`, `link`, `tags`, `rating`, `email`, `phone`, `country`, `vote`, `week`, `location`, `updated_by`, `created_by`, `created_at_col`, `formula`.
- **`lib/actions/with-user.ts`** + `requireBoardRole` from epic 04 are reused unchanged.
- **`lib/activity.ts`** has `logActivity` + the `ActivityType` union. Epic 07 extends the union to add: `column.created`, `column.renamed`, `column.reordered`, `column.duplicated`, `column.type_changed`, `column.deleted`, `column.settings_updated`, `label.created`, `label.renamed`, `label.recolored`, `label.reordered`, `label.deleted`, `cell.changed`, `cell.bulk_changed`. Single small additive change.
- **`<EditableTitle>`** already has the imperative `focus()` ref API from epic 06 S14. Reusable for column-header rename in this epic (no need to touch the primitive).
- **`<MenuList />`** + Base UI `<Popover>` / `<Dialog>` / `<Menu>` / `<Tooltip>` / `<Checkbox>` / `<Slider>` (for rating?) all available.
- **No Tiptap installed.** Per Q11, defer.
- **No `react-day-picker` installed.** The `date` cell's calendar uses Base UI's `<Popover>` + a hand-rolled month grid for v1 (per Q12 / epic-07 line 286 says "shadcn Calendar / react-day-picker" — choose hand-rolled to avoid pulling in a 100KB dep for one cell type). If the executor needs `react-day-picker`, escalate.

### Tokens (`app/globals.css`)

- `--color-label-green: #00c875`, `--color-label-yellow: #ffcb00` (NOT `#fdab3d`!), `--color-label-blue: #579bfc`, `--color-label-gray: #c4c4c4`, `--color-label-red: #e2445c`, `--color-label-purple: #a25ddc` — present.
- The seed labels currently use `#fdab3d` for "Working on it" but the token registry has `--color-label-yellow: #ffcb00`. The epic-07 visual fidelity table says `#FDAB3D` for "Working on it" and `#FDAB3D` for Priority "Medium". **There's a token mismatch.** The visual fidelity table values (`#FDAB3D`, `#A25DDC`, `#579BFC`, `#00C875`, `#E2445C`, `#C4C4C4`, `#333333`) are the binding source. Epic 07 ships:
  - A new token `--color-label-orange: #fdab3d` in `app/globals.css` for the "Working on it" / Medium-priority swatch.
  - A new token `--color-label-black: #333333` for the Critical-priority swatch.
  - Existing seed `#fdab3d` value stays as-is (matches the visual spec). The mismatch was a one-off in `--color-label-yellow` which is unused by status labels in the seed.
- `--color-group-1` … `--color-group-12` present.
- `--size-cell-h: 36px`, `--size-cell-w: 140px`, `--size-cell-w-task: 336px` present.
- `--motion-fast/base/medium/slow/drawer` present.
- `--shadow-modal`, `--shadow-bulk-bar` present.
- **No `--motion-fold-reveal` token.** The epic-07 spec calls for the diagonal status-fold animation with `transition-delay: .2s`. Add a new token `--motion-fold-delay: 0.2s` in `app/globals.css` as part of the S0 token-extension slice.

### Seed labels

- `supabase/seed.sql` currently has 3 status labels (`Working on it / Done / Stuck`) on the demo board's status column. Epic 07's visual fidelity spec requires 5 status labels + 4 priority labels (per the table at epic-07 lines 376–390). Slice S0 extends the seed to:
  - Add `Waiting for review (#a25ddc)` and `Pending (#579bfc)` to the existing status column.
  - Add a new `Priority` column (type `priority`, position 6) on the demo board.
  - Add 4 priority labels: `Critical (#333333)`, `High (#e2445c)`, `Medium (#fdab3d)`, `Low (#579bfc)`.
- The "(empty)" pseudo-label at `#c4c4c4` is rendered by the `<StatusCell />` when `cell.label_id is null` — no DB row.

### Routes & layout

- The board route layout (`app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`) wraps `{children}` in `<div className="flex flex-col h-full min-h-0">` + inner `<div className="flex flex-col flex-1 min-h-0 overflow-hidden">` (per epic-06 followup F3.1). This layout chain MUST NOT be touched in epic 07 — it's the contract that makes virtualization work.
- `<BoardHeader />` and `<BoardViewTabs />` are RSC siblings of `{children}`; epic 07 must not change them.

### Known deps installed (from package.json)

- `@base-ui/react ^1.4.1`, `@dnd-kit/core / sortable / utilities`, `@tanstack/react-table`, `@tanstack/react-virtual`, `lucide-react`, `react-hook-form`, `zod ^4`, `zustand ^5`, `sonner`, `@hookform/resolvers`. Everything epic 07 needs is already in the lockfile.

### Tests

- No Vitest / Playwright runner installed (deferred to epic 15). Same `describe.skip` + `// @ts-expect-error vitest is wired in epic 15` precedent applies.
- pgTAP not installed (deferred to epic 15). Any new RLS coverage epic 07 wants to add lands as `tests/policies/*.sql` files with notes; CI wires later.

---

## 3. Guardrails from prior epics

Carry forward the 28 guardrails distilled in `_dispatch/epic-06.md` §2. Plus the new lessons specific to epic 06's execution:

**Carry-forward (epic 06 list — reapplies as-is):**

1. Zero raw hex/rgba in `.tsx`/`.ts` shipping code. Token definitions in `app/globals.css` only. (NB: `lib/cells/icons.ts` and per-type seed-label constants are exceptions where palette identifiers must live in TS — same precedent as `lib/group-palette.ts`.)
2. No `var(--color-X, ...)` references to undefined tokens. Verify the token exists before consuming.
3. No raw Tailwind color-scale classes. Use semantic tokens.
4. Group accent colors come from `--color-group-1 … 12`.
5. Use Base UI primitives, not raw HTML. `<MenuList />` for menus.
6. Reuse, don't reinvent. `EditableTitle`, `MemberStack`, `Avatar`, `MenuList`, `Button`, `Input` already exist.
7. Cells are referenced by short string id per CLAUDE.md.
8. No `window.confirm` in new code. Use Base UI `<Dialog>` confirm with typed-name pattern.
9. All mutations go through Server Actions wrapped in `withUser`.
10. One Zod schema validates client and server.
11. No client-generated ids. Postgres `gen_random_uuid()` only. Optimistic rows that need a temp id use `tempId: string`.
12. `router.refresh()` after mutations that change RSC-rendered data; Zustand-driven UX in-place edits do NOT need refresh.
13. Soft-delete only (where applicable). Columns and cells are HARD-deleted (no `deleted_at` in their schema). Labels also hard-delete. The "soft-delete only" rule applies to `workspace`, `board`, `group`, `task` and only those.
14. Server actions return updated rows or a minimal diff.
15. No `as any` casts. `// @ts-expect-error` with rationale comment is acceptable when the generated type is wrong/lagging (e.g., the `column.type` enum doesn't include the new types until `pnpm db:types` runs).
16. RLS is the source of truth.
17. Role gating must match the spec exactly. **For epic 07: column + label CRUD = `>= admin`. Cell write = `>= member`.**
18. Don't conflate board-owner with workspace-owner.
19. Reserved words `"group"` and `"column"` are double-quoted in raw SQL. In Supabase JS client, `supabase.from("column")` is correct.
20. Don't write `task.board_id` explicitly. The `task_board_id_consistency` BEFORE INSERT/UPDATE OF group_id trigger handles it. **Same applies to cell upserts** — the cell's `task_id` is the source of truth; do not duplicate `board_id` anywhere on `cell`.
21. Migration filenames `YYYYMMDDHHMMSS_description.sql`, monotonically increasing. Epic 07 needs **exactly one** new migration (extends `column.type` check constraint per Q4).
22. `pnpm db:types` runs after every migration, never hand-edit `lib/supabase/types.ts`.
23. `"use client"` only when interactivity demands it. The board page (`page.tsx`) stays RSC. Cell renderers and editors are client. The cell-type registry itself (`lib/cells/registry.ts`) is shared client+server (no React hooks at module scope) so the activity feed renderer in epic 09 (RSC) can read it too.
24. Hooks at the top level of components.
25. No callsite stubs for in-scope features. Acceptable stubs: `<Filter>` menu item ("Coming in epic 11"), `<FileCell />` editor ("Coming in epic 10"), formula renderer ("—" + tooltip).
26. **File-scope boundaries are non-negotiable.** Two parallel slices may not edit the same file. Cross-slice handoffs use shared file scope only via sequencing.
27. No edits to legacy `frontend/` or `backend/`.
28. `pnpm` only.

**New lessons specific to epic 06's execution (bake into epic 07):**

29. **Layout-chain virtualization gotcha.** Any flex parent that isn't `flex flex-col h-full min-h-0` will collapse the virtualizer. Epic 07 must NOT touch the board route's layout chain (`app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`). Specifically: the dynamic column-header and per-column cell additions must stay inside the existing `<TableVirtualizer />` container — no new wrapper div with `overflow: auto` between the virtualizer and the rows. The virtualizer is the only scroll surface.
30. **Orphaned-component cleanup pattern.** When a slice replaces a previous component (e.g., S7 replacing the placeholder `<TaskTitleCell>` with cell-registry-driven cells, IF that ever happens), delete the orphan in the same commit. Do NOT leave dead files behind for "the next slice."
31. **`// @ts-expect-error` for trigger-set columns — same pattern.** Epic 07 won't write `task.board_id`, but the cell's value codec `toRow()` returns `Partial<CellRow>` and the upsert call may have a type mismatch on the always-required composite-PK fields if `pnpm db:types` was run before the S0 migration. The pattern: `// @ts-expect-error: task_board_id_consistency trigger / generated-types lag` with a specific rationale.
32. **localStorage persist + SSR pattern.** Same as the `collapsedByBoard` pattern in epic 06. New persisted slice: `columnPrefsByBoard: Record<boardId, Record<columnId, { width?: number; hidden?: boolean }>>`. SSR-safe via `createJSONStorage(() => (typeof window === "undefined" ? noopStorage : localStorage))`. Partialized to that one field. Storage key `donezo:column-prefs:v1`.
33. **`applyTaskUpsertReplaceTemp` temp-id swap pattern.** Same model for cells: a server action that creates a NEW cell row (rare — most cell writes are upserts on a stable composite key, so no temp-id needed). For column CREATE, however, a temp-id swap IS needed (`createColumn` returns a real id that replaces the optimistic temp-id). Implement `applyColumnUpsertReplaceTemp(tempId, real)` in the store — symmetric to `applyTaskUpsertReplaceTemp`.
34. **Single-board safety check on bulk operations.** `bulkSetCellValue({ taskIds, columnId, value })` must derive a single `boardId` from the task list (mirror epic-06 `bulkDeleteTasks` pattern). Reject mixed-board input with `{ code: "VALIDATION", message: "Tasks span multiple boards" }`. Also verify that the `columnId` belongs to the same board (rejects "set status on a column from a different board" — RLS would block it anyway, but a friendly error is better).
35. **Borderline-no-op-stub-as-deferred-handoff pattern.** The `<Filter>` and `<FileCell editor>` items render a Base UI `<Tooltip>` with text like "Coming in epic 11" / "Coming in epic 10". They are visible UI but never fire a server action or toast lie. Per epic-06 followup-3 reasoning, this is acceptable for cross-epic handoffs explicitly named in the epic doc. Bake into S6 / S11 specs.
36. **Hydrate-effect deps must be `[boardId]` only.** Same precedent as epic-06 followup-2. The store hydration is a one-time mount-time operation. If epic 07 needs to add new fields to `hydrate({ ... })` (it does — `columns`), the deps array stays `[boardId]`. The new bootstrap data flows through the same `initial` prop and is consumed once.
37. **Cell write/realtime contract.** `applyCellUpsert(cell)` is the ONLY path that mutates cells in the store. Both server-action results and Realtime echoes (epic 08) feed it. Idempotency on `updated_at` is the safety. Epic 07's `setCellValue` server action returns the full `cell` row; the orchestrator calls `applyCellUpsert(result.data)` after success (or reverts on failure).
38. **Reserved-word "column" in Supabase JS client.** `supabase.from("column")` works; no quoting needed in client code. Same for `"group"`.
39. **Column type union mismatch with generated types.** After the S0 migration extends the check constraint, `pnpm db:types` MUST run before any slice that imports `Database['public']['Tables']['column'].Row` and pattern-matches on `type`. If a slice ships before db:types regenerates, the union won't include the new types and the registry won't compile. Sequencing rule: S0 ships first, alone, with the `pnpm db:types` step in its DoD.
40. **Aggregation values are strings.** `def.aggregate` returns `string` (not `number`) per the epic-doc interface. Implementations format numbers, percentages, ranges as display-ready strings. This keeps the group-footer renderer trivial.

---

## 4. Slice plan

The epic decomposes into **six stages**. Each stage's slices are parallel-safe by file scope; the orchestrator runs the `epic-researcher` review after each stage and dispatches followups before moving on.

### Sequencing diagram

```
Stage 0 — schema + tokens + seed (1 slice, alone, BLOCKING):
  S0. Migration (extend column.type), token additions, seed labels, db:types regen, ActivityType union extension
       ↓ stage 0 review

Stage 1 — registry foundations (parallel: 4 slices, disjoint files):
  S1. lib/cells/types.ts + lib/cells/icons.ts + lib/cells/registry.ts (skeleton, empty stubs)
  S2. lib/validations/column.ts + lib/validations/cell.ts + lib/validations/label.ts
  S3. stores/board-store.ts (extend with columns + applyColumn* + applyLabel* + columnPrefsByBoard)
  S4. lib/cells/aggregations.ts + lib/cells/filter-operators.ts + lib/cells/conversions.ts (helpers used by per-type defs)
       ↓ stage 1 review

Stage 2 — server actions (parallel: 3 slices, disjoint files):
  S5. app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions.ts (column + label CRUD + change-type + duplicate)
  S6. app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts (setCellValue + bulkSetCellValue)
  S7. app/(app)/w/[workspaceSlug]/b/[boardId]/labels/actions.ts (label CRUD: create / rename / recolor / reorder / delete)
       ↓ stage 2 review

Stage 3 — cell-type implementations (parallel: 7 slices, disjoint folders):
  S8.  components/cells/{text,long_text,email,phone,country,link}/    (Group A — text-y, 6 types)
  S9.  components/cells/{number,currency,rating,checkbox}/             (Group B — numeric, 4 types)
  S10. components/cells/{status,priority}/ + StatusLabelEditor          (Group C — label-backed, 2 types)
  S11. components/cells/{person,date,timeline,week}/                    (Group D — people/time, 4 types)
  S12. components/cells/{tags,vote,file}/                                (Group E — collection, 3 types)
  S13. components/cells/{updated_by,created_by,created_at_col,location}/ (Group F — derived/special, 4 types)
  S14. components/cells/formula/                                         (Group G — stub, 1 type)
       ↓ stage 3 review (mass)

Stage 4 — orchestration + headers + add-column modal (parallel: 4 slices, disjoint files):
  S15. components/cells/CellEditor.tsx + components/cells/TableCell.tsx (orchestrator + render dispatcher)
  S16. components/board/table/AddColumnModal.tsx + AddColumnButton (replace stub)
  S17. components/board/table/ColumnHeader.tsx + ColumnHeaderMenu.tsx + LabelEditorModal.tsx
  S18. components/board/table/ColumnReorder.tsx + ColumnResize.tsx (dnd-kit horizontal + drag-resize handle)
       ↓ stage 4 review

Stage 5 — wiring into BoardTable + StickyHeader + TaskRow + group footer + bulk apply (sequential within shared files):
  S19. components/board/table/StickyHeader.tsx (replace single Name with dynamic columns)
  S20. components/board/table/TaskRow.tsx + BoardTable.tsx renderRow (wire per-column TableCell)
  S21. components/board/table/GroupFooter.tsx (new RowEntry kind "group-footer" + aggregation render)
  S22. components/board/table/BulkActionBar.tsx (wire "Apply column value" to bulkSetCellValue)
       ↓ stage 5 review

Stage 6 — tests + perf + docs (parallel: 3 slices):
  S23. tests/unit/{cell-codecs,cell-aggregations,cell-conversions,column-actions,cell-actions}.test.ts
  S24. tests/e2e/07-column-system.spec.ts (test.skip stubs per epic-15)
  S25. docs/conversion-plan/07-column-system.md (NO changes — read-only); README in components/cells/ documenting how to add a new cell type
       ↓ epic-level review → PR
```

---

### Slice S0 — Schema, tokens, seed, types regen, ActivityType extension

**Owner:** epic-executor (sonnet) · **Stage 0, alone (BLOCKING — no parallelism).**

**Files (only):**
- `supabase/migrations/<TS>_extend_column_type_check.sql` (create)
- `supabase/seed.sql` (modify — extend status labels + add Priority column + priority labels)
- `app/globals.css` (modify — add `--color-label-orange: #fdab3d`, `--color-label-black: #333333`, `--motion-fold-delay: 0.2s`)
- `lib/supabase/types.ts` (regenerated by `pnpm db:types` — DO NOT hand-edit)
- `lib/activity.ts` (modify — extend `ActivityType` union with new types)

**Forbidden scope:** any other file. No registry, no server actions, no components. This slice is the schema/seed/token foundation only.

**Spec:**

1. **Migration.** Create `supabase/migrations/<TS>_extend_column_type_check.sql` with:
   ```sql
   alter table public."column" drop constraint if exists column_type_check;
   alter table public."column" add constraint column_type_check check (type in (
     'text','long_text','status','priority','person','date','timeline',
     'number','currency','checkbox','file','link','tags','rating',
     'email','phone','country','vote','week','location',
     'updated_by','created_by','created_at_col','formula'
   ));
   ```
   The constraint name is taken from the live schema's anonymous check (verify with `supabase db inspect` or by reading the initial migration). If the constraint has a different generated name, find it via `\d+ public."column"` in psql. The migration is a drop+recreate; safe because it's a strict superset of the existing constraint (no existing rows are invalidated).

2. **Run `pnpm db:reset` then `pnpm db:types`** to regenerate `lib/supabase/types.ts`. The `column.type` union must now include 24 string literals. Verify by grepping `grep -c "'formula'" lib/supabase/types.ts` returns `>=1`.

3. **Seed extensions.** In `supabase/seed.sql`:
   - Add two `insert into public.label` rows for the existing status column `55555555-5555-5555-5555-555555555502`:
     - `Waiting for review`, `#a25ddc`, position 4
     - `Pending`, `#579bfc`, position 5
   - Add a new column on the demo board: `id = 55555555-5555-5555-5555-555555555506`, `name = 'Priority'`, `type = 'priority'`, `position = 6`.
   - Add 4 priority labels for column `...555506`:
     - `Critical`, `#333333`, position 1, id `66666666-6666-6666-6666-666666666701`
     - `High`, `#e2445c`, position 2, id `66666666-6666-6666-6666-666666666702`
     - `Medium`, `#fdab3d`, position 3, id `66666666-6666-6666-6666-666666666703`
     - `Low`, `#579bfc`, position 4, id `66666666-6666-6666-6666-666666666704`
   - All inserts use `on conflict (id) do nothing` per the existing pattern.

4. **Token additions** in `app/globals.css` (locate by `--color-label-purple` line and add after the label-color block):
   ```css
   --color-label-orange: #fdab3d;
   --color-label-black: #333333;
   --motion-fold-delay: 0.2s;
   ```
   These three tokens are new. Document their purpose in a one-line CSS comment each.

5. **`ActivityType` union extension** in `lib/activity.ts`. Add to the union (in the order they fire):
   ```ts
   | "column.created"
   | "column.renamed"
   | "column.reordered"
   | "column.duplicated"
   | "column.type_changed"
   | "column.deleted"
   | "column.settings_updated"
   | "label.created"
   | "label.renamed"
   | "label.recolored"
   | "label.reordered"
   | "label.deleted"
   | "cell.changed"
   | "cell.bulk_changed"
   ```
   The DB `activity.type` column is unconstrained text; this is a TS-only union. No migration needed.

**Definition of done:**
- Migration applies cleanly to the local Supabase DB (`pnpm db:reset` succeeds without error).
- `pnpm db:types` regenerates `lib/supabase/types.ts` with the extended `column.type` union.
- The `column.type` union literally includes `'email' | 'phone' | 'country' | 'vote' | 'week' | 'location' | 'formula'` (verified by grep).
- `supabase/seed.sql` re-runs idempotently (`pnpm db:reset` succeeds twice in a row).
- `app/globals.css` includes the three new tokens; the file has no other changes.
- `lib/activity.ts`'s `ActivityType` union includes the 14 new entries.
- `pnpm typecheck` and `pnpm lint` pass clean.
- ZERO changes to any other file.

**Escalation triggers:**
- If `supabase db reset` fails after the migration, escalate. Don't silently rename the constraint or change its definition.
- If the existing constraint is named something other than `column_type_check`, document the actual name in the done report; don't guess. Use `supabase db diff --schema public` to inspect.

**Guardrails applied:** #1 (no raw hex outside `app/globals.css` — all hex values for new tokens go in CSS, not TS), #21 (migration timestamp), #22 (types are regenerated, not hand-edited).

---

### Slice S1 — Cell registry types + icons + skeleton

**Owner:** epic-executor (sonnet) · **Stage 1, parallel-safe with S2/S3/S4.**

**Files (only):**
- `lib/cells/types.ts` (create)
- `lib/cells/icons.ts` (create)
- `lib/cells/registry.ts` (create — skeleton with empty stubs for every type)

**Forbidden scope:** any other file. No per-type defs (those land in stages 3). No server actions. No components.

**Spec:**

1. **`lib/cells/types.ts`** — define the contract per the epic doc lines 53–104, with these adaptations:
   - Use `name` not `title` for `CellTypeDef.label` (which is the human-readable type name like "Status", not the column name).
   - Add a doc comment at the top:
     ```ts
     /**
      * Cell type registry — the contract for every cell type in the product.
      *
      * Schema mapping note: the DB calls the column-config field `settings`
      * (not `config`), and the column's user-visible name is `column.name`
      * (not `column.title`). The registry's `TConfig` generic corresponds to
      * `column.settings`. The CellTypeDef's `label` is the human name shown
      * in the add-column type picker, not the column instance's name.
      */
     ```
   - `CellRow` matches the generated `Database['public']['Tables']['cell'].Row` exactly. Re-export, don't redefine:
     ```ts
     import type { Database } from "@/lib/supabase/types";
     export type CellRow = Database["public"]["Tables"]["cell"]["Row"];
     ```
   - `TaskRow` similarly:
     ```ts
     export type TaskRow = Database["public"]["Tables"]["task"]["Row"];
     ```
   - `CellTypeId` is the union of all 24 string literals. Source the union from the regenerated `Database['public']['Tables']['column'].Row['type']`:
     ```ts
     export type CellTypeId = Database["public"]["Tables"]["column"]["Row"]["type"];
     ```
     This guarantees the registry can never reference a type that the DB rejects.
   - `AggregationKind`:
     ```ts
     export type AggregationKind =
       | "count" | "count_empty" | "count_unique"
       | "sum" | "avg" | "min" | "max" | "median"
       | "percent_by_label" | "percent_checked"
       | "range" | "earliest" | "latest";
     ```
   - `FilterOperator` matches the epic doc line 263–271 exactly.
   - `CellTypeDef<TValue, TConfig>` matches the epic doc lines 67–103 with one addition:
     ```ts
     editorMode: "inline" | "popover";   // per Q14
     ```
     The orchestrator (`<CellEditor />`, S15) reads this to decide whether to render the editor inside a `<Popover>` or directly inside the cell.

2. **`lib/cells/icons.ts`** — exports a `CELL_TYPE_ICONS: Record<CellTypeId, ComponentType<{ className?: string }>>` per Q28. Map each type id to a `lucide-react` icon:
   ```ts
   import {
     Type, AlignLeft, Circle, AlertCircle, Users, Calendar, BarChart2, Hash,
     DollarSign, CheckSquare, Paperclip, Link, Tags, Star, Mail, Phone, Globe,
     ThumbsUp, CalendarDays, MapPin, UserCheck, UserPlus, Clock, Sigma,
   } from "lucide-react";
   import type { CellTypeId } from "./types";
   import type { ComponentType } from "react";

   export const CELL_TYPE_ICONS: Record<CellTypeId, ComponentType<{ className?: string }>> = {
     text: Type, long_text: AlignLeft, status: Circle, priority: AlertCircle,
     person: Users, date: Calendar, timeline: BarChart2, number: Hash,
     currency: DollarSign, checkbox: CheckSquare, file: Paperclip, link: Link,
     tags: Tags, rating: Star, email: Mail, phone: Phone, country: Globe,
     vote: ThumbsUp, week: CalendarDays, location: MapPin,
     updated_by: UserCheck, created_by: UserPlus, created_at_col: Clock,
     formula: Sigma,
   };
   ```
   (`Function` is not a lucide icon name; use `Sigma` for formula.)

3. **`lib/cells/registry.ts`** — empty skeleton. For now, a stub that throws "not implemented" for every type. Stage 3 fills in real defs. The skeleton:
   ```ts
   import type { CellTypeDef, CellTypeId } from "./types";

   const NOT_IMPLEMENTED = new Proxy({} as CellTypeDef<unknown, unknown>, {
     get(_target, prop) {
       throw new Error(`cellRegistry: type not yet implemented (accessing ${String(prop)})`);
     },
   });

   export const cellRegistry: Record<CellTypeId, CellTypeDef<any, any>> = {
     text: NOT_IMPLEMENTED,
     long_text: NOT_IMPLEMENTED,
     status: NOT_IMPLEMENTED,
     priority: NOT_IMPLEMENTED,
     person: NOT_IMPLEMENTED,
     date: NOT_IMPLEMENTED,
     timeline: NOT_IMPLEMENTED,
     number: NOT_IMPLEMENTED,
     currency: NOT_IMPLEMENTED,
     checkbox: NOT_IMPLEMENTED,
     file: NOT_IMPLEMENTED,
     link: NOT_IMPLEMENTED,
     tags: NOT_IMPLEMENTED,
     rating: NOT_IMPLEMENTED,
     email: NOT_IMPLEMENTED,
     phone: NOT_IMPLEMENTED,
     country: NOT_IMPLEMENTED,
     vote: NOT_IMPLEMENTED,
     week: NOT_IMPLEMENTED,
     location: NOT_IMPLEMENTED,
     updated_by: NOT_IMPLEMENTED,
     created_by: NOT_IMPLEMENTED,
     created_at_col: NOT_IMPLEMENTED,
     formula: NOT_IMPLEMENTED,
   };

   export function getCellDef(type: CellTypeId): CellTypeDef<any, any> {
     return cellRegistry[type];
   }
   ```
   Stage 3 slices replace `NOT_IMPLEMENTED` with the imported per-type def by editing this single file. **NB: this file is the cross-slice handoff point in Stage 3.** Each Stage-3 slice edits ONLY the keys it owns. The file's structure must stay flat (one key per line) so per-slice diffs don't conflict — see Stage 3 forbidden-scope rules.

**Definition of done:**
- `lib/cells/types.ts` exports `CellTypeId`, `CellRow`, `TaskRow`, `CellTypeDef`, `AggregationKind`, `FilterOperator`.
- `CellTypeId` is sourced from the generated DB type (verified: `type CellTypeId = Database['public']['Tables']['column']['Row']['type']`).
- `lib/cells/icons.ts` exports `CELL_TYPE_ICONS` covering all 24 type ids.
- `lib/cells/registry.ts` exports `cellRegistry` (Record covering all 24 type ids) + `getCellDef`. Every value is the `NOT_IMPLEMENTED` proxy.
- `pnpm typecheck` passes (the proxy is `any`-typed, which is fine for the skeleton; Stage 3 introduces real types).
- `pnpm lint` passes.

**Escalation triggers:**
- If `Database['public']['Tables']['column']['Row']['type']` doesn't include all 24 literals, S0 didn't ship correctly. STOP and escalate (do not work around with `as` or by hand-typing the union).

**Guardrails applied:** #7 (cell types referenced by short string id), #15 (no `as any` — proxy-typed via `unknown` then cast through generic constraint), #22 (no hand-edit of `lib/supabase/types.ts`), #26 (file scope).

---

### Slice S2 — Zod validations for column / cell / label

**Owner:** epic-executor (sonnet) · **Stage 1, parallel-safe with S1/S3/S4.**

**Files (only):**
- `lib/validations/column.ts` (create)
- `lib/validations/cell.ts` (create)
- `lib/validations/label.ts` (create)

**Forbidden scope:** any other file.

**Spec:**

Mirror the epic-06 pattern (`lib/validations/{group,task}.ts`).

1. **`lib/validations/column.ts`:**
   ```ts
   import { z } from "zod";

   const cellTypeIds = [
     "text","long_text","status","priority","person","date","timeline",
     "number","currency","checkbox","file","link","tags","rating",
     "email","phone","country","vote","week","location",
     "updated_by","created_by","created_at_col","formula",
   ] as const;
   export const CellTypeIdSchema = z.enum(cellTypeIds);

   export const CreateColumnSchema = z.object({
     boardId: z.string().uuid(),
     name: z.string().min(1).max(120),
     type: CellTypeIdSchema,
     position: z.number(),
     settings: z.record(z.unknown()).optional().default({}),
   });
   export type CreateColumnInput = z.infer<typeof CreateColumnSchema>;

   export const RenameColumnSchema = z.object({
     columnId: z.string().uuid(),
     name: z.string().min(1).max(120),
   });

   export const ReorderColumnSchema = z.object({
     columnId: z.string().uuid(),
     position: z.number(),
   });

   export const DuplicateColumnSchema = z.object({
     columnId: z.string().uuid(),
   });

   export const DeleteColumnSchema = z.object({
     columnId: z.string().uuid(),
   });

   export const ChangeColumnTypeSchema = z.object({
     columnId: z.string().uuid(),
     newType: CellTypeIdSchema,
     /** When true, the action proceeds even if the conversion loses data. */
     confirmDataLoss: z.boolean().optional().default(false),
   });

   export const UpdateColumnSettingsSchema = z.object({
     columnId: z.string().uuid(),
     settings: z.record(z.unknown()),
   });

   // …emit `*Input` types for each schema.
   ```

2. **`lib/validations/cell.ts`:**
   ```ts
   import { z } from "zod";
   export const SetCellValueSchema = z.object({
     taskId: z.string().uuid(),
     columnId: z.string().uuid(),
     /** Polymorphic value — server validates against the column's type via the registry's `def.toRow`. */
     value: z.unknown().nullable(),
   });
   export type SetCellValueInput = z.infer<typeof SetCellValueSchema>;

   export const BulkSetCellValueSchema = z.object({
     taskIds: z.array(z.string().uuid()).min(1).max(500),
     columnId: z.string().uuid(),
     value: z.unknown().nullable(),
   });
   export type BulkSetCellValueInput = z.infer<typeof BulkSetCellValueSchema>;
   ```
   The `value` is `unknown` at the validation layer; per-type validation happens in the server action by routing through `cellRegistry[col.type].toRow(value)` which throws if the value shape doesn't match.

3. **`lib/validations/label.ts`:**
   ```ts
   import { z } from "zod";
   const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Must be a 6-digit hex color");

   export const CreateLabelSchema = z.object({
     columnId: z.string().uuid(),
     name: z.string().min(1).max(60),
     color: hexColor,
     position: z.number(),
   });
   export const RenameLabelSchema = z.object({
     labelId: z.string().uuid(),
     name: z.string().min(1).max(60),
   });
   export const RecolorLabelSchema = z.object({
     labelId: z.string().uuid(),
     color: hexColor,
   });
   export const ReorderLabelSchema = z.object({
     labelId: z.string().uuid(),
     position: z.number(),
   });
   export const DeleteLabelSchema = z.object({
     labelId: z.string().uuid(),
   });
   ```

**Definition of done:**
- All three files compile and export the schemas + inferred input types.
- `pnpm typecheck` and `pnpm lint` pass.
- ZERO changes to other files.

**Guardrails applied:** #10 (one Zod schema per shape, used client + server), #26 (file scope).

---

### Slice S3 — Extend board store with columns + labels + per-board column prefs

**Owner:** epic-executor (sonnet) · **Stage 1, parallel-safe with S1/S2/S4.**

**Files (only):**
- `stores/board-store.ts` (modify — additive only; no behavior changes to existing methods)

**Forbidden scope:** any other file. NO changes to existing methods (`hydrate`, `applyTaskUpsert`, etc.) beyond extending `hydrate`'s signature to accept `columns`. Specifically: do NOT touch `applyTaskUpsert`, `applyTaskDelete`, `applyGroupUpsert`, `applyGroupDelete`, `applyCellUpsert`, `toggleGroupCollapse`, `selection*`, `clearSelection`, etc. Do NOT change the persist storage key — extend the partialize closure.

**Spec:**

1. **State additions:**
   ```ts
   type Column = Database["public"]["Tables"]["column"]["Row"];
   type Label = Database["public"]["Tables"]["label"]["Row"];

   // existing BoardState, with these added:
   columns: Column[];
   labelsByColumn: Map<string, Label[]>; // key: column_id; values sorted by position
   columnPrefsByBoard: Record<string, Record<string, { width?: number; hidden?: boolean }>>;
   sortColumnId: string | null;          // ephemeral per-tab sort (per Q30)
   sortDirection: "asc" | "desc" | null;

   // hydrate is extended:
   hydrate: (args: {
     boardId: string;
     groups: Group[];
     tasks: Task[];
     cells: Cell[];
     columns: Column[];          // NEW
     labels: Label[];            // NEW (loaded by page.tsx)
   }) => void;

   // New methods (all idempotent on `updated_at` like the existing apply* methods):
   applyColumnUpsert: (column: Column) => void;
   applyColumnUpsertReplaceTemp: (tempId: string, real: Column) => void;
   applyColumnDelete: (columnId: string) => void;
   applyLabelUpsert: (label: Label) => void;
   applyLabelDelete: (labelId: string) => void;

   // Per-board column prefs (width + hidden):
   setColumnWidth: (columnId: string, width: number) => void;
   toggleColumnHidden: (columnId: string) => void;

   // Ephemeral sort:
   setSort: (columnId: string | null, direction: "asc" | "desc" | null) => void;
   ```

2. **`hydrate` body** — extend to:
   ```ts
   hydrate({ boardId, groups, tasks, cells, columns, labels }) {
     // ... existing code ...
     const labelMap = new Map<string, Label[]>();
     for (const label of labels) {
       const list = labelMap.get(label.column_id) ?? [];
       list.push(label);
       labelMap.set(label.column_id, list);
     }
     // Sort each label list by position
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
       selection: new Set(),
       draggingTaskId: null,
       draggingGroupId: null,
       editingTaskId: null,
       tempIdMap: new Map(),
       sortColumnId: null,
       sortDirection: null,
     });
   }
   ```

3. **`reset` body** — extend to clear `columns`, `labelsByColumn`, `sortColumnId`, `sortDirection`. PRESERVE `columnPrefsByBoard` (it's the persisted slice).

4. **`applyColumnUpsert`** — same idempotency pattern as `applyGroupUpsert`. Resort by position when inserting/updating. This is critical: column order is driven by `position`, not array index, so any insert/update may change the rendered order.

5. **`applyColumnDelete`** — remove the column AND cascade-clear cells where `column_id === columnId` AND clear labels in `labelsByColumn` for that column. Mirror `applyGroupDelete`'s cascade pattern.

6. **`applyColumnUpsertReplaceTemp`** — symmetric to `applyTaskUpsertReplaceTemp`. Used by `createColumn` server action's optimistic flow: insert with `tempId`, replace with real id on success.

7. **`applyLabelUpsert` / `applyLabelDelete`** — analogous; resort labels in their column by position.

8. **Per-board column prefs:**
   ```ts
   setColumnWidth(columnId, width) {
     const { boardId, columnPrefsByBoard } = get();
     if (!boardId) return;
     const boardPrefs = { ...(columnPrefsByBoard[boardId] ?? {}) };
     boardPrefs[columnId] = { ...boardPrefs[columnId], width };
     set({ columnPrefsByBoard: { ...columnPrefsByBoard, [boardId]: boardPrefs } });
   },
   toggleColumnHidden(columnId) {
     const { boardId, columnPrefsByBoard } = get();
     if (!boardId) return;
     const boardPrefs = { ...(columnPrefsByBoard[boardId] ?? {}) };
     const current = boardPrefs[columnId]?.hidden ?? false;
     boardPrefs[columnId] = { ...boardPrefs[columnId], hidden: !current };
     set({ columnPrefsByBoard: { ...columnPrefsByBoard, [boardId]: boardPrefs } });
   },
   ```

9. **Persist middleware** — extend `partialize` to include `columnPrefsByBoard`:
   ```ts
   partialize: (state) => ({
     collapsedByBoard: state.collapsedByBoard,
     columnPrefsByBoard: state.columnPrefsByBoard,
   }),
   ```
   Storage key STAYS `donezo:board-collapsed:v1` — adding a new field to the same persist namespace is forward-compatible (`zustand/middleware` `persist` handles missing keys on rehydration). Document: the storage key name is now historical (it persists more than just collapse state). Do NOT change the key — that would orphan existing localStorage entries.
   
   Actually: name change is awkward but necessary for clarity. **Decision: keep the existing key** to avoid orphaning; document the misnomer in a comment above `partialize`.

10. **`onRehydrateStorage`** stays as-is (only re-derives `collapsedGroupIds`). `columnPrefsByBoard` is consumed lazily by `setColumnWidth` / `toggleColumnHidden` / read accesses, so no rehydration hook needed.

**Definition of done:**
- All new fields and methods exist on `BoardState`.
- `hydrate` accepts and uses `columns + labels`.
- `reset` preserves `columnPrefsByBoard`.
- `applyColumnUpsert` / `applyColumnDelete` / `applyColumnUpsertReplaceTemp` / `applyLabelUpsert` / `applyLabelDelete` are idempotent on `updated_at`.
- `setColumnWidth` / `toggleColumnHidden` write to `columnPrefsByBoard`; `partialize` includes it; rehydration restores it.
- `pnpm typecheck` and `pnpm lint` pass.
- ZERO change to existing method bodies (only signature additions to `hydrate`). The store's existing tests (S15 of epic 06) still pass conceptually (they're describe.skip'd anyway).

**Escalation triggers:**
- If `Database['public']['Tables']['column'].Row` is unavailable or doesn't include the post-S0 type union, S0 didn't run db:types correctly. Escalate.
- If extending `partialize` triggers a TypeScript error (the persist middleware's generic should accept any object subset), escalate before working around with a cast.

**Guardrails applied:** #11 (no client ids — `applyColumnUpsertReplaceTemp` uses tempId), #15 (no casts), #20 (no `task.board_id` writes — same applies to columns: never write `column.board_id` redundantly when modifying), #26 (file scope).

---

### Slice S4 — Aggregations + filter operators + conversions helper modules

**Owner:** epic-executor (sonnet) · **Stage 1, parallel-safe with S1/S2/S3.**

**Files (only):**
- `lib/cells/aggregations.ts` (create — pure helpers; no per-type wiring)
- `lib/cells/filter-operators.ts` (create — pure operator definitions)
- `lib/cells/conversions.ts` (create — pure helpers for type conversions)

**Forbidden scope:** any other file.

**Spec:**

1. **`lib/cells/aggregations.ts`** — exports utility functions used by per-type `def.aggregate`. Pure functions, no React, no Supabase. Examples:
   ```ts
   export function aggregateCount(values: unknown[]): string { return values.length.toString(); }
   export function aggregateCountEmpty<T>(values: (T | null)[]): string {
     return values.filter((v) => v == null).length.toString();
   }
   export function aggregateCountUnique<T>(values: T[]): string {
     return new Set(values).size.toString();
   }
   export function aggregateSum(values: number[]): string {
     return values.reduce((s, v) => s + v, 0).toString();
   }
   export function aggregateAvg(values: number[]): string {
     if (values.length === 0) return "—";
     return (values.reduce((s, v) => s + v, 0) / values.length).toFixed(2);
   }
   export function aggregateMin(values: number[]): string { /* ... */ }
   export function aggregateMax(values: number[]): string { /* ... */ }
   export function aggregateMedian(values: number[]): string { /* ... */ }
   export function aggregatePercentByLabel(
     values: ({ labelId: string } | null)[],
     labels: { id: string; name: string }[],
   ): string { /* returns "60% Done · 30% Working · 10% Stuck" */ }
   export function aggregatePercentChecked(values: (boolean | null)[]): string {
     const total = values.length;
     if (total === 0) return "0%";
     const checked = values.filter((v) => v === true).length;
     return `${Math.round((checked / total) * 100)}%`;
   }
   export function aggregateRange(values: (string | null)[]): string {
     const dates = values.filter((v): v is string => v != null).map((v) => new Date(v));
     if (dates.length === 0) return "—";
     const min = new Date(Math.min(...dates.map((d) => d.getTime())));
     const max = new Date(Math.max(...dates.map((d) => d.getTime())));
     return `${min.toLocaleDateString()} – ${max.toLocaleDateString()}`;
   }
   ```

2. **`lib/cells/filter-operators.ts`** — exports the `FilterOperator` union (re-export from `lib/cells/types.ts`) plus a `FILTER_OPERATOR_LABELS: Record<FilterOperator, string>` for UI display. The actual `matchesFilter` implementations live in per-type defs (Stage 3).

3. **`lib/cells/conversions.ts`** — exports utility helpers for cross-type conversions. Pure functions, no DB access:
   ```ts
   export function tryParseNumber(s: string): number | null {
     const n = Number(s);
     return Number.isFinite(n) ? n : null;
   }
   export function isValidEmail(s: string): boolean {
     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
   }
   export function joinTagValues(values: string[]): string {
     return values.join(", ");
   }
   export function splitToTagValues(s: string): string[] {
     return s.split(/,\s*/).filter(Boolean);
   }
   ```
   These are used by per-type `def.convertTo` maps.

**Definition of done:**
- All three files exist and export their helpers.
- All exports are pure (no React, no Supabase, no `window`).
- `pnpm typecheck` and `pnpm lint` pass.
- ZERO changes to other files.

**Guardrails applied:** #26 (file scope), no others apply.

---

### Stage 2 — Server actions

The three server-action slices are parallel-safe by file scope. All wrap `withUser`, all call `requireBoardRole(boardId, "admin")` for column/label CRUD and `"member"` for cell writes, all parse Zod, all log activity.

### Slice S5 — `columns/actions.ts`

**Owner:** epic-executor (sonnet) · **Stage 2, parallel-safe with S6/S7.**

**Files (only):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions.ts` (create)
- `tests/unit/column-actions.test.ts` (create — `describe.skip` per the epic-06 precedent)

**Forbidden scope:** any other file. Do NOT touch the existing `groups/actions.ts`, `tasks/actions.ts`, or the board-root `actions.ts`. Do NOT touch `cells/actions.ts` (S6 owns) or `labels/actions.ts` (S7 owns).

**Spec:**

`"use server"` at file top. Exports:

- `createColumn(input)` — validates with `CreateColumnSchema`, requires `>= admin` on `boardId`, inserts a `column` row + (for `type === 'status' || type === 'priority'`) inserts the default seed-label set under that new column id. Returns `{ column, labels }`. Activity: `column.created` + (per label) `label.created`.

  Default labels for a new status column (admin can rename later):
  ```
  Working on it (#fdab3d, position 1)
  Done (#00c875, position 2)
  Stuck (#e2445c, position 3)
  Waiting for review (#a25ddc, position 4)
  Pending (#579bfc, position 5)
  ```
  For priority:
  ```
  Critical (#333333, position 1)
  High (#e2445c, position 2)
  Medium (#fdab3d, position 3)
  Low (#579bfc, position 4)
  ```
  Source these from a constant in `lib/cells/seed-labels.ts` (CREATE this file as part of S5 — it's tiny and only used by `createColumn`).

- `renameColumn(input)` — `RenameColumnSchema`, `>= admin`. Returns the updated column row. Activity: `column.renamed` with `{ from, to }`.

- `reorderColumn(input)` — `ReorderColumnSchema`, `>= admin`. Returns the updated column row. Activity: `column.reordered`.

- `duplicateColumn(input)` — `DuplicateColumnSchema`, `>= admin`. Per Q29: copies column + labels (for status/priority) but NOT cell values. New column position = source position + 0.5 (same v1 pattern as `duplicateGroup`). Returns the new column + duplicated labels. Activity: `column.duplicated`.

- `deleteColumn(input)` — `DeleteColumnSchema`, `>= admin`. HARD delete (no `deleted_at` on columns). The `cell` rows are cascade-deleted by the FK. Returns `{ deletedColumnId, affectedCellCount }`. Activity: `column.deleted` with `{ name, type, affectedCellCount }`.

- `changeColumnType(input)` — `ChangeColumnTypeSchema`, `>= admin`. Per Q4 + Q33:
  1. Load source column + all its cells.
  2. Look up `cellRegistry[oldType].convertTo[newType]`. If undefined, throw `{ code: "VALIDATION", message: "No conversion defined for this type change" }`.
  3. If the conversion is "lossy" (the registry tags it via a `lossy: true` flag on the convertTo entry — see S1's `CellTypeDef` extension), and `confirmDataLoss === false`, throw `{ code: "CONFIRMATION_REQUIRED", message: "This change will clear values; confirm to proceed" }`. The client UI uses this code to show the confirm dialog.
  4. Update `column.type = newType` AND iterate cells, computing `newValue = convertFn(oldValue)` and writing via `setCellValue`'s codec. For LARGE columns (>500 cells), do this in batches via SQL. For now, simple loop is fine.
  5. Log activity: `column.type_changed` with `{ from, to, affectedCellCount }`.
  
  The conversion runs in the action, not in a transaction. If the conversion partially fails, leave the column type updated with some cells in inconsistent shape (the `cell_one_value_check` constraint will reject mismatched writes anyway). Document this v1 limitation.

- `updateColumnSettings(input)` — `UpdateColumnSettingsSchema`, `>= admin`. Updates `column.settings`. Activity: `column.settings_updated`.

**Action signature pattern (matches epic 06):**
```ts
"use server";
import { revalidatePath } from "next/cache";
import { withUser } from "@/lib/actions";
import { requireBoardRole } from "@/lib/authorization";
import { logActivity } from "@/lib/activity";
import { CreateColumnSchema /* ... */ } from "@/lib/validations/column";

export const createColumn = withUser(async ({ supabase, userId }, raw) => {
  const input = CreateColumnSchema.parse(raw);
  await requireBoardRole(input.boardId, "admin");

  const { data: column, error } = await supabase
    .from("column")
    .insert({
      board_id: input.boardId,
      name: input.name,
      type: input.type,
      position: input.position,
      settings: input.settings as Json,
    })
    .select()
    .single();
  if (error || !column) throw { code: "DB_ERROR", message: error?.message ?? "Insert failed" };

  // Seed labels for status/priority…
  let labels: Label[] = [];
  if (input.type === "status" || input.type === "priority") {
    const seed = SEED_LABELS[input.type];
    const { data: inserted, error: lerr } = await supabase
      .from("label")
      .insert(seed.map((l) => ({ ...l, column_id: column.id })))
      .select();
    if (lerr) throw { code: "DB_ERROR", message: lerr.message };
    labels = inserted ?? [];
  }

  await logActivity({
    boardId: input.boardId,
    actorId: userId,
    type: "column.created",
    payload: { columnId: column.id, name: column.name, type: column.type },
  });

  return { column, labels };
});
```

**Tests:** `tests/unit/column-actions.test.ts` — `describe.skip` with sketch cases for: createColumn (status with default labels), renameColumn, deleteColumn (cascades cells), duplicateColumn (copies labels, not cells), changeColumnType (text → number happy path + lossy refusal without confirm).

**Definition of done:**
- All seven actions present, each `withUser`-wrapped, each parses Zod once, each calls `requireBoardRole(boardId, "admin")`, each logs activity.
- `lib/cells/seed-labels.ts` exists and is consumed only by `createColumn` (not exported elsewhere — keep the surface tiny).
- Test file exists with at least 5 `describe.skip` cases.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- If `cellRegistry[oldType].convertTo` doesn't exist on the proxy stub (because Stage 3 hasn't shipped yet), `changeColumnType` will throw on import. The action body should `import { getCellDef } from "@/lib/cells/registry"` lazily inside the function — NOT at module top — to defer the proxy access until call time. By the time `changeColumnType` is INVOKED, Stage 3 will have shipped. If Stage-2 typecheck fails because the proxy has no methods at compile time, the proxy must be typed as `CellTypeDef<unknown, unknown>` (which it already is). If a real type error pops, escalate.

**Guardrails applied:** #5 (Base UI N/A — server), #9 (`withUser` wrap), #10 (Zod), #15 (no casts), #16 + #17 (`>= admin` for column CRUD), #20 (no redundant board_id writes), #26 (file scope).

---

### Slice S6 — `cells/actions.ts`

**Owner:** epic-executor (sonnet) · **Stage 2, parallel-safe with S5/S7.**

**Files (only):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts` (create)
- `tests/unit/cell-actions.test.ts` (create — `describe.skip`)

**Forbidden scope:** any other file. Do NOT touch the columns or labels directories.

**Spec:**

Two server actions:

- `setCellValue(input)` — `SetCellValueSchema.parse`. Loads the column row (`column.id, board_id, type`). `requireBoardRole(boardId, "member")`. Reads the existing cell (for the activity log's `from` payload). Computes `patch = cellRegistry[col.type].toRow(input.value)`. Upserts via:
  ```ts
  const { data, error } = await supabase
    .from("cell")
    .upsert({
      task_id: input.taskId,
      column_id: input.columnId,
      ...patch,           // toRow MUST set ALL value columns (others to null) per Q35
      updated_by: userId,
    }, { onConflict: "task_id,column_id" })
    .select()
    .single();
  ```
  Activity: `cell.changed` with `{ columnType: col.type, from: prevValue, to: input.value }`.
  Returns the updated cell row.

- `bulkSetCellValue(input)` — `BulkSetCellValueSchema.parse`. Per Q20 + guardrail #34:
  1. Load the column → get `boardId + type`.
  2. Load all tasks by `taskIds` (single query). Verify all share the same `boardId`. If not, reject with `{ code: "VALIDATION", message: "Tasks span multiple boards" }`.
  3. Verify `column.board_id === tasksBoardId`. If not, reject with `{ code: "VALIDATION", message: "Column belongs to a different board" }`.
  4. `requireBoardRole(boardId, "member")`.
  5. Compute `patch = cellRegistry[col.type].toRow(input.value)` ONCE.
  6. Build the upsert payload as `taskIds.map(tid => ({ task_id: tid, column_id: input.columnId, ...patch, updated_by: userId }))`.
  7. Single upsert call with `{ onConflict: "task_id,column_id" }`.
  8. Activity: `cell.bulk_changed` with `{ columnType: col.type, columnId, taskCount: taskIds.length, value: input.value }`.
  9. Returns `{ count: taskIds.length, cells: data }`.

**Tests:** at least 4 `describe.skip` cases — setCellValue happy path, setCellValue with type mismatch (registry rejects), bulkSetCellValue happy path, bulkSetCellValue mixed-board rejection.

**Definition of done:**
- Both actions present and wrapped.
- Activity types match the union extended in S0.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- Same as S5 re: proxy stub access for `getCellDef`. Defer the call until invocation.

**Guardrails applied:** #9, #10, #15, #16 + #17 (`>= member` for cells), #20 (no `task.board_id` writes; the cell only references task_id), #26, #34 (single-board safety).

---

### Slice S7 — `labels/actions.ts`

**Owner:** epic-executor (sonnet) · **Stage 2, parallel-safe with S5/S6.**

**Files (only):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/labels/actions.ts` (create)
- `tests/unit/label-actions.test.ts` (create — `describe.skip`)

**Forbidden scope:** any other file.

**Spec:**

Five server actions for label CRUD:

- `createLabel(input)` — `CreateLabelSchema`, requires `>= admin` on the column's board. Loads `column.board_id` first. Inserts label, returns row. Activity: `label.created`.
- `renameLabel(input)` — `RenameLabelSchema`, `>= admin`. Activity: `label.renamed`.
- `recolorLabel(input)` — `RecolorLabelSchema`, `>= admin`. Activity: `label.recolored`.
- `reorderLabel(input)` — `ReorderLabelSchema`, `>= admin`. Activity: `label.reordered`.
- `deleteLabel(input)` — `DeleteLabelSchema`, `>= admin`. Cascade: any `cell.label_id == labelId` becomes NULL (per the FK `on delete set null`). Activity: `label.deleted` with `{ name, color, affectedCellCount }`.

Pattern matches S5 exactly.

**Tests:** `describe.skip` sketches.

**Definition of done:**
- All five actions present, wrapped, gated on `>= admin`.
- Activity types match the S0 union.
- `pnpm typecheck` and `pnpm lint` pass.

**Guardrails applied:** #9, #10, #15, #16 + #17 (`>= admin` for labels per Q26), #26.

---

### Stage 3 — Cell-type implementations

Seven slices in parallel, each owns a disjoint folder under `components/cells/`. **Critical file-scope rule:** every Stage-3 slice MUST modify `lib/cells/registry.ts` to replace its own type's `NOT_IMPLEMENTED` proxy with the real def. To prevent merge conflicts:

- **`lib/cells/registry.ts` is structured as a flat object literal with one key per line.** Each Stage-3 slice does a single-line replacement: `text: NOT_IMPLEMENTED,` → `text: textType,` plus a single `import { textType } from "@/components/cells/text/def";` line at the top. The import block is alphabetical, so each slice inserts its line in alphabetical position.
- **The orchestrator MUST run Stage 3 sequentially with respect to `lib/cells/registry.ts` even though the per-folder work is parallel.** The simplest path: execute Stage 3 in two waves. Wave 1 does all the per-folder work in parallel; Wave 2 (one slice, 5min of work) consolidates the registry imports. **Decision: each Stage-3 slice owns BOTH its folder AND its specific keys in `lib/cells/registry.ts`.** Slices conflict ONLY on the registry file — and only on disjoint lines — so a 3-way merge handles them. The orchestrator should sequence Stage-3 slices serially through the registry edit, applying each to the latest `epic/07-column-system` tip and committing immediately. Per-folder work is still fully parallel.
- **Final review for Stage 3 verifies every key is wired**: `grep "NOT_IMPLEMENTED" lib/cells/registry.ts` should return zero matches at end-of-stage.

Each per-folder slice's spec follows the same shape. I'll detail Slice S8 fully and abbreviate the rest by reference.

### Slice S8 — Group A: text, long_text, email, phone, country, link

**Owner:** epic-executor (sonnet) · **Stage 3, parallel-safe with S9–S14 modulo registry edit.**

**Files (only):**
- `components/cells/text/def.ts`, `components/cells/text/Cell.tsx`, `components/cells/text/Editor.tsx`
- `components/cells/long_text/def.ts`, `components/cells/long_text/Cell.tsx`, `components/cells/long_text/Editor.tsx`
- `components/cells/email/def.ts`, `components/cells/email/Cell.tsx`, `components/cells/email/Editor.tsx`
- `components/cells/phone/def.ts`, `components/cells/phone/Cell.tsx`, `components/cells/phone/Editor.tsx`
- `components/cells/country/def.ts`, `components/cells/country/Cell.tsx`, `components/cells/country/Editor.tsx`, `components/cells/country/iso-list.ts`
- `components/cells/link/def.ts`, `components/cells/link/Cell.tsx`, `components/cells/link/Editor.tsx`
- `lib/cells/registry.ts` (modify — replace 6 `NOT_IMPLEMENTED` entries with the imported defs; add 6 imports)

**Forbidden scope:** any other folder under `components/cells/`. Any file in `lib/cells/` other than `registry.ts`. Any board/table component. Any server action. Any test outside the per-folder Storybook (which is deferred to epic 14).

**Spec for each type:**

For all six text-y types:
- **`def.ts`** exports the `CellTypeDef`. `editorMode: "inline"` for text/email/phone/country, `"popover"` for long_text and link.
- **`Cell.tsx`** is the read-mode renderer. `min-width: var(--size-cell-w)`, `height: var(--size-cell-h)`, `1px solid var(--color-border-strong)` per the visual spec. Centered text. Hover state: `outline: 1px solid var(--color-border-strong)`. Empty state: muted placeholder ("Empty"). `React.memo` on the cell.
- **`Editor.tsx`** is the edit-mode renderer. Inline `<input>` for text/email/phone, multi-line `<textarea>` for long_text (per Q11), Base UI `<Popover>` with URL+label inputs for link, `<select>` over `iso-list.ts` for country. All editors emit `onChange(value)` and `onClose()` only — no server-action calls (the orchestrator handles those).

**Per-type details:**

| Type | TValue | TConfig | toRow patch | filterOps | aggregations | convertTo |
|---|---|---|---|---|---|---|
| text | `string` | `{}` | `{ text_value: v, ...allOthers: null }` | equals, contains, starts_with, ends_with, is_empty, is_not_empty | count, count_empty | `number, email, phone, country, link, status (lossy)` |
| long_text | `string` | `{ richText: false }` | `{ text_value: v, ...allOthers: null }` | contains, is_empty, is_not_empty | count, count_empty | `text` |
| email | `string` | `{}` | `{ text_value: v, ...allOthers: null }` | equals, contains, is_empty | count | `text, phone (lossy)` |
| phone | `string` | `{}` | `{ text_value: v, ...allOthers: null }` | equals, contains, is_empty | count | `text` |
| country | `string` (ISO alpha-2) | `{}` | `{ text_value: v, ...allOthers: null }` | equals, in, is_empty | count_unique | `text` |
| link | `{ url: string; label?: string }` | `{}` | `{ json_value: v, ...allOthers: null }` | contains, is_empty | count | `text (joins url + label)` |

Lossy conversions (e.g., text → status which only matches existing labels) MUST be tagged with `lossy: true` on the convertTo entry — extend the `CellTypeDef.convertTo` value shape to `{ fn: (v) => unknown; lossy?: boolean }` (slight refinement on the epic doc's `Partial<Record<CellTypeId, fn>>`). Do this in S1's types file via a post-S1 followup if not already present; if it IS already present per the S1 spec, just use it. **Resolved decision: extend `CellTypeDef.convertTo` to `Partial<Record<CellTypeId, { fn: (v: TValue | null) => unknown; lossy?: boolean }>>`** — bake into S1's spec.

**Visual fidelity for this slice:**
- All six cells share the cell skeleton: 140px min-width, 36px height, 1px border `--color-border-strong`.
- Focus state on `<input>` / `<textarea>`: `outline: 1px solid var(--color-primary)`.
- Hover state on the cell wrapper (read mode): `outline: 1px solid var(--color-border-strong)` (subtle).
- Country cell shows the ISO code in muted text after the country name.
- Link cell shows just the label (or domain, fallback to URL) as a clickable underlined text in `--color-primary`.

**Definition of done:**
- All six folders contain `def.ts` + `Cell.tsx` + `Editor.tsx` (+ `iso-list.ts` for country).
- `lib/cells/registry.ts` has the six `NOT_IMPLEMENTED` entries replaced with the imported defs; six imports added at top in alphabetical order.
- Every `def.toRow` explicitly nulls all other value columns (per Q35 + the `cell_one_value_check` constraint).
- Every `def.fromRow` returns the typed value or `null`.
- Every `def.Editor` emits `onChange + onClose` only; no server-action calls; no Supabase imports.
- Every `def.Cell` is `React.memo`'d.
- Zero raw hex/rgba in any of the new `.tsx` files.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- If the registry edit conflicts with another concurrent Stage-3 slice's edit, rebase against the latest `epic/07-column-system` tip and re-apply the per-line edit. Do not silently merge — the orchestrator may need to re-sequence.
- If `cell_one_value_check` rejects a write because a value column wasn't nulled, the `toRow` is wrong — fix the patch, do not work around the constraint.

**Guardrails applied:** #1, #5 (Base UI Popover), #6 (cell skeleton extension), #7, #15, #25 (no toast stubs — long_text really ships a textarea), #26 (file scope incl. registry edit discipline).

---

### Slices S9–S14 — Other cell-type groups (abbreviated)

Each follows the S8 pattern. Per-slice deltas:

- **S9 (Group B: number, currency, rating, checkbox):**
  - All `editorMode: "inline"`.
  - `number` config: `{ decimals: number; suffix?: string; min?: number; max?: number }`. Storage `number_value`.
  - `currency` config: `{ currency: string }` (default "USD"). Storage `number_value`. Display formatted via `Intl.NumberFormat`.
  - `rating` config: `{ max: number }` (default 5). Storage `number_value`. Editor: hover-and-click stars (custom hand-rolled component using lucide `Star`).
  - `checkbox` value `boolean`. Storage `boolean_value`. Editor: Base UI `<Checkbox>`. Per the visual spec: checked = `--color-primary`, hover wash `rgba(0,0,0,0.05)` (use `--color-surface-hover`).
  - Number cell hover reveals `+`/`-` icons in `--color-primary` and a `clear` chip top-right per the visual spec.
  - **All four cells must be optimistic + zero in-flight chrome** per the spec. The orchestrator handles this.

- **S10 (Group C: status, priority + StatusLabelEditor):**
  - Per Q24, `status` and `priority` share `Cell.tsx` and `Editor.tsx`. Each has its own `def.ts`. The shared `StatusLabelEditor.tsx` lives at `components/cells/status/StatusLabelEditor.tsx` (NOT in a separate folder); priority's `def.ts` imports the same components.
  - Cell value: `{ labelId: string }` or `null`. Storage `label_id`.
  - **Visual fidelity (must-match per the epic spec):**
    - Full-bleed background = label color (read from `labelsByColumn[columnId]` in store).
    - Centered white label text.
    - **Diagonal "fold" reveal in top-right on hover** — `border-width: 0 → 10×10 → 15×15px` over `--motion-base` with `transition-delay: var(--motion-fold-delay)`. This is THE most distinctive visual moment in the product. Implement via CSS pseudo-elements + `transition`. Document in the file with reference to the legacy SCSS line.
    - Empty state: `--color-label-gray` background, no text.
  - StatusLabelEditor popover: 152px-wide chips, gap 8px, white-text-on-color, "Edit Labels" button at bottom with 1px top border `--color-border-strong`. Opens an inline `LabelEditorModal` (S17 owns) when clicked.
  - `editorMode: "popover"`.
  - filterOps: equals, not_equals, is_empty, in.
  - aggregations: percent_by_label.
  - convertTo: `text` (uses label name).

- **S11 (Group D: person, date, timeline, week):**
  - `person` value `{ userIds: string[] }` (per Q-no — multi default per epic spec). Storage `json_value`. Editor: Base UI `<Popover>` + a search command list of workspace members (uses workspace context cached by epic 05).
  - `date` value `{ iso: string }`. Storage `date_value`. Editor: Base UI `<Popover>` + hand-rolled month grid (per Q12 — no `react-day-picker`). Format per `config.format`.
  - `timeline` value `{ start: string; end: string }`. Storage `date_value` + `date_end_value`. **Special case**: `toRow` writes BOTH `date_value` and `date_end_value`; the `cell_one_value_check` constraint counts `date_value` (auxiliary `date_end_value` excluded), so this is consistent.
  - `week` value `{ year: number; week: number }`. Storage `json_value`.
  - Person cell visual: 26px avatars, `-5px` overlap, white border, `+N` overflow tile. Reuse `<MemberStack />` from epic 05.
  - Date cell visual: centered text input style; hover text → `--color-primary`; focus border `--color-primary`.

- **S12 (Group E: tags, vote, file):**
  - `tags` value `{ values: string[] }` (free-form per Q1). Storage `json_value`. Editor: Base UI `<Popover>` + free-text creation + chip removal.
  - `vote` value `{ userIds: string[] }`. Storage `json_value`. Editor: inline thumbs-up button (toggle membership of current user's id).
  - `file` per Q13 stub: `{ attachmentIds: string[] }`. Storage `json_value`. Cell renders count badge linking to task drawer placeholder route. Editor disabled with `<Tooltip>` "Coming in epic 10". `editorMode: "inline"`, but the editor renders a no-op placeholder.

- **S13 (Group F: updated_by, created_by, created_at_col, location):**
  - First three are derived per Q25. `def.toRow` returns `{}` (empty patch). `def.fromRow` returns the value derived from the parent task row passed via `Cell` props.
  - `updated_by`/`created_by` cell: 26px avatar from workspace member profile + relative-time string (`2h`, `5d`, `3w`) computed via a `lib/cells/relative-time.ts` helper (CREATE in this slice — small file, single-purpose).
  - `created_at_col`: just the relative-time string.
  - All three editors are NO-OPs (orchestrator must not open them — `editorMode: "inline"`, but the inline "editor" renders nothing and `def.Editor = ReadOnlyPlaceholder` from `components/cells/_shared/ReadOnlyPlaceholder.tsx` (CREATE).
  - `location` per Q6: value `{ lat: number; lng: number; label?: string }`. Storage `json_value`. Editor: Base UI `<Popover>` with three inputs (lat, lng, label).

- **S14 (Group G: formula stub):**
  - Per Q4: `def.Cell` renders "—" with a `<Tooltip>` "Formula columns coming soon".
  - `def.Editor = ReadOnlyPlaceholder`.
  - `def.toRow` returns `{}` (no writes).
  - All filterOps empty. No aggregations.

**Definition of done for S9–S14 (each):**
- All folders contain `def.ts + Cell.tsx + Editor.tsx`.
- `lib/cells/registry.ts` updated for the slice's types.
- Visual fidelity per epic-07 §"Visual fidelity requirements" + component-system §2.4.
- Zero raw hex/rgba in shipped TS/TSX.
- `pnpm typecheck` and `pnpm lint` pass.

---

### Stage 4 — Orchestration + headers + add-column modal

Four slices, parallel-safe by file scope.

### Slice S15 — `<CellEditor />` orchestrator + `<TableCell />` dispatcher

**Owner:** epic-executor (sonnet) · **Stage 4, parallel-safe with S16/S17/S18.**

**Files (only):**
- `components/cells/CellEditor.tsx` (create)
- `components/cells/TableCell.tsx` (create)
- `components/cells/_shared/ReadOnlyPlaceholder.tsx` (if not already created in S13 — if S13 created it, S15 just imports; document overlap as "S15 may create iff S13 did not").

**Forbidden scope:** any per-type folder (those are owned by stages 3 slices). Any board/table component. Any server action.

**Spec:**

1. **`<TableCell />`** is the renderer dispatched per (task, column). Resolves the cell from the store via `useBoardStore((s) => s.cells.get(\`${task.id}:${column.id}\`))`. Resolves the def via `getCellDef(column.type)`. Calls `def.fromRow(cellRow)` to compute the value. Renders `<def.Cell value={value} config={column.settings as TConfig} row={task} />` in read mode. Memoized on `(value, config, row.id, row.updated_at, column.id, column.settings)`.

2. **On click**, swaps to `<CellEditor task={task} column={column} />`. Per the spec line 200–202, the orchestrator handles the optimistic update + server action + rollback ONCE.

3. **`<CellEditor />`** behavior:
   - Reads current value from store.
   - Renders `def.Editor` either inline OR inside a Base UI `<Popover>` based on `def.editorMode`.
   - On `Editor.onChange(value)`:
     - Compute `optimisticPatch = def.toRow(value)`.
     - Compute optimistic cell row: `{ task_id, column_id, ...optimisticPatch, updated_by: currentUserId, updated_at: new Date().toISOString() }`.
     - Call `applyCellUpsert(optimisticCell)` immediately.
   - On `Editor.onClose()`:
     - Fire `setCellValue({ taskId, columnId, value })` server action.
     - On success: `applyCellUpsert(result.data)` (idempotent).
     - On failure: revert by calling `applyCellUpsert(prevCell)` + `toast.error(...)`.
   - On Esc: reverts the editor's local state to the persistent value, calls `onClose` without firing the action.
   - For derived types (`updated_by` / `created_by` / `created_at_col` / `formula`): editor never opens (orchestrator early-returns to read-mode).

4. **Memoization:** `<TableCell />` is `React.memo`'d. Re-renders only when (cell value updated_at, column settings, task identity) change.

**Definition of done:**
- `<TableCell />` and `<CellEditor />` exist with the contracts above.
- Optimistic update + revert + toast flow works (manually verified during stage-4 review).
- `<CellEditor />` for derived types short-circuits without opening.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- If a per-type editor invokes a server action directly (violating the orchestrator pattern), STOP and escalate. The orchestrator pattern is not optional.

**Guardrails applied:** #5, #6, #15, #26, #34 (orchestrator handles bulk via S22), #37 (cell write/realtime via `applyCellUpsert`).

---

### Slice S16 — `<AddColumnModal />` + replace `<AddColumnButton />` stub

**Owner:** epic-executor (sonnet) · **Stage 4, parallel-safe with S15/S17/S18.**

**Files (only):**
- `components/board/table/AddColumnModal.tsx` (create)
- `components/board/table/AddColumnButton.tsx` (modify — replace tooltip stub with functional button)

**Forbidden scope:** any other board/table component. Any per-cell folder. Server actions.

**Spec:**

1. **`<AddColumnButton />`** becomes a real button that opens `<AddColumnModal>`. Same chrome (lucide `Plus`, 36px square). NO tooltip. NO disabled state for users with `>= admin` role (read role from `useBoard()` context). For users below admin, render the button disabled with a tooltip "Admins can add columns".

2. **`<AddColumnModal />`** is a Base UI `<Dialog>`-based multi-step modal:
   - Step 1: type picker. Grid of icons + labels from `CELL_TYPE_ICONS` + `getCellDef(t).label`. Hover shows a description tooltip. Excludes the derived types (`updated_by`, `created_by`, `created_at_col`) from the grid for the v1 (admins can add them by command-palette later — out of scope for now). Includes `formula` as a "coming soon" disabled tile.
   - Step 2: configure. Title input (defaults to type's `def.label`). Per-type config via `def.ConfigEditor` if present. For status/priority, omit the labels customization step in v1 (defaults seed fine; admins can edit labels via the column header dropdown later).
   - Footer: Cancel / Add buttons. Add fires `createColumn({ boardId, name, type, position, settings })` with `position = max(existing positions) + 1`.
   - Optimistic: insert with tempId via `applyColumnUpsertReplaceTemp` after server returns the real id.

**Definition of done:**
- AddColumnButton opens the modal for admins, shows disabled+tooltip for non-admins.
- Modal walks through type picker → config → submit.
- Server-action call uses optimistic temp-id + replace pattern.
- Visual fidelity: type-picker grid is 240px wide × 120px cells per component-system §3.10.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- If `<Dialog>` from Base UI doesn't support multi-step content (it does), escalate.

**Guardrails applied:** #5, #8 (Base UI Dialog, no `window.confirm`), #11 (tempId pattern), #15, #17 (admin gating), #25 (disabled-with-tooltip is acceptable cross-role pattern), #26.

---

### Slice S17 — `<ColumnHeader />` + `<ColumnHeaderMenu />` + `<LabelEditorModal />`

**Owner:** epic-executor (sonnet) · **Stage 4, parallel-safe with S15/S16/S18.**

**Files (only):**
- `components/board/table/ColumnHeader.tsx` (create — the per-column header cell)
- `components/board/table/ColumnHeaderMenu.tsx` (create — the dropdown that opens from each header chevron)
- `components/board/table/LabelEditorModal.tsx` (create — the popover for editing status/priority labels)

**Forbidden scope:** any per-cell folder. Any other board/table component (StickyHeader is S19, BoardTable is S20).

**Spec:**

1. **`<ColumnHeader />`** renders a single column header. Props: `{ column: Column }`. Shows:
   - Type icon (from `CELL_TYPE_ICONS[column.type]`).
   - Column name via `<EditableTitle>` (reuses the imperative `focus()` ref API from epic 06 S14).
   - Chevron button → opens `<ColumnHeaderMenu />`.
   - Sort indicator if `useBoardStore((s) => s.sortColumnId) === column.id`.
   - Resize drag handle on the right edge (S18 owns the actual resize logic; this slice exposes a `<div data-resize-handle>` that S18 wires up).

2. **`<ColumnHeaderMenu />`** uses `<MenuList />` recipe inside a Base UI `<Popover>`. Items per the epic doc + Q30/Q31:
   - Rename — calls the EditableTitle's imperative `focus()` (same `setTimeout(0)` pattern as epic 06 F4.1).
   - Sort ascending / Sort descending / Sort: none — updates the store's `sortColumnId + sortDirection`.
   - Filter — disabled with tooltip "Coming in epic 11".
   - Hide — calls `toggleColumnHidden(columnId)`.
   - Move left / Move right — calls `reorderColumn` server action with the new position.
   - Duplicate — calls `duplicateColumn`.
   - Change type → submenu of compatible types (built from `def.convertTo` keys). Selecting a type opens the change-type confirm dialog (Base UI `<Dialog>`, typed-name pattern).
   - Settings — opens the per-type `def.ConfigEditor` in a Base UI `<Dialog>`. For status/priority, the Settings item opens `<LabelEditorModal>` instead.
   - Delete — opens the typed-name `<Dialog>` confirm; on confirm, calls `deleteColumn`. Admin only.

3. **`<LabelEditorModal />`** is the editor for status/priority labels. Lists labels for the column (rename via inline `<EditableTitle>`, recolor via `<ColorPalette>`-like swatch grid, reorder via dnd-kit vertical, delete via inline button). Add Label button at bottom. Each operation calls the corresponding S7 server action with optimistic updates via `applyLabelUpsert` / `applyLabelDelete`.

**Definition of done:**
- ColumnHeader renders type icon + EditableTitle + chevron + (conditional) sort indicator + resize handle slot.
- ColumnHeaderMenu items work for rename, sort, hide, move, duplicate, settings, delete.
- Filter is disabled with tooltip per spec.
- Change type opens confirm dialog when conversion is lossy.
- LabelEditorModal supports add/rename/recolor/reorder/delete.
- All actions optimistic via store, with revert + toast on failure.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- If the change-type lossy-confirmation flow is unclear (server returns CONFIRMATION_REQUIRED — does the client re-call with `confirmDataLoss: true`?), the answer is YES per Q4 + S5 spec. Document the round-trip in the dialog's submit handler.

**Guardrails applied:** #5, #6, #8, #15, #17, #25, #26.

---

### Slice S18 — Column reorder + column resize

**Owner:** epic-executor (sonnet) · **Stage 4, parallel-safe with S15/S16/S17.**

**Files (only):**
- `components/board/table/ColumnReorder.tsx` (create — dnd-kit horizontal SortableContext wrapper for column headers)
- `components/board/table/ColumnResize.tsx` (create — resize-by-drag wrapper around a header)
- `hooks/use-column-resize.ts` (create — pointer-event drag hook; applies width to `setColumnWidth`)

**Forbidden scope:** any per-cell folder. Any other board/table component.

**Spec:**

1. **Column reorder** uses dnd-kit's `horizontalListSortingStrategy`. Wrap the entire column-header row (the array of `<ColumnHeader />` from S17) in a `SortableContext`. On drop, compute new position via `positionBetween(prev.position, next.position)` and call `reorderColumn`. Optimistic via `applyColumnUpsert`. Match the epic-06 pattern for group/task DnD.

2. **Column resize**: each header has a 4px-wide drag handle on its right edge (the `data-resize-handle` slot from S17). `use-column-resize` listens for pointerdown → pointermove → pointerup. On pointermove, it computes `newWidth = startWidth + (e.clientX - startX)` and calls `setColumnWidth(columnId, newWidth)` (debounced via `requestAnimationFrame`). Min width 60px, max 600px.

3. The width is read via `useBoardStore((s) => s.columnPrefsByBoard[boardId]?.[columnId]?.width)` and applied as a CSS variable on the cell's outer wrapper. If unset, falls back to `var(--size-cell-w)` (140px) or `var(--size-cell-w-task)` for the title column.

**Definition of done:**
- Dragging a column header reorders columns; persists via `reorderColumn` action; optimistic.
- Dragging the right edge of a header resizes; persists via `setColumnWidth` to localStorage; survives reload.
- Width clamped to [60px, 600px].
- `pnpm typecheck` and `pnpm lint` pass.

**Guardrails applied:** #5, #15, #26, #32 (localStorage persist).

---

### Stage 5 — Wiring into BoardTable + StickyHeader + TaskRow + group footer + bulk apply

These four slices touch shared files. **Sequential within shared file scope.** S19 → S20 (S20 depends on S19's StickyHeader changes for column visibility logic) → S21 (S21 depends on S20's renderRow extension to add a new row kind) → S22 (S22 only touches BulkActionBar, but reads from wider state updated by S19/S20).

### Slice S19 — Replace StickyHeader's hard-coded "Name" with dynamic columns

**Owner:** epic-executor (sonnet) · **Stage 5, sequential (must precede S20/S21).**

**Files (only):**
- `components/board/table/StickyHeader.tsx` (modify — replace single Name with `<ColumnReorder>` over `<ColumnHeader />` per visible column; keep the BoardLevelCheckbox + AddColumnButton)

**Forbidden scope:** any other file. NO changes to TaskRow, BoardTable, or any cell component.

**Spec:**

1. Read `columns` from `useBoardStore((s) => s.columns)`. Apply hidden filter via `columnPrefsByBoard[boardId]`. Sort by `position`.
2. Replace the `<div className="w-[var(--size-cell-w-task)] ...">Name</div>` block with a horizontally scrollable row that maps over visible columns and renders `<ColumnHeader column={col} />` (from S17), wrapped in `<ColumnReorder />` (from S18).
3. The first column (the "Title" column, `type === 'text'` AND `position === 1` by convention from the seed) is rendered as a sticky-left column header; subsequent columns scroll with the table.
4. Keep `<BoardLevelCheckbox />` at the leftmost position and `<AddColumnButton />` at the rightmost position.
5. Keep the sticky-top + z-index + height (`h-9`) chrome.

**Definition of done:**
- StickyHeader renders one header per visible column.
- Column reorder (drag) and resize (drag handle) both work via S18 wrappers.
- Hidden columns via `columnPrefsByBoard` are not rendered.
- AddColumnButton opens AddColumnModal.
- `pnpm typecheck` and `pnpm lint` pass.

**Guardrails applied:** #5, #15, #26, #29 (no new wrapper that breaks virtualization).

---

### Slice S20 — Wire per-column `<TableCell />` into TaskRow + extend BoardTable.renderRow

**Owner:** epic-executor (sonnet) · **Stage 5, sequential (after S19, before S21).**

**Files (only):**
- `components/board/table/TaskRow.tsx` (modify — replace the single TaskTitleCell with the title cell + a horizontal flex of `<TableCell />` per visible non-title column)
- `components/board/table/BoardTable.tsx` (modify — pass the visible columns to TaskRow + GroupHeaderRow; no other changes)

**Forbidden scope:** StickyHeader (S19 owns), GroupFooter (S21 owns), BulkActionBar (S22 owns), any cell folder.

**Spec:**

1. **TaskRow:** add a per-column `<TableCell task={task} column={col} />` for each visible non-title column. The title column stays as `<TaskTitleCell task={task} />` (existing).
2. The cells render in a flex row; widths come from `columnPrefsByBoard` or default tokens.
3. Read columns via `useBoardStore((s) => s.columns)` filtered by hidden state.
4. **BoardTable:** in `renderRow`, the `case "task"` branch already renders `<TaskRow task={entry.task} group={entry.group} />`. No change needed — TaskRow self-resolves the columns from the store. (This keeps the renderRow signature unchanged and minimizes the diff.)
5. Memoization: each `<TableCell />` is `React.memo`'d (from S15). TaskRow itself stays as-is wrt memoization.

**Definition of done:**
- A task row renders title + per-column cells.
- Editing a cell fires the optimistic flow via `<CellEditor />`.
- Hidden columns are not rendered.
- Resize widths apply.
- Reorder applies (column DnD updates position; rows re-render with new column order).
- Virtualization still works (only visible rows in DOM — verify via React DevTools).
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- If virtualization breaks (the layout-chain gotcha from guardrail #29), escalate. Do NOT add a new wrapper div.

**Guardrails applied:** #5, #6, #15, #26, #29.

---

### Slice S21 — `<GroupFooter />` aggregations row + new `RowEntry` kind

**Owner:** epic-executor (sonnet) · **Stage 5, sequential (after S20, before S22).**

**Files (only):**
- `components/board/table/GroupFooter.tsx` (create)
- `components/board/table/TableVirtualizer.tsx` (modify — extend `RowEntry` union with `{ kind: "group-footer"; group: Group }` + add `"group-footer": 36` to DEFAULT_HEIGHTS + add the `rowKey` case)
- `components/board/table/BoardTable.tsx` (modify — extend the rows builder to insert a `group-footer` between task rows and the add-task-footer; extend `renderRow` to handle the new kind)

**Forbidden scope:** TaskRow (S20 owns), StickyHeader (S19 owns), BulkActionBar (S22 owns), any cell folder.

**Spec:**

1. **GroupFooter** props: `{ group: Group }`. Renders a 36px row with one cell per visible column. Each cell calls `def.aggregate(values, def.aggregations[0], column.settings)` where `values` is `tasks.filter(t => t.group_id === group.id).map(t => def.fromRow(cells.get(\`${t.id}:${column.id}\`)))`.
2. Default aggregator per type is the first entry in `def.aggregations`. Per Q8, no per-group override; this is the simplest case.
3. Visual: 14px font-weight 500 for the value, 12px font in `--color-fg-muted` for the aggregation label ("sum", "%", "avg"). Per the epic-07 visual spec line 391.
4. **TableVirtualizer:** add `"group-footer"` to the `RowEntry` union, add `36` to DEFAULT_HEIGHTS, add `gf:${entry.group.id}` to `rowKey`.
5. **BoardTable rows builder:** for each non-collapsed group, insert a `{ kind: "group-footer", group }` after the last task row and before the `add-task-footer`.

**Definition of done:**
- Each non-collapsed group has a footer row showing per-column aggregations.
- Aggregations match the registry's defaults (count for text, sum for number, %-by-label for status, etc.).
- Virtualization still works (footers are virtual rows).
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- If a per-type def's aggregation throws (e.g., `aggregateSum` on non-numbers because the registry returns wrong-typed values), the per-type def is buggy — escalate to the slice owner that shipped it.

**Guardrails applied:** #5, #6, #15, #26, #29, #40 (aggregations return strings).

---

### Slice S22 — Wire bulk "Apply column value" to `bulkSetCellValue`

**Owner:** epic-executor (sonnet) · **Stage 5, sequential (after S21).**

**Files (only):**
- `components/board/table/BulkActionBar.tsx` (modify — replace the disabled "Apply column value" tooltip with a working column picker that fires `bulkSetCellValue`)

**Forbidden scope:** any other file.

**Spec:**

1. Read selected `taskIds` from `useBoardStore((s) => s.selection)`.
2. The "Apply column value" button opens a Base UI `<Popover>` with a column picker (only types whose value can be sensibly bulk-set per Q10: status, person, date, checkbox, text, number, currency, priority, rating).
3. Selecting a column shows the column's `<def.Editor>` (using S15's orchestrator pattern but in a non-row context — pass a `null` task and a virtual cell row).
4. On the editor's `onClose(value)`, fire `bulkSetCellValue({ taskIds: [...selection], columnId, value })`.
5. Optimistic update: for each taskId, call `applyCellUpsert(optimistic)`.
6. On server success: reconcile with returned cells.
7. On failure: revert all optimistic updates + toast.
8. Confirm dialog (Base UI `<Dialog>`) before firing if `taskIds.length > 25` — "This will update {N} tasks. Continue?"

**Definition of done:**
- "Apply column value" is a working button with a column picker → editor → bulk apply flow.
- Single roundtrip to the server (`bulkSetCellValue` is one call).
- Optimistic with revert.
- `pnpm typecheck` and `pnpm lint` pass.

**Guardrails applied:** #5, #8 (confirm dialog for large sets), #15, #26, #34.

---

### Stage 6 — Tests + perf + docs

### Slice S23 — Unit test stubs

**Owner:** epic-executor (sonnet) · **Stage 6, parallel-safe with S24/S25.**

**Files (only):**
- `tests/unit/cell-codecs.test.ts` (create — `describe.skip` covering every `def.toRow` + `def.fromRow` round-trip per type)
- `tests/unit/cell-aggregations.test.ts` (create — `describe.skip` covering aggregation helpers from S4)
- `tests/unit/cell-conversions.test.ts` (create — `describe.skip` covering every documented `convertTo` path)
- `tests/unit/column-actions.test.ts` (extend — already created in S5; add cases here)
- `tests/unit/cell-actions.test.ts` (extend — already created in S6; add cases here)

**Forbidden scope:** any production code.

**Spec:** sketch test cases per the epic doc line 418. Use `describe.skip` + `// @ts-expect-error vitest is wired in epic 15`. Cover at least:
- Every cell type's `toRow(value)` produces a patch with EXACTLY one non-null value column (or empty patch for derived types).
- Every cell type's `fromRow(toRow(v))` round-trips to `v`.
- Every aggregator helper's edge cases (empty array, single value, mixed values).
- Every documented conversion (text→number, number→text, status→text, date→timeline, etc.).

**Definition of done:** test files exist with the sketches; `pnpm typecheck` and `pnpm lint` pass.

---

### Slice S24 — E2E test stubs

**Owner:** epic-executor (sonnet) · **Stage 6, parallel-safe with S23/S25.**

**Files (only):**
- `tests/e2e/07-column-system.spec.ts` (create — `test.skip` per the epic-15 convention)

**Spec:** sketch the scenario from epic-07 line 418: "add status column → set value on three tasks → group by status (preview only) → change column type to text → values become titles." Plus: "add column → reorder → resize → hide → bulk apply → revert."

**Definition of done:** spec exists with sketches; `pnpm typecheck` passes.

---

### Slice S25 — Per-folder README documenting "how to add a cell type"

**Owner:** epic-executor (sonnet) · **Stage 6, parallel-safe with S23/S24.**

**Files (only):**
- `components/cells/README.md` (create — short doc explaining: 1. add to `column.type` check constraint via migration; 2. run `pnpm db:types`; 3. create `components/cells/<id>/{def,Cell,Editor}.tsx`; 4. add to `lib/cells/registry.ts`; 5. add to `lib/cells/icons.ts`; 6. add to `lib/cells/seed-labels.ts` if label-backed.)

**Forbidden scope:** any other doc. Do NOT modify `docs/conversion-plan/07-column-system.md` (it's the spec, read-only).

**Definition of done:** README exists, ≥40 lines, walks through the steps.

---

## 5. Sequencing diagram (recap)

```
Stage 0   S0 (alone, blocking)                                       → review
Stage 1   S1 ‖ S2 ‖ S3 ‖ S4                                          → review
Stage 2   S5 ‖ S6 ‖ S7                                               → review
Stage 3   S8 → S9 → S10 → S11 → S12 → S13 → S14 (sequential through registry edit;
          per-folder work parallel within each slice)                → review (mass)
Stage 4   S15 ‖ S16 ‖ S17 ‖ S18                                      → review
Stage 5   S19 → S20 → S21 → S22 (sequential — shared file scope)     → review
Stage 6   S23 ‖ S24 ‖ S25                                            → final review → PR
```

After Stage 6 final review returns CLEAN, the orchestrator opens the PR against `main`. **Before the PR review begins, the orchestrator MUST**:
1. Confirm epic 06 PR (#42) is merged into `main`.
2. Run `git rebase --onto main epic/06-groups-tasks-table epic/07-column-system`.
3. Force-push `epic/07-column-system` (only the epic branch, NEVER `main`).
4. Verify the PR diff now contains only epic-07 commits.

If epic 06 hasn't merged yet, leave the PR as draft and notify the user in the morning.

---

## 6. Risk notes

- **`column.type` check constraint extension is irreversible without a destructive migration.** S0's migration is a strict superset; future trims would require backfill. Document in S0's done report so future migrations don't accidentally narrow it.
- **Tiptap deferral (Q11)** means `long_text` ships as a `<textarea>`. Epic 09 (comments) is the natural place to introduce Tiptap; when it lands, the `long_text` editor is a one-line swap. The activity feed (epic 09) MUST handle plain-string `long_text` payloads even after Tiptap ships — backwards-compatible value codec.
- **Date editor without `react-day-picker` (Q12)** means a hand-rolled month grid. Risk: localization, week-start, ARIA. The hand-rolled date picker is a known scope risk; if the executor S11 needs to escalate, accept `react-day-picker` as a fallback (it's ~30KB gzipped, acceptable).
- **Status fold-reveal animation** is the single most distinctive moment in the product (per the visual spec). If it ships visually wrong, request a screenshot review before stage-3 review pass. The legacy SCSS reference is at `frontend/src/assets/styles/cmps/task-picker/_status-priority-picker.scss:6-28` (legacy gitignored — reference only, do not import).
- **Lazy editor mounting deferred (Q32)** — bundle size for 24 statically imported cell-type editors is a perf risk for very small initial loads. If the executor S15 sees the bundle balloon, escalate; the fallback is `React.lazy` for the heaviest editors (status label editor + timeline + person picker).
- **Stage 3 registry merge conflicts.** Seven slices each modifying `lib/cells/registry.ts`. Discipline matters. The orchestrator should sequence Stage-3 slices through the registry edit even if per-folder work runs in parallel. If conflicts pile up, fall back to a single "S15.5 wire-registry" slice that consolidates all 24 entries after the per-folder work lands.
- **`changeColumnType` with large columns** is unbatched in v1. For boards with thousands of cells per column, this could time out. Document as a known v1 limitation; epic 15 (perf/observability) can add a Postgres function or batched approach.
- **`view.config` localStorage migration** when epic 11 ships saved views. Document the migration path now (the storage key `donezo:board-collapsed:v1` partializes both `collapsedByBoard` AND `columnPrefsByBoard`; epic 11 will migrate `columnPrefsByBoard` entries into per-view `config.columnPrefs` on first save).
- **RLS member vs admin for label edits (Q26).** The migration enforces admin; the doc text suggested member. If product feedback says `member` should be allowed, that's a future migration + a `requireBoardRole` change in S7. Bake the `>= admin` decision into S10's StatusLabelEditor (UX shows "Admins can edit labels" for non-admins).
- **Realtime echoes from epic 08 must not regress.** Epic 07's `applyCellUpsert` / `applyColumnUpsert` / `applyLabelUpsert` MUST be idempotent on `updated_at`. The same shape Realtime will deliver in epic 08 is the same shape server actions return — no payload-shape divergence.
- **Cross-slice integration gap risk** (the epic-06 lesson). Stage 5 is the integration stage. The reviewer should specifically verify: a header column's resize updates the cell width in every row; a header reorder updates cell order in every row; a column type change updates the rendering for every cell in that column; a cell edit fires activity AND echoes through the store.

---

## 7. Reference paths

Absolute paths the executors will read.

**Repo rules + canonical plan:**
- `/Volumes/SSD1T/DEV WORK/donezo/CLAUDE.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/00-overview.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/07-column-system.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/component-system.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/design-system.md`

**Epic dependencies:**
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/02-supabase-schema.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/04-authorization-rls.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/06-groups-tasks-table.md`

**Prior dispatch diaries (lessons-learned source):**
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-06.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-06-followup-1.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-06-followup-2.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-06-followup-3.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-06-followup-4.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-05-final-review.md`

**Live schema + RLS migrations (read for shape):**
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506224930_initial_schema.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260507120000_authz_helpers.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260507120100_rls_policies.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/seed.sql`

**Existing infrastructure to extend / consume:**
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/activity.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/actions/with-user.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/authorization/board.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/group-palette.ts` (precedent for `lib/cells/seed-labels.ts`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/positions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/validations/group.ts` (template for `lib/validations/column.ts`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/validations/task.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/types.ts` (regenerated by S0)
- `/Volumes/SSD1T/DEV WORK/donezo/components/shared/EditableTitle.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/ui/menu-list.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/StickyHeader.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/TaskRow.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/TableVirtualizer.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/AddColumnButton.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/GroupOverflowMenu.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BulkActionBar.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/table-keyboard-context.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/table-scroll-context.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/types.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions.ts` (template for column/cell/label actions)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions.ts` (template + bulk pattern)
- `/Volumes/SSD1T/DEV WORK/donezo/app/globals.css`
- `/Volumes/SSD1T/DEV WORK/donezo/package.json`

**Empty placeholder dirs to fill:**
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/.gitkeep`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/text/`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/status/`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/person/`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/date/`

The orchestrator should save this plan to `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-07.md` and dispatch S0 immediately. After S0 lands and `pnpm db:types` regenerates the types, dispatch Stage 1 (S1–S4) in parallel.

---

agentId: ae4a705f945173307 (use SendMessage with to: 'ae4a705f945173307' to continue this agent)
<usage>total_tokens: 201657
tool_uses: 40
duration_ms: 778024</usage>