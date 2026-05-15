# Epic 11 — Dispatch (auto-approved by scheduled task)

> Approved by autonomous scheduled task on 2026-05-12.
> Orchestrator: the user was not online, so the scheduled task accepted the epic-researcher's recommended default on every open question. Decisions captured below; executors should treat them as authoritative.

## Autonomous decisions

All 24 open questions from the researcher's plan were resolved per the researcher's recommended default. Substantive items worth restating:

- **Q1 — `view.owner_id` vs doc's `view.user_id`:** use `owner_id` everywhere (deployed schema wins; doc drift).
- **Q2 — `view.config` Zod strictness:** strict for the v1 active subset (filter/sort/groupBy/columnVisibility/columnWidths/columnOrder/density/search); permissive `kanban/calendar/timeline/dashboard/form` slots reserved for Epic 12. Malformed config → fall back to `{}` + dev-only warning, never crash.
- **Q3 — client-side vs server-side filter/sort:** client-side only for v1 over the existing store. `lib/filtering/apply-*.ts` are pure so a future SQL translator can reuse them.
- **Q4 — URL wire format:** base64url JSON under `?f=` (filter), `?s=` (sort), `?g=` (groupBy), `?q=` (search), `?d=` (density), `?view=` (saved view id). 2 KB cap; if exceeded, toast "Filter too large to share via URL — save it as a view".
- **Q5 + Q18 — single-key vs multi-key sort:** replace `sortColumnId / sortDirection / setSort` with `sortKeys: SortKey[]`. Column-header quick-sort writes `sortKeys = [{ columnId, direction }]`. `<SortBuilder>` owns the multi-key path. Legacy fields deleted (one small intra-branch break).
- **Q6 — view tabs:** `<BoardViewTabs>` (kind tabs) is replaced by `<ViewTabs>` (saved-view tabs). Non-table kinds disabled with "Coming in Epic 12" tooltip.
- **Q7 — column widths / visibility persistence:** migrate from `columnPrefsByBoard` localStorage to `view.config.columnWidths / columnVisibility`. One-shot mount-time migration folds existing per-user localStorage prefs into the user's personal view; legacy slice then deleted.
- **Q8 — default views:** `create_board` RPC inserts shared "Main table" (`is_shared=true, owner_id=null, position=0`). First board open per user auto-creates personal "My view" (`is_shared=false, owner_id=auth.uid(), position=1`). Active on first open = "Main table".
- **Q9 — active-view resolution:** URL `?view=` → `profile.last_view_per_board[boardId]` → workspace `Main table` → first by `position`.
- **Q10 — in-board search scope:** task.title + visible-cell text via new `def.toSearchString`. Hidden columns included. No comments search; no fuzzy match.
- **Q11 — Cmd-K SQL:** `public.global_search(p_workspace_id uuid, q text)` SECURITY INVOKER, `ilike`, `limit 20`, returns `(kind, id, title, board_id, board_title)`. Cmd-K on Mac, Ctrl-K elsewhere; skipped when an input/textarea/contenteditable owns focus unless that focus is inside the palette.
- **Q12 — alt group-by semantics:** purely client-side re-bucketing; DnD reorder across alt-buckets disabled (would imply mutating `cell.value` rather than `task.group_id`).
- **Q13 — bucket order in alt group-by:** by `def.compare`, "Uncategorized" appended last. Status/priority use `label.position`. Person alphabetical. Date ascending chronological with "No date" last.
- **Q14 — OR groups / nested filters:** data shape supports them; v1 UI emits single-level AND only. Decoder accepts the broader shape so v1.5 can add the UI without a breaking change.
- **Q15 — `OperandEditor`:** optional on `CellTypeDef`. Six types ship a compact picker: `status, priority, person, date, tags, country`. The other 18 fall back to the regular `Editor` inside a small popover.
- **Q16 — hidden columns in filter/sort/group pickers:** still selectable (hidden is presentational, not a privacy gate).
- **Q17 — density tokens:** `compact = 28px`, `default = 36px`, `spacious = 48px` row height via `--size-row-h` keyed off `data-density` on the table root. `--size-cell-h` unchanged.
- **Q19 — save semantics:** manual save. URL state ≠ `view.config` → "Save" + "Reset" buttons visible. Auto-save-draft toggle deferred.
- **Q20 — realtime:** no changes to `use-board-realtime.ts`. Filter/sort/group is pure client derivation.
- **Q21 — non-table view kinds in v1:** reserved in Zod schema (`z.unknown().optional()`), disabled in `<AddViewMenu>` with "Coming in Epic 12" tooltip.
- **Q22 — "My view" auto-create kind:** always `table`.
- **Q23 (flagged NEEDS USER) — column ORDER scope:** per-view override via `view.config.columnOrder`. Matches the epic doc's `ViewConfig`. The "save this order as the board default" path is deferred to a followup.
- **Q24 (flagged NEEDS USER) — `last_view_per_board` write cadence:** debounce 750ms after the last view-switch, flush on `pagehide`, cap one write per 2s.

### Deferred to followup work (do NOT in-scope this epic)

