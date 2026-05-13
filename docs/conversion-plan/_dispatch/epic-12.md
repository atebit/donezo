# Epic 12 — Alternate Views (Kanban, Calendar, Timeline, Dashboard, Form) — Dispatch Plan

> Planned and approved 2026-05-12 via an autonomous scheduled run (`donezo-hourly-epic-checkin`). The orchestrator (Opus) resolved the three "NEEDS USER" open questions with the researcher's recommended defaults. Decisions captured below — executors should treat these as binding.

## Orchestrator decisions (autonomous run, 2026-05-12)

| Question | Decision | Rationale |
|---|---|---|
| **Q7 — Form submit with no board groups** | Server action returns `VALIDATION { code: 'NO_GROUPS' }`; FormView shows inline error "Add a group to this board before accepting submissions." Do NOT auto-create a default group. | Auto-creating a group has broader UX implications than this epic should make. Inline empty-state is the minimal correct behavior. |
| **Q24 — Minimum role to submit a form** | `viewer` role (any board member) may submit a form. Implement via **option (b)**: a `SECURITY DEFINER` SQL function `submit_form(...)` that performs the insert with elevated privileges and a single CHECK on board membership. Slice F adds a small migration for this function. If executor cannot land (b) cleanly, fall back to (a) and escalate. | Per risk note #15: if viewers cannot submit, the form view is useless for v1 (only a slower path for members who can already create tasks from the table). RLS-as-truth approach (SECURITY DEFINER) keeps the auth boundary inside the database. |
| **Q27 — CardStyle storage location** | Top-level `view.config.cardStyle?: CardStyle`. Kanban / Calendar / Timeline all read the same key. | Simplest model; per-kind divergence can be added later as a non-breaking change. |

All other open questions resolved with the recommended defaults inline in the slice specs (strong defaults, not policy calls).

---

## Preconditions verified

**Repo state (confirmed by direct inspection):**

- **Route slug is `[workspaceSlug]`, not `[slug]`.** Every Epic 12 route file lives under `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/`. The epic doc's `app/(app)/w/[slug]/b/[boardId]/...` paths are doc drift — use `[workspaceSlug]`.
- **All five per-kind route directories already exist but are empty** (`table/`, `kanban/`, `calendar/`, `timeline/`, `dashboard/` under the `[boardId]` route). No `page.tsx` in any of them. The default board view is the top-level `[boardId]/page.tsx` which renders `<BoardTable />` directly — Epic 12 must turn that into a redirect or wrap it.
- **All five per-kind component directories already exist but are empty** (`components/board/kanban/`, `calendar/`, `timeline/`, `dashboard/`). The plan owns these.
- **`view.kind` already accepts all 6 kinds** in `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506224930_initial_schema.sql:334-336` (`'table' | 'kanban' | 'calendar' | 'timeline' | 'dashboard' | 'form'`). No new migration needed for kind values.
- **`profile.last_view_per_board` already exists** (`/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260515000000_profile_last_view_per_board.sql`). Epic 12 must extend `last_view_per_board` to store **`{ boardId: viewId }`** today; Epic 12 keeps that exact shape (view id encodes kind already).
- **`view.config jsonb` schema is in place** (`/Volumes/SSD1T/DEV WORK/donezo/lib/views/config-schema.ts:104-108`). The `kanban`, `calendar`, `timeline`, `dashboard`, `form` slots are `z.unknown().optional()` reservations. Epic 12 replaces each with a strict shape for its kind while leaving the others as `unknown` until their slice lands. **Per-kind config schemas are co-owned by their per-kind slice.**
- **`<ViewTabs />`, `<ViewToolbar />`, `<AddViewMenu />`, `<ViewTabDropdown />` all exist and are wired through `<BoardLayout />`.** `<AddViewMenu />` lists all 6 kinds; everything but `table` is disabled with "Coming in Epic 12" tooltips. Epic 12 flips the enabled flags as each kind ships.
- **`useBoardView()` is the canonical view-state hook** (`/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-view.ts`). It returns `{ active, effective, hasUnsavedChanges, applyDraft, resetDraft, save, switchView, views, role }`. **`switchView(viewId)` currently only sets `?view=<id>` on the SAME route** — it does NOT navigate to a different per-kind route. Epic 12 must extend `switchView` to route to `/w/[slug]/b/[id]/<kind>?view=<id>` when the chosen view's `kind !== currentKind`. (Slice A owns this delta.)
- **Cell registry exposes `def.aggregate`, `def.aggregations: AggregationKind[]`, `def.compare`, `def.toSearchString`, `def.matchesFilter`** (`/Volumes/SSD1T/DEV WORK/donezo/lib/cells/types.ts:182-245`). All 24 cell types implement these. The Dashboard slice consumes `aggregate` directly through the registry.
- **`AggregationKind` values from the registry** (`/Volumes/SSD1T/DEV WORK/donezo/lib/cells/types.ts` + `lib/cells/aggregations.ts`): `count`, `count_empty`, `count_unique`, `sum`, `avg`, `min`, `max`, `median`, `percent_by_label`. Numeric types (`number`, `currency`, `rating`, `vote`) expose `sum`/`avg`/`min`/`max`/`median`; `status`/`priority` expose `percent_by_label`. Dashboard widgets must call `def.aggregate(values, kind, config)` and treat its string return as display-ready.
- **`setCellValue` server action** is at `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts`. Kanban drag-between-lanes, Calendar drag-to-reschedule, and Timeline bar drag all wire to this same action.
- **`createTask` server action** at `tasks/actions.ts:47-91` accepts `{ groupId, title, position }` and **derives `board_id` from the group via trigger**. Kanban "+ Add task in this lane" + Form `submitForm` both need to call this then immediately call `setCellValue` for the pre-set column (or for every form field). There's no "atomic create-task-with-cells" server action today; Epic 12 must either add one or use sequential calls inside a server-action wrapper.
- **`useBoardRealtime` is shared and channel-per-board** (`/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-realtime.ts:25`). It updates the store; derived views (kanban lanes, calendar buckets, timeline rows) re-render automatically when the store changes. **No realtime hook changes needed for Epic 12.**
- **`useBoardStore` shape: store keys we will consume but not mutate** — `tasks`, `groups`, `cells` (Map keyed `task_id:column_id`), `columns`, `labelsByColumn`. Multi-field selectors must wrap with `useShallow` per MEMORY note.
- **Realtime denormalization** is in place (`/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260512000000_realtime_denormalization.sql`) — `cell.board_id` exists and is enforced by trigger, so the existing filter-by-board on the realtime channel covers every kind.
- **dnd-kit is installed** (`@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10`, `@dnd-kit/utilities@3.2.2`). Already used by the table for row + group reorder; Kanban + Timeline + Dashboard widget reorder all reuse it.
- **`@tanstack/react-virtual` is installed (3.13.24).** Used by the table virtualizer; Kanban lanes and Timeline rows will reuse it.
- **`@base-ui/react` is installed (1.4.1)** and is the primitive layer for all popovers, dialogs, menus. The form view's inputs land on Base UI primitives.
- **Sonner toasts (`sonner@2.0.7`), `react-hook-form@7.75`, `zod@4.4.3` are installed.** Form view uses RHF + Zod.

**Dependencies that must be NEW additions for Epic 12** (no equivalent in `package.json`):

- `react-big-calendar@^1.x` (Calendar slice) — date-fns localizer.
- `date-fns@^4.x` (Calendar + Timeline slices) — date math, localizer.
- `react-grid-layout@^1.x` (Dashboard slice) — `WidthProvider(Responsive)` for resize/reorder.
- `recharts@^2.x` (Dashboard slice) — Bar / Pie / Line / Area chart components.

These are **installed once in Slice A (the Stage-1 shared slice)** so executor branches stay merge-clean on `package.json` / `pnpm-lock.yaml`.

**Stack defaults present (CLAUDE.md, restated for each slice spec below):**

