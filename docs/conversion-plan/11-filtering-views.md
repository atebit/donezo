# Epic 11 — Filtering, Sorting, Search, Saved Views

## Goal

Make the table fast to navigate at scale: a per-board filter builder (any column, any operator), multi-key sort, full-text search across tasks, and saved views (filter + sort + grouping + visibility presets). Per-user views and shared views. Global cross-board search. URL-sync so filtered states are shareable.

## Why this is its own epic

Filtering, sorting, and saved-view configuration are cross-cutting: they touch the table, kanban, calendar, timeline, and dashboard views ([12](12-alternate-views.md)) identically. The right place is one epic that builds the data shape and UI components every view consumes.

## In scope

- Per-board filter builder UI: column + operator + operand, ANDed clauses (OR groups: stretch).
- Per-board sort: multi-key (column + asc/desc).
- Per-board group-by: pick a column to group by (replaces the structural groups for the duration of the view).
- Column visibility (which columns to show/hide).
- Column resize persistence (per user).
- Density (compact/default/spacious).
- Saved views: combine all of the above into a named, shareable preset.
- View URL sync: `?view=<id>` or `?filter=...&sort=...`.
- Full-text search across tasks within a board (title + cell text + comment text).
- Global search across boards in the workspace (top of sidebar).
- The `view` table from [02](02-supabase-schema.md) is the persistence layer.

## Out of scope

- Filter formulas (filter by computed expression) — defer with `formula` cell type.
- Cross-board filtering / saved queries — defer.
- AI-powered search ranking — defer.

## Dependencies

[02](02-supabase-schema.md), [04](04-authorization-rls.md), [06](06-groups-tasks-table.md), [07](07-column-system.md).

## Architecture & design choices

### View configuration shape

Saved in `view.config jsonb`:

```ts
type ViewConfig = {
  filter?: FilterTree;
  sort?: SortKey[];
  groupBy?: { columnId: string } | { kind: 'native' };  // 'native' = the structural groups
  columnVisibility?: Record<string, boolean>;            // columnId → visible
  columnWidths?: Record<string, number>;                 // px
  columnOrder?: string[];                                // overrides board's column.position
  density?: 'compact' | 'default' | 'spacious';
  search?: string;
  // Per-view-kind extras:
  kanban?: { groupByColumnId: string; swimlaneColumnId?: string };
  calendar?: { dateColumnId: string };
  timeline?: { columnId: string };                       // a timeline-type column
  dashboard?: DashboardConfig;                           // [12]
};
```

Each view row has `kind` (`table | kanban | calendar | timeline | dashboard | form`) and the relevant subset of the config.

### Filter tree

Single-level AND for v1. Structure prepared for nesting:

```ts
type Comparison = {
  columnId: string;
  operator: FilterOperator;
  operand: unknown;       // type depends on column type, validated by the cell registry
};
type FilterTree =
  | { kind: 'and'; clauses: FilterTree[] }
  | { kind: 'or'; clauses: FilterTree[] }
  | { kind: 'comparison'; comparison: Comparison };
```

UI for v1: flat list of comparisons, all ANDed. The data shape supports OR groups when we add them.

### Filter evaluation

Two paths:

- **Server-side** (preferred when possible): translate the filter tree to SQL and apply on the query. For a 5,000-task board with a complex filter, this is much faster than client-side.
- **Client-side fallback**: walk the cell store and apply `def.matchesFilter` per cell.

