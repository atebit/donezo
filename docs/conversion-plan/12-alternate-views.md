# Epic 12 — Alternate Views (Kanban, Calendar, Timeline, Dashboard, Form)

## Goal

Beyond the table, render the same board data as Kanban, Calendar, Timeline (Gantt), Dashboard (charts), and Form (data entry). Each view is a different lens on the same `task` + `cell` rows; switching is instant; saved views per kind persist their configuration. After this epic, a board can be visualized in 6 different shapes from the same dataset.

## Why this is its own epic

Each view is substantial on its own; bundling them lets the team build a shared "view kind" plumbing layer once (router, view-tabs, common toolbar) and reuse for all five. Splitting per kind would re-litigate UI patterns five times.

## In scope

- **Kanban** — group tasks by a status (or status-like) column into vertical lanes; drag tasks between lanes to update the cell.
- **Calendar** — show tasks placed by a date column on a month/week/day calendar.
- **Timeline (Gantt)** — show tasks with start/end from a `timeline` column on a horizontal timeline.
- **Dashboard** — charts (count, sum, group-by) over the board.
- **Form** — public-or-internal form that creates tasks. Internal-only for v1.
- View routing: `/.../b/[boardId]/<kind>` with `?view=<id>`.
- Shared toolbar primitives from [11](11-filtering-views.md): filter / sort / group-by / search.
- Per-view config in `view.config` (defined in [11](11-filtering-views.md)).
- Realtime updates apply to all views the same way.

## Out of scope

- Public-link form sharing (defer; "form" view here is internal-only).
- Dashboard as a separate page (v1 dashboards live in a board view; cross-board dashboards defer).
- Gantt dependencies (task A blocks task B). Defer.
- Workload / capacity views.
- Map view.

## Dependencies

[02](02-supabase-schema.md), [04](04-authorization-rls.md), [06](06-groups-tasks-table.md), [07](07-column-system.md), [08](08-realtime-presence.md), [10](10-attachments.md) (file column in form), [11](11-filtering-views.md).

## Architecture & design choices

### Shared "view kind" plumbing

Routes for each kind live under the board layout:

```
app/(app)/w/[slug]/b/[boardId]/
  layout.tsx
  page.tsx           → redirects to last-used view kind, default 'table'
  table/page.tsx     → from [06]
  kanban/page.tsx    → this epic
  calendar/page.tsx  → this epic
  timeline/page.tsx  → this epic
  dashboard/page.tsx → this epic
  form/page.tsx      → this epic
```

Each page is an RSC that:

1. Loads the board snapshot (same Promise.all as the table).
2. Reads the active view from URL or DB.
3. Renders the kind-specific component with the same `boardData` prop shape.

The Zustand store from [06](06-groups-tasks-table.md) is shared. Realtime updates propagate to all kinds simultaneously.

### Why one route per kind

Alternative: a single route with a query param `?kind=kanban`. Issues: harder to code-split per kind, harder to set defaults per kind, browser history less useful. One route per kind is simpler.

### View-tab navigation

Tabs from [11](11-filtering-views.md) drive `<Link>`s to the per-kind routes. Adding a view ("+ Add view → Kanban") creates a `view` row of that kind and navigates.

### Kanban

Components: `<KanbanBoard />` → `<KanbanLane />` × N → `<KanbanCard />` × M.

**Group-by column**: a status, priority, person, country, or any "categorical" cell type with a finite known set of values. v1 supports status, priority, person, checkbox.

**Lane order**: matches the chosen column's label order (status/priority labels have `position`). Person columns: lanes per workspace member, plus an "Unassigned" lane.

**Drag-drop**: dnd-kit, same library as [06](06-groups-tasks-table.md). Dragging a card between lanes triggers `setCellValue` for the group-by column. Within a lane, position changes... aren't quite meaningful (lanes are ordered by `position` of the structural group? or by another criterion?). Choice: within a lane, render in `task.position` order. Reordering within a lane updates `task.position`.

**Card content**: configurable. Default: title + first 3 visible columns (status pill, person pile, due date). Configurable via "Card style" panel. Click a card → opens the task drawer.

**Empty lanes**: render with "No tasks" message + "+ Add task" → creates a task with the corresponding cell value pre-set.

**Swimlane dimension** (stretch): a second column to subdivide each lane horizontally. Defer; v1 single dimension.

### Calendar