- pnpm only. Next 15 App Router. RSC-first. `"use client"` only for interactivity.
- Server Actions for mutations; no `/api` route handlers.
- TypeScript strict; regen Supabase types only if a slice adds a column — Epic 12 likely does not need any.
- Tailwind v4 + shadcn/ui + Base UI (`@base-ui/react`). No MUI / SCSS.
- React Hook Form + Zod. One schema validates client + server.
- TanStack Table + Virtual already on the page; reuse for Kanban / Timeline row virtualization.
- DnD: dnd-kit only — react-big-calendar's drag-drop addon is NOT used (it's a separate package, not installed, and conflicts with dnd-kit ergonomics). Calendar drag is implemented via dnd-kit overlay over the calendar cells (see Slice C spec).
- Toasts: sonner.
- Zustand v5 + `useShallow` for every multi-field / derived selector (MEMORY note).
- All ids `uuid v4` from Postgres. All times `timestamptz`. Soft-delete via `deleted_at` (none added in this epic).
- Migrations under `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Next free timestamp: `>20260515000002`. Epic 12 uses `20260516000000+` if any migrations land (the shared slice may add one trivial migration to add a partial-unique constraint for personal views per board+kind — see Open questions).

## Open questions for the user

Each item lists the recommended default the scheduled task should auto-approve. Strong defaults; only items flagged **NEEDS USER** require a human in the loop.

1. **Per-kind route shells: redirect from `/[boardId]` (no segment) vs render-in-place.** The epic doc says `page.tsx → redirects to last-used view kind, default 'table'`. The current `[boardId]/page.tsx` renders `<BoardTable />` directly.
   **Default:** Convert `[boardId]/page.tsx` into a thin **redirect** RSC: resolve the active view (URL → `last_view_per_board[boardId]` → "Main table") and `redirect()` to `/w/<slug>/b/<id>/<kind>?view=<id>`. Move the current BoardTable-with-data-load into `[boardId]/table/page.tsx`. Every kind ships its own `page.tsx` that performs the same data load. **Rationale:** matches the epic doc verbatim; makes per-kind code-splitting trivial; browser history per kind is intuitive.

2. **Shared `boardData` loader to avoid five copies of the Promise.all in each kind's `page.tsx`.**
   **Default:** Extract a server-only helper `lib/board/load-board-snapshot.ts` exporting `loadBoardSnapshot({ boardId, currentUserId, searchParamViewId })` that returns the same shape that `BoardTable.tsx`'s `initial` prop expects (groups, tasks, cells, columns, attachments, views, activeViewId, currentUserId). Each per-kind `page.tsx` is a 20-line RSC that calls this helper, then renders a per-kind container. (`table/page.tsx` keeps using `<BoardTable />`; the others use `<KanbanBoard />`, `<CalendarView />`, etc.)

3. **`switchView` cross-kind navigation.** Today `switchView(viewId)` calls `router.replace(${pathname}?view=${id})`. It does NOT change the URL segment.
   **Default:** Extend `switchView` in `useBoardView` so that if `view.kind !== currentKind`, it routes via `router.push(/w/<slug>/b/<id>/<kind>?view=<id>)`. Same-kind switches still use `router.replace` to avoid history bloat. Slice A owns this delta.

4. **TaskCard shared renderer location.** Epic doc § Card style: "Card style applied to `<TaskCard />` for kanban/calendar/timeline must come from a single shared renderer".
   **Default:** `components/board/shared/TaskCard.tsx` — one component, three contexts. Props `{ task: Task; cells: Cell[]; columns: Column[]; cardStyle: CardStyle; onOpen: () => void }`. Click navigates to the task drawer route via the existing `@modal` slot, identical to how `<TaskRow />` does it. Card style applies to this component only; per-kind containers don't replicate card chrome.

5. **`CardStyle` storage shape and defaults.**
   **Default:** Per the epic doc verbatim:
   ```ts
   type CardStyle = {
     showTitle: boolean;          // always true
     visibleColumnIds: string[];  // order matters; default = first 3 visible non-title columns
     showAvatars: boolean;        // default true (visible only if a person column is on the card)
     showDueDate: boolean;        // default true (visible only if a date column is on the card)
   };
   ```
   Stored at `view.config.cardStyle` (Slice A adds this to `ViewConfigSchema`). The card-style editor is a small popover triggered from the view-toolbar's "Card style" affordance, owned by Slice A.

6. **Form view scope.** Epic doc § Form: "internal only for v1; public sharing deferred."
   **Default:** Form route lives at `/w/<slug>/b/<id>/form?view=<viewId>`, served behind the same auth as the rest of the app. Submitting calls a new server action `submitForm({ boardId, viewId, values })` that creates a task in the form view's configured group (default: first non-deleted group) and writes cells via `setCellValue` in a single round trip. No public token. No anonymous path.

7. **NEEDS USER (low-stakes) — Where does the form-submitted task land if the board has no groups?**
   **Recommended default:** Server action returns `VALIDATION { code: 'NO_GROUPS' }` and the Form view renders an inline error: "Add a group to this board before accepting submissions." Stage 1 ships the empty-state. Hidden cost of auto-creating a default group is wider than this epic.

8. **Kanban group-by support for v1.** Epic doc lists `status, priority, person, checkbox`.
   **Default:** Ship `status` and `priority` first-class. `person` is supported but lanes-per-member is computed off `workspace_member` (each lane = one member + an "Unassigned" lane). `checkbox` ships with exactly two lanes — "Checked" and "Unchecked". `country` and other categorical types listed in the epic doc § Group-by intro are out of scope for v1 — flagged in the picker as "Coming soon" if a column with those types exists. Drag uses `setCellValue` for status/priority/checkbox; for person, drag updates the cell's `json_value` (`{ userIds: [...] }`) to a single-user array equal to the destination lane's member (replacing prior assignees — documented in the lane drop tooltip).

9. **Lane ordering for `person` kanban.**
   **Default:** Member lanes ordered by display name ascending. "Unassigned" lane is last. (Senior-eng default; epic doc says "lanes per workspace member, plus an Unassigned lane.")

10. **Reordering within a kanban lane.** Epic doc: "reorder updates `task.position`."
    **Default:** Reorder uses the existing `moveTask` server action (already accepts `{ taskId, groupId, position }`), but with the **caveat from Epic 11**: if the active view has `sort.length > 0`, the drag handle is hidden and reorder is disabled (consistent with the table). Document on `<KanbanLane>`'s drag-disabled state.

11. **Calendar library + drag library.** Epic doc lists `react-big-calendar` with date-fns localizer.
    **Default:** Install `react-big-calendar@^1` + `date-fns@^4`. Use the date-fns localizer. **Do not install `react-big-calendar/lib/addons/dragAndDrop`** — instead, intercept events with `onSelectEvent` for click-to-open, `onSelectSlot` for quick-create, and use a custom drag overlay via dnd-kit's `<DndContext>` wrapped around the calendar root (calendar cells become drop targets identified by their date). This keeps DnD consistent with the rest of the app and avoids react-dnd, which `react-big-calendar`'s addon depends on. **Rationale:** Per CLAUDE.md, dnd-kit is the canonical DnD library.

12. **Calendar locale.**
    **Default:** English (`en-US`) hardcoded via `dateFnsLocalizer({ locale: enUS, ...})`. Localization is deferred to Epic 14 per the epic doc's open question.

13. **Calendar resize semantics for date vs timeline columns.** Epic doc says resize is only available when the calendar column is `timeline`-type.
    **Default:** Conditional on `column.type === 'timeline'`. For `date` columns, resize is disabled (the cell stores a single date, not a range). Encode `resizable={col.type === 'timeline'}` on each rendered event.

14. **Timeline custom build vs library.** Epic doc: "Choice: build custom on top of `@tanstack/react-virtual`."
    **Default:** Build custom per the epic doc. `<TimelineView />` is a virtualized row list (one row per task) with sticky time axis at the top, today line, and absolutely-positioned bars rendered inside each row. dnd-kit drives bar drag + edge resize. **Rationale matches the epic doc.**

15. **Time-axis scales for timeline.**
    **Default:** Per the epic doc: `day | week | month | quarter | year`. Default scale = `week`. Header is sticky; the today line is a vertical 1px line at `--color-primary`. Weekend shading on `day`/`week` scales uses `--color-surface-hover` for Saturday + Sunday columns. Snap-to-day for bar drag (epic doc open question — recommended).

16. **Timeline tasks without start+end.** Epic doc: "in a sidebar list, draggable onto the timeline."
    **Default:** Render a right-side panel "Unscheduled (N)" that lists tasks with empty `timeline` cells. Dragging from the panel onto the timeline creates a `{ start, end }` pair (default duration = 1 day on `day`/`week`, 7 days on `month`+) at the drop position.

17. **Dashboard config storage shape.** Epic doc verbatim — Slice F's job to implement it in `view.config.dashboard`. Slice A adds the strict Zod schema for `DashboardConfig`.

18. **Widget initial layout defaults.**
    **Default:** New dashboards start with 1 number widget (`{ kind: 'number', columnId: <first numeric column or empty>, aggregation: 'sum' }`) at `(0,0) 4w 2h`. Empty dashboards render a "+ Add widget" centered placeholder. (Senior-eng default.)

19. **Dashboard live update mechanism.**
    **Default:** Each widget reads the underlying tasks + cells from the store directly via the same selectors the table uses (filtered by the view's filter if present), and recomputes via `useMemo` on store-change. No bespoke realtime: the existing realtime hook updates the store; widgets re-render. Cap re-computation to one frame via `useDeferredValue` over the source list for dashboards with > 1000 tasks. (Senior-eng default; matches epic doc § "Realtime in alternate views".)

20. **Dashboard widget reorder + resize via `react-grid-layout`.**
    **Default:** Use `react-grid-layout`'s `Responsive + WidthProvider`. Layout is the array stored at `view.config.dashboard.layout`. Save on `onLayoutChange` is debounced 750ms (matches Epic 11's view-config-save cadence). **SSR concern**: `react-grid-layout` reads `window` at module init; the Dashboard component must be marked `"use client"` AND dynamically imported with `ssr: false` inside the `dashboard/page.tsx` RSC. Slice F's spec documents the next/dynamic boundary.

21. **Recharts SSR.** Recharts uses ResizeObserver and `window` heavily.
    **Default:** All widget components (`NumberWidget`, `BarWidget`, `PieWidget`, `LineWidget`, `TableWidget`) are client components. The wrapping `<Dashboard />` is a client component dynamically imported with `ssr: false`. (No special handling beyond this — recharts works fine in client-side React 19.)

22. **Aggregation dispatch.** Epic doc: "Aggregations come from `def.aggregate`."
    **Default:** Widgets call `def.aggregate(values, kind, config)` and treat the returned string as display-ready (it already formats with units / percentages). Numeric chart widgets that need raw numbers (bar/line) bypass `def.aggregate` and instead call `def.fromRow` to extract typed values per task, then aggregate via `lib/cells/aggregations.ts` helpers (`aggregateSum`, `aggregateAvg`, etc.) directly. The string-returning `def.aggregate` is for the number widget's final display only.

23. **Form view's `submitForm` server action — atomic task+cells.**
    **Default:** A new server action `submitForm({ boardId, viewId, values: { columnId, value }[] })` lives at `app/(app)/w/[workspaceSlug]/b/[boardId]/form/actions.ts`. It (1) resolves the target group (the form-view config picks one; default = first non-deleted group), (2) calls `requireBoardRole(boardId, 'member')` because forms are internal-only and only members can submit (admin override the role gate by epic doc — flagged in q24 below), (3) inserts a task via the same Insert pattern as `createTask`, (4) upserts cells in one round trip via a single `upsert([...])` on `cell`. Returns the new task id. Activity is logged best-effort.

24. **NEEDS USER (medium-stakes) — minimum role to submit a form.** Internal-only forms: should `viewer`-role users be able to submit a form (since they otherwise cannot mutate)? Or does form-submit count as a member-only mutation?
    **Recommended default:** **viewer can submit a form** — the value prop of the form view for non-members is precisely that it lets them propose tasks without granting them broader edit rights. `submitForm` checks role >= `viewer` (effectively: any board role), and `setCellValue`/`createTask` inside the action bypass the standard `requireBoardRole(_, 'member')` gate via a service-scoped helper. This is the only place in the app today where viewers can mutate. **Flagged for the user** because it crosses the RLS boundary subtly and may need a SQL function instead of stacked server-action checks.

25. **Form view config shape.** Epic doc § Form view describes the config; Slice A adds the schema.
    **Default:** ```ts
    type FormConfig = {
      title?: string;
      description?: string;
      groupId?: string;            // target group; default = first group
      fields: Array<{
        columnId: string;
        required: boolean;
        labelOverride?: string;
        helpText?: string;
        defaultValue?: unknown;    // typed per cell registry
      }>;
    };
    ```
    Stored at `view.config.form`. The form-config editor (Slice G) is a small panel: column list with toggle to include + per-row settings.

26. **`page.tsx` redirect destination when no view is resolvable.**
    **Default:** Fallback to `/w/<slug>/b/<id>/table` with no `?view=`, which causes the table page to fall back to its "show all tasks unfiltered, no group-by override" mode (already implemented). This matches today's behavior when `views = []`.

27. **NEEDS USER (low-stakes) — Should `view.config.cardStyle` be a separate top-level key vs per-kind?** Card style applies to kanban / calendar / timeline. Today the doc says one shared editor.
    **Recommended default:** Top-level `view.config.cardStyle?: CardStyle`. Kanban / Calendar / Timeline read the same key. This is the simplest model; if per-kind divergence is needed later it can be added without breaking change.

28. **Add a partial unique constraint on personal views per `(board_id, owner_id, kind)`?** This was deferred from Epic 11 (followup #7). Without it, the personal "My view" can be duplicated by tab-race.
    **Default:** **Defer.** Epic 12 already has a large surface; the duplicate-view issue is benign (the second tab just creates a redundant "My view" row, no data corruption). Leave for Epic 14 polish or a standalone migration. Not in scope here.

29. **Reuse of the existing `<ViewToolbar />` Save / Reset / Filter / Sort / Hide / Group / Search / Density buttons on every kind.**
    **Default:** All five new view kinds render `<ViewToolbar />` above their main content. The filter / sort / search are reused identically (kanban filters cards, calendar filters events, timeline filters bars, dashboard filters widget-data sources). **Hide / Group / Density are gated per kind:**
    - Kanban: Hide and Group are hidden in the toolbar (group-by is owned by the kanban's group-by-column picker; column visibility is replaced by the card-style editor). Density hidden.
    - Calendar: Hide / Group / Density all hidden.
    - Timeline: Hide / Group hidden; Density used for row height.
    - Dashboard: Filter only (applies to widget data); Sort / Hide / Group / Density hidden.
    - Form: only Filter / Search make sense for the form-builder side panel; in the form-render side, all toolbar items are hidden.

    Slice A adds a `kindGate` prop to `<ViewToolbar />` so the right items are shown per kind. Less risky than per-kind ToolbarN components.

30. **Per-kind realtime gating.**
    **Default:** None. `useBoardRealtime(boardId, userId)` is called once at the board layout level (today: inside `<BoardTable />` only). Slice A moves the `useBoardRealtime` hook call up to a shared `<BoardRealtimeBootstrap />` client component rendered by `[boardId]/layout.tsx`, so every per-kind page benefits. Each view kind reads from the same store; no per-kind subscription. **Side effect**: `<BoardTable />` stops calling `useBoardRealtime` directly (it's now called from the layout). Slice A's spec calls this out.

## Stack reminders (do not drift)

- pnpm only. Next 15 App Router, RSC-first. `"use client"` only for interactivity.
- Server Actions for mutations. No `/api` route handlers except webhooks.
- TypeScript strict.
- Tailwind v4 + shadcn/ui + Base UI (`@base-ui/react`). No MUI / SCSS.
- Forms: React Hook Form + Zod v4 — one schema validates client + server.
- DnD: dnd-kit (NOT react-dnd, NOT react-big-calendar's addon).
- Charts: Recharts.
- Tables: TanStack Table + Virtual.
- Toasts: sonner.
- Zustand v5; multi-field selectors wrapped in `useShallow` (MEMORY note).
- RLS is the source of truth. Helpers `role_for_board` / `role_rank` for any privilege check.
- All ids `uuid v4` from Postgres. All times `timestamptz`. Soft-delete by `deleted_at` for top-level entities; `view` rows hard-delete.
- Migrations under `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Next free timestamp: `>20260515000002`. Epic 12 reserves `20260516000000+` if any are needed.