For v1, **client-side** is acceptable because the entire board is loaded into memory anyway (it's already streamed for Realtime). The cell registry's `matchesFilter` from [07](07-column-system.md) handles per-type semantics. If perf becomes an issue at 50,000+ tasks, build the SQL translator.

### Sort evaluation

Same model: client-side multi-key sort using the cell type's `def.compare`. Stable sort.

```ts
function compareTasks(a: Task, b: Task, sort: SortKey[], cells, cols): number {
  for (const key of sort) {
    const def = cellRegistry[cols.get(key.columnId)!.type];
    const av = cells.get(`${a.id}:${key.columnId}`);
    const bv = cells.get(`${b.id}:${key.columnId}`);
    const c = def.compare(def.fromRow(av), def.fromRow(bv)) * (key.direction === 'asc' ? 1 : -1);
    if (c !== 0) return c;
  }
  return a.position - b.position;
}
```

### Group-by

The native group-by uses the structural `group` table — the default. An "alt group-by" replaces it with the chosen column (e.g., group-by-status, group-by-person). Client-side computes the buckets from cell values.

The alt group-by is **non-mutating** — it doesn't move tasks between actual groups; it's a view-only regrouping. The original structure restores when the view is closed or changed.

### Column visibility, widths, density

Persisted in `view.config`. Per-user views (`view.user_id = auth.uid()`) hold each user's preferences. Shared views (`view.user_id is null`) hold team presets.

When a user opens a board:

1. Load all views accessible to the user (RLS filter from [04](04-authorization-rls.md)).
2. Pick the active view: from URL `?view=<id>`, or last-used (stored in `profile.last_view_per_board jsonb`), or the workspace default ("Main table").
3. If no per-user view exists, create a default one on first board open.

```sql
alter table public.profile add column last_view_per_board jsonb not null default '{}'::jsonb;
```

### Default views

Every new board ships with one shared view: "Main table" (table kind, no filter, native group-by, all columns visible). The create-board flow ([05](05-workspaces-boards.md)) inserts it.

Each user gets a personal "My view" auto-created on first open. Customizations save here unless they explicitly use a shared view.

### View tabs UI

Above the table, a row of tabs:

- "Main table" (shared)
- "+ Add view" (dropdown: New table / kanban / calendar / timeline / dashboard / form)
- Active view dropdown menu: Rename, Duplicate, Save filters, Reset to defaults, Delete.

Active view's filter/sort/etc are set from `view.config`. Editing the filter updates either the view (if author/admin) or a "draft" overlay (if not authorized to save). Draft state persists in URL params, not the DB.

### URL sync

The active view, plus any unsaved filter/sort overrides, sync to the URL:

```
/w/acme/b/<id>?view=<viewId>
/w/acme/b/<id>?view=<viewId>&filter=<base64-encoded-tree>&sort=<...>
```

Encoding: base64 JSON. For long filters, swap to a server-stored "draft view" id.

URL state is the source of truth for client-only overrides. Persistent state lives in the DB.

### Filter UI

A "Filter" button next to view tabs opens a popover:

```
[Status] [is]    [Done]              ✕
[Person] [is]    [Chris, Sara]       ✕
[Date]   [in]    [This week]         ✕
+ Add filter
```

Each row: column dropdown (filtered to filterable columns), operator dropdown (filtered by `def.filterOperators`), operand input (per-type editor like the cell editor in compact mode).

Active filter count shows on the button: "Filter (3)."

### Sort UI

A "Sort" button beside Filter. Same popover pattern: list of sort keys, each with column + direction. "Add sort" appends.

### Hide / Group / Density

A "Hide" button opens a column visibility checklist. Drag-to-reorder columns within the list (overrides board column.position for the view).

A "Group by" button opens a column picker filtered to groupable types (status, priority, person, date, checkbox, country, ...). Default: native (the actual `group` rows).

A "Density" inline toggle: 3 buttons.

### Search

In-board search input in the toolbar. As you type:

- Debounced 200ms.
- Client-side filter on `task.title.includes(q) || cells.some(c => def.toSearchString(c).includes(q)) || comments.some(...)` — the `comments` part requires comment list pre-loaded (we have it in the task drawer; for search we'd need a board-wide comment index).
- For v1: search task titles + visible cell text. Comment search is in the per-task drawer only.

Future: Postgres full-text search. Add a `tsv` column on `task` materialized from `title + cell_text(task)` + `comment.body_text`. Index with GIN. For v1, defer.

### Global cross-board search

Topbar global search (Cmd-K palette) searches:

- Boards by title (within the user's workspace).
- Tasks by title (across all boards user has access to).

Implementation:

```sql
-- search function returning combined results
create or replace function public.global_search(p_workspace_id uuid, q text)
returns table(kind text, id uuid, title text, board_id uuid, board_title text)
language sql stable security invoker
as $$
  select 'board' as kind, b.id, b.title, b.id, b.title
  from public.board b
  where b.workspace_id = p_workspace_id
    and b.title ilike '%' || q || '%'
    and b.deleted_at is null
  union all
  select 'task' as kind, t.id, t.title, t.board_id, b.title
  from public.task t
  join public.board b on b.id = t.board_id
  where b.workspace_id = p_workspace_id
    and t.title ilike '%' || q || '%'
    and t.deleted_at is null
  order by 1, 3
  limit 20;
$$;
```

Server-action calls the function. RLS still applies (the function runs as `security invoker`, so the user's session is enforced — they only see boards/tasks their session can SELECT).

For better-than-`ilike` ranking later, add `pg_trgm` index or `tsvector`. v1 ships `ilike`.

### Saved view permissions

- **Shared view**: anyone on the board can read; admin+ can edit/delete (RLS from [04](04-authorization-rls.md)).
- **Personal view**: only the owner can read/edit/delete.

Creating a shared view: button "Save as shared view" requires admin+ (server action checks).

### Component catalog

- `<ViewTabs />` (server-rendered initial views; client interactivity).
- `<ViewToolbar />` — Filter / Sort / Hide / Group / Search / Density.
- `<FilterBuilder />` — popover with the comparison rows.
- `<FilterRow />` — column + operator + operand.
- `<SortBuilder />`.
- `<ColumnVisibilityPanel />`.
- `<GroupByPicker />`.
- `<SearchInput />` (in-board).
- `<GlobalSearchPalette />` (Cmd-K, in topbar).

### Operand inputs

Each cell type's editor doubles as a filter operand input in compact mode. The cell registry adds an optional `OperandEditor` component; default is the regular `Editor`.

### Performance with filters/sorts

For 5,000 tasks, client-side filter+sort on every keystroke is feasible but should be debounced/throttled. Use `useDeferredValue` for filter state to keep typing responsive while the table re-renders.

### Migration

```sql
-- supabase/migrations/00000000000006_views_polish.sql
alter table public.profile
  add column last_view_per_board jsonb not null default '{}'::jsonb;
```

The `view` table itself was created in [02](02-supabase-schema.md). The default-view insertion happens in [05](05-workspaces-boards.md)'s `createBoard` server action — update it to insert "Main table" automatically (already noted in [05](05-workspaces-boards.md)'s tasks).

## Visual fidelity requirements

This epic completes the `<BoardFilter />` toolbar started in [06](06-groups-tasks-table.md) and adds saved-view tabs. Refer to [`component-system.md §1.4`](component-system.md#14-boardfilter-toolbar) and [`design-system.md`](design-system.md).

Must-match:

- **`<BoardFilter />` toolbar full** — gap 5px, each tool 32px tall, font 14px. Tools (`Person`, `Filter`, `Sort`, `Hide`, `Group`, `Search`): padding `0 8px`, color `--color-fg-muted`, glyph 18px. Hover bg `--color-surface-hover`, radius 4px.
- **Search expand animation** — input width `58 → 140px` over `--motion-medium` on focus. Chrome border on focus `0.5px --color-primary`, bg white. Cursor flips `pointer → text` on focus. See [_board-filter.scss:90-110](../../frontend/src/assets/styles/cmps/board/_board-filter.scss).
- **Person filter chip active state** — bg `--color-primary-selected` (`#cce5ff`), radius 4px.
- **`<ViewTabs />`** — same chrome as board view tabs: 32px tall, padding `0 8px`, font 14px weight 500. Active tab gets 2px bottom border `--color-primary`. Inactive hover bg `--color-surface-hover`, radius `4px 4px 0 0`.
- **`<FilterBuilder />` popover** — uses `<DynamicModal />` chrome from [01](01-foundation.md): bg white, border `1px solid --color-border-strong`, radius 8px, shadow `--shadow-modal`, z-index `--z-popover`.
- **`<GlobalSearchPalette />` (Cmd-K)** — modal centered, ~640px wide, radius `--radius-md`, shadow `--shadow-modal`. Each result row uses the `<MenuList />` recipe.
- **Filter operand editors** — reuse the cell-type editors in compact mode (don't redesign per filter type).

## Tasks

1. **Migration**: `profile.last_view_per_board`.
2. **Update `createBoard`** ([05](05-workspaces-boards.md)) to insert the default "Main table" shared view.
3. **Build view-state hook** `useBoardView()` that returns `{ view, draft, applyDraft, save, ... }`. Source of truth: URL → DB.
4. **`<ViewTabs />`** with shared and personal views, "+ Add view" dropdown.
5. **`<ViewToolbar />`** with Filter / Sort / Hide / Group / Search buttons.
6. **`<FilterBuilder />`** — multi-row popover; reads from cell registry's filterable types and operators.
7. **`<SortBuilder />`** — multi-key sort with cell registry's compare.
8. **`<ColumnVisibilityPanel />`** — checklist with drag reorder.
9. **`<GroupByPicker />`** — column picker. Switching to alt group-by re-buckets tasks client-side without mutating data.
10. **`<DensityToggle />`** — 3-state.
11. **In-board `<SearchInput />`** with debounce + cell-text matching.
12. **Per-cell-type `OperandEditor`** for status/priority/person/date/etc. Reuses the editor in compact mode.
13. **Apply filter/sort to the table render**. Use `useMemo` over derived task lists; `useDeferredValue` on the search input.
14. **URL sync** — encode/decode filter+sort in URL, hydrate on mount, debounced push on change.
15. **Save view** — server action `saveView({ id?, name, kind, config, isShared })`. Admin+ for shared.
16. **Manage views** — rename, duplicate, delete actions in the view tab dropdown.
17. **Global search**: SQL `global_search` function, `<GlobalSearchPalette />` (Cmd-K), keyboard shortcut.
18. **Sync `last_view_per_board`** when switching views (debounced).
19. **Tests**:
    - Unit: filter tree → matchesFilter dispatch; sort with multiple keys.
    - Integration: open board → apply filter → result table contains expected rows; reload URL → state restored.
    - E2E: create a "Done only" view → save shared → another user opens board, sees the view, applies it, sees the same filtered set.
    - E2E: Cmd-K → type → click result → navigates to task drawer.

## Definition of done

- Users can filter the table by any column with type-appropriate operators.
- Multi-key sort works.
- Hiding columns, resizing, and reordering persists per user.
- Saved views (shared and personal) appear in tabs; switching applies their config.
- The URL reflects the active view + draft overrides; copying it shares the same state.
- In-board search filters tasks live as you type.
- Cmd-K global search finds boards and tasks across the workspace, respecting RLS.
- Default "Main table" view auto-created on board creation.
- Filter/sort/group-by all happen client-side; rendering 5,000 filtered/sorted tasks stays at 60fps.

## Open questions

- **Server-side filter for very large boards.** Defer; revisit if a board >20,000 tasks emerges.
- **Filter expression UX**: structured rows (current plan) vs free-form mini-language. Rows are accessible to non-power users.
- **OR / nested filters**: defer to v1.5.
- **Saved view notifications** ("notify me when this filter has new matches"): defer.
- **Default view per role**: e.g., "Viewers see X view by default." Configurable later.
- **Comment search in board search**: requires preloading board-wide comments. Defer; accept that in-board search is title+cells only.
- **Search ranking**: trigram or full-text. Defer.