- OR groups / nested filter trees in the UI (Q14).
- "Save this column order as the board default" mutator (Q23 followup).
- Personal-view "Auto-save changes" toggle (Q19 followup).
- Person-cell `toSearchString` resolving to display names — needs a `resolveUser(id) => display_name` ctx in the registry call (researcher risk note #11).
- Postgres full-text / `tsv` index for board-wide / comment search.
- DnD reorder of tasks within column-based group-by buckets (Q12 followup).
- "Filter too large for URL" → server-stored draft view (Q4 escalation path).
- Partial unique index on `(board_id, owner_id, kind)` to prevent duplicate "My view" rows under tab-race (researcher risk note #7).

### Cross-slice contract notes (executor-binding)

- **Sort + DnD:** when `sortKeys.length > 0`, DnD reorder is disabled. Drag handle hidden. Slice B documents on `applySort` JSDoc; Slice D drag-handle render gates on it.
- **Column-based group-by + DnD:** drag disabled under non-native group-by. Slice B coordinates.
- **`view_modify` state invariant:** Slice E always either sets `owner_id = userId` (personal, `is_shared = false`) or `owner_id = null` + `is_shared = true` (shared/system). No CHECK constraint in the migration — server-action discipline enforces.
- **`useShallow` everywhere:** every multi-field `useBoardStore` selector this epic introduces wraps with `useShallow`. Reviewers grep `useBoardStore((s) => ({` and `useBoardStore((s) => [...` on each PR.

### Stack reminders (do not drift)

- pnpm only. Next 15 App Router, RSC-first. Server Actions for mutations.
- TypeScript strict; regen Supabase types via `pnpm db:types`.
- Tailwind v4 + shadcn/ui + Base UI (`@base-ui/react`). No MUI / SCSS.
- Forms: React Hook Form + Zod v4. One schema validates client + server.
- TanStack Table + Virtual already mounted. Zustand v5 + `useShallow`.
- All ids `uuid v4` from Postgres. All times `timestamptz`. `view` rows hard-delete.
- Migrations under `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Next free timestamp `>20260514000004`; this plan uses `20260515000000+`.

---

---

# Epic 11: Filtering, Sorting, Search, Saved Views — Dispatch Plan

## Preconditions verified

**Merged dependencies (epics 01–10) — all present:**

- **Epic 02 — schema.** `public.view` table exists at `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506224930_initial_schema.sql:329-348` with columns `id, board_id, owner_id, name, kind, config jsonb, is_shared, position, created_at, updated_at`. Important **schema-vs-epic-doc drift**: epic 11 doc refers to `view.user_id` (epic 02 doc's name); the deployed schema uses `owner_id` and adds an `is_shared` boolean. The deployed `kind` check accepts `'table' | 'kanban' | 'calendar' | 'timeline' | 'dashboard' | 'form'`. `position` was restored by `20260506230238_view_board_pos_idx.sql`.
- **Epic 04 — `view` RLS.** Two policies in `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260507120100_rls_policies.sql:383-408`: `view_select` (any board role can read shared or own personal or owner-null system rows) and `view_modify` (admin+ for shared/system rows; owner-only for personal rows). Helpers `role_for_board` and `role_rank` are SECURITY DEFINER and avoid the self-referential RLS subquery problem (MEMORY: donezo-rls-helpers).
- **Epic 05 — `create_board` RPC** at `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260507120200_invitations_and_creation_rpcs.sql:185-215`. **Does NOT currently insert a default "Main table" view** — Epic 11 must add this. The RPC is `security definer set search_path = public`, so the additional INSERT will run with elevated privileges and won't fight `view_modify` RLS.
- **Epic 06 — board table.** `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx` (848 lines) is the surface filter/sort/group-by must hook into. Row list is currently built directly from `state.tasks` filtered/sorted only by `group_id` + `position` (lines 388–412). No filter/sort/group-by is applied to the rendered row order.
- **Epic 07 — column system + cell registry.** `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/types.ts:113-232` defines `CellTypeDef<TValue, TConfig>` with `filterOperators: FilterOperator[]`, `matchesFilter(value, op, operand) => boolean`, and `compare(a, b) => number` — **all 24 cell defs ship these methods** (verified for text/status/person/date/number; same pattern for the rest). `FILTER_OPERATOR_LABELS` is defined at `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/filter-operators.ts`. The registry does **NOT** yet expose `toSearchString` (epic 11 needs it for in-board search) or `OperandEditor` (epic 11 needs it for compact filter-operand input) — both are net-new additions Epic 11 introduces.
- **Epic 08 — realtime.** `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-realtime.ts` subscribes to `board:<boardId>` and routes `cell` UPDATE events through the store. Filtering happens client-side over the same store; no realtime changes required for filter/sort. Saved views (`view` table) are not in the realtime publication today and don't need to be — view writes are admin/own-only and tab open/refresh hydrates.
- **Epic 09 / 10 — task drawer, comments, attachments.** Active, unaffected by epic 11 scope.

**Existing store / UI surface to reuse:**

- **Per-board column prefs already persisted.** `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts:30` declares `columnPrefsByBoard: Record<string, Record<string, { width?: number; hidden?: boolean }>>` and persists it via the zustand `persist` middleware (line 1103). `setColumnWidth(columnId, width)` and `toggleColumnHidden(columnId)` actions exist at lines 535–555. **Column resize + hidden state is therefore already per-user-per-board persistent — Epic 11 wires this same data into `view.config` for view-scoped persistence.**
- **Ephemeral sort already in store.** `sortColumnId: string | null` + `sortDirection: 'asc' | 'desc' | null` + `setSort()` at lines 31–32, 558–562. **Currently a no-op rendering-wise** — `ColumnHeader` only shows an arrow indicator (`components/board/table/ColumnHeader.tsx:121-128`) and the rendered row list never consults sort. Epic 11 must either (a) replace this single-key sort with a multi-key sort consumed by `BoardTable`'s row build, or (b) keep this single-key as the "draft" overlay while a saved view holds multi-key — see Q5.
- **Existing view tabs are kind-only.** `/Volumes/SSD1T/DEV WORK/donezo/components/board/BoardViewTabs.tsx` currently renders five hardcoded view-kind tabs (Table / Kanban / Calendar / Timeline / Dashboard) — all but Table are stubs. Epic 11 must replace this with **saved-view tabs** (which include kind), not kind-switching tabs. Kanban / Calendar / Timeline / Dashboard are Epic 12 work; Epic 11 ships table-kind saved views only but the data model and tab UI must accommodate the others.
- **No filter, search, density, or group-by UI exists.** `/Volumes/SSD1T/DEV WORK/donezo/components/filters/` directory is empty. `<SearchStub>` placeholder lives at `/Volumes/SSD1T/DEV WORK/donezo/components/shared/topbar/SearchStub.tsx` — Epic 11 replaces it with the Cmd-K palette.
- **Profile shape.** `profile` has `id, email, display_name, avatar_url, last_workspace_id` (`lib/supabase/types.ts:598-625`). **`last_view_per_board` is NOT yet on profile** — Epic 11 adds it.
- **Server-action conventions.** `withUser` wrapper at `/Volumes/SSD1T/DEV WORK/donezo/lib/actions/with-user.ts` returns `ActionResult<T> = { ok: true, data } | { ok: false, error }` and parses Zod errors into `VALIDATION` codes. All Epic 11 server actions must use this wrapper.
- **MEMORY-flagged trap.** `useBoardStore(selector)` calls that compute a fresh object/array crash with infinite render loops unless wrapped in `useShallow`. Epic 11 introduces several derived-task lists (filtered tasks, sorted tasks, grouped buckets, search hits) — every multi-field store selector must use `useShallow` or read a single primitive/Map.get/Set.has.

**Stack defaults present (all from CLAUDE.md and confirmed in repo):**

- pnpm only. Next 15 App Router. TypeScript strict. RSC-first; `"use client"` only for interactivity.
- Server Actions for mutations. `app/**/actions.ts` next to route.
- Tailwind v4 + shadcn/ui + Base UI (`@base-ui/react`). No MUI / SCSS.
- Forms: React Hook Form + Zod v4. One schema validates client + server.
- TanStack Table + Virtual already in board table. Zustand v5 + `useShallow`.
- All ids `uuid v4` from Postgres. All times `timestamptz`. Soft-delete by `deleted_at` where applicable; `view` rows are hard-deleted (no `deleted_at` column).
- Migrations under `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Next free timestamp: `>20260514000004`. Plan uses `20260515000000+`.

## Open questions for the user

Each question lists the recommended default the scheduled task should auto-approve. Defaults are strong. Items flagged **NEEDS USER** must remain unanswered until a human is in the loop.

1. **Schema-vs-epic-doc drift: `view.owner_id` (repo) vs `view.user_id` (epic doc).**
   **Default:** Use `owner_id` everywhere in Epic 11 code. The schema is deployed, RLS references `owner_id`, and Epic 11's text mentioning `view.user_id` is doc drift carried from the schema doc's first version. Every slice spec below uses `owner_id`. (No user input needed; reality wins.)

2. **`view.config jsonb` Zod schema strictness.**
   **Default:** Use **strict** Zod parsing (no `passthrough`, no `catch`) for the active subset of `ViewConfig` (filter, sort, groupBy, columnVisibility, columnWidths, columnOrder, density, search) and a permissive `kanban / calendar / timeline / dashboard` slot (`z.unknown().optional()`) reserved for Epic 12. A malformed config row → fall back to defaults and surface a single dev-only warning; never crash the board. Rationale: a stricter schema catches executor drift; the permissive future-view slot avoids handcuffing Epic 12. (No user input needed.)

3. **Server-side vs client-side filter/sort in v1.**
   **Default:** **Client-side only** for v1, per epic doc § "Filter evaluation" and § "Sort evaluation". The board already streams every task/cell into the store for realtime. Add `useDeferredValue` over the search input and a debounced URL push. Document a future-work seam (`lib/filtering/applyFilterTree.ts` is a pure function so a server-side SQL translator can call the same predicates server-side when board scale forces it). (Matches epic doc verbatim.)

4. **Filter-tree wire format on the URL.**
   **Default:** Base64-encoded **JSON** of `FilterTree` under `?f=<base64>`; same encoding for sort (`?s=<base64>`), groupBy (`?g=<columnId>` or `?g=native`), search (`?q=<urlencoded>`), and density (`?d=compact|default|spacious`). Keep `?view=<viewId>` as the saved-view selector. Cap the encoded filter string at 2 KB; above that, fall back to a server-stored draft view (deferred to v1.5; in v1, surface a toast "Filter too large to share via URL — save it as a view"). (Matches epic doc "base64 JSON" verbatim; explicit cap is a senior-eng default.)

5. **Single-key sort in store today vs multi-key sort epic 11 needs.**
   **Default:** **Replace** `sortColumnId / sortDirection` with `sortKeys: SortKey[]` in the store. Migrate the two consumers in `ColumnHeader.tsx` and `ColumnHeaderMenu.tsx` (Sort menu items) to read the **first** key in `sortKeys` for the indicator + active-direction toggle, and to set `sortKeys = [{ columnId, direction }]` when invoked from the column header (single-column quick-sort). The full multi-key path lives in `<SortBuilder>` (slice C). This avoids carrying two parallel sort fields. (Senior-eng default.)

6. **Saved-view tabs vs kind-tabs.**
   **Default:** Replace `<BoardViewTabs>` (kind-tabs: Table/Kanban/...) with `<ViewTabs>` (saved-view tabs: "Main table", "My view", "+ Add view"). Kind is a property of each saved view, surfaced as an icon. The current Table page route (`/w/.../b/<id>` with no segment) is the **only** active kind in Epic 11; kind-switching is implicit in opening a kanban/calendar/timeline/dashboard-kind view (those throw a "Coming in Epic 12" toast and remain disabled in the "+ Add view" dropdown for now). Epic 12 will navigate to `/w/.../b/<id>/kanban` etc. as it lands. (Matches epic doc § "View tabs UI".)

7. **Persistence model for column widths and visibility (existing `columnPrefsByBoard` localStorage slice).**
   **Default:** Migrate column widths and visibility from `columnPrefsByBoard` (localStorage, per-user-per-board, view-agnostic) into the active **view**'s `config.columnWidths` and `config.columnVisibility`. The localStorage slice remains as a **fallback** for the brief moment between board mount and active-view resolution (or if no per-user view exists yet). When the active view is resolved, edits to width/visibility persist to `view.config` via a debounced `saveView` server action; the localStorage slice is dropped (a one-shot migration on first epic-11 mount writes any existing prefs into the user's auto-created personal view). Per-user widths/visibility therefore become **view-scoped**, which matches the epic doc's design. (Senior-eng default.)

8. **Default view auto-creation policy.**
   **Default:** Two-level defaults per epic doc:
   - **On `create_board` RPC:** insert one shared `view` row with `name='Main table'`, `kind='table'`, `is_shared=true`, `owner_id=null`, `config='{}'`, `position=0`. This is the workspace-wide default.
   - **On first board open by user X:** if there is no `view` row with `owner_id=X` for this board, the board page (RSC) creates one via a `getOrCreatePersonalView` server action: `name='My view'`, `kind='table'`, `is_shared=false`, `owner_id=auth.uid()`, `config='{}'`, `position=1`.
   The "active view" on first open is `Main table`. (Matches epic doc § "Default views".)

9. **Active-view resolution priority.**
   **Default:** URL `?view=<id>` (if id exists and is RLS-readable) → `profile.last_view_per_board[boardId]` (if id exists and is readable) → workspace default `Main table` (always present after task 1) → first RLS-readable view by `position`. (Matches epic doc.)

10. **In-board search scope.**
    **Default:** v1 searches `task.title` + visible-cell text (via a new `def.toSearchString(value, config) => string` on the cell registry). Comments are **not** searched in-board (epic doc explicitly defers). Hidden columns ARE included in search (hiding is presentational, not a privacy filter). Case-insensitive, no fuzzy matching. (Matches epic doc.)

11. **Global Cmd-K search SQL function exposure.**
    **Default:** Per epic doc — add SQL function `public.global_search(p_workspace_id uuid, q text)` with `security invoker`, plain `ilike` for v1, `limit 20`, ordered by kind then title. RLS still applies because of `security invoker`. Server action `globalSearch({ workspaceId, q })` wraps the RPC via the user client and is debounced 200ms client-side. Cmd-K keyboard shortcut: `Cmd-K` on macOS, `Ctrl-K` elsewhere; capture at the topbar level and skip when an `<input>` / `<textarea>` / `contenteditable` is focused unless that focus is the palette itself. (Matches epic doc.)

12. **Group-by alternate column — non-mutating bucketing semantics.**
    **Default:** Alt group-by re-buckets tasks **purely client-side**. The rendered groups become `cell.value`-derived buckets; the structural `group` rows are hidden for the duration of the view. **No drag-and-drop reorder of tasks across alt-buckets** in v1 (because moving a task between buckets would imply mutating `cell.value`, not `task.group_id` — confusing semantics). Document this in the GroupBy popover ("Group-by view is read-only for reordering"). Switching the view back to native group-by restores DnD. (Senior-eng default, matches epic doc § "Group-by" intent.)

13. **Status / priority / person / date / etc. — bucket order for alt group-by.**
    **Default:** Use the cell type's `def.compare` for ordering buckets, with an explicit "Uncategorized" bucket appended last for `null`/empty values. For `status`/`priority`, the order is `label.position` (the editor-controlled order). For `person`, alphabetical by display name. For `date`, ascending chronological with "No date" last. (Senior-eng default.)

14. **OR groups / nested filter trees in v1 UI.**
    **Default:** Defer per epic doc. The `FilterTree` data shape supports OR/nesting, but the v1 UI emits only single-level `{ kind: 'and', clauses: [Comparison, ...] }`. The decoder accepts the broader shape so we can introduce OR groups in v1.5 without a breaking change. (Matches epic doc.)

15. **Per-cell-type `OperandEditor` — fallback to `Editor`?**
    **Default:** Optional on `CellTypeDef`. When absent, the filter row reuses the regular `def.Editor` rendered inside a small Popover (`editorMode` is ignored; the filter UI always pops over). When present, `OperandEditor` is preferred and gets a `compact: boolean` prop. Six cell types ship `OperandEditor` in this epic: `status`, `priority`, `person`, `date`, `tags`, `country` (these are the popover-mode pickers whose default Editor renders chips/calendars too large for a filter row). The other 18 types use their existing inline editors as-is. (Senior-eng default; epic doc says "default is the regular Editor".)

16. **Column visibility — does hidden also hide from group-by / sort / filter pickers?**
    **Default:** **No.** Hidden columns remain selectable in filter / sort / group-by pickers (the user can still filter by hidden columns; that's a common workflow when a column is hidden for noise reduction but its data still matters). The Hide popover is exclusively about column rendering in the table. (Senior-eng default.)

17. **Density tokens.**
    **Default:** Three CSS variables driven by `data-density` on the table root: `compact` (`--size-row-h: 28px`), `default` (`--size-row-h: 36px` — current `--size-cell-h`), `spacious` (`--size-row-h: 48px`). All other paddings derive from `--size-row-h` math; cell skeleton border / corner radius are constant. `--size-cell-h` is not touched (it remains 36px and is used in non-row contexts — column headers, footers). (Senior-eng default; epic doc is silent on exact values.)

18. **Re-architect `setSort` consumers, or keep `sortColumnId` as a thin facade?**
    **Default:** Refactor the two consumers (`ColumnHeader.tsx`, `ColumnHeaderMenu.tsx`) and **delete** the legacy `sortColumnId / sortDirection / setSort` fields once `sortKeys` is wired. This is one small breaking change inside the epic branch. The alternative (keep as facade) carries two parallel sort fields forever. (Senior-eng default; consequence of Q5.)

19. **Saving view edits — "save filters" vs "auto-save on edit".**
    **Default:** **Manual save.** Editing filter/sort/group/visibility on a view produces a draft (URL-encoded). A "Save" button appears in the view-tab dropdown when the URL state differs from `view.config`. Save invokes `saveView` (admin+ for shared rows, owner-only for personal). For personal rows, an extra dropdown item "Save changes automatically" can flip a `view.config.autoSaveDraft = true` flag — **defer this toggle to a followup**; v1 is manual-save only. (Matches epic doc § "View tabs UI".)

20. **Realtime + filter — does the realtime hook need any change?**
    **Default:** **No.** Filter/sort/group/visibility are pure client-side derivations over the existing store, computed inside `BoardTable`'s render. Realtime continues to push raw cell/task/etc. into the store; the derived view simply recomputes. No new realtime channel, no new postgres_changes filter. (Matches epic doc.)

21. **`view.config` for kind = `'kanban' | 'calendar' | 'timeline' | 'dashboard' | 'form'` in Epic 11.**
    **Default:** Reserve the keys in the Zod schema (`z.unknown().optional()` per Q2) but do **not** implement view-kind-specific UI. The "+ Add view" dropdown lists Table only; the other kinds appear disabled with a "Coming in Epic 12" tooltip. (Matches epic doc.)

22. **Default view kind for "My view" auto-create.**
    **Default:** `table`. Always. (No other kinds ship in v1.)

23. **NEEDS USER — Should column ORDER (drag-reorder within the Hide popover) override the board-global `column.position` for the view, or persist back to `column.position` for the board?**
    **The default I'd pick if forced:** Per-view override via `view.config.columnOrder: string[]`. This matches the epic doc's `ViewConfig`. But it has a subtle data-model implication: there's no longer a single "the columns are in this order" reality on the board — the order depends on which view you're looking at. **My recommendation:** start with per-view override (the docs-locked behavior), and the followup work to allow "save this order as the board default" can land in a later slice. **Flagged for the user** because it's a UX semantics call. The scheduled task should accept per-view override unless the user objects.

24. **NEEDS USER — Persisting `last_view_per_board` on every view switch is one write per switch — debounce or eager?**
    **The default I'd pick if forced:** Debounce 750ms after the last view-switch event; flush on `pagehide`. Cap to one write per 2s. This is a tiny write and rate-limiting is a polish concern, but eager writes on every tab click would spam the DB. **Flagged for the user** so the scheduled task can confirm; default is "debounce 750ms".

## Stack reminders (CLAUDE.md — do not drift)

- pnpm only.
- Next 15 App Router, RSC-first. `"use client"` only for interactivity.
- Server Actions for mutations. No `/api` route handlers.
- TypeScript strict; regen Supabase types via `pnpm db:types`.
- Tailwind v4 + shadcn/ui + Base UI (`@base-ui/react`). No MUI / SCSS.
- Forms: React Hook Form + Zod v4. One schema validates client + server.
- DnD: dnd-kit. Rich text: Tiptap. Tables: TanStack Table + Virtual. Toasts: sonner.
- Zustand v5; **every multi-field or derived selector wrapped in `useShallow`** (MEMORY: donezo-zustand-v5-selectors).
- RLS is the source of truth. Helpers `role_for_board` / `role_rank` for any privilege check.
- All ids `uuid v4` from Postgres `gen_random_uuid()`. All times `timestamptz`. Soft-delete by `deleted_at` for top-level entities; `view` rows hard-delete.
- Migrations under `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Next free timestamp: `>20260514000004`.

---

## Stage 1 — six parallel slices (A is the only blocker)

Slice A (schema + view types + cell-registry contract extensions) is the only Stage-1 pre-req. B, C, D, E, F run in parallel after A merges. Slice G (Stage 2) is sequential integration. Slice H (Stage 3) is e2e and topbar global search.

---

### Slice A — Schema, view types, cell-registry contract extensions

**Branch:** `epic/11-filtering-views/a-schema-and-contracts`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260515000000_profile_last_view_per_board.sql` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260515000001_default_view_on_create_board.sql` (new — patch `create_board` RPC to insert "Main table")
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260515000002_global_search_fn.sql` (new — `public.global_search(p_workspace_id uuid, q text)`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/types.ts` (regen via `pnpm db:reset && pnpm db:types`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/types.ts` (extend `CellTypeDef` — add `toSearchString` required, `OperandEditor` optional)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/filter-operators.ts` (extend — add `getOperandArity` helper used by the filter UI to decide whether an operand input is needed)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/views/config-schema.ts` (new — `ViewConfigSchema`, `FilterTreeSchema`, `SortKeySchema`, `GroupBySchema`, `DensitySchema` Zod schemas + inferred types)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/views/url-codec.ts` (new — `encodeFilterTree`, `decodeFilterTree`, same for sort; pure functions, base64-JSON)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/text/def.ts` (extend — implement `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/long_text/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/status/def.ts` (extend — `toSearchString` returns label title via config lookup; will need column/labels access — see spec)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/priority/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/person/def.ts` (extend — `toSearchString` returns "" for v1; see spec)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/date/def.ts` (extend — `toSearchString` returns ISO date string)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/timeline/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/number/def.ts` (extend — `toSearchString` numeric.toString)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/currency/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/checkbox/def.ts` (extend — `toSearchString` returns "true"/"false"/"")
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/def.ts` (extend — `toSearchString` returns "")
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/link/def.ts` (extend — `toSearchString` returns URL+label)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/tags/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/rating/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/email/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/phone/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/country/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/vote/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/week/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/location/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/updated_by/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/created_by/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/created_at_col/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/formula/def.ts` (extend — `toSearchString`)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/view-config-schema.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/view-url-codec.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/cell-to-search-string.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/global_search_rls.spec.sql` (new pgTAP — verify RLS is enforced via `security invoker`)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/default_view_on_create_board.spec.sql` (new pgTAP — `create_board` inserts the Main table view)

**Forbidden:** Any file under `app/`, `components/board/`, `components/filters/`, `stores/`, `hooks/`, the server-action layer in `app/.../actions.ts`. Do not touch `lib/cells/registry.ts` (the registry file itself stays clean — only the per-type defs add their `toSearchString` field).

**Depends on:** none.

**Spec (self-contained):**

#### A.1 — Migration: `20260515000000_profile_last_view_per_board.sql`

```sql
-- Epic 11 — per-user "last opened view" memory, scoped per board.
-- Map: { [boardId: uuid]: viewId: uuid }.
alter table public.profile
  add column last_view_per_board jsonb not null default '{}'::jsonb;

-- No index needed; only ever fetched as profile.last_view_per_board for auth.uid().
-- No GIN — we read the whole jsonb on profile load.
```

#### A.2 — Migration: `20260515000001_default_view_on_create_board.sql`

Patch the `create_board` RPC to insert a shared "Main table" view as part of the same transaction. Idempotency: if a view with `is_shared = true and name = 'Main table'` already exists for the board (it won't on create, but to be safe), skip.

```sql
create or replace function public.create_board(p_workspace_id uuid, p_name text, p_is_private boolean)
returns public.board
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_role  text;
  v_board public.board;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  select role into v_role from public.workspace_member
    where workspace_id = p_workspace_id and user_id = v_user;
  if v_role is null or public.role_rank(v_role) < public.role_rank('member') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.board (workspace_id, name, created_by, is_private)
    values (p_workspace_id, p_name, v_user, coalesce(p_is_private, false))
    returning * into v_board;
  if coalesce(p_is_private, false) then
    insert into public.board_member (board_id, user_id, role)
      values (v_board.id, v_user, 'owner');
  end if;
  -- Epic 11 — default shared "Main table" view.
  insert into public.view (board_id, owner_id, name, kind, config, is_shared, position)
    values (v_board.id, null, 'Main table', 'table', '{}'::jsonb, true, 0);
  return v_board;
end $$;

-- Grant unchanged.
```

Note: a future executor must NOT add `grant execute on function public.create_board(uuid, text, boolean) to authenticated` again — it already exists in `20260507120200_invitations_and_creation_rpcs.sql`.

#### A.3 — Migration: `20260515000002_global_search_fn.sql`

```sql
-- Epic 11 — global search across boards + tasks in a workspace.
-- security invoker so RLS still enforces visibility.
create or replace function public.global_search(p_workspace_id uuid, q text)
returns table(
  kind text,
  id uuid,
  title text,
  board_id uuid,
  board_title text
)
language sql stable security invoker
set search_path = public
as $$
  select 'board' as kind, b.id, b.name as title, b.id as board_id, b.name as board_title
    from public.board b
   where b.workspace_id = p_workspace_id
     and b.name ilike '%' || q || '%'
     and b.deleted_at is null
  union all
  select 'task' as kind, t.id, t.title, t.board_id, b.name as board_title
    from public.task t
    join public.board b on b.id = t.board_id
   where b.workspace_id = p_workspace_id
     and t.title ilike '%' || q || '%'
     and t.deleted_at is null
     and b.deleted_at is null
  order by 1, 3
  limit 20;
$$;

grant execute on function public.global_search(uuid, text) to authenticated;
```

Note: column names are `b.name` and `t.title` (board uses `name`; task uses `title` per the deployed schema — verify against `lib/supabase/types.ts`).

#### A.4 — `CellTypeDef` contract extensions

Edit `lib/cells/types.ts`. Add two fields:

```ts
/**
 * Render the value as a plain-text searchable string. Used by in-board search
 * (Epic 11) to test whether a cell matches a free-text query.
 *
 * MUST be a pure function. Return "" when the cell is empty or when search has
 * no useful representation (e.g. file cell — file names are searched via the
 * attachment table directly in v2; for v1 file returns "").
 *
 * `config` is the column.settings jsonb (typed as TConfig). Some types resolve
 * labels via config (e.g. status pulls label title from column.labels).
 */
toSearchString: (value: TValue | null, config: TConfig) => string;

/**
 * Optional compact-mode operand input for the filter builder. When absent, the
 * filter UI falls back to the regular `Editor` rendered in a Base UI Popover.
 *
 * `compact: true` signals the editor to shrink internal paddings and hide
 * footer chrome that's appropriate for a free-standing cell edit.
 *
 * `op` is the active filter operator — useful for editors that switch between
 * single-value and multi-value modes (e.g. status `equals` vs `in`).
 */
OperandEditor?: ComponentType<{
  value: unknown;
  config: TConfig;
  op: FilterOperator;
  compact: true;
  onChange: (next: unknown) => void;
  onClose: () => void;
}>;
```

`toSearchString` is **required**, so every cell def must add it in this slice. Default for empty / null returns `""`. The 18 cell types listed above each get a one-liner implementation per type semantics.

For status / priority:
```ts
toSearchString: (value, config) => {
  // value is `{ labelId: string | null }` and config has `labels: Label[]`
  // when the column is fully hydrated. The board store carries labelsByColumn
  // separately, so the runtime caller must pass column.settings as config.
  // If a label can't be resolved, return "".
  if (!value?.labelId) return "";
  const lbl = config?.labels?.find((l: { id: string }) => l.id === value.labelId);
  return lbl?.title ?? "";
},
```
For person: returns `""` for v1 — person values are arrays of user_ids, and resolving to display names requires the member roster which isn't accessible from a pure function. Document: "v1 fallback; v1.5 will pass a `resolveUser` ctx into toSearchString".

For date / timeline: ISO date strings (`"2025-12-01"` and `"2025-12-01 → 2025-12-15"`).

For number / currency / rating: `String(value)`.

For checkbox: `value ? "true" : "false"` (lowercase, so search for "true" matches).

For tags: tag titles joined by space.

For link: `[label, url].filter(Boolean).join(" ")`.

For email / phone / country: the string itself.

For updated_by / created_by / created_at_col / formula: `""` for v1 (these are derived display-only).

For file / vote / week / location: `""` for v1 (no obvious text representation).

#### A.5 — Filter operator arity helper

Edit `lib/cells/filter-operators.ts`. Add:

```ts
/**
 * How many operand inputs a filter row needs for this operator.
 *
 *   "none"   → is_empty, is_not_empty, today, this_week, this_month
 *   "one"    → equals, not_equals, contains, not_contains, starts_with,
 *              ends_with, lt, lte, gt, gte, before, after
 *   "many"   → in, not_in
 *   "range"  → between
 */
export type OperatorArity = "none" | "one" | "many" | "range";

export function getOperatorArity(op: FilterOperator): OperatorArity {
  switch (op) {
    case "is_empty":
    case "is_not_empty":
    case "today":
    case "this_week":
    case "this_month":
      return "none";
    case "in":
    case "not_in":
      return "many";
    case "between":
      return "range";
    default:
      return "one";
  }
}
```

#### A.6 — `lib/views/config-schema.ts`

```ts
import { z } from "zod";

// Filter tree
export const FilterOperatorSchema = z.enum([
  "equals", "not_equals", "contains", "not_contains",
  "starts_with", "ends_with", "is_empty", "is_not_empty",
  "in", "not_in", "lt", "lte", "gt", "gte", "between",
  "before", "after", "today", "this_week", "this_month",
]);

export const ComparisonSchema = z.object({
  columnId: z.string().uuid(),
  operator: FilterOperatorSchema,
  operand: z.unknown(), // type depends on cell type; runtime-validated by the cell registry
});

export type FilterTree =
  | { kind: "and"; clauses: FilterTree[] }
  | { kind: "or"; clauses: FilterTree[] }
  | { kind: "comparison"; comparison: z.infer<typeof ComparisonSchema> };

export const FilterTreeSchema: z.ZodType<FilterTree> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("and"), clauses: z.array(FilterTreeSchema) }),
    z.object({ kind: z.literal("or"), clauses: z.array(FilterTreeSchema) }),
    z.object({ kind: z.literal("comparison"), comparison: ComparisonSchema }),
  ]),
);