---

## Stage 1 — view-kind plumbing (single blocker)

Stage 1 is the ONLY pre-req for Stage 2. Stage 1 is **one slice** (Slice A) because everything in it is shared infrastructure — splitting it across parallel slices would create merge conflicts on the small set of shared files.

---

### Slice A — Shared view-kind plumbing

**Branch:** `epic/12-alternate-views/a-view-kind-plumbing`

**Owner:** epic-executor (Sonnet)

**Owns (write):**

- `/Volumes/SSD1T/DEV WORK/donezo/package.json` (add: `react-big-calendar`, `date-fns`, `react-grid-layout`, `recharts`, `@types/react-grid-layout`)
- `/Volumes/SSD1T/DEV WORK/donezo/pnpm-lock.yaml` (regenerated by pnpm)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/board/load-board-snapshot.ts` (new — extracted server-only loader)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/views/config-schema.ts` (extend — add `CardStyleSchema`, narrow `kanban`/`calendar`/`timeline`/`dashboard`/`form` Zod slots with strict per-kind shapes; keep them all `.optional()`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/views/kind-routes.ts` (new — pure helpers: `kindFromPath(pathname): ViewKind`, `pathForKind(kind, slug, boardId, viewId?): string`)
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-view.ts` (extend — `switchView(id)` cross-kind navigation per Q3 above)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/shared/TaskCard.tsx` (new — shared card renderer for kanban / calendar / timeline per Q4)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/shared/CardStyleEditor.tsx` (new — popover panel; renders inside the active-view dropdown for kanban/calendar/timeline)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/BoardRealtimeBootstrap.tsx` (new — client component that calls `useBoardRealtime(boardId, userId)` from the layout per Q30)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` (extend — render `<BoardRealtimeBootstrap />`)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (REPLACE — convert to redirect-to-active-view-kind RSC; the existing data-load moves to `table/page.tsx`)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/table/page.tsx` (new — receives the relocated data-load body; renders `<BoardTable />`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx` (small edit — remove the `useBoardRealtime` call that's relocated to the layout's `<BoardRealtimeBootstrap />`; ≤10 lines)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/AddViewMenu.tsx` (small edit — flip `enabled` to `true` for kanban/calendar/timeline/dashboard/form; on click for each, call `createView` with the corresponding `kind` and then `switchView(id)` which navigates to the per-kind route)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/ViewToolbar.tsx` (small edit — accept a `kindGate?: { hide?: ('filter'|'sort'|'hide'|'group'|'density'|'search'|'save'|'reset')[] }` prop and hide listed items per Q29; pass from each kind's container)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/use-board-view-cross-kind.test.ts` (new — verifies `switchView` cross-kind navigation)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/task-card.test.tsx` (new — visual contract: shows title + first N visible columns; card-style respected)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/view-config-per-kind-schema.test.ts` (new — verifies kind-specific config Zod parsing for each kind)

**Forbidden:** Any file under `components/board/kanban/`, `components/board/calendar/`, `components/board/timeline/`, `components/board/dashboard/`, or any per-kind route directory other than `table/page.tsx`. **Do not** add or modify any cell-type def, server action under `cells/`, `tasks/`, `groups/`, etc. Do not write to `app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions.ts` (it's already fine).

**Depends on:** none.

**Spec (self-contained):**

#### A.1 — Install dependencies

Run `pnpm add react-big-calendar date-fns react-grid-layout recharts` and `pnpm add -D @types/react-grid-layout`. Do not pin minors; use caret. **All four packages are NEW; no existing imports to migrate.**

After install:
- `react-big-calendar` should be ^1.x
- `date-fns` ^4.x
- `react-grid-layout` ^1.x
- `recharts` ^2.x

`react-big-calendar`'s CSS lives at `react-big-calendar/lib/css/react-big-calendar.css`; the Calendar slice will import it from the calendar `page.tsx`. Slice A does not need to import it.

#### A.2 — `lib/board/load-board-snapshot.ts`

A server-only helper that returns the exact shape `<BoardTable />` expects (the `TableData` plus `views` + `activeViewId` + `currentUserId`). Single-source loader, used by all five per-kind pages.

Signature:
```ts
export type BoardSnapshot = {
  groups: Group[];
  tasks: Task[];
  cells: Cell[];
  columns: Column[];
  attachments: AttachmentRow[];
  views: ViewRow[];
  activeViewId: string | null;
  currentUserId: string;
};

export async function loadBoardSnapshot(args: {
  boardId: string;
  searchParamViewId: string | undefined;
}): Promise<BoardSnapshot>;
```

Move the body of the current `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (the Promise.all + the view-fallback auto-create logic + activeViewId resolution) into this helper. The new file in `app/(app)/w/.../page.tsx` and each kind's `page.tsx` call the helper.

#### A.3 — `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` becomes a redirect

```ts
export default async function BoardIndexPage({ params, searchParams }) {
  const { workspaceSlug, boardId } = await params;
  const sp = await searchParams;
  const snap = await loadBoardSnapshot({ boardId, searchParamViewId: sp.view });
  const activeView = snap.views.find((v) => v.id === snap.activeViewId);
  const kind = activeView?.kind ?? 'table';
  // Preserve any other URL params (?f, ?s, ?g, ?q, ?d, ?view).
  const params = new URLSearchParams(sp as Record<string, string>);
  redirect(`/w/${workspaceSlug}/b/${boardId}/${kind}?${params.toString()}`);
}
```

Side effect: the URL is always `/w/.../b/<id>/<kind>?view=<id>` once a board is opened. The old bare `/w/.../b/<id>` is a 1-hop redirect.

#### A.4 — `app/(app)/w/[workspaceSlug]/b/[boardId]/table/page.tsx`

This file receives the body of today's `[boardId]/page.tsx` (just the `<BoardTable />` render path; the data-load is moved to `loadBoardSnapshot`). The other four kinds' `page.tsx` will be added in their respective slices (Stage 2) and follow the same shape.

```ts
export default async function TablePage({ params, searchParams }) {
  const { boardId } = await params;
  const sp = await searchParams;
  const currentUser = await requireUser();
  const snap = await loadBoardSnapshot({ boardId, searchParamViewId: sp.view });
  return (
    <BoardTable boardId={boardId} initial={{ ...snap, currentUserId: currentUser.id }} />
  );
}
```

#### A.5 — Cross-kind `switchView` in `use-board-view.ts`

Today `switchView(id)` does `router.replace(${pathname}?view=${id})`. Modify it to:
1. Look up `view.kind` from the store's `viewsByBoard[boardId]`.
2. Use `lib/views/kind-routes.ts` to compute the target path: `/w/<slug>/b/<id>/<kind>?view=<id>`.
3. If the target path differs from `pathname` (cross-kind switch), call `router.push(target)`. Otherwise `router.replace(target)`.

**`workspaceSlug` resolution**: the hook already calls `usePathname()`. Parse `/w/<slug>/...` to extract slug, OR add `workspaceSlug` to the existing `BoardContext` (better — avoid path parsing). The `<BoardProvider>` already receives `board` and `role`; extend it to also receive `workspaceSlug` from `[boardId]/layout.tsx`.

#### A.6 — `<TaskCard />`

The single shared card renderer for kanban / calendar / timeline:

```tsx
interface TaskCardProps {
  task: Task;
  /** Optional: pre-filtered cells for this task (callers pass to avoid lookup). */
  cells?: Cell[];
  /** Columns the card may render; ordered per card style. */
  columns: Column[];
  cardStyle: CardStyle;
  /** Click handler — default opens the task drawer route. */
  onOpen?: () => void;
  /** Optional drag handle slot (kanban uses this; calendar/timeline don't). */
  dragHandle?: React.ReactNode;
}
export function TaskCard(props: TaskCardProps): JSX.Element;
```

Visual contract (must-match per component-system §7.1):
- bg white
- radius 4px, shadow `--shadow-card`
- font 13px
- margin-bottom 8px (parent layouts pass this through gap)
- Inner padding 8px, gap 8px
- Title row 36px tall, gap 4px, comment-count badge identical to `<TaskRow />`
- Card content rows: stacked picker rows, each 36px tall with bg `--color-surface-info` (`#f5f6f8`)

Each cell renders via `def.Cell` (NOT the editor — cards are read-only at v1). Click on card body → calls `onOpen()` (defaults to `router.push(/w/<slug>/b/<id>/<currentKind>/t/<taskId>)` via the existing `@modal` intercept).

For tests: a snapshot test verifying the visual contract (heights, classes), plus a behavior test verifying clicking opens the drawer.

#### A.7 — `<CardStyleEditor />`

A small popover triggered from each kind's view-toolbar (kanban / calendar / timeline). It reads `view.config.cardStyle` (or the per-kind default), and writes via `useBoardView().applyDraft({ cardStyle: ... })`.

Editor surface (Base UI Popover):
- "Show columns" — a checklist of all `column`s except the title column; reorderable via dnd-kit's `<SortableContext>`. Each item toggles `cardStyle.visibleColumnIds`.
- "Show avatars" toggle → `cardStyle.showAvatars` (only effective if a person column is in `visibleColumnIds`).
- "Show due date" toggle → `cardStyle.showDueDate`.

Wired by each kind container (kanban/calendar/timeline). Dashboard + Form do not show this.

#### A.8 — `<BoardRealtimeBootstrap />`

A 10-line client component:

```tsx
"use client";
import { useBoardRealtime } from "@/hooks/use-board-realtime";
import { useBoard } from "@/hooks/use-board";

export function BoardRealtimeBootstrap() {
  const { board, userId } = useBoard();
  useBoardRealtime(board.id, userId);
  return null;
}
```

Rendered inside `[boardId]/layout.tsx` so the realtime channel is active across all view kinds. The current `useBoardRealtime` call inside `<BoardTable />` is removed (small edit; see file scope).

#### A.9 — `<ViewToolbar />` kind gate

Add a `kindGate?: { hide?: ToolbarItem[] }` prop where `ToolbarItem = 'filter' | 'sort' | 'hide' | 'group' | 'density' | 'search' | 'save' | 'reset'`. Items listed in `hide` are skipped. Each per-kind page passes the appropriate `kindGate` (see Q29). The default (no prop) preserves today's behavior so the table page doesn't change.

#### A.10 — Update `<AddViewMenu />`

Flip `enabled: true` for all 6 kinds. Update the click handler to:
1. Call `createView({ boardId, kind: <selected>, name: 'New <kind> view', isShared: false, config: <kind-specific-default> })`.
2. On success, call `switchView(result.data.id)` which (per A.5) navigates to `/w/.../b/<id>/<kind>?view=<id>`.

Per-kind default configs (Slice A only stubs them as empty objects; per-kind slices fill in real defaults):
- `table`: `{}`
- `kanban`: `{ kanban: { groupByColumnId: '' } }` (the kanban container detects empty `groupByColumnId` and shows a picker on first render)
- `calendar`: `{ calendar: { dateColumnId: '' } }` (same pattern)
- `timeline`: `{ timeline: { columnId: '' } }`
- `dashboard`: `{ dashboard: { layout: [], widgets: {} } }`
- `form`: `{ form: { fields: [] } }`

#### A.11 — Zod schemas for per-kind config

Replace the `z.unknown().optional()` for kanban/calendar/timeline/dashboard/form in `lib/views/config-schema.ts` with strict per-kind schemas:

```ts
export const CardStyleSchema = z.object({
  showTitle: z.boolean().default(true),
  visibleColumnIds: z.array(z.string().uuid()).default([]),
  showAvatars: z.boolean().default(true),
  showDueDate: z.boolean().default(true),
});

export const KanbanConfigSchema = z.object({
  groupByColumnId: z.string().uuid().or(z.literal("")),
});

export const CalendarConfigSchema = z.object({
  dateColumnId: z.string().uuid().or(z.literal("")),
  defaultRBCView: z.enum(["month", "week", "day", "agenda"]).default("month"),
});

export const TimelineConfigSchema = z.object({
  columnId: z.string().uuid().or(z.literal("")),
  scale: z.enum(["day", "week", "month", "quarter", "year"]).default("week"),
});

export const AggregationKindSchema = z.enum([
  "count", "count_empty", "count_unique",
  "sum", "avg", "min", "max", "median",
  "percent_by_label",
]);

export const WidgetConfigSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("number"),
             columnId: z.string().uuid(),
             aggregation: AggregationKindSchema,
             label: z.string().optional() }),
  z.object({ kind: z.literal("bar"),
             xColumnId: z.string().uuid(),
             yAggregation: AggregationKindSchema,
             yColumnId: z.string().uuid().optional(),
             groupBy: z.string().uuid().optional() }),
  z.object({ kind: z.literal("pie"),
             columnId: z.string().uuid(),
             aggregation: AggregationKindSchema }),
  z.object({ kind: z.literal("line"),
             dateColumnId: z.string().uuid(),
             yAggregation: AggregationKindSchema,
             yColumnId: z.string().uuid().optional(),
             bucket: z.enum(["day", "week", "month"]) }),
  z.object({ kind: z.literal("table"),
             filter: FilterTreeSchema.optional(),
             sort: z.array(SortKeySchema).optional(),
             limit: z.number().int().positive().max(100) }),
]);

export const DashboardConfigSchema = z.object({
  layout: z.array(z.object({
    i: z.string(),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  })).default([]),
  widgets: z.record(z.string(), WidgetConfigSchema).default({}),
});

export const FormFieldSchema = z.object({
  columnId: z.string().uuid(),
  required: z.boolean().default(false),
  labelOverride: z.string().optional(),
  helpText: z.string().optional(),
  defaultValue: z.unknown().optional(),
});

export const FormConfigSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  groupId: z.string().uuid().optional(),
  fields: z.array(FormFieldSchema).default([]),
});

// Update ViewConfigSchema:
export const ViewConfigSchema = z.object({
  filter: FilterTreeSchema.optional(),
  sort: z.array(SortKeySchema).optional(),
  groupBy: GroupBySchema.optional(),
  columnVisibility: z.record(z.string().uuid(), z.boolean()).optional(),
  columnWidths: z.record(z.string().uuid(), z.number().positive()).optional(),
  columnOrder: z.array(z.string().uuid()).optional(),
  density: DensitySchema.optional(),
  search: z.string().optional(),
  cardStyle: CardStyleSchema.optional(),
  kanban: KanbanConfigSchema.optional(),
  calendar: CalendarConfigSchema.optional(),
  timeline: TimelineConfigSchema.optional(),
  dashboard: DashboardConfigSchema.optional(),
  form: FormConfigSchema.optional(),
});
```

The Epic-11 `parseViewConfig` already handles parse failures gracefully — no change needed there.

#### A.12 — Tests

- `tests/unit/use-board-view-cross-kind.test.ts` — mock the router and the store with a kanban-kind view; assert that `switchView(kanbanViewId)` invokes `router.push('/w/<slug>/b/<id>/kanban?view=<id>')`. Same-kind switch invokes `router.replace`.
- `tests/unit/task-card.test.tsx` — render with a card style that hides date and shows status; assert DOM does not include the date cell; assert clicking opens the drawer.
- `tests/unit/view-config-per-kind-schema.test.ts` — for each kind, parse a well-formed config and a malformed config; verify the well-formed parses and the malformed falls back to `{}`.

**Definition of done for Slice A:**

- `pnpm install` succeeds after `react-big-calendar` / `date-fns` / `react-grid-layout` / `recharts` / `@types/react-grid-layout` are added.
- All five per-kind page directories' `page.tsx` resolve to valid Next.js routes (only `table/page.tsx` has a body; the other four exist as stubs **only** if Slice A finds it cleaner — otherwise leave the directories empty for Stage 2 slices to populate).
- Visiting `/w/<slug>/b/<id>` (no kind) redirects to `/w/<slug>/b/<id>/table?view=<MainTableId>`.
- `<ViewToolbar />`'s `kindGate` prop hides the right items per per-kind container.
- `<BoardRealtimeBootstrap />` is rendered by the layout; `<BoardTable />` no longer calls `useBoardRealtime` directly.
- `pnpm test` passes new tests.
- `pnpm typecheck` and `pnpm lint` clean.

**Escalation triggers:**

- If `react-big-calendar` install fails or has a React 19 peerDep conflict (it shipped React 18 peer pins for a while). If `react-big-calendar`'s newest release doesn't list React 19 as compatible, escalate as needs-direction.
- If extracting `loadBoardSnapshot` from `page.tsx` reveals hidden coupling (e.g., the auto-create-personal-view logic depends on something the helper can't see), escalate rather than papering.
- If `react-grid-layout` types are broken on React 19, escalate.

---

## Stage 2 — five parallel per-kind slices (file-scope disjoint)

After Slice A lands on `epic/12-alternate-views`, Slices B / C / D / E / F all run in parallel. **They are mutually file-scope-disjoint by design** — each owns its kind's route directory + its kind's components directory + its kind's actions file (where applicable).

Each per-kind container reads from the shared store and writes via the same shared server actions (`setCellValue` for kanban / calendar / timeline drags; `submitForm` for form view, which IS introduced by Slice F). Cross-slice coordination is via the store, not direct imports.

---

### Slice B — Kanban

**Branch:** `epic/12-alternate-views/b-kanban`

**Owner:** epic-executor (Sonnet)

**Owns (write):**

- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/kanban/page.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/kanban/KanbanBoard.tsx` (new — top-level container)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/kanban/KanbanLane.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/kanban/KanbanCardItem.tsx` (new — sortable wrapper around `<TaskCard />`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/kanban/KanbanGroupByPicker.tsx` (new — column picker filtered to status/priority/person/checkbox)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/kanban/lane-bucketing.ts` (new — pure function computing lanes from cells + a chosen group-by column)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/kanban/EmptyLaneAddTask.tsx` (new — "+ Add task" affordance pre-setting the lane's cell value)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/lane-bucketing.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/12-kanban-drag.spec.ts` (new — Playwright)

**Forbidden:** Any file outside `components/board/kanban/`, `app/.../kanban/`, and the listed tests. No edits to `components/board/shared/TaskCard.tsx` (Slice A owns it). No edits to server actions. No edits to the store. No edits to `useBoardView`.

**Depends on:** Slice A.

**Spec:**

#### B.1 — `kanban/page.tsx`

Mirror `table/page.tsx`:
```ts
export default async function KanbanPage({ params, searchParams }) {
  const { boardId } = await params;
  const sp = await searchParams;
  const currentUser = await requireUser();
  const snap = await loadBoardSnapshot({ boardId, searchParamViewId: sp.view });
  return <KanbanBoard boardId={boardId} initial={{ ...snap, currentUserId: currentUser.id }} />;
}
```

#### B.2 — `<KanbanBoard />` container

Hydrates the store (same pattern as `<BoardTable />`'s `hydrate()` call). Reads:
- `view.config.kanban.groupByColumnId` from `useBoardView().effective`
- `cells`, `tasks`, `columns`, `labelsByColumn` from `useBoardStore` (each as a single selector OR wrapped in `useShallow`)

Renders:
- `<ViewToolbar kindGate={{ hide: ['hide', 'group', 'density'] }} />` is already rendered by the layout; do not double-render. Card-style editor is reached via the active-view dropdown's "Card style…" item (Slice A wired the menu item via `<ViewTabDropdown>`; Kanban container does not render its own button).
- `<KanbanGroupByPicker />` shown when `groupByColumnId === ''`.
- Otherwise: a horizontally-scrolling lane container; one `<KanbanLane />` per bucket.

#### B.3 — `lane-bucketing.ts`

```ts
export type Lane = {
  id: string;                  // labelId or memberId or 'unassigned' or 'unchecked'/'checked'
  title: string;
  color?: string;              // e.g., status label color for the lane header
  taskIds: string[];           // in task.position order
};

export function bucketTasksIntoLanes(args: {
  groupByColumnId: string;
  tasks: Task[];
  cellsByKey: Map<string, Cell>;          // task_id:column_id → cell
  columns: Column[];
  labelsByColumn: Map<string, Label[]>;   // for status / priority
  members: WorkspaceMember[];             // for person
}): Lane[];
```

Bucketing rules per Q8 / Q9:
- `status` / `priority`: one lane per label (ordered by `label.position`); empty/null → "Unassigned" lane last.
- `person`: one lane per member (alphabetical by display name) + "Unassigned" last. A task with multiple assignees appears in every assigned member's lane (the rendered card carries `task.id`; React keys are `${laneId}:${taskId}` to keep React happy on multi-membership).
- `checkbox`: exactly two lanes — "Unchecked" (null/false) and "Checked" (true).

Unit-tested per cell type (status, priority, person, checkbox) with 3+ rows of data each, including the "Unassigned" path.

#### B.4 — `<KanbanLane />`

dnd-kit `useDroppable` on the lane id. Renders:
- Header: 44px tall, white text on lane color (status label color for status/priority; primary or member-derived hue for person; neutral for checkbox), top corners 8px rounded — must-match per component-system §7.1.
- Card list: virtualized via `@tanstack/react-virtual` when `taskIds.length > 50` (epic doc § Performance notes — kanban virtualization is required at 5k tasks). For < 50, render directly.
- Each card: `<KanbanCardItem task={...} cardStyle={...} />` → wraps `<TaskCard />` in a `useSortable` from dnd-kit.
- Empty state: `<EmptyLaneAddTask />` with a "+ Add task" button.

#### B.5 — `<KanbanCardItem />`

`useSortable({ id: task.id })`. Renders `<TaskCard />` from Slice A, passing `dragHandle={<DragHandle {...attributes} {...listeners} />}` (handle in the top-right corner of the card).

#### B.6 — Drop behavior

A single `<DndContext>` wraps all lanes (rendered by `<KanbanBoard />`). On `onDragEnd`:

```ts
async function onDragEnd(event: DragEndEvent) {
  const fromLaneId = activeTaskLane(event.active);
  const toLaneId = event.over?.id;
  if (!toLaneId || toLaneId === fromLaneId) {
    // Within-lane reorder: dispatch moveTask({ taskId, groupId: task.group_id, position }).
    // Disabled when sortKeys.length > 0 (carry-over from Epic 11 risk note #2).
    return;
  }
  // Cross-lane drop: dispatch setCellValue({ taskId, columnId: groupByColumnId, value: <toLane's cell value> }).
  // For person: value = { userIds: [toLaneMemberId] } (single-user assignment per Q8).
  // For status/priority: value = { labelId: toLaneLabelId }.
  // For checkbox: value = true | false | null (Unchecked = false).
}
```

The store's optimistic-update path is unchanged (cells/setCellValue calls already reconcile via Realtime). Wrap with `withOutbox` per the existing wrappedSetCellValue pattern in `lib/realtime/wrapped-actions.ts` IF that wrapper exists; if not, accept that an offline drop fails — out of scope here.

#### B.7 — `<KanbanGroupByPicker />`

A simple `<Select>` of columns filtered to `type in ('status', 'priority', 'person', 'checkbox')`. On select, calls `useBoardView().applyDraft({ kanban: { groupByColumnId: <id> } })`.

#### B.8 — Tests

- Unit (`lane-bucketing.test.ts`): each cell type produces the expected lanes with the expected order; empty cells go to Unassigned; multi-person cells appear in every assigned lane.
- E2E (`12-kanban-drag.spec.ts`): open a board, create a kanban view grouped by status, drag a card from "Working on it" to "Done"; assert (a) the card moved on screen, (b) reloading preserves the new lane, (c) the status cell value in the table is "Done".

**Definition of done for Slice B:**

- Visiting `/w/<slug>/b/<id>/kanban?view=<id>` renders the kanban for a configured view.
- Picking a group-by column persists to `view.config.kanban.groupByColumnId`.
- Dragging a card between lanes updates the cell; reload preserves.
- Empty lane "+ Add task" creates a task with the lane's cell value pre-set.
- `<TaskCard />` (from Slice A) is the card renderer; no inline duplication.
- E2E `12-kanban-drag.spec.ts` passes.

**Escalation triggers:**

- If person-cell multi-assignment renders need React key collisions that `${laneId}:${taskId}` doesn't solve, escalate.
- If virtualization at 5k tasks introduces visible jitter, escalate before optimizing.

---

### Slice C — Calendar

**Branch:** `epic/12-alternate-views/c-calendar`

**Owner:** epic-executor (Sonnet)

**Owns (write):**

- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/calendar/page.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/calendar/CalendarView.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/calendar/CalendarEventCard.tsx` (new — wraps `<TaskCard />` for event rendering inside react-big-calendar)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/calendar/CalendarDateColumnPicker.tsx` (new — picker filtered to date + timeline columns)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/calendar/OffCalendarPanel.tsx` (new — list of tasks without a date value)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/calendar/calendar-localizer.ts` (new — dateFnsLocalizer with en-US)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/calendar/event-mapping.ts` (new — pure function: tasks + cells + dateColumnId → react-big-calendar events)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/calendar/calendar.css` (new — minimal overrides on top of react-big-calendar's stylesheet to match design tokens)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/calendar-event-mapping.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/12-calendar-drag.spec.ts` (new)

**Forbidden:** Anywhere outside `components/board/calendar/`, `app/.../calendar/`, and the listed tests. No edits to server actions or store.

**Depends on:** Slice A.

**Spec:**

#### C.1 — `calendar/page.tsx`

Mirror `table/page.tsx`. Imports `react-big-calendar/lib/css/react-big-calendar.css` at the top of the **client component** (`CalendarView.tsx`), not the RSC.

#### C.2 — `<CalendarView />`

Layout (must-match component-system §1.4 toolbar styles):
- Top toolbar slot: `<CalendarDateColumnPicker />` and `<CardStyleEditor />` trigger.
- Main area: `<Calendar />` from `react-big-calendar`.
- Right rail (12rem wide, collapsible): `<OffCalendarPanel />`.

Reads:
- `view.config.calendar.dateColumnId` + `view.config.calendar.defaultRBCView`.
- `tasks` + `cells` from the store.

If `dateColumnId === ''`, render only the picker + a centered "Pick a date column to show your tasks on a calendar" empty state.

#### C.3 — Event mapping (`event-mapping.ts`)

Pure function: given the column type (`date` vs `timeline`), produce events with `{ start, end, title, taskId, allDay, resizable }`:
- `date`: `{ start: cell.date_value, end: cell.date_value, allDay: true, resizable: false }`.
- `timeline`: `{ start: cell.date_value, end: cell.date_end_value, allDay: true, resizable: true }`.
- Cells without a value → emit nothing; off-calendar panel reads them separately.

Tested with 5+ cells covering both column types and the null cell branch.

#### C.4 — Drag-and-drop via dnd-kit overlay (Q11)

`react-big-calendar` is not configured with its native drag-drop addon. Instead:
- The whole calendar is wrapped in dnd-kit's `<DndContext>`.
- Each day-cell becomes a droppable via a custom `dayPropGetter` that sets `data-date={iso}` on the cell DOM.
- Drag handles on event cards come from `<TaskCard />`'s `dragHandle` slot.
- On `onDragEnd`, read `event.over?.id` (the iso date string) and dispatch `setCellValue({ taskId, columnId: dateColumnId, value: { date: <iso> } })`.

For resize (timeline columns only): the event card grows two edge-handles (8px wide). Dragging a handle in week/day view computes the new `start` or `end` from the X position relative to the calendar's day grid. Snap to day.

If dnd-kit + react-big-calendar prove to integrate poorly, the executor **may fall back** to using `react-big-calendar`'s addon `react-big-calendar/lib/addons/dragAndDrop` — but doing so requires escalation because it pulls in `react-dnd` which contradicts CLAUDE.md.

#### C.5 — Quick-create on slot click

`onSelectSlot` from react-big-calendar fires when the user click-and-drags on the empty grid. Dispatch:
1. `createTask({ groupId: <first group>, title: 'New task', position: end-of-list })` to get a `taskId`.
2. `setCellValue({ taskId, columnId: dateColumnId, value: { date: <slot.start ISO> } })`.

Show a toast on each step; on the second step's success, route the user to the task drawer (`@modal` slot).

#### C.6 — Off-calendar panel

`<OffCalendarPanel />` lists tasks where the chosen date cell is null. Each row is a `<TaskCard />` (compact width). The card is draggable into the calendar. Drag drop on a calendar day cell triggers `setCellValue`.

#### C.7 — Tests

- Unit: `calendar-event-mapping.test.ts` — verify both date and timeline column types produce the expected event shapes.
- E2E (`12-calendar-drag.spec.ts`): open a board, create a calendar view with a date column, drag a task from one day to another, assert the date cell updates and the reloaded URL shows the task on the new day.

**Definition of done for Slice C:**

- Visiting `/w/<slug>/b/<id>/calendar?view=<id>` renders a month-view calendar with events.
- Selecting a date column persists to `view.config.calendar.dateColumnId`.
- Drag-to-reschedule updates the cell; reload persists.
- Resize on timeline-column events updates start/end; reload persists.
- Click on event opens the task drawer.
- Off-calendar panel lists null-cell tasks; dragging them into the calendar assigns a date.
- E2E `12-calendar-drag.spec.ts` passes.

**Escalation triggers:**

- If `react-big-calendar` v1 has React 19 peer-dep issues that survive `--legacy-peer-deps`, escalate.
- If dnd-kit overlay on react-big-calendar cells doesn't reliably register drops, escalate before falling back to react-big-calendar's addon (the addon brings react-dnd, which is forbidden).

---

### Slice D — Timeline (Gantt)

**Branch:** `epic/12-alternate-views/d-timeline`

**Owner:** epic-executor (Sonnet)

**Owns (write):**

- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/timeline/page.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/TimelineView.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/TimelineHeader.tsx` (new — sticky time axis)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/TimelineRow.tsx` (new — row chrome + bar slot)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/TimelineBar.tsx` (new — draggable bar with edge handles)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/TimelineUnscheduled.tsx` (new — right-side panel of tasks without start+end)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/TimelineColumnPicker.tsx` (new — picker filtered to timeline columns)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/TimelineScaleSwitcher.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/timeline-math.ts` (new — pure: scale + container width → px-per-day; date-to-x; x-to-date with snap-to-day)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/timeline-math.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/12-timeline-drag.spec.ts` (new)

**Forbidden:** Anywhere outside `components/board/timeline/`, `app/.../timeline/`, and the listed tests. No edits to server actions or store.

**Depends on:** Slice A.

**Spec:**

#### D.1 — `timeline/page.tsx`

Mirror the other kinds.

#### D.2 — `<TimelineView />`

Layout:
- Top sticky `<TimelineHeader />` with the time axis (header rows depend on scale: e.g., month scale shows years + months; week scale shows months + days).
- Body: virtualized list of `<TimelineRow />` via `@tanstack/react-virtual` (one row per task).
- Right rail: `<TimelineUnscheduled />` (collapsible).
- Bottom-left: `<TimelineScaleSwitcher />` (segmented control: Day/Week/Month/Quarter/Year). Active scale persisted to `view.config.timeline.scale`.

Reads:
- `view.config.timeline.columnId` + `view.config.timeline.scale`.
- `tasks` (filtered through Epic-11's `applyFilterTree` / `applySearch` / `applySort` derived list) + the `timeline` cells.

If `columnId === ''`, render a centered "Pick a timeline column to render bars" empty state with `<TimelineColumnPicker />`.

#### D.3 — `timeline-math.ts`

Pure helpers:

```ts
export type Scale = 'day' | 'week' | 'month' | 'quarter' | 'year';

export function pxPerDay(scale: Scale, containerWidthPx: number): number;
export function dateToX(date: string, originDate: string, scale: Scale, containerWidthPx: number): number;
export function xToDate(x: number, originDate: string, scale: Scale, containerWidthPx: number): string;  // snaps to day
export function visibleRange(scale: Scale, originDate: string, containerWidthPx: number): { start: string; end: string };
```

Tested for each scale with 3+ inputs.

#### D.4 — `<TimelineBar />`

Absolutely-positioned inside `<TimelineRow />`. Width from `dateToX(end) - dateToX(start)`; left from `dateToX(start)`. Three drag regions via dnd-kit (or pointer events; dnd-kit's overhead is fine here):
- Body: drag horizontally moves both `start` and `end` by the same delta (preserving duration).
- Left edge handle (8px wide): drag updates `start` only.
- Right edge handle (8px wide): drag updates `end` only.

On drag-end, snap to day and dispatch `setCellValue({ taskId, columnId: <timelineColumnId>, value: { start, end } })`.

Click-without-drag opens the task drawer.

#### D.5 — Today line + weekend shading

A 1px vertical line at the current day's X position, color `--color-primary`, rendered as a sibling of the bar layer (so it floats over all rows). Weekend cells in `day`/`week` scales get a `--color-surface-hover` background overlay.

#### D.6 — `<TimelineUnscheduled />`

Lists tasks where the timeline cell is null. Each is a small card draggable onto any row in the timeline; drop creates `{ start, end }` at the drop position with a default duration of 1 day (day/week scales) or 7 days (month+ scales).

#### D.7 — Tests

- Unit: `timeline-math.test.ts` — verify x↔date round-trip for each scale.
- E2E (`12-timeline-drag.spec.ts`): drag a bar 5 days right → cell start+end shift by 5 days; reload preserves; drag the right edge handle 3 days right → only end shifts.

**Definition of done for Slice D:**

- Visiting `/w/<slug>/b/<id>/timeline?view=<id>` renders the timeline with bars positioned per the timeline cell values.
- Scale switcher persists the choice.
- Bars drag, edge-resize, and the today line + weekend shading render correctly.
- Tasks without start+end appear in the unscheduled rail; dragging them onto the timeline creates a range.
- E2E `12-timeline-drag.spec.ts` passes.
- 2000 visible rows scroll at 60fps in `pnpm dev` smoke (epic doc § Performance notes).

**Escalation triggers:**

- If virtualization + absolutely-positioned bars create overlap / clipping bugs, escalate.
- If snap-to-day produces off-by-one errors under DST transitions, escalate (we accept "always day-precision UTC" as the v1 default, but DST edge cases may surface).

---

### Slice E — Dashboard

**Branch:** `epic/12-alternate-views/e-dashboard`

**Owner:** epic-executor (Sonnet)

**Owns (write):**

- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/dashboard/page.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/Dashboard.tsx` (new — `react-grid-layout`-driven container; `"use client"` + dynamic imported with `ssr: false` from the page)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/Widget.tsx` (new — frame with title + edit/delete actions; switches on `kind`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/WidgetEditor.tsx` (new — Base UI Dialog with kind picker + per-kind config form)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/widgets/NumberWidget.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/widgets/BarWidget.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/widgets/PieWidget.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/widgets/LineWidget.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/widgets/TableWidget.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/widget-data.ts` (new — pure functions: bucket tasks by column, aggregate values, time-series bucketing)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/dashboard.css` (new — minimal overrides on top of react-grid-layout's stylesheet)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/widget-data.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/12-dashboard.spec.ts` (new)

**Forbidden:** Anywhere outside `components/board/dashboard/`, `app/.../dashboard/`, and the listed tests. No edits to server actions, store, or cell defs.

**Depends on:** Slice A.

**Spec:**

#### E.1 — `dashboard/page.tsx`

Same shape as the others. The page is an RSC that renders a client `<DashboardClient />` shim dynamically imported with `ssr: false`:

```tsx
const Dashboard = dynamic(() => import('@/components/board/dashboard/Dashboard'), { ssr: false });
```

Reason: `react-grid-layout` references `window` at import time.

#### E.2 — `<Dashboard />` container

Reads `view.config.dashboard` (defaults to `{ layout: [], widgets: {} }`).

Layout: `<Responsive>` from `react-grid-layout` with `WidthProvider`. `cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}`. RowHeight 60. Draggable handle restricted to the widget header (`draggableHandle=".widget-drag-handle"`).

On `onLayoutChange`, debounce 750ms then call `useBoardView().applyDraft({ dashboard: { ...current, layout } })`. The existing `applyDraft` already debounces 200ms; the additional dashboard-local debounce keeps the URL bar quiet during a drag.

Toolbar: small "+ Add widget" button in the top-right opens `<WidgetEditor />` with `widget: null` (create mode).

#### E.3 — `<Widget />`

Switches on `config.kind`:
- `number` → `<NumberWidget />`
- `bar` → `<BarWidget />`
- `pie` → `<PieWidget />`
- `line` → `<LineWidget />`
- `table` → `<TableWidget />`

Header: drag handle (class `widget-drag-handle`), title (overridable per widget), an overflow menu (Edit / Delete). Visual contract (must-match per component-system §1.4 inspired by component-system Visual fidelity — Dashboard):
- 2px border `--color-border-strong`; hover border `--color-primary`.
- Header separator: `1px solid --color-border-strong`.

#### E.4 — Per-widget components

Each widget is a `"use client"` component that reads `tasks`, `cells`, `columns` from `useBoardStore` (with `useShallow`), applies the **view's active filter** via Epic-11's `applyFilterTree`, then computes its data via `widget-data.ts`. Each calls `useDeferredValue` over the source list (per Q19) for dashboards with >1000 tasks.

- **`<NumberWidget />`**: large number + label. Calls `def.aggregate(values, config.aggregation, columnConfig)` from the registry. Renders the returned string verbatim. Font 48px / weight 600 / `--color-fg`.
- **`<BarWidget />`**: Recharts `<BarChart>` with `<XAxis>`, `<YAxis>`, `<Tooltip>`, `<Bar>`. X = `config.xColumnId` buckets (status labels, person names, etc., via `bucketValuesByColumn` in `widget-data.ts`). Y = aggregated per bucket via the chosen aggregation.
- **`<PieWidget />`**: Recharts `<PieChart>` + `<Pie>`. Slice colors come from the cell registry's color palette (status/priority labels) or a neutral fallback for other types.
- **`<LineWidget />`**: Recharts `<LineChart>` with `<XAxis dataKey="date">`. Time-series bucketing by `config.bucket` (`day`/`week`/`month`). One series; multi-series deferred.
- **`<TableWidget />`**: A simple `<table>` of N rows (`config.limit`). Renders title + 2-3 cells. Applies `config.filter` + `config.sort` via Epic-11 helpers. No virtualization — limit is bounded ≤ 100.

#### E.5 — `<WidgetEditor />`

Base UI Dialog. Two-step UI: kind picker (5 cards) → per-kind config form (React Hook Form + Zod over the kind's schema from Slice A's `WidgetConfigSchema`).

Save → calls `useBoardView().applyDraft({ dashboard: { ...current, widgets: { ...current.widgets, [widgetId]: newConfig }, layout: [...current.layout, { i: widgetId, x: 0, y: Infinity, w: 4, h: 3 }] } })`.

Delete → removes from both `widgets` and `layout`.

#### E.6 — `widget-data.ts`

Pure functions:
```ts
export function bucketValuesByColumn(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  labelsByColumn: Map<string, Label[]>,
  bucketColumnId: string,
): { bucketKey: string; bucketLabel: string; tasks: Task[] }[];

export function timeSeriesBuckets(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  dateColumnId: string,
  bucket: 'day' | 'week' | 'month',
): { dateKey: string; tasks: Task[] }[];

export function aggregateForWidget(
  values: unknown[],
  kind: AggregationKind,
  columnType: CellTypeId,
  columnConfig: unknown,
): { display: string; numeric: number | null };
```

Unit-tested with 5+ scenarios per function.

#### E.7 — Tests

- Unit (`widget-data.test.ts`): each helper tested with multiple inputs.
- E2E (`12-dashboard.spec.ts`): create a dashboard view → add a Number widget configured to "Sum of Budget" → add a task with budget 100 → assert widget value is "100" → add another with budget 50 → assert widget value is "150".

**Definition of done for Slice E:**

- Visiting `/w/<slug>/b/<id>/dashboard?view=<id>` renders the dashboard grid.
- "+ Add widget" opens the editor; saving a Number widget renders it with the correct aggregate.
- Dragging a widget reorders; resizing changes its grid cells; both persist to `view.config.dashboard.layout`.
- Adding a task or editing a cell updates widget values without reload (realtime via store).
- E2E `12-dashboard.spec.ts` passes.

**Escalation triggers:**

- If `react-grid-layout`'s `WidthProvider` infinite-loops under React 19, escalate.
- If Recharts can't render under React 19's strict mode (double-render), escalate.

---

### Slice F — Form view

**Branch:** `epic/12-alternate-views/f-form`

**Owner:** epic-executor (Sonnet)

**Owns (write):**

- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/form/page.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/form/actions.ts` (new — `submitForm` server action)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/form/FormView.tsx` (new — runtime renderer)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/form/FormBuilder.tsx` (new — config editor; toggled via the active-view dropdown's "Configure" item)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/form/FormField.tsx` (new — single field renderer; dispatches per cell type)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/validations/form.ts` (new — `SubmitFormSchema` Zod)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/form-schema.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/submit_form_role.spec.sql` (new pgTAP — confirms a `viewer`-role user can call `submitForm` per Q24 if approved; OTHERWISE the test asserts they cannot)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/12-form-submit.spec.ts` (new)

**Forbidden:** Anywhere outside `components/board/form/`, `app/.../form/`, `lib/validations/form.ts`, and the listed tests. No edits to other server actions, store, or cell defs. **Do not** edit `cells/actions.ts` or `tasks/actions.ts`.

**Depends on:** Slice A.

**Spec:**

#### F.1 — `form/page.tsx`

Same shape as the others. The route is internal — same auth gates apply.

#### F.2 — `<FormView />` (runtime renderer)

Reads `view.config.form.fields` and renders one `<FormField />` per field. React Hook Form drives the form state; Zod validates per-field. Submit calls `submitForm({ boardId, viewId, values })`.

Visual contract (match per component-system Visual fidelity — Form view):
- Single-column form, max-width 1024px.
- Input chrome reused from Epic 03's auth form: radius 4px, padding `8px 16px`, focus border `--color-primary`.

If `view.config.form.fields.length === 0`, show an empty state: "Configure form fields from the view menu."

If the board has no groups (per Q7), show the error state: "Add a group to this board before accepting submissions."

#### F.3 — `<FormField />`

For each configured field, dispatches to the cell type's editor in compact mode:
- Look up `def = cellRegistry[column.type]`.
- Render `<def.Editor value={...} config={column.settings} onChange={...} onClose={() => {}} />` inside a small bordered container.
- Required-state asterisk + help text per `view.config.form.fields[i]`.

#### F.4 — `<FormBuilder />` (config editor)

Reached via the active-view dropdown's "Configure form" item (Slice A's `<ViewTabDropdown>` adds this menu item when `view.kind === 'form'` — small extension to Slice A's scope, but Slice F owns the menu-item content). Two-pane:
- Left: checklist of all columns. Toggling adds/removes from `fields`.
- Right: per-field settings (required, label override, help text, default value).

Saves via `useBoardView().applyDraft({ form: { ...current, fields: [...] } })`.

#### F.5 — `submitForm` server action

```ts
export const submitForm = withUser(async ({ supabase, userId }, raw) => {
  const input = SubmitFormSchema.parse(raw);
  // 1. Resolve form config from the view row.
  // 2. Resolve target groupId (form config's groupId OR first non-deleted group).
  // 3. Role check: Q24 default = viewer is sufficient.
  await requireBoardRole(input.boardId, 'viewer');  // <-- pending user decision on Q24
  // 4. Insert task (board_id derived by trigger).
  // 5. Upsert cells in one round trip (filter out cells with null/undefined values).
  // 6. Log activity 'task.created via form'.
  // 7. Return new task id.
});
```

`SubmitFormSchema` in `lib/validations/form.ts`:
```ts
export const SubmitFormSchema = z.object({
  boardId: z.string().uuid(),
  viewId: z.string().uuid(),
  values: z.array(z.object({
    columnId: z.string().uuid(),
    value: z.unknown(),
  })),
});
```

#### F.6 — Tests

- Unit (`form-schema.test.ts`): valid + invalid submit shapes.
- pgTAP (`submit_form_role.spec.sql`): verify Q24 — viewer role can submit (or cannot, depending on user decision).
- E2E (`12-form-submit.spec.ts`): open a form view, fill in title + status, submit, navigate to the table view, assert the new task appears.

**Definition of done for Slice F:**

- Visiting `/w/<slug>/b/<id>/form?view=<id>` renders the configured form.
- Submit creates a task + cells; task is visible in the table view.
- Form builder configures fields and persists to `view.config.form`.
- Empty-state behavior matches Q7 spec.
- E2E `12-form-submit.spec.ts` passes.

**Escalation triggers:**

- If Q24 (viewer-submit) is declined by the user, the role check shifts to `member` and the pgTAP test inverts. Surface as needs-direction with the user's response.
- If the cell editors require a `useBoard` context (BoardProvider) that's not present in the form-render path, escalate — may need a "form-mode" cell editor variant.

---

## Stage 3 — sequential integration (Slice G)

After B / C / D / E / F all merge into `epic/12-alternate-views`, dispatch Slice G.

### Slice G — Integration audit + cross-kind e2e + view-tab smoothing

**Branch:** `epic/12-alternate-views/g-integration`

**Owner:** epic-executor (Sonnet)

**Owns (write):**

- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/12-view-switching.spec.ts` (new — exercises cross-kind navigation)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/12-alternate-views-perf.spec.ts` (new — 1k tasks smoke for kanban/calendar/timeline; manual run, marked `@perf`)
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-12-checkpoint-1.md` (new — written by executor as part of the audit)
- Minor edits (≤5 lines per file) to any Stage 1 or Stage 2 file ONLY where the audit surfaces a wiring gap. Anything larger escalates.

**Depends on:** Slices A–F all merged into `epic/12-alternate-views`.

**Spec:**

#### G.1 — Cross-kind navigation e2e

`tests/e2e/12-view-switching.spec.ts`:
- T1: open `/w/<slug>/b/<id>` → asserts redirect to `/table?view=<id>`.
- T2: from table, switchView to a kanban view → URL becomes `/kanban?view=<id>`; kanban renders.
- T3: from kanban, switchView back to the table view → URL becomes `/table?view=<id>`; same filter state preserved across the kind switch (drafts are NOT preserved per Slice A's `switchView` clearing them).
- T4: reload `/calendar?view=<id>` → calendar renders with the view's `dateColumnId`.

#### G.2 — Integration audit

Executor's job (must include real-browser exercise):
1. Run `pnpm dev` + local Supabase. Walk through every flow:
   - Create one of each kind from the "+ Add view" menu.
   - Verify each kind's empty state (column-picker for kanban/calendar/timeline; empty grid for dashboard; empty fields for form).
   - Configure each, drag/edit something, reload, confirm persistence.
   - Verify cross-kind switching preserves the URL params expected (each kind's `?view=<id>`).
   - Verify the realtime channel still routes cell updates while on every kind (open the same board in two browser windows on different kinds; edit in one; assert the other refreshes).
2. Run `pnpm test` + the new pgTAPs + the new e2es.
3. Identify gaps. Patch with minimal edits (≤5 lines per file). Anything broader → escalate.

#### G.3 — Checkpoint doc

`_dispatch/epic-12-checkpoint-1.md` — for each DoD item in the epic doc, give a verdict (`PASS` / `FAIL`) + a one-line note + the test or smoke that proved it.

**Definition of done for Slice G:**

- Every DoD item from the epic doc has a `PASS` verdict in the checkpoint doc.
- All new e2es pass locally.
- `pnpm typecheck` + `pnpm lint` clean.

**Escalation triggers:**

- Any DoD item that fails verification AND requires more than a 5-line patch → escalate. Opus produces a followup spec.
- If cross-kind navigation creates flickers (because each kind page re-runs `loadBoardSnapshot`), escalate; the fix is likely `loadBoardSnapshot` should leverage Next.js `cache()`.

---

## Sequential follow-ups (after G lands)

- **Stage 4 — Review pass:** the orchestrator dispatches the `epic-researcher` (Opus) against the merged Stage-1+2+3 diff against the epic doc's Definition of Done. Verdict: `CLEAN` (epic ready to merge into main) or a followup spec at `_dispatch/epic-12-followup-N.md`.
- **Deferred to followup work (DO NOT in-scope this epic):**
  - Kanban swimlanes (epic doc § Swimlane dimension — out of scope verbatim).
  - Gantt dependencies / `task_dependency` table (epic doc § Dependencies — out of scope).
  - Cross-board dashboards (epic doc § Dashboard cross-board — deferred).
  - Form public sharing via `share_token` (epic doc § Form view — explicitly v1.5).
  - Workload / Files / Map views (epic doc § "Coming soon" — deferred).
  - Partial unique index on `view (board_id, owner_id, kind)` to harden personal-view race (Q28; carried from Epic 11 followups).
  - Calendar i18n (date-fns locale switching; Epic 14).
  - react-big-calendar's drag-drop addon as a fallback if dnd-kit overlay proves fragile (Q11) — requires escalation.

---

## Risk notes

1. **react-big-calendar + React 19 peer-deps.** react-big-calendar's stable releases historically pinned `react@^16 || ^17 || ^18`. At time of writing (May 2026), check the latest release — if it doesn't list React 19, install with `pnpm add --strict-peer-dependencies=false` and document in Slice C's README. **Mitigation:** the executor must run `pnpm install` BEFORE writing component code; if it fails, escalate immediately rather than working around it.

2. **react-grid-layout + SSR.** `react-grid-layout` references `window` at module init. Slice E imports it ONLY inside a client component dynamically imported with `ssr: false` from the RSC page. Failing to do so produces a `ReferenceError: window is not defined` build error. Documented in E.1.

3. **Recharts under React 19 strict mode.** Recharts uses `ResizeObserver`-based render loops; React 19's double-invoke in dev can produce spurious console warnings. Not a functional issue; flag for Epic 14 polish if it shows up.

4. **dnd-kit + react-big-calendar overlay.** Custom drop-target via `data-date` attributes on calendar cells works because react-big-calendar renders predictable DOM nodes, but `react-big-calendar` is free to re-render the cells on view change — dnd-kit's `useDroppable` re-registers on each render, which is generally fine but may interact poorly with the calendar's `Toolbar` clicks. Slice C must verify drop registration survives `view.month → view.week` switches. Mitigation: a `useEffect` that bumps a key in `<Calendar />`'s `key` prop on view changes.

5. **Cell editor compact-mode in Form view.** The form re-uses `def.Editor` from each cell type's def. Those editors were designed for inline-table edit, not free-standing form fields, and may assume a parent context (e.g., the table-keyboard context). Slice F's executor should test rendering each cell type's editor in isolation before claiming done. Surface failures as needs-direction.

6. **Q24 — viewer role can submit a form.** This is the most architecturally novel thing in the epic — viewers normally cannot mutate. Two implementation options:
   - **(a)** Server action checks `viewer` role, then internally uses an elevated client (e.g., service role) to insert task+cells, bypassing RLS. This is clean but couples the action to service-role credentials.
   - **(b)** Add a SECURITY DEFINER SQL function `submit_form(...)` that performs the insert with elevated privileges, with a single CHECK on board membership. This is the more RLS-as-truth-aligned approach.
   
   **Recommended (b)** if Q24 is approved. Slice F's spec assumes (b) and accepts a small migration to add the function. If the executor cannot land (b) cleanly, they fall back to (a) and escalate.

7. **Dashboard widget data aggregation at 5000 tasks.** Each widget recomputes via `useMemo` on store change. With 10 widgets × 5000 tasks per widget, recompute on every cell edit is O(50k) work, which is fine on a desktop but can stutter on a low-end device. Slice E uses `useDeferredValue` (per Q19) to soften; deeper perf work belongs to Epic 14.

8. **Realtime + 5 kinds rendering simultaneously.** Each kind subscribes to the same store; the store is updated by the realtime channel; each kind's derived selectors re-run. The risk: at 5000 tasks + a fast burst of edits, the calendar's event-mapping fires per edit and is O(N). Slice C should compute events once via `useMemo` over the source list with shallow comparison; same for kanban lanes. Each per-kind container's spec calls this out.

9. **Cross-kind URL params collision.** Epic 11 reserved `view, f, s, g, q, d`. Epic 12 adds no new URL params (per-kind config lives in `view.config`, not URL). If a future epic adds, e.g., `?w=<widgetId>` for dashboard deep-links, document in `lib/views/url-codec.ts`.

10. **`loadBoardSnapshot` re-runs on every kind navigation.** Today each per-kind page does its own Promise.all. Next.js 15's `cache()` could memoize within a request, but cross-request the snapshot reloads. Acceptable for v1 — RSC streams are fast enough.

11. **Card style applied to TaskCard in three contexts (kanban / calendar / timeline).** Component is shared; a bug in `<TaskCard />` reproduces in all three. Mitigation: Slice A's `tests/unit/task-card.test.tsx` covers the visual contract and three rendering callers verify in their E2Es. The reviewer pass MUST exercise card style edits in at least kanban + calendar to catch regressions.

12. **Pre-epic-09 bugfix lesson (MEMORY).** First end-to-end browser run of any new epic surfaces ~8 latent bugs. Slice G's integration audit MUST include manual in-browser smoke testing as part of the checkpoint doc — not just `pnpm test`. Every kind gets a smoke run.

13. **`switchView` cross-kind navigation and draft state.** When a user switches from a kanban view with unsaved draft to a calendar view, the draft is discarded (per Slice A). This is the right v1 behavior (the draft was kanban-shaped; it makes no sense on calendar), but users may be surprised. Document in the active-view dropdown's "switch" affordance with a tooltip on hover if `hasUnsavedChanges`.

14. **MemberPicker / WorkspaceMember loading for Kanban person-grouping.** The kanban container needs the workspace's members to build person lanes. The board snapshot doesn't include `workspace_member`. Slice A's `loadBoardSnapshot` may need to add a `workspaceMembers` field — flag in Slice A's spec if not already added. If not, Slice B reads members via a separate fetch inside `<KanbanBoard />` (less ideal). **Recommended: Slice A extends `loadBoardSnapshot` to fetch members; Slice B consumes.**

15. **Form view + role downgrade.** If Q24 is denied (forms require `member`), the form view becomes useless for the v1 internal release — it's just a slower path to creating a task that members can already create from the table. The orchestrator should weigh in. Recommend approving viewer-submit so the form view has a real use case.

---

## Definition of done (epic 12 doc, mapped to slices)

| DoD item from `12-alternate-views.md` | Slice(s) |
|---|---|
| A user can switch between Table / Kanban / Calendar / Timeline / Dashboard / Form on the same board with the same data. | A (route shells + redirect + cross-kind switchView) + B–F (each kind ships) + G (cross-kind e2e) |
| Dragging a task between Kanban lanes updates the relevant cell. | A (TaskCard) + B (KanbanBoard + DnD wiring + setCellValue dispatch) |
| Dragging a task in Calendar moves the date. | A (TaskCard) + C (CalendarView + dnd-kit overlay + setCellValue dispatch) |
| Dragging a Timeline bar updates start/end. | A (TaskCard) + D (TimelineBar + timeline-math + setCellValue dispatch) |
| Dashboard widgets render correct aggregates and update on Realtime changes. | A (BoardRealtimeBootstrap moved to layout) + E (Dashboard + widgets + widget-data + cell-registry aggregate dispatch) |
| Form view creates tasks on submit. | F (submitForm + FormView + RHF/Zod + activity log) |
| Each view persists its config in the corresponding `view.config` row; URL `?view=<id>` restores state. | A (per-kind Zod schemas in ViewConfigSchema) + B–F (each kind reads/writes its config slot) + Epic 11 (existing useBoardView already restores from URL) |
| Switching views is instant — no full reload. | A (router.push/replace, not full reload; loadBoardSnapshot streamed via RSC) + G (cross-kind e2e checks no flicker) |
| Visual fidelity: Kanban must-match per component-system §7.1; Calendar/Timeline/Dashboard/Form match per Visual fidelity requirements. | A (TaskCard + CardStyleEditor — shared chrome) + B (kanban lanes + cards) + C (calendar) + D (timeline bars) + E (widget chrome) + F (form input chrome reused from Epic 03) |

---

**Summary of file paths I touched while planning (all absolute, repo-relative):**

- `/Volumes/SSD1T/DEV WORK/donezo/CLAUDE.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/00-overview.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/12-alternate-views.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/11-filtering-views.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/component-system.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-11.md` (format template)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506224930_initial_schema.sql` (view table at 329-348; column type check at 127-132)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260511075330_extend_column_type_check.sql` (24 cell types confirmed)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260515000000_profile_last_view_per_board.sql` (already present)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (becomes a redirect in Slice A)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/table/` (empty — populated in Slice A)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/kanban/` (empty)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/calendar/` (empty)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/timeline/` (empty)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/dashboard/` (empty)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts` (setCellValue contract)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions.ts` (createTask)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/AddViewMenu.tsx` (will be edited by Slice A)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/ViewTabs.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/ViewToolbar.tsx` (will be edited by Slice A — `kindGate` prop)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/ViewTabDropdown.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx` (small edit by Slice A)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/types.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/kanban/` (empty)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/calendar/` (empty)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/` (empty)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/dashboard/` (empty)
- `/Volumes/SSD1T/DEV WORK/donezo/components/filters/*.tsx` (Epic 11 — toolbar primitives reused)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/views/config-schema.ts` (extended by Slice A)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/views/url-codec.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/filtering/apply-filter-tree.ts` (Epic 11 — reused by all kinds)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/types.ts` (CellTypeDef contract used by all kinds)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/registry.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/aggregations.ts` (used by Dashboard)
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-view.ts` (extended by Slice A for cross-kind switchView)
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-realtime.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/stores/types/views.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/package.json` (will be edited by Slice A — add 4 deps)
