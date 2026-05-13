# Epic 12 — Final Review (Stage 3)

**Date:** 2026-05-12
**Branch:** `epic/12-alternate-views` (off `main`)
**Reviewer:** epic-researcher (Opus)
**Scope reviewed:** `git diff main...epic/12-alternate-views` — 81 files, +15,022 / -489 lines, 23 commits across 7 slices (A–G) + Q24 resolution + 2 in-flight fixes.

---

## Verdict: CLEAN (static) — merge gated on user in-browser smoke run

All 8 epic-doc DoD bullets are satisfied at the static code-review level. All 7 slices delivered the contracts the dispatch plan promised. No stack-default drift. No MEMORY-flagged trap violations. All 265 Epic-12 unit tests pass; typecheck clean.

**However**, this review is static-only. The pre-epic-09 bugfix MEMORY note documents that the first in-browser run of every prior epic surfaced ~8 latent bugs invisible to typecheck / lint / unit tests. **The user must complete the in-browser smoke checklist (epic-12-checkpoint-1.md §"Mandatory smoke checklist") before this epic merges to `main`.**

Three small code-quality followups are queued at `epic-12-followup-1.md`. They are NOT DoD gaps and do NOT block merge; they may be cherry-picked into the epic branch before PR or batched into an Epic-14 polish pass. The user can decide.

---

## DoD checklist (from `docs/conversion-plan/12-alternate-views.md` § "Definition of done")

| # | DoD item | Status | Evidence |
|---|---|---|---|
| 1 | Switch between Table / Kanban / Calendar / Timeline / Dashboard / Form on the same board, same data | CLEAN | All 6 per-kind `page.tsx` files exist under `app/(app)/w/[workspaceSlug]/b/[boardId]/{table,kanban,calendar,timeline,dashboard,form}/page.tsx`. `[boardId]/page.tsx` is the redirect RSC: `loadBoardSnapshot` → resolve `activeView.kind` → `redirect()` to `/<kind>?view=<id>`. `BoardDataProvider` mounted once in layout (line 238), keyed on boardId — stays mounted across kind navigation. `useBoardView.switchView()` (hooks/use-board-view.ts:302–330) routes cross-kind via `router.push` and same-kind via `router.replace`. `AddViewMenu.tsx` has all 6 kinds enabled, each calling `createView` + `switchView`. |
| 2 | Dragging a task between Kanban lanes updates the relevant cell | CLEAN | `KanbanBoard.tsx:225–232` — `performCrossLaneDrop` calls `setCellValue({ taskId, columnId: groupByColumnId, value: toLane.dropValue })`. dnd-kit `DndContext` + `PointerSensor` configured at line 201–206. Lane bucketing pure function tested in `tests/unit/lane-bucketing.test.ts` (486 lines, all pass). `TaskCard` used both inside lanes and as the `<DragOverlay>` content. |
| 3 | Dragging a task in Calendar moves the date | CLEAN | `CalendarView.tsx:147–196` — both `date` and `timeline` column types dispatch through `setCellValue`. dnd-kit overlay over `DroppableDayOverlay`s registered by ISO date. `event-mapping` pure function tested in `tests/unit/calendar-event-mapping.test.ts` (250 lines). `OffCalendarPanel` lists tasks without a date and renders them as draggable `TaskCard`s. |
| 4 | Dragging a Timeline bar updates start/end | CLEAN | `TimelineView.tsx:203–246` — `handleBarDragEnd` (body drag) and `handleDateChange` (edge resize) both call `setCellValue({ value: { start, end } })`. Virtualised rows via `@tanstack/react-virtual`. `timeline-math.ts` pure helpers (`dateToX`, `xToDate`, `pxPerDay`, `headerDates`, `isWeekend`) tested in `tests/unit/timeline-math.test.ts` (354 lines). Today line rendered as 2px overlay at `var(--color-primary)`. Weekend shading rendered per row on `day`/`week` scales. |
| 5 | Dashboard widgets render correct aggregates and update on Realtime changes | CLEAN | `Dashboard` dynamically imported with `ssr: false` (dashboard/page.tsx:18–28) — necessary because `react-grid-layout` reads `window` at module init. All 5 widget types present (NumberWidget, BarWidget, PieWidget, LineWidget, TableWidget). `widget-data.ts` (306 lines) is the aggregation dispatch layer over the cell registry. Tested in `tests/unit/widget-data.test.ts` (387 lines). Realtime: `BoardDataProvider.tsx:54` calls `useBoardRealtime(boardId, userId)` once at the layout level → store updates propagate through `useMemo` in widget-data, re-rendering each widget. |
| 6 | Form view creates tasks on submit | CLEAN | `app/(app)/w/[workspaceSlug]/b/[boardId]/form/actions.ts` (192 lines) implements `submitForm({ boardId, viewId, values })`: Zod-validates input, role-checks at `member` (per Q24 resolution), resolves target group, inserts task with `created_by`/`updated_by` set, upserts cells through `getCellDef(type).toRow(value)`. `FormView` renders fields from `effective.form`; success state shows "Submit another response". `FormBuilder` (333 lines) handles per-column config. `SubmitFormSchema` tested in `tests/unit/form-schema.test.ts` (151 lines). pgTAP at `tests/policies/submit_form_role.spec.sql` proves member/owner CAN insert, viewer/outsider CANNOT (5 assertions). |
| 7 | Each view persists its config in `view.config`; URL `?view=<id>` restores state | CLEAN | `lib/views/config-schema.ts` has strict per-kind sub-schemas with `.removeDefault().optional()` slots for all 6 kinds (`kanban`, `calendar`, `timeline`, `dashboard`, `form` — plus the Epic-11 `table` fields). `parseViewConfig` safely falls back to `{}` on parse failure. `useBoardView` (hooks/use-board-view.ts:120–193) decodes URL params on mount and merges with `activeView.config`. `loadBoardSnapshot` accepts `searchParamViewId` and uses it as priority #1 in `resolveActiveViewId`. Per-kind Zod parsing tested in `tests/unit/view-config-per-kind-schema.test.ts` (271 lines, all 5 kinds covered) and `view-config-schema-epic12.test.ts` (361 lines). |
| 8 | Switching views is instant — no full reload | CLEAN | `BoardDataProvider` is in `layout.tsx` (not per-page); it stays mounted across intra-board kind navigation. `useBoardRealtime` called once in the provider — single channel survives kind nav. `useBoardView.switchView` uses `router.push`/`router.replace` (never `window.location`). Hydration guard at `BoardDataProvider.tsx:86` (`if (hydratedRef.current === boardId) return;`) prevents re-hydration on kind nav, only re-hydrates when boardId changes. |