// Sort
export const SortKeySchema = z.object({
  columnId: z.string().uuid(),
  direction: z.enum(["asc", "desc"]),
});
export type SortKey = z.infer<typeof SortKeySchema>;

// Group-by
export const GroupBySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("native") }),
  z.object({ kind: z.literal("column"), columnId: z.string().uuid() }),
]);
export type GroupBy = z.infer<typeof GroupBySchema>;

// Density
export const DensitySchema = z.enum(["compact", "default", "spacious"]);
export type Density = z.infer<typeof DensitySchema>;

// View kind
export const ViewKindSchema = z.enum([
  "table", "kanban", "calendar", "timeline", "dashboard", "form",
]);
export type ViewKind = z.infer<typeof ViewKindSchema>;

// The whole config jsonb
export const ViewConfigSchema = z.object({
  filter: FilterTreeSchema.optional(),
  sort: z.array(SortKeySchema).optional(),
  groupBy: GroupBySchema.optional(),
  columnVisibility: z.record(z.string().uuid(), z.boolean()).optional(),
  columnWidths: z.record(z.string().uuid(), z.number().positive()).optional(),
  columnOrder: z.array(z.string().uuid()).optional(),
  density: DensitySchema.optional(),
  search: z.string().optional(),
  // Reserved for Epic 12 — permissive shape.
  kanban: z.unknown().optional(),
  calendar: z.unknown().optional(),
  timeline: z.unknown().optional(),
  dashboard: z.unknown().optional(),
  form: z.unknown().optional(),
});
export type ViewConfig = z.infer<typeof ViewConfigSchema>;