Library: [`react-big-calendar`](https://github.com/jquense/react-big-calendar) with the date-fns localizer. Mature, accessible, reasonably stylable.

**Date column**: pick which date or timeline column drives the calendar. Tasks without a value → off-calendar list.

**Views**: month, week, day, agenda. Defaults to month.

**Click a slot** → quick-create task at that date.

**Drag a task** between dates → update the cell value.

**Resize task** (week/day view) → update the timeline column's start/end (only if the column is a `timeline` type).

Card style: title + status pill (configurable like Kanban).

### Timeline / Gantt

Custom component. Library candidates:

- [`@tanstack/react-virtual`](https://tanstack.com/virtual) — renders the rows; we draw our own timeline bars.
- [`gantt-task-react`](https://github.com/MaTeMaTuK/gantt-task-react) — looks decent but limited.
- [`frappe-gantt`](https://frappe.io/gantt) — popular but jQuery-flavored.
- Build custom — moderate effort, max flexibility.

**Choice: build custom** on top of `@tanstack/react-virtual`. Gantt's hard part is the time axis + bars; the row layout is just a virtualized list. Estimate ~3–5 days of work for a usable v1.

**Time axis**: configurable scale (day, week, month, quarter, year). Headers stick to top. Today line.

**Bar position** computed from the chosen `timeline` column's `start` and `end`. Tasks without start+end → in a sidebar list, draggable onto the timeline.

**Drag bar**: move along the time axis → update both start and end (preserving duration).
**Drag bar edges**: resize → update start or end independently.
**Click bar** → task drawer.

**Dependencies**: out of scope. The schema doesn't have a `task_dependency` table yet.

### Dashboard

Charts: count, sum, group-by, %-by-label, time-series.

Components:

- `<Dashboard />` — grid of widgets (drag-drop reorder; resizable). Uses `react-grid-layout`.
- `<Widget />` — wrapper with title + actions (edit, delete).
- `<WidgetEditor />` — modal: type (bar / pie / line / number / table) + data config (X axis column, Y aggregation, group-by column, filter).

**Charts**: Recharts. Already chosen in [00](00-overview.md). Components for bar, pie, line, area, scatter.

**Number widget**: a single big number. E.g., "Sum of Budget = $124,500." Configured: column + aggregation.

**Table widget**: a small embedded list. E.g., "Top 5 tasks by priority." Configured: filter + sort + limit.

**Dashboard config** in `view.config.dashboard`:

```ts
type DashboardConfig = {
  layout: { i: string; x: number; y: number; w: number; h: number }[];
  widgets: Record<string, WidgetConfig>;
};

type WidgetConfig =
  | { kind: 'number'; columnId: string; aggregation: AggregationKind; label?: string }
  | { kind: 'bar'; xColumnId: string; yAggregation: AggregationKind; yColumnId?: string; groupBy?: string }
  | { kind: 'pie'; columnId: string; aggregation: AggregationKind }
  | { kind: 'line'; dateColumnId: string; yAggregation: AggregationKind; yColumnId?: string; bucket: 'day'|'week'|'month' }
  | { kind: 'table'; filter?: FilterTree; sort?: SortKey[]; limit: number };
```

Aggregations come from [07](07-column-system.md) cell registry's `def.aggregate`.

### Form view

A simple form, scoped to creating tasks on the current board. Configuration:

- Pick which columns appear in the form.
- Per-column: required, label override, help text, default value.
- Layout: single column, max 1024px wide.

The form posts to a server action `submitForm({ boardId, viewId, values })` that creates a task + cells. The form view itself is just an authenticated route; public-link sharing is deferred.

For the v1 internal release, "form view" mostly serves as a quick-create UI for users who don't want to interact with the table. Worth shipping.

### Realtime in alternate views

The store is shared, so updates flow into all views. Each view re-renders from derived state (kanban lanes, calendar buckets, timeline bars).

### Performance notes

- **Kanban** with 5000 tasks across 5 lanes — virtualized lanes. Each lane uses `@tanstack/react-virtual` for its card list.
- **Calendar** in month view — `react-big-calendar` handles ~500 events/month gracefully. For more, switch to week/day.
- **Timeline** — virtualize rows; draw bars in absolute-positioned divs. Up to 2,000 visible tasks at 60fps.
- **Dashboard** — widgets memoized; chart libraries handle rendering.

### Card style configuration

Shared "card" content config across kanban, calendar, timeline:

```ts
type CardStyle = {
  showTitle: boolean;          // always true; here for completeness
  visibleColumnIds: string[];  // order matters
  showAvatars: boolean;
  showDueDate: boolean;
};
```

Stored in the view's config. Editor: a panel in the view settings.

### "Coming soon" for some types

- Map view, Workload view, Files view, Chart per group: all stubbed in the "+ Add view" dropdown with a "Coming soon" tooltip; not added in v1.
- Form public sharing: similar.

## Visual fidelity requirements

This epic spans five different views; each needs to feel cohesive with the table while having its own visual rhythm. Tokens always come from [`design-system.md`](design-system.md); component contracts in [`component-system.md`](component-system.md).

**Must-match — Kanban** ([component-system.md §7.1](component-system.md#71-kanbanboard-lanes--cards)):
- Lane width `260px`, bg `--color-surface-rail` (`#F6F7FB`).
- Lane header 44px tall, white text on group color, top corners `8px` rounded.
- Card bg white, radius 4px, shadow `--shadow-card` (`0px 4px 8px rgb(0 0 0 / 20%)`), font 13px, margin-bottom 8px.
- Card title row 36px, gap 4px, with chat icon right (24px) + comment count badge (`14×13` circle, bg `--color-primary`).
- Card content rows: stacked picker rows, each 36px tall with bg `--color-surface-info` (`#f5f6f8`).
- Lane container max-height `410px`, flex-wrap.

**Match — Calendar / Timeline / Dashboard / Form**:
- Use `--color-primary` for selected dates and active timeline today-line.
- Status-pill bars in Timeline use the cell registry's color palette (no new color choices).
- Dashboard widgets: 2px border `--color-border-strong` with hover border-color `--color-primary` (per [_dashboard.scss:14](../../frontend/src/assets/styles/views/_dashboard.scss)). Widget headers separated by `1px solid --color-border-strong`.
- Form view inputs reuse the chrome from [03](03-auth.md) auth forms (radius 4px, padding `8px 16px`, focus border `--color-primary`).
- Card style applied to `<TaskCard />` for kanban/calendar/timeline must come from a single shared renderer — same component, three contexts.

Use the `<MenuList />` primitive for any dropdowns (group-by picker, density toggle, view-tab dropdown). Don't roll bespoke menus per view.

## Tasks

### Shared

1. **View kind router**: per-kind page files under the board layout. Default redirect from `/b/[id]` to last-used kind (in `profile.last_view_per_board`).
2. **Shared toolbar plumbing** (Filter / Sort / Search) on alternate views — reuses [11](11-filtering-views.md) components.
3. **Card style editor** + per-card renderer (`<TaskCard />`) used by kanban, calendar, timeline.

### Kanban

4. **`<KanbanBoard />`** with column-based lanes.
5. **Group-by column picker** — supports status, priority, person, checkbox.
6. **Drag between lanes** — wires to `setCellValue`.
7. **Drag within lane** — updates `task.position`.
8. **Empty-lane create** — quick-add task with column value preset.
9. **Card style applied** to `<TaskCard />`.
10. **Tests**: drag a card to "Done" lane → status cell becomes the "Done" label; reload → persists.

### Calendar

11. **`<CalendarView />`** with `react-big-calendar`.
12. **Date column picker** — supports `date` and `timeline` columns.
13. **Drag to reschedule** — updates the cell.
14. **Resize** (timeline columns only) — updates start/end.
15. **Quick-create on slot click**.
16. **Off-calendar list** for tasks without a date value.
17. **Tests**: drag a task from one day to another → date cell updates; reload → persists.

### Timeline

18. **`<TimelineView />`** custom: virtualized rows + absolute-positioned bars + sticky time axis.
19. **Time-axis scale switcher**: day / week / month / quarter / year.
20. **Drag bar** to move; drag edges to resize.
21. **Today line, weekend shading**.
22. **Tests**: drag a bar → start/end cell values update; reload → persists.

### Dashboard

23. **`<Dashboard />`** grid container with `react-grid-layout` for resize/reorder.
24. **`<WidgetEditor />`** modal with kind picker + per-kind config.
25. **`<NumberWidget />`**, **`<BarWidget />`**, **`<PieWidget />`**, **`<LineWidget />`**, **`<TableWidget />`**.
26. **Aggregation dispatch** through cell registry.
27. **Live updates**: widget values update when underlying tasks change.
28. **Tests**: configure a "Sum of Budget" number widget; add a task with budget 100; widget updates.

### Form

29. **`<FormView />`** with column-driven layout.
30. **Form config editor**: pick columns, set required, labels, help, defaults.
31. **`submitForm` server action** creating task + cells.
32. **Tests**: fill form → submit → task appears in the table view.

## Definition of done

- A user can switch between Table / Kanban / Calendar / Timeline / Dashboard / Form on the same board with the same data.
- Dragging a task between Kanban lanes updates the relevant cell.
- Dragging a task in Calendar moves the date.
- Dragging a Timeline bar updates start/end.
- Dashboard widgets render correct aggregates and update on Realtime changes.
- Form view creates tasks on submit.
- Each view persists its config in the corresponding `view.config` row; URL `?view=<id>` restores state.
- Switching views is instant — no full reload.

## Open questions

- **Gantt library buy vs build**. Build is recommended for control; revisit if the cost feels high.
- **Form public sharing.** Deferred; will require a `share_token` and unauth path. Plan in v1.5.
- **Calendar localization**. `date-fns` locales; English default; switch later when i18n lands ([14](14-mobile-a11y-polish.md)).
- **Dashboard cross-board**. Currently scoped to a single board's data. Cross-board widgets are valuable but require cross-board joins respecting RLS; defer.
- **Timeline color rules**: color bars by status / priority / person? Spec via card style config.
- **Drag granularity on timeline**. Snap to day vs continuous. Snap-to-day is more usable; expose in config.
- **Calendar view "all-day" vs "with time"**. Date column has `withTime` config from [07](07-command-system.md); calendar respects it.
- **Workspace dashboards**. A "workspace home" with charts across boards. Deferred.