---

## Dispatch-plan cross-slice contracts (epic-12.md §"Definition of done" mapping table + risk notes)

| Contract | Status | Evidence |
|---|---|---|
| `loadBoardSnapshot` single-source loader, called by all 5 per-kind pages | CLEAN | `lib/board/load-board-snapshot.ts` (253 lines). Returns `{ groups, tasks, cells, columns, attachments, views, activeViewId, currentUserId, workspaceMembers }`. Each per-kind `page.tsx` invokes it once. |
| `[boardId]/page.tsx` is a redirect RSC, default 'table' | CLEAN | `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (53 lines) is the redirect; data load moved to `loadBoardSnapshot` + per-kind pages. |
| `BoardDataProvider` mounted once in layout, not per-page | CLEAN | `layout.tsx:238` mounts `BoardDataProvider`. Layout is keyed on `boardId` indirectly via the RSC tree; the provider's `useEffect` only re-hydrates on `boardId` change (line 116 dep array). |
| `useBoardRealtime` called once for all kinds | CLEAN | `BoardDataProvider.tsx:54` is the sole live call site. `BoardTable.tsx` no longer calls it directly. |
| All five Epic-12 deps installed in Slice A, no per-slice re-adds | CLEAN | `package.json` shows `react-big-calendar@^1.19.4`, `date-fns@^4.1.0`, `react-grid-layout@^2.2.3`, `recharts@^3.8.1`, `@types/react-big-calendar@^1.16.3`. |
| `kindGate` prop on `ViewToolbar` to hide irrelevant tools per kind | CLEAN | `components/board/ViewToolbar.tsx:244` lines — `kindGate` prop drives conditional toolbar items. Each per-kind page passes its `kindGate`. |
| `AddViewMenu` flips all 6 kinds to ENABLED | CLEAN | `AddViewMenu.tsx:44–74` — `VIEW_TYPES` array has all 6, each calls `createView` with `defaultConfigForKind(kind)` then `switchView`. |
| `useShallow` on every multi-field store read in alt-view containers | CLEAN | Verified across `components/board/{kanban,calendar,timeline,dashboard,form}/*.tsx`: all multi-field `useBoardStore(...)` reads wrap with `useShallow`. |
| `defaultConfigForKind` helper for "+ Add view" config defaults | CLEAN | `lib/views/config-schema.ts:249–264` — switches on kind, calls each kind's `Schema.parse({})` to get Zod defaults. |
| Q24 resolution: `submitForm` requires `member` (matches Epic 04 RLS) | CLEAN | `form/actions.ts:51` calls `requireBoardRole(boardId, 'member')`. pgTAP asserts viewer/outsider blocked at the RLS level (42501). Header comment block in `form/actions.ts:1–33` explains the decision and the deferred viewer-form-submit option. |
| Q27 resolution: `cardStyle` lives per-kind (`view.config.kanban.cardStyle` etc.) | CLEAN-as-specified | Schema reflects per-kind storage (Kanban / Calendar / Timeline each carry their own optional `cardStyle`). Kanban + Calendar consume it. Timeline gap flagged below — not a DoD miss but flagged for followup. |
| TaskCard shared renderer used in kanban + calendar | CLEAN | `components/board/shared/TaskCard.tsx` is imported and rendered by `KanbanBoard`, `KanbanLane`, `KanbanCardItem`, `CalendarView`, `CalendarEventCard`, `OffCalendarPanel`. |
| CardStyleEditor exists for the kanban/calendar config UI | CLEAN | `components/board/shared/CardStyleEditor.tsx` (199 lines). |

---

## Stack-default audit (CLAUDE.md)

- No `/api` route handlers introduced — all mutations go through Server Actions (`form/actions.ts`, `cells/actions.ts`, `tasks/actions.ts`, `views/actions.ts`). Verified by inspecting the diff for `app/api/` — no changes.
- No MUI / Redux / SCSS reintroduced. `git diff main...epic/12-alternate-views | grep -iE '(@mui|redux|cloudinary|socket\.io|\.scss)'` returns no source matches.
- TanStack Virtual reused for Kanban lanes and Timeline rows (not re-added — already in deps).
- dnd-kit used for Kanban drag, Calendar drag overlay, Timeline bar drag — `react-big-calendar/lib/addons/dragAndDrop` is NOT installed (confirmed in `package.json` — only `react-big-calendar` core). Per dispatch plan Q11.
- Recharts used for chart widgets (NumberWidget, BarWidget, PieWidget, LineWidget, TableWidget). All client components.
- `react-grid-layout` dynamically imported with `ssr: false` (dashboard/page.tsx).
- pnpm only — `pnpm-lock.yaml` updated; no `package-lock.json`.
- TypeScript strict — `pnpm exec tsc --noEmit` returns no errors.
- All times `timestamptz`; all ids `uuid v4` via `gen_random_uuid()` (no new migrations in this epic; reuses Epic-02 schema).
- `useShallow` discipline enforced on every multi-field store read in the new containers.

---

## Test surface

| File | Status | Notes |
|---|---|---|
| `tests/unit/view-config-per-kind-schema.test.ts` | PASS | 5 kinds × default + custom config parsing |
| `tests/unit/view-config-schema-epic12.test.ts` | PASS | Extended ViewConfigSchema round-trips |
| `tests/unit/kind-router.test.ts` | PASS | Pure URL helper round-trips (tests the dead `kind-router.ts` — see followup #1) |
| `tests/unit/use-board-view-cross-kind.test.ts` | PASS | switchView cross-kind navigation |
| `tests/unit/task-card.test.tsx` | PASS | TaskCard visual contract + cardStyle |
| `tests/unit/lane-bucketing.test.ts` | PASS | 486 lines — kanban lane bucketing for status/priority/person/checkbox |
| `tests/unit/calendar-event-mapping.test.ts` | PASS | 250 lines — task → calendar event mapping |
| `tests/unit/timeline-math.test.ts` | PASS | 354 lines — dateToX / xToDate / pxPerDay / headerDates / isWeekend |
| `tests/unit/widget-data.test.ts` | PASS | 387 lines — widget aggregation dispatch through cell registry |
| `tests/unit/form-schema.test.ts` | PASS | 151 lines — `SubmitFormSchema` |
| `tests/policies/submit_form_role.spec.sql` | PRESENT | pgTAP, 5 assertions; awaits Epic-15 pgTAP runner per repo convention |
| `tests/e2e/12-view-switching.spec.ts` | SKIP-WRAPPED | 213 lines, T1–T4; `test.skip(true, ...)` per Epic-15 Playwright convention |
| `tests/e2e/12-kanban-drag.spec.ts` | SKIP-WRAPPED | 157 lines |
| `tests/e2e/12-calendar-drag.spec.ts` | SKIP-WRAPPED | 245 lines |
| `tests/e2e/12-timeline-drag.spec.ts` | SKIP-WRAPPED | 285 lines |
| `tests/e2e/12-dashboard.spec.ts` | SKIP-WRAPPED | 231 lines |
| `tests/e2e/12-form-submit.spec.ts` | SKIP-WRAPPED | 222 lines |
| `tests/e2e/12-alternate-views-perf.spec.ts` | SKIP-WRAPPED | 243 lines, @perf-tagged |

Vitest run scope: `pnpm exec vitest run tests/unit/view-config-per-kind-schema.test.ts tests/unit/kind-router.test.ts tests/unit/use-board-view-cross-kind.test.ts tests/unit/lane-bucketing.test.ts tests/unit/timeline-math.test.ts tests/unit/calendar-event-mapping.test.ts tests/unit/widget-data.test.ts tests/unit/form-schema.test.ts tests/unit/view-config-schema-epic12.test.ts tests/unit/task-card.test.tsx` → 10 files passed, 265 tests passed, 6 skipped, 876 ms.

Pre-existing ~30 RTL/jsdom test-file failures (the Epic-10/11 component tests awaiting the Epic-15 RTL runner) are out of scope per the dispatch plan §"Tests" — confirmed unchanged by this epic.

---

## In-browser smoke gap (MEMORY note — `donezo-pre-epic-09-bugfix-pass`)

The pre-epic-09 bugfix pass recorded ~8 latent bugs across Epics 01–08 that all surfaced only in the first end-to-end browser run. Lesson: future epic reviews must include in-browser smoke testing.

This review was performed in an autonomous run with no live dev server — static analysis only. **Before merging `epic/12-alternate-views` → `main`, the user must run the smoke checklist** documented at `epic-12-checkpoint-1.md` §"Mandatory smoke checklist":

- [ ] Create one view of each kind via "+ Add view"
- [ ] Verify each kind's empty state (column picker / empty grid / empty fields)
- [ ] Configure each kind (set groupBy / dateColumn / timelineColumn / add widget / add field)
- [ ] Drag/edit in kanban, calendar, timeline; reload; confirm persistence
- [ ] Switch between all 6 kinds and verify URL changes correctly
- [ ] Open two browser tabs on the same board (different kinds); edit in one; assert real-time update in the other
- [ ] Submit the form view; verify task appears in the table view

This is the only gate remaining. The static review confirms the code structure is sound; the browser run confirms wiring actually works.

---

## Non-blocking followups (queued at `epic-12-followup-1.md`)

The static audit surfaced three small code-quality items. None are DoD gaps; none block merge. The user can choose to:
- (a) land them on the epic branch before opening the PR to `main`,
- (b) merge Epic 12 as-is and pick them up in an Epic-14 polish pass, or
- (c) drop them entirely.

1. **Dead helper file `lib/views/kind-router.ts`** — duplicate of `lib/views/kind-routes.ts` with subtly different `table` semantics. The production code uses `kind-routes.ts`; `kind-router.ts` is consumed only by its own test (`tests/unit/kind-router.test.ts`). No runtime breakage. Risk: a future executor might import the wrong helper and silently regress the redirect URL for `table` views.

2. **Dead component `components/board/BoardRealtimeBootstrap.tsx`** — not mounted anywhere; the realtime subscription is owned by `BoardDataProvider.tsx:54`. Either delete it or document its future purpose.

3. **Timeline `cardStyle` not consumed** — `TimelineConfigSchema` declares `cardStyle: CardStyleSchema.optional()` but neither `TimelineView`, `TimelineRow`, nor `TimelineBar` reads it. The bar renders the task title only. This is NOT a DoD miss because the epic-doc DoD bullets do not mention card style; the "Visual fidelity requirements" section says card style applies across kanban/calendar/timeline "for `<TaskCard />`", and a timeline bar is structurally not a `<TaskCard />`. But the per-kind schema slot is dead until wired.

See `epic-12-followup-1.md` for slice specs.

---

## Verdict (final)

**CLEAN (static) — Epic 12 ready to merge to `main` after the user completes the in-browser smoke checklist.**

All 8 epic-doc DoD bullets are met at the code-review level. All dispatch-plan cross-slice contracts hold. No stack-default drift. No `useShallow` violations. No re-introduction of legacy code. Tests pass; typecheck clean.

The three small followups documented above are non-blocking quality cleanups, not DoD gaps.

Recommended sequence:
1. **User runs the smoke checklist** (mandatory).
2. If the smoke pass surfaces bugs: stop, route findings to a followup spec, fix on the epic branch, re-smoke.
3. (Optional) Land followup-1 cleanups on the epic branch.
4. Open PR `epic/12-alternate-views` → `main`.