/** Permissively parse a config jsonb — returns {} when parsing fails. */
export function parseViewConfig(raw: unknown): ViewConfig {
  const r = ViewConfigSchema.safeParse(raw);
  if (r.success) return r.data;
  if (process.env.NODE_ENV !== "production") {
    console.warn("[view] config failed validation; falling back to defaults", r.error);
  }
  return {};
}
```

#### A.7 — `lib/views/url-codec.ts`

```ts
import {
  FilterTreeSchema, type FilterTree,
  SortKeySchema, type SortKey,
} from "./config-schema";

const MAX_ENCODED_LENGTH = 2048; // 2 KB

/** Base64url-encode JSON. Returns null when input is empty or too large. */
function encodeJson(payload: unknown): string | null {
  const json = JSON.stringify(payload);
  if (typeof window === "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const urlSafe = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return urlSafe.length > MAX_ENCODED_LENGTH ? null : urlSafe;
}

function decodeJson<T>(encoded: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: unknown } }): T | null {
  try {
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = typeof window === "undefined"
      ? Buffer.from(b64, "base64").toString("utf8")
      : decodeURIComponent(escape(atob(b64)));
    const parsed = schema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function encodeFilterTree(tree: FilterTree): string | null {
  return encodeJson(tree);
}

export function decodeFilterTree(encoded: string): FilterTree | null {
  return decodeJson(encoded, FilterTreeSchema);
}

export function encodeSortKeys(keys: SortKey[]): string | null {
  return encodeJson(keys);
}

export function decodeSortKeys(encoded: string): SortKey[] | null {
  const arr = decodeJson(encoded, { safeParse: (v) => SortKeySchema.array().safeParse(v) });
  return arr;
}

export const URL_PARAM_KEYS = {
  view: "view",
  filter: "f",
  sort: "s",
  groupBy: "g",
  search: "q",
  density: "d",
} as const;
```

#### A.8 — Tests

- `view-config-schema.test.ts`: parses valid configs, rejects malformed `groupBy` discriminator, parses lazy recursive FilterTree (nested and/or), `parseViewConfig` falls back to `{}` on bad input.
- `view-url-codec.test.ts`: roundtrip filter trees / sort keys; null when oversize (>2 KB); unicode-safe; `decodeFilterTree` returns null on garbage input.
- `cell-to-search-string.test.ts`: one assertion per cell type — verifies the expected text representation. Status fixture passes `config.labels` and the test checks the title is returned.
- `global_search_rls.spec.sql`: insert a workspace + board owned by user A; insert a task on it. Call `global_search` as user B (non-member) — expect 0 rows. Add B to the workspace — expect the task to appear.
- `default_view_on_create_board.spec.sql`: call `create_board` as a member — assert exactly one `view` row exists with `is_shared=true`, `name='Main table'`, `kind='table'`, `position=0`.

**Definition of done:**
- Three migrations apply cleanly on a fresh DB and on the current local DB.
- `pnpm db:types` regenerates `lib/supabase/types.ts` with `profile.last_view_per_board jsonb` and `Database["public"]["Functions"]["global_search"]`.
- Every cell def exposes a `toSearchString` field; `pnpm tsc --noEmit` is clean.
- `lib/views/config-schema.ts` and `lib/views/url-codec.ts` exist with the contracts above; both have unit tests.
- `lib/cells/filter-operators.ts` exports `getOperatorArity`.
- pgTAP suite passes locally.

**Escalation triggers:**
- If patching `create_board` requires a `drop function` before `create or replace` due to signature drift (it shouldn't — signature is unchanged), surface and propose a `drop function if exists` guarded migration.
- If `lib/cells/types.ts`'s `toSearchString` being **required** rather than optional cascades type errors across the 24 cell defs after they each implement it, that's expected — confirm each cell def compiles. If any cell def's existing type signature can't accept the new field, escalate (don't widen `CellTypeDef`'s generic).
- If `pnpm tsc --noEmit` surfaces breakage in files outside this slice's scope after the cell-def edits, escalate.

---

### Slice B — Board store: view slice + filter/sort/group/visibility/density/search state

**Branch:** `epic/11-filtering-views/b-store-and-hook`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/stores/types/views.ts` (new — type re-exports + selector shapes)
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts` (extend in place — replace `sortColumnId/sortDirection/setSort` with `sortKeys` + new view-state slice; deprecate `columnPrefsByBoard` once migrated)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/ColumnHeader.tsx` (refactor — read `sortKeys[0]` for the indicator)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/ColumnHeaderMenu.tsx` (refactor — set `sortKeys = [{...}]` from the menu)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/TaskRow.tsx` (refactor — read column visibility / width from active-view selector, not legacy `columnPrefsByBoard`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/StickyHeader.tsx` (refactor — same)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx` (refactor — `rows` useMemo now consumes a derived `viewState` selector that yields `{ filteredSortedTasks, groupBuckets, visibleColumns, density }`)
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-view.ts` (new — the canonical `useBoardView()` hook returning `{ active, draft, applyDraft, hasUnsavedChanges, save, resetDraft, switchView }`; URL ↔ store ↔ DB)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/filtering/apply-filter-tree.ts` (new — pure function `applyFilterTree(tasks, cellsByKey, columns, tree)` returns the filtered Task[])
- `/Volumes/SSD1T/DEV WORK/donezo/lib/filtering/apply-sort.ts` (new — pure function `applySort(tasks, cellsByKey, columns, sortKeys)` returns the sorted Task[])
- `/Volumes/SSD1T/DEV WORK/donezo/lib/filtering/apply-group-by.ts` (new — pure function `applyGroupBy(tasks, cellsByKey, columns, groupBy, structuralGroups)` returns `{ buckets: Array<{ key, label, tasks }> }`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/filtering/apply-search.ts` (new — pure function `applySearch(tasks, cellsByKey, columns, query)` returns the filtered Task[])
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/board-store-views.test.ts` (new — view-state slice unit tests)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/use-board-view.test.ts` (new — hook tests with mocked URL + server action)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/apply-filter-tree.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/apply-sort.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/apply-group-by.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/apply-search.test.ts` (new)

**Reads (no write):**
- `lib/supabase/types.ts` (post-A regen) for `Database["public"]["Tables"]["view"]["Row"]`.
- `lib/views/config-schema.ts` and `lib/views/url-codec.ts` (Slice A).
- `lib/cells/registry.ts` (cell defs via `getCellDef`).

**Forbidden:** Any UI component under `components/filters/`, the topbar, any new server action file, the page-level RSC (`app/.../page.tsx`), or any cell `def.ts`.

**Depends on:** Slice A merged (needs view types, `toSearchString`, `getOperatorArity`, `ViewConfig` schema, regen types).

**Spec:**

#### B.1 — `stores/types/views.ts`

```ts
import type { Database } from "@/lib/supabase/types";
export type ViewRow = Database["public"]["Tables"]["view"]["Row"];
```

#### B.2 — Board store extensions

Append after the Epic-10 block in `stores/board-store.ts`:

```ts
// ============================================================================
// Epic 11 — Views, filtering, sorting, grouping, visibility, density, search
// ============================================================================
viewsByBoard: Map<string, ViewRow[]>;          // key: board_id; sorted by position
activeViewId: string | null;                    // resolved from URL → last → default
draftConfig: ViewConfig | null;                 // null when active === view.config; set when user has edits
inBoardSearch: string;                          // ephemeral; not URL-synced (URL ?q owns the truth via the hook)
sortKeys: SortKey[];                            // replaces sortColumnId / sortDirection

// Hydration / mutations
hydrateViewsForBoard: (boardId: string, rows: ViewRow[]) => void;
applyViewUpsert: (row: ViewRow) => void;
applyViewDelete: (viewId: string) => void;
setActiveViewId: (viewId: string | null) => void;
setDraftConfig: (next: ViewConfig | null) => void;
setSortKeys: (keys: SortKey[]) => void;
setInBoardSearch: (query: string) => void;
```

Remove `sortColumnId`, `sortDirection`, `setSort` from `BoardState` and from `transientInitial`. Use `sortKeys` everywhere.

**Selector exports (named exports next to the store, not store methods):**

```ts
/** Returns the resolved active view row, or null if not yet hydrated. */
export function selectActiveView(state: BoardState): ViewRow | null;

/** Returns the effective config: draftConfig if set, else parsed active view config. */
export function selectEffectiveConfig(state: BoardState): ViewConfig;

/** Returns true iff the user has unsaved draft edits. */
export function selectHasDraftEdits(state: BoardState): boolean;

/** Stable-empty when nothing has been hydrated. */
export function selectViewsForBoard(state: BoardState, boardId: string): ViewRow[];
```

All selectors return stable references when the underlying slice hasn't changed (use `EMPTY_ARRAY` / `EMPTY_CONFIG` sentinels per the MEMORY zustand-v5-selectors guidance).

**Persistence:** Persist `activeViewId` per-board in a small `lastViewByBoard: Record<string, string>` field inside the existing persisted partial. `viewsByBoard` and `draftConfig` are **transient** (re-hydrated from server on mount).

**`columnPrefsByBoard` migration:** On first epic-11 mount of a board, if there are entries in `columnPrefsByBoard[boardId]` AND a personal view exists for the user, fold those entries into the personal view's `config.columnWidths` / `config.columnVisibility` via a one-shot `saveView` call, then clear the localStorage entry. Slice E (server actions) ships the call; Slice B exposes a helper `migrateLegacyColumnPrefs(boardId, viewId): { widths, hidden }` that returns the fold-target config — F (page wiring) calls it.

#### B.3 — `useBoardView()` hook

`hooks/use-board-view.ts`:

```ts
import type { ViewConfig } from "@/lib/views/config-schema";
import type { ViewRow } from "@/stores/types/views";

export interface UseBoardViewResult {
  /** The view row currently selected (from URL → last → default). */
  active: ViewRow | null;
  /** The merged config: draft overrides on top of view.config. */
  effective: ViewConfig;
  /** Has the user edited the active view's config? */
  hasUnsavedChanges: boolean;
  /** Apply a partial config patch to the draft. */
  applyDraft: (patch: Partial<ViewConfig>) => void;
  /** Clear the draft (reverts to saved view.config). */
  resetDraft: () => void;
  /** Persist the current effective config back to the active view. */
  save: () => Promise<void>;
  /** Switch the active view; pushes ?view=<id> and clears draft. */
  switchView: (viewId: string) => void;
  /** All views for the current board (sorted by position). */
  views: ViewRow[];
  /** Current user's role on the board (read from BoardContext). */
  role: Role;
}

export function useBoardView(): UseBoardViewResult;
```

Behavior:
- Reads URL via `useSearchParams()` / `usePathname()`.
- Hydrates `activeViewId` priority order: URL `?view=` > `profile.last_view_per_board[boardId]` (resolved at page-load and passed as initial via the BoardProvider — see Slice F) > workspace default `Main table`.
- When `?f`, `?s`, `?g`, `?q`, `?d` URL params are present and **differ** from the active view's stored config, they populate `draftConfig`. `hasUnsavedChanges = draftConfig != null`.
- `applyDraft(patch)`: merges patch into `draftConfig`, computes the new URL params, and `router.replace()`s. Debounced 200ms to avoid history thrash.
- `resetDraft()`: clears `draftConfig`, strips URL params except `?view`.
- `save()`: calls `saveView` server action (Slice E) with current `effective` config; on success, applies the returned ViewRow to the store and clears draft.
- `switchView(viewId)`: clears draft, pushes `?view=<id>` (strips all other view params), updates store + persisted `lastViewByBoard`.

**MEMORY-critical:** Every selector inside the hook reads either a primitive or a single map.get. Multi-field reads use `useShallow`. Sample:
```ts
const { active, effective, hasUnsavedChanges } = useBoardStore(useShallow((s) => ({
  active: selectActiveView(s),
  effective: selectEffectiveConfig(s),
  hasUnsavedChanges: selectHasDraftEdits(s),
})));
```

#### B.4 — Filter / sort / group / search pure functions

`lib/filtering/apply-filter-tree.ts`:

```ts
import type { FilterTree } from "@/lib/views/config-schema";
import type { Task, Cell, Column } from "@/components/board/table/types";
import { getCellDef } from "@/lib/cells/registry";

/** Returns the subset of tasks that satisfy the tree. Pure; no realtime side effects. */
export function applyFilterTree(
  tasks: Task[],
  cellsByKey: Map<string, Cell>, // `${task.id}:${column.id}` → cell
  columns: Column[],
  tree: FilterTree | undefined,
): Task[];
```

Recursive evaluation: `and` requires all clauses true, `or` requires any. `comparison` resolves the cell for `(task.id, columnId)`, looks up `def = getCellDef(column.type)`, calls `def.matchesFilter(def.fromRow(cell), op, operand)`. If the column is unknown, the clause is `true` (silently ignore — column was deleted).

`lib/filtering/apply-sort.ts`:

```ts
export function applySort(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  sortKeys: SortKey[] | undefined,
): Task[];
```

Multi-key stable sort. Fallback when sort keys are empty: original `(group.position, task.position)` order is preserved by the caller — `applySort` returns `[...tasks]` unchanged. When the column for a sort key is unknown, skip that key.

`lib/filtering/apply-group-by.ts`:

```ts
export type GroupBucket = {
  key: string;          // synthetic id (e.g. `label:<labelId>` | `person:<userId>` | `none`)
  label: string;        // display title
  color: string | null; // optional accent color (for status/priority/group buckets)
  tasks: Task[];
};

export function applyGroupBy(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  groupBy: GroupBy | undefined,
  structuralGroups: Group[], // when groupBy is undefined/native, return the existing buckets
): GroupBucket[];
```

For `kind: "native"` (or `undefined`): one bucket per structural group, in position order, tasks unchanged. For `kind: "column"`: bucket by `cell.value`. Use the cell type's category — for `status`/`priority`, key by `labelId`; for `person`, key by `userId` (one task per assignee — defer to v1.5 fanout; for v1, key by the first userId or "Uncategorized" when empty); for `date`, key by the ISO date string; for `checkbox`, two buckets `Checked` / `Unchecked`. Bucket order per Q13.

`lib/filtering/apply-search.ts`:

```ts
export function applySearch(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  query: string,
): Task[];
```

Empty query → return input untouched. Otherwise, lowercase the query and match each task by `task.title.toLowerCase().includes(q) || columns.some((col) => def.toSearchString(def.fromRow(cellsByKey.get(`${task.id}:${col.id}`)), col.settings).toLowerCase().includes(q))`.

#### B.5 — `BoardTable` refactor

Replace the existing `rows` useMemo. New build order:

1. Read `effective` config from `useBoardView()`.
2. Compute `filteredTasks = applyFilterTree(tasks, cellsByKey, columns, effective.filter)`.
3. Compute `searchedTasks = applySearch(filteredTasks, cellsByKey, columns, effective.search ?? "")`.
4. Compute `sortedTasks = applySort(searchedTasks, cellsByKey, columns, effective.sort)`.
5. Compute `buckets = applyGroupBy(sortedTasks, cellsByKey, columns, effective.groupBy, groups)`.
6. Flatten buckets into the existing `RowEntry[]` shape (group-header → tasks → group-footer → add-task-footer per bucket), preserving the row-kind union.

The `add-task-footer` is suppressed for **column-based group-by** buckets (because adding a task into a "Status: Done" bucket isn't a meaningful action — the user would need to create a task elsewhere, then set its status). The "+ Add group" footer is suppressed when group-by is column-based.

Wrap the derivation in `useDeferredValue(effective)` to keep typing responsive on large boards.

#### B.6 — `ColumnHeader.tsx` / `ColumnHeaderMenu.tsx` refactor

Read `sortKeys[0]` as the active single-key indicator. The menu's Sort items set `sortKeys = [{ columnId, direction }]` (a single-key quick-sort). Multi-key sort is exclusive to `<SortBuilder>` (Slice D).

#### B.7 — Tests

- `board-store-views.test.ts`: hydrate views, set active, set draft, computes `hasUnsavedChanges`, draft reset, sortKeys round-trip.
- `use-board-view.test.ts`: URL → draft hydration; `switchView` clears draft; `applyDraft` debounces; `save` invokes `saveView` mock.
- `apply-filter-tree.test.ts`: and/or/comparison evaluation, unknown column id is silently true, empty tree returns input.
- `apply-sort.test.ts`: multi-key, stable, asc/desc, unknown column id skips.
- `apply-group-by.test.ts`: native returns structural buckets; column-based groups by status/labelId; uncategorized last; checkbox two buckets.
- `apply-search.test.ts`: case-insensitive, title-hit, cell-hit (text/status), no-match returns empty.

**Definition of done:**
- Store exposes new `sortKeys`, `viewsByBoard`, `activeViewId`, `draftConfig`, `inBoardSearch` fields + actions + selectors.
- `sortColumnId / sortDirection / setSort` are removed; the two existing consumers (`ColumnHeader`, `ColumnHeaderMenu`) compile against `sortKeys` and continue to work (single-column quick-sort still functions).
- `useBoardView()` hook compiles and is unit-tested.
- The four `lib/filtering/apply-*.ts` pure functions exist and pass unit tests.
- `BoardTable`'s row build pulls through the new derivation pipeline. Existing keyboard nav / dnd / virtualizer continue to work (no regressions on a board with no filter/sort/group-by configured — the derivation is a passthrough).
- `pnpm tsc --noEmit` clean. `pnpm test` clean. `pnpm lint` clean.

**Escalation triggers:**
- If removing `sortColumnId / sortDirection / setSort` breaks consumers outside `ColumnHeader.tsx` / `ColumnHeaderMenu.tsx` (a grep should confirm none — but if it does), stop and surface.
- If the existing `columnPrefsByBoard` localStorage slice can't be cleanly migrated (e.g. a TaskRow consumer that's hard to refactor), STOP — propose keeping `columnPrefsByBoard` as a per-user fallback layer underneath `view.config` and re-spec accordingly.
- If `useDeferredValue` over the effective config causes visible row mis-alignment at the first paint, document but don't remove — Slice G's e2e will exercise it.

---

### Slice C — Filter / Sort / Hide / Group / Density popovers

**Branch:** `epic/11-filtering-views/c-filter-sort-popovers`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/FilterBuilder.tsx` (new — popover that edits `FilterTree` and-clause list)
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/FilterRow.tsx` (new — column + operator + operand row)
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/OperandInput.tsx` (new — adapter that picks `def.OperandEditor` or falls back to `def.Editor`; handles arity)
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/SortBuilder.tsx` (new — multi-key sort popover)
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/SortRow.tsx` (new — column + direction)
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/ColumnVisibilityPanel.tsx` (new — checklist + dnd-kit reorder)
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/GroupByPicker.tsx` (new — column picker filtered by groupable types)
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/DensityToggle.tsx` (new — 3-state segmented control)
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/PopoverShell.tsx` (new — shared Base UI Popover wrapper applying the `<DynamicModal />` chrome tokens from component-system §1.4)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/status/OperandEditor.tsx` (new — compact label picker)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/priority/OperandEditor.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/person/OperandEditor.tsx` (new — compact person picker)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/date/OperandEditor.tsx` (new — compact calendar)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/tags/OperandEditor.tsx` (new — compact tag picker)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/country/OperandEditor.tsx` (new — compact country select)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/status/def.ts` (extend — register `OperandEditor`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/priority/def.ts` (extend — register)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/person/def.ts` (extend — register)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/date/def.ts` (extend — register)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/tags/def.ts` (extend — register)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/country/def.ts` (extend — register)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/FilterBuilder.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/SortBuilder.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/ColumnVisibilityPanel.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/GroupByPicker.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/OperandInput.test.tsx` (new)

**Reads (no write):**
- `lib/cells/registry.ts`, all `def.ts` files (for `filterOperators`, `compare`, `Editor`).
- `lib/views/config-schema.ts`, `lib/cells/filter-operators.ts`.
- `hooks/use-board-view.ts` (Slice B).
- `stores/board-store.ts` (Slice B — `selectEffectiveConfig`, `applyDraft`).

**Forbidden:** The board page RSC, the topbar, any server-action file, `components/board/`, `components/filters/ViewTabs.tsx` (Slice D owns).

**Depends on:** Slices A + B merged.

**Spec:**

#### C.1 — `<FilterBuilder>` props + behavior

```ts
export interface FilterBuilderProps {
  filter: FilterTree | undefined;
  columns: Column[];
  cellsByKey: Map<string, Cell>;
  onChange: (next: FilterTree | undefined) => void;
  onClose?: () => void;
}
```

Renders the popover content. For v1, only single-level AND:
- Flatten `filter` (assumed `{ kind: 'and', clauses: Comparison[] }`) into N `<FilterRow>`s. On change of any row, rebuild and emit `{ kind: 'and', clauses: [...] }`; if empty, emit `undefined`.
- "+ Add filter" button appends a default comparison (first filterable column, first operator, empty operand).
- "Clear all" button emits `undefined`.

`<FilterRow>` is a 4-column grid: column dropdown, operator dropdown (filtered by `def.filterOperators`), `<OperandInput>` (arity-aware), and a delete button.

#### C.2 — `<OperandInput>` adapter

```ts
export interface OperandInputProps {
  column: Column;
  op: FilterOperator;
  value: unknown;
  onChange: (next: unknown) => void;
}
```

Algorithm:
1. `arity = getOperatorArity(op)`. If `"none"` → render nothing (operator-only filter).
2. `def = getCellDef(column.type)`.
3. If `def.OperandEditor` exists, render it with `compact: true` inside a small Base UI Popover anchored to a button showing the current operand summary (e.g. "Done", "Chris, Sara", "2025-01-01").
4. Else, render `def.Editor` inside the same popover, with a small `compact` wrapper class.
5. For `arity === "many"` (in / not_in) — coerce the value into an array.
6. For `arity === "range"` (between) — emit `[v1, v2]` tuples.

#### C.3 — `<SortBuilder>` + `<SortRow>`

Edits `SortKey[]`. UI: vertical list of rows, each = column dropdown + direction toggle (asc / desc). "+ Add sort" appends with the next unused column as the default. "Clear all" emits `[]`. Reorderable via dnd-kit (sort priority = array order).

#### C.4 — `<ColumnVisibilityPanel>`

UI: dnd-kit reorderable checklist of all board columns. Each row = drag handle + checkbox (visibility) + column type icon + column name. The first row (the title column) is locked visible — checkbox disabled, displayed but unmovable (the title column has no `ColumnHeader`-style position arithmetic).

Emits two patches to `applyDraft`:
- `columnVisibility: Record<columnId, boolean>` — false means hidden.
- `columnOrder: string[]` — the new order (only emitted when reordered; otherwise omit so the view inherits board `column.position`).

#### C.5 — `<GroupByPicker>`

Popover with two options:
1. **Native (default)** — radio.
2. **Column** — a list of groupable columns (filtered by `def.aggregations.includes("count_unique")` OR a hardcoded allow-list `['status','priority','person','date','checkbox','country','rating']` per epic doc).

On change, emits a `GroupBy` discriminated union to `applyDraft`.

#### C.6 — `<DensityToggle>`

Three buttons (compact / default / spacious) with Lucide icons (`Rows3` / `Rows4` / `Rows2` or equivalent). Active button gets `--color-primary` background. Emits `density: Density` to `applyDraft`.

#### C.7 — `<PopoverShell>` (visual fidelity)

Reusable Base UI Popover wrapper that applies the chrome from component-system §1.4 / §3.1:
- bg `white`, border `1px solid var(--color-border-strong)`, radius `8px`, shadow `var(--shadow-modal)`, z-index `var(--z-popover)`.
- All five popovers above wrap their content in this shell.

#### C.8 — Per-cell-type `OperandEditor`s

Each of the six is a tiny composition of the existing `Editor` with `compact: true`. Status / priority share most logic — they list labels in a checklist when `op === "in"` else a single-select when `op === "equals"`. Person filters to a compact multi-select picker. Date for `op === "before" | "after"` is a single date; for `between` is two dates; for `today/this_week/this_month` no input is rendered. Tags: compact chip-picker. Country: compact dropdown.

#### C.9 — Tests

- `FilterBuilder.test.tsx`: adding/removing rows; switching operators; clear all; passes filter down to onChange.
- `SortBuilder.test.tsx`: adding/removing keys; direction toggle; reorder.
- `ColumnVisibilityPanel.test.tsx`: toggle hides a column; reorder fires `columnOrder`.
- `GroupByPicker.test.tsx`: switching to a column emits `{kind:'column', columnId}`.
- `OperandInput.test.tsx`: arity-none renders no operand; arity-range renders two inputs; falls back to `Editor` when `OperandEditor` not registered.

**Definition of done:**
- All five popovers exist and edit the draft via `useBoardView().applyDraft`.
- Each popover uses `<PopoverShell>` (matching component-system §1.4 / §3.1 tokens).
- Six cell types register `OperandEditor`; the other 18 fall back to `Editor` gracefully.
- `pnpm tsc --noEmit` / `pnpm lint` / `pnpm test` all clean.

**Escalation triggers:**
- If any existing cell `Editor` cannot be rendered inside a `compact: true` popover without visual breakage (it should — the editors already render inside Base UI Popover when `editorMode === "popover"`), surface and propose a per-cell adapter.
- If dnd-kit reorder inside `<ColumnVisibilityPanel>` collides with the board-page-level DndContext, surface — the panel must instantiate its own scoped `DndContext` to avoid cross-contamination.

---

### Slice D — View tabs, view toolbar, in-board search

**Branch:** `epic/11-filtering-views/d-view-tabs-and-toolbar`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/ViewTabs.tsx` (new — replaces `BoardViewTabs`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/ViewToolbar.tsx` (new — the filter/sort/hide/group/search/density buttons)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/ViewTabDropdown.tsx` (new — rename / duplicate / save / reset / delete per active view)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/AddViewMenu.tsx` (new — "+ Add view" dropdown; Table enabled, others disabled with "Coming in Epic 12" tooltip)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/BoardViewTabs.tsx` (DELETE — replaced by `ViewTabs.tsx`)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` (small edit — render `<ViewTabs />` instead of `<BoardViewTabs />`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/SearchInput.tsx` (new — in-board search with 200ms debounce; `--motion-medium` width-expand animation per design-system; component-system §1.4 visuals)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/InlineSearchBar.tsx` (new — the toolbar inline search hosting `<SearchInput>`)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/ViewTabs.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/ViewToolbar.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/SearchInput.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/ViewTabDropdown.test.tsx` (new)

**Reads (no write):**
- Slice C's popovers (mounted from `<ViewToolbar>` buttons).
- Slice B's `useBoardView()` hook.
- Slice E's server actions (`saveView`, `createView`, `renameView`, `duplicateView`, `deleteView`) — typed imports only.

**Forbidden:** The page-level RSC, the topbar, any server-action file (Slice E owns), any cell `def.ts`, the board store.

**Depends on:** Slices A + B + C merged. Awareness of Slice E's server-action signatures (typed imports — actual implementation lives in E).

**Spec:**

#### D.1 — `<ViewTabs>`

Replaces `<BoardViewTabs>`. Reads `useBoardView().views` and `.active`. Renders one tab per view (sorted by `position`), each tab:
- Icon based on `view.kind` (Table / Kanban / ... Lucide).
- View name.
- Active tab gets the 2px bottom border `--color-primary` per design-system.
- Hover bg `--color-surface-hover`, radius `4px 4px 0 0`.
- Right-side chevron when active → opens `<ViewTabDropdown>`.

Trailing item: `<AddViewMenu />`.

Switching tabs: calls `useBoardView().switchView(id)`. Active-tab dropdown actions invoke server actions from Slice E (see signatures below).

#### D.2 — `<ViewToolbar>`

The row below `<ViewTabs>`. Layout per component-system §1.4 (32px tall buttons, padding `0 8px`, font 14px, hover bg `var(--color-surface-hover)`, radius 4px, gap 5px):

```
[Filter (N)] [Sort (N)] [Hide (N)] [Group: status] [Density] [Search ──────] [💾 Save] [↺ Reset]
```

- Each button shows a count badge when the corresponding config is non-empty (e.g. "Filter (3)" when there are 3 clauses).
- "Filter (N)" / "Sort (N)" / "Hide (N)" open the Slice-C popovers.
- "Group: <name>" opens `<GroupByPicker>`.
- "Density" is the inline `<DensityToggle>` from Slice C.
- "Search" is the inline `<SearchInput>`.
- "💾 Save" appears only when `useBoardView().hasUnsavedChanges` is true AND the user has permission (admin+ for shared, owner for personal).
- "↺ Reset" appears only when `hasUnsavedChanges`.

#### D.3 — `<ViewTabDropdown>`

Menu items for the active view:
- **Rename** → inline rename via `EditableTitle` pattern or dialog → `renameView({ id, name })`.
- **Duplicate** → `duplicateView({ id })` → switches to the new view.
- **Save changes** (disabled unless draft + permission) → `saveView({ id, config })`.
- **Reset to saved** (disabled unless draft) → `resetDraft()`.
- **Delete** (admin+ for shared, owner for personal; never for the workspace default `Main table` if it's the last shared table view on the board) → `deleteView({ id })` after confirm.

#### D.4 — `<AddViewMenu>`

Dropdown items:
- **New table view** → `createView({ boardId, kind: 'table', name: 'New view' })` → switch.
- **New kanban view** (disabled, tooltip "Coming in Epic 12").
- **New calendar view** (disabled).
- **New timeline view** (disabled).
- **New dashboard view** (disabled).
- **New form view** (disabled).

#### D.5 — `<SearchInput>` / `<InlineSearchBar>`

Visual contract (component-system §1.4 + design-system §14):
- Collapsed width `58px`; focus → animates to `140px` over `--motion-medium`. Cursor flips `pointer → text` on focus.
- Chrome border on focus `0.5px var(--color-primary)`; bg white.
- 200ms debounce; emits via `useBoardView().applyDraft({ search: q })`. The store's `inBoardSearch` mirror is set via the hook (single source of truth = URL/effective config).

Keyboard: `/` global keybinding focuses the in-board search when the board is the focused surface (skip when an input/textarea/contenteditable is focused).

#### D.6 — Layout integration

`app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`: replace `<BoardViewTabs />` with `<ViewTabs />`. Add `<ViewToolbar />` immediately below `<ViewTabs />`, above the `{children}` slot. Both are client components; the layout stays a Server Component.

**Definition of done:**
- `<ViewTabs>`, `<ViewToolbar>`, `<ViewTabDropdown>`, `<AddViewMenu>`, `<SearchInput>` ship.
- Visual fidelity matches component-system §1.4 — verified by Storybook-equivalent test or screenshot diff (not required, but document the token mapping inline in each component).
- The board layout renders the new tabs + toolbar; `BoardViewTabs.tsx` is deleted.
- All five toolbar buttons mount the correct popover from Slice C.
- Search debounces 200ms and routes through `useBoardView().applyDraft`.

**Escalation triggers:**
- If the existing `<BoardViewTabs>` has callers beyond the layout file (none expected — verify with grep), stop and surface.
- If the Slice E server-action import types aren't ready yet at branch-creation time (race condition between D and E), use a typed `as const` placeholder and document the dependency in a `TODO(slice-E)` comment — surface to coordinator.

---

### Slice E — Server actions for views (createView, saveView, renameView, duplicateView, deleteView, setLastView, switchView is purely client-side)

**Branch:** `epic/11-filtering-views/e-view-server-actions`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/lib/validations/view.ts` (new — Zod schemas)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions.ts` (new — six server actions)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/account/last-view-actions.ts` (new — `setLastViewForBoard`)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/view-validations.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/view-actions.test.ts` (new)

**Reads (no write):**
- `lib/views/config-schema.ts` (Slice A).
- `lib/actions/with-user.ts`.
- `lib/authorization/board.ts` (`requireBoardRole`).

**Forbidden:** Any UI file. Any other server-action file. The board store. The view-hook.

**Depends on:** Slice A merged.

**Spec:**

#### E.1 — `lib/validations/view.ts`

```ts
import { z } from "zod";
import { ViewConfigSchema, ViewKindSchema } from "@/lib/views/config-schema";

export const CreateViewSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(120),
  kind: ViewKindSchema,
  isShared: z.boolean().default(false),
  config: ViewConfigSchema.default({}),
});

export const SaveViewSchema = z.object({
  viewId: z.string().uuid(),
  config: ViewConfigSchema,
});

export const RenameViewSchema = z.object({
  viewId: z.string().uuid(),
  name: z.string().min(1).max(120),
});

export const DuplicateViewSchema = z.object({
  viewId: z.string().uuid(),
});

export const DeleteViewSchema = z.object({
  viewId: z.string().uuid(),
});

export const SetLastViewSchema = z.object({
  boardId: z.string().uuid(),
  viewId: z.string().uuid(),
});

export const GlobalSearchSchema = z.object({
  workspaceId: z.string().uuid(),
  q: z.string().min(1).max(200),
});

export type CreateViewInput = z.infer<typeof CreateViewSchema>;
export type SaveViewInput = z.infer<typeof SaveViewSchema>;
// ... and so on for the others.
```

#### E.2 — Server actions

`app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { withUser } from "@/lib/actions";
import { requireBoardRole } from "@/lib/authorization/board";
import {
  CreateViewSchema, SaveViewSchema, RenameViewSchema,
  DuplicateViewSchema, DeleteViewSchema, GlobalSearchSchema,
} from "@/lib/validations/view";

export const createView = withUser(async ({ supabase, userId }, raw) => {
  const input = CreateViewSchema.parse(raw);
  // Admin+ to create shared; member+ to create personal.
  await requireBoardRole(input.boardId, input.isShared ? "admin" : "member");
  // Next position = max(position) + 1 within this board.
  const { data: maxRow } = await supabase
    .from("view").select("position")
    .eq("board_id", input.boardId)
    .order("position", { ascending: false })
    .limit(1).maybeSingle();
  const nextPos = (maxRow?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("view").insert({
      board_id: input.boardId,
      owner_id: input.isShared ? null : userId,
      name: input.name,
      kind: input.kind,
      is_shared: input.isShared,
      config: input.config,
      position: nextPos,
    }).select().single();
  if (error) throw { code: "DB", message: error.message };
  // No revalidatePath — board page is mostly client-side; the hook re-reads.
  return data;
});

export const saveView = withUser(async ({ supabase, userId }, raw) => {
  const input = SaveViewSchema.parse(raw);
  // Load to confirm board + permissions.
  const { data: row, error: loadErr } = await supabase
    .from("view").select("*").eq("id", input.viewId).single();
  if (loadErr || !row) throw { code: "NOT_FOUND", message: "View not found" };
  if (row.is_shared || row.owner_id == null) {
    await requireBoardRole(row.board_id, "admin");
  } else if (row.owner_id !== userId) {
    throw { code: "FORBIDDEN", message: "Cannot edit another user's personal view" };
  }
  const { data, error } = await supabase
    .from("view").update({ config: input.config })
    .eq("id", input.viewId).select().single();
  if (error) throw { code: "DB", message: error.message };
  return data;
});

export const renameView = withUser(async ({ supabase, userId }, raw) => { /* mirror saveView shape */ });

export const duplicateView = withUser(async ({ supabase, userId }, raw) => {
  const input = DuplicateViewSchema.parse(raw);
  const { data: source, error: loadErr } = await supabase
    .from("view").select("*").eq("id", input.viewId).single();
  if (loadErr || !source) throw { code: "NOT_FOUND", message: "View not found" };
  await requireBoardRole(source.board_id, "viewer"); // read access
  // Duplicate as personal (regardless of source).
  const newName = `${source.name} (copy)`;
  const { data: maxRow } = await supabase
    .from("view").select("position")
    .eq("board_id", source.board_id)
    .order("position", { ascending: false })
    .limit(1).maybeSingle();
  const nextPos = (maxRow?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("view").insert({
      board_id: source.board_id,
      owner_id: userId,
      name: newName,
      kind: source.kind,
      is_shared: false,
      config: source.config,
      position: nextPos,
    }).select().single();
  if (error) throw { code: "DB", message: error.message };
  return data;
});

export const deleteView = withUser(async ({ supabase, userId }, raw) => {
  const input = DeleteViewSchema.parse(raw);
  const { data: row, error: loadErr } = await supabase
    .from("view").select("*").eq("id", input.viewId).single();
  if (loadErr || !row) throw { code: "NOT_FOUND", message: "View not found" };
  if (row.is_shared || row.owner_id == null) {
    await requireBoardRole(row.board_id, "admin");
  } else if (row.owner_id !== userId) {
    throw { code: "FORBIDDEN", message: "Cannot delete another user's personal view" };
  }
  // Guard: don't allow deleting the last shared table view on the board (the workspace default).
  if (row.is_shared && row.kind === "table") {
    const { count } = await supabase
      .from("view").select("id", { count: "exact", head: true })
      .eq("board_id", row.board_id)
      .eq("is_shared", true)
      .eq("kind", "table");
    if ((count ?? 0) <= 1) {
      throw { code: "LAST_DEFAULT", message: "Cannot delete the last shared table view" };
    }
  }
  const { error } = await supabase.from("view").delete().eq("id", input.viewId);
  if (error) throw { code: "DB", message: error.message };
  return { ok: true };
});

export const globalSearch = withUser(async ({ supabase }, raw) => {
  const input = GlobalSearchSchema.parse(raw);
  const { data, error } = await supabase.rpc("global_search", {
    p_workspace_id: input.workspaceId,
    q: input.q,
  });
  if (error) throw { code: "DB", message: error.message };
  return data;
});
```

`app/(app)/account/last-view-actions.ts`:

```ts
"use server";
import { withUser } from "@/lib/actions";
import { SetLastViewSchema } from "@/lib/validations/view";

export const setLastViewForBoard = withUser(async ({ supabase, userId }, raw) => {
  const input = SetLastViewSchema.parse(raw);
  // Read current map, merge, write back. Concurrent writes are last-write-wins — acceptable for this UX.
  const { data: prof, error: loadErr } = await supabase
    .from("profile").select("last_view_per_board").eq("id", userId).single();
  if (loadErr || !prof) throw { code: "DB", message: loadErr?.message ?? "profile missing" };
  const next = {
    ...(prof.last_view_per_board as Record<string, string>),
    [input.boardId]: input.viewId,
  };
  const { error } = await supabase
    .from("profile").update({ last_view_per_board: next })
    .eq("id", userId);
  if (error) throw { code: "DB", message: error.message };
  return { ok: true };
});
```

#### E.3 — Tests

- `view-validations.test.ts`: schema rejects bad uuid / oversize name / unknown kind.
- `view-actions.test.ts`: mocked Supabase. Cover:
  - `createView({ isShared: true })` requires admin+; throws when caller is `member`.
  - `saveView` for a shared row requires admin+; throws when caller is `member`.
  - `saveView` for own personal row succeeds; throws when targeting another user's personal row.
  - `deleteView` of the last shared table view throws `LAST_DEFAULT`.
  - `duplicateView` always creates a personal copy with `(copy)` suffix.
  - `setLastViewForBoard` merges into existing jsonb (other entries preserved).

**Definition of done:**
- Six server actions exist, each `withUser`-wrapped, each Zod-validated, each returning `ActionResult<T>`.
- Authorization gates are correct (admin+ for shared writes, owner-only for personal writes).
- Unit tests pass.

**Escalation triggers:**
- If `requireBoardRole` doesn't accept the `"viewer"` role string (it should — Epic 04 defines four roles), surface.
- If `supabase.rpc("global_search", ...)` typing doesn't surface the function (the regen types should include it after Slice A merges), surface.

---

### Slice F — Page-level wiring: server-side view hydration, RSC search-param handling, page handoff

**Branch:** `epic/11-filtering-views/f-page-wiring`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (extend — load views, profile.last_view_per_board, resolve active view; accept `searchParams`; pass through to `<BoardTable>`)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` (small edit — accept `searchParams` if needed; pass through to children)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx` (extend — accept `initialViews` + `initialActiveViewId` props, hydrate views into store on mount)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/types.ts` (extend `TableData` — add `views?`, `activeViewId?`, `currentUserId`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/board-context.tsx` (extend — add `currentUserId` already present; expose `workspaceId` for the topbar global-search)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/MigrateLegacyColumnPrefs.tsx` (new — client component that runs the one-shot migration on first mount per Slice B's helper)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/board-page-active-view.test.ts` (new — tests the resolution priority in a unit harness)

**Reads (no write):**
- Slice E's server actions.
- Slice B's store + hook + migration helper.

**Forbidden:** Any cell `def.ts`. Any filter popover. The view server-action file (Slice E owns). The view-tab UI (Slice D owns).

**Depends on:** Slices A + B + E merged. Awareness of Slice D's `<ViewToolbar>` mount point (already in layout via Slice D).

**Spec:**

#### F.1 — `page.tsx` extension

Extend the existing `BoardPage` to:

1. Accept `searchParams: Promise<{ view?: string; f?: string; s?: string; g?: string; q?: string; d?: string }>` per Next.js 15 RSC searchParams contract.
2. Fetch the full set of views for this board: `supabase.from("view").select("*").eq("board_id", boardId).order("position", { ascending: true })`. RLS filters to shared + own personal + system-null automatically.
3. If no personal view exists for the current user on this board, invoke `createView({ boardId, kind: 'table', name: 'My view', isShared: false })` (server-side; the action is server-side already). Re-fetch (or append the result locally).
4. Fetch `supabase.from("profile").select("last_view_per_board").eq("id", currentUser.id).single()` and extract `lastViewId = profile?.last_view_per_board?.[boardId]`.
5. Resolve `initialActiveViewId` priority:
   - `searchParams.view` if it appears in the fetched views.
   - `lastViewId` if it appears in the fetched views.
   - The first view named `Main table` with `is_shared = true`.
   - The first view by `position` (fallback).
6. Pass `views`, `initialActiveViewId`, and `currentUserId` to `<BoardTable>`.

#### F.2 — `<BoardTable>` extension

Extend the existing mount-time hydrate to call `hydrateViewsForBoard(boardId, views)` and `setActiveViewId(initialActiveViewId)`. After hydration, mount `<MigrateLegacyColumnPrefs />` as a sibling — that component runs the one-shot migration and unmounts itself.

#### F.3 — Realtime — no changes required

`use-board-realtime.ts` is **not** edited. Views aren't in the realtime publication; tab open/refresh is the canonical refresh path. (If a future epic wants multi-tab live view sync, add `view` to the publication then — out of scope.)

#### F.4 — Tests

- `board-page-active-view.test.ts`: priority resolution unit (in-memory views array + a fake searchParams + a fake last-view map).

**Definition of done:**
- Board page loads views server-side, auto-creates personal view if absent, resolves active view, and passes it to the client.
- `<BoardTable>` hydrates views into the store and migrates legacy prefs.
- `searchParams` round-trip works: deep-linking `?view=<id>&f=<base64>` opens the board with the right view + filter.
- The "Main table" view is always present (per Slice A).

**Escalation triggers:**
- If the page-level personal-view auto-create requires a refresh round-trip rather than a single render (because the server action's result needs to be re-fetched), accept that tradeoff and document — UX-wise the user never sees the missing view because we fetch + insert atomically and re-include the inserted row.
- If `searchParams` mutation across `router.replace` causes the page to re-execute and recreate views in a loop, surface.

---

## Stage 2 — sequential integration

### Slice G — Cmd-K global search palette + topbar wiring + integration audit + e2e

**Branch:** `epic/11-filtering-views/g-global-search-and-e2e`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/shared/topbar/GlobalSearchPalette.tsx` (new — Cmd-K palette)
- `/Volumes/SSD1T/DEV WORK/donezo/components/shared/topbar/SearchStub.tsx` (REPLACE — render the launcher button that opens `<GlobalSearchPalette>`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/shared/topbar/Topbar.tsx` (small edit — accept the active workspaceId via a context or prop, pass to the search launcher)
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-cmdk.ts` (new — global Cmd-K / Ctrl-K keybinding hook that ignores when an input is focused unless it's the palette itself)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/GlobalSearchPalette.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/11-filtering-views.spec.ts` (new — Playwright)
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-11-checkpoint-1.md` (new — written by executor as part of the audit)
- Minor edits to Stage-1 files **only** to resolve integration gaps surfaced during the audit (≤5 lines per file). Anything larger escalates as needs-direction.

**Depends on:** Stage 1 (A–F) all merged into `epic/11-filtering-views`.

**Spec:**

#### G.1 — `<GlobalSearchPalette>` (Cmd-K)

Base UI Dialog centered, ~640px wide, `var(--radius-md)`, `var(--shadow-modal)`. Layout:
- Top: a search input (autofocus).
- Below: result list using a Base UI / shadcn `MenuList` recipe — each result row 32px tall, 14px font, hover `--color-surface-hover`.
- Two sections: "Boards" and "Tasks". Each result links to its target.
- Empty state when no query: a hint "Type to search boards and tasks".
- No-results state when query has no matches.

Wired to `globalSearch({ workspaceId, q })` debounced 200ms.

Workspace id resolution: from the topbar context (the topbar runs inside the `(app)` layout, which already resolves `currentUser`'s workspace; if not, derive from the current route pathname `/w/<slug>/...` via `useParams`).

#### G.2 — `use-cmdk` hook

```ts
export function useCmdK(): {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};
```

Subscribes to `keydown` at the document level. Triggers on `(navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey) && e.key === 'k'`. Skips when `document.activeElement?.tagName` is `INPUT`/`TEXTAREA` or has `contenteditable="true"` — UNLESS the active element is inside the palette itself.

#### G.3 — Topbar wiring

Replace `<SearchStub>`'s body with a button that calls `useCmdK().open()`. Visual: text "Search", muted, with a "⌘K" hint badge on the right (or "Ctrl K" on non-Mac).

#### G.4 — Integration audit

The executor's job:
1. Run `pnpm dev` + local Supabase. Exercise every flow:
   - Open a board → "Main table" tab is active.
   - First-load creates "My view" personal tab (visible in tab strip).
   - Add a filter via `<FilterBuilder>` → URL updates → table filters live.
   - Reload the URL → state restored.
   - Save filter → `Filter (N)` clears the "unsaved" indicator.
   - Multi-key sort works.
   - Hide a column → only that user sees it hidden.
   - Reorder columns in the visibility panel → order persists to view config.
   - Group-by status → buckets render; "+ Add task footer" suppressed.
   - Density toggle changes row height.
   - Search "foo" → tasks containing "foo" remain.
   - Cmd-K → type a board name → click → navigates.
   - Switch view → URL updates → filter cleared → other view's config applied.
   - Open the same board in two tabs as two users → both see the shared "Main table" view; the admin's edit + save is reflected on the other user's next switch.
2. Run `pnpm test`, the new pgTAP, and `tests/e2e/11-filtering-views.spec.ts`.
3. Identify wiring gaps. Patch with minimal edits (≤5 lines per file). Anything broader → escalate.

#### G.5 — E2E spec

`tests/e2e/11-filtering-views.spec.ts` covers:
- T1: open board → Main table active. Apply a status filter → expected rows visible. Reload URL → filter persists.
- T2: save filter as admin → second user (member) opens the board → sees the filter applied via the shared view.
- T3: hide a column → persisted; reload board → still hidden.
- T4: switch view → filter clears, other view's config applies.
- T5: in-board search → typing narrows visible rows; clearing restores.
- T6: Cmd-K → type board title → result row → click → navigates to board.
- T7: Cmd-K → type task title → click → navigates to the task drawer.
- T8: non-member tries to see another workspace's board in Cmd-K → 0 results (RLS proof).
- T9: delete the last shared table view → server action throws `LAST_DEFAULT`.

#### G.6 — Checkpoint doc

`_dispatch/epic-11-checkpoint-1.md` — list every DoD item with verdict + any minor patches.

**Definition of done:**
- Cmd-K palette opens + closes via keyboard and via the topbar button.
- Global search returns boards + tasks, respecting RLS (verified by E2E T8).
- E2E spec passes locally.
- Checkpoint doc enumerates each DoD item with a verdict.

**Escalation triggers:**
- Any DoD item that fails verification AND requires more than a 5-line patch → escalate. Opus produces a followup spec.
- If `use-cmdk` collides with the existing keyboard nav (`hooks/use-table-keyboard-nav.ts`) in the input-focus check, surface.

---

## Sequential follow-ups (after G lands)

- **Stage 3 — Review pass:** the orchestrator dispatches the `epic-researcher` (Opus) against the merged Stage-1+2 diff. Verdict: `CLEAN` (epic ready to merge) or a followup spec at `_dispatch/epic-11-followup-N.md`.
- **Deferred to followup work (do NOT in-scope this epic):**
  - OR groups / nested filter trees in the UI (Q14).
  - "Save this column order as the board default" mutator (Q23 followup path).
  - "Auto-save draft" personal-view toggle (Q19 followup).
  - Person-cell `toSearchString` resolving to display names (requires a `resolveUser(id) => display_name` ctx in the registry call — small spec).
  - Postgres full-text / `tsv` index for board-wide / comment search (epic doc § "Future: Postgres full-text search").
  - DnD reorder of tasks within column-based group-by buckets (Q12 followup).
  - "Filter too large for URL" → server-stored draft view (Q4 escalation path).

## Risk notes

1. **`useShallow` traps (MEMORY).** Every multi-field or derived `useBoardStore` selector in this epic touches the store. Slice C's popovers, Slice D's toolbar, and Slice F's page-wiring are the highest-risk surfaces. Each component spec calls this out, but it's worth flagging again: a selector returning `{filter, sort, search}` (fresh object) without `useShallow` will infinite-loop on the first realtime push. Reviewers must grep for `useBoardStore((s) => ({` and `useBoardStore((s) => [...` on every PR.

2. **Sort + DnD interaction.** When a sort is active, the existing `moveTask` server action (dnd-kit drop handler in `BoardTable`) still computes positions from the **rendered** order. A user dragging a row that has been sorted into a different position than its `task.position` could land at an unintended `position`. The safe default is to **disable DnD reorder when `sortKeys.length > 0`** — the `moveTask` becomes meaningless because the next render re-sorts. The cursor should change and the drag handle should disappear. Slice B / D must coordinate this — flag in Slice B's `applySort` JSDoc and Slice D's drag-handle render.

3. **Group-by column + DnD.** Same issue: column-based group-by means dragging across buckets implies changing `cell.value`, which is a different operation than `moveTask`. Per Q12, drag is disabled when group-by is non-native. Slice B coordinates.

4. **RLS on `view_modify`.** Policy is `for all using (...)` — it gates SELECT/UPDATE/DELETE/INSERT through one CASE. INSERT path verifies admin+ for shared rows. Slice E's `createView` defense-in-depth uses `requireBoardRole` before the insert too. Test surface: a `member` calling `createView({ isShared: true })` must fail at both layers.

5. **`is_shared = false` + `owner_id = null` is not a valid state.** RLS' `view_modify` treats `owner_id is null` as "system shared" (admin+ writable). The `view_select` policy similarly admits `owner_id is null` as readable. Slice E must always either set `owner_id = userId` (personal) or `owner_id = null` and `is_shared = true` (shared). The CHECK constraint to enforce this is **not present** in the deployed schema — consider adding a check constraint in Slice A's migration. (Default: skip the CHECK constraint to avoid widening Slice A; rely on server-action discipline. Surface for review.)

6. **Realtime back-pressure under filter + 5k tasks.** Each cell update fires a postgres_changes event; the store applies it; `useDeferredValue` ensures the next paint is computed from the deferred state, but the derivation itself (`applyFilterTree` × N rows) runs synchronously inside `useMemo`. At 5k tasks × 8 columns × a fast pasted edit, the derivation can drop frames. Mitigation: `useDeferredValue` is enough for v1; `useTransition` around the actual `setSort`/`applyDraft` calls smooths the worst case. Flag for Epic 14 perf pass.

7. **Default view auto-create races.** Two tabs opening the same board at exactly the same time as User X could each detect "no personal view" and each insert. Both inserts succeed (no UNIQUE constraint on `(board_id, owner_id, kind)`). User ends with two "My view" rows. Mitigation: add a soft-uniqueness check in Slice E's `createView` (load-then-insert in the same RPC would be cleaner but the action is simpler), OR add a partial unique index in a followup migration. **Default: accept duplicate "My view" rows in v1; followup adds the partial unique index.** Document in Risk notes.

8. **URL state collisions with future epic params.** Epic 12 (alternate views) and Epic 13 (notifications) may want additional URL params on `/w/.../b/<id>`. The Epic 11 codec reserves `view, f, s, g, q, d`. Future params must avoid these letters. Document in `lib/views/url-codec.ts` JSDoc.

9. **Pre-epic-09 bugfix lesson (MEMORY).** First end-to-end browser run of any new epic surfaces ~8 latent bugs that compile and lint cleanly. Slice G's integration audit MUST include manual in-browser smoke testing as part of the checkpoint doc — not just `pnpm test`.

10. **Cmd-K palette inside iframe / Storybook.** The Cmd-K binding at document level can collide with a host application's keybinding when the app is embedded. Out of scope for v1 (we don't have embeds).

11. **Person-cell `toSearchString` returns "" in v1.** This means searching for an assignee's name will not surface their tasks in v1. Document in the UI ("Search matches task titles and visible cell text — person assignment search coming soon"). Followup: pass a `resolveUser(id) => display_name` ctx through the registry call.

12. **Auto-create "Main table" on legacy boards.** The migration patches `create_board`; boards already created BEFORE the migration won't have a Main table view. Mitigation: at Slice F's page hydrate, if zero shared views exist for the board, auto-insert one via `createView({ isShared: true, name: 'Main table', kind: 'table' })`. This is a tiny extra step in F.1; it covers the upgrade path and idempotent on subsequent loads. Document in F's spec — already present as the page-level fallback behavior in F.1 step 3 (extend to also create the shared default when absent).

## Definition of done (epic 11 doc, mapped to slices)

| DoD item from `11-filtering-views.md` | Slice(s) |
|---|---|
| Users can filter the table by any column with type-appropriate operators. | A (registry contracts) + B (apply-filter-tree) + C (FilterBuilder) |
| Multi-key sort works. | A (registry compare) + B (apply-sort + sortKeys) + C (SortBuilder) |
| Hiding columns, resizing, and reordering persists per user. | A (config schema columnVisibility/columnWidths/columnOrder) + B (effective config) + C (ColumnVisibilityPanel) + F (existing column-resize hook routes through view.config) |
| Saved views (shared and personal) appear in tabs; switching applies their config. | A (default view migration) + B (viewsByBoard + activeViewId) + D (ViewTabs) + E (server actions) + F (page hydration) |
| The URL reflects the active view + draft overrides; copying it shares the same state. | A (url-codec) + B (useBoardView hook) + F (RSC searchParams handoff) |
| In-board search filters tasks live as you type. | A (toSearchString) + B (apply-search) + D (SearchInput) |
| Cmd-K global search finds boards and tasks across the workspace, respecting RLS. | A (global_search SQL fn) + E (globalSearch server action) + G (palette + topbar wiring) |
| Default "Main table" view auto-created on board creation. | A (patch create_board RPC) + F (fallback for legacy boards) |
| Filter/sort/group-by all happen client-side; rendering 5,000 filtered/sorted tasks stays at 60fps. | B (apply-*.ts + useDeferredValue) + G (e2e perf smoke; deep perf in Epic 14) |
| Visual fidelity: BoardFilter toolbar, view tabs, popovers per component-system §1.4 / §3.1. | C (PopoverShell + popovers) + D (ViewTabs + ViewToolbar + SearchInput animation) |

---

**Summary of file paths I touched while planning (all absolute, repo-relative):**

- `/Volumes/SSD1T/DEV WORK/donezo/CLAUDE.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/00-overview.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/02-supabase-schema.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/11-filtering-views.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/component-system.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/design-system.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-10.md` (format template)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506224930_initial_schema.sql` (`view` table at lines 329-348; `profile` at 357-368)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506230238_view_board_pos_idx.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260507120100_rls_policies.sql` (view RLS at 383-408)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260507120200_invitations_and_creation_rpcs.sql` (`create_board` RPC at 185-215)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/types.ts` (profile at 598-625; view at 716-762)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/types.ts` (CellTypeDef contract)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/registry.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/filter-operators.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/activity.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/actions/with-user.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/board-context.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/actions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/BoardViewTabs.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/types.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/ColumnHeader.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/ColumnHeaderMenu.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/CellEditor.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/text/def.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/status/def.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/person/def.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/date/def.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/number/def.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/shared/topbar/Topbar.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/shared/topbar/SearchStub.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/` (empty directory — net-new surface)
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/stores/types/attachments.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-realtime.ts`
