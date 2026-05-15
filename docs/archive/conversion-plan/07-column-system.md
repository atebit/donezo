# Epic 07 — Dynamic Column System

## Goal

The full column experience: add, rename, reorder, remove, and hide columns; render a registry of cell types (text, status, priority, person, date, timeline, number, currency, formula, checkbox, file, link, tags, rating, email, phone, country, vote, week, location, last-updated, created-by). Each cell type has its own renderer, editor, validator, aggregator, sorter, filterer, and Realtime payload codec. The result: users can configure a board to look like the screenshots referenced in the audit (e.g., a marketing-asset tracker or a song-tracker) without code changes.

## Why this is its own epic

Cell types are the heart of the product. Each one is small but adds up; pulling them into one focused epic keeps cross-cell concerns (the registry, value codecs, common settings UI) consistent. Splitting cells across feature epics would breed inconsistency.

## In scope

- Cell type registry (`lib/cells/registry.ts`).
- Twenty cell-type implementations in `components/cells/<type>/` — see catalog below.
- Add-column modal with type picker and per-type configuration.
- Column header with: title, type icon, sort/filter dropdown, rename, duplicate, hide, delete, change type (with conversion rules).
- Column reorder via DnD.
- Column resize (persisted per-user).
- Column visibility (per-user; persisted via [11](11-filtering-views.md) saved views).
- Column-level aggregations (sum/avg/count/min/max/median, unique-count, %-by-label).
- Cell editor focus/keyboard model: open-on-click, close-on-blur, Enter-saves, Esc-cancels.
- Cell value codec: how to write to / read from `cell` table's polymorphic columns based on type.
- Conversion rules: changing a column's type migrates existing cells where it makes sense.
- Server actions for column + cell mutations.
- Activity log integration: every cell change writes an event with from/to.

## Out of scope

- Realtime broadcast of cell changes ([08](08-realtime-presence.md)).
- Filtering by cell value beyond the column header ([11](11-filtering-views.md) — uses the filterers defined here).
- Cross-board mirror / dependency / connect-boards types — listed in catalog but stubbed.
- Formula evaluation engine — stubbed (returns "—" for now). Define the type so it can land later without schema changes.
- Form view ([12](12-alternate-views.md)).

## Dependencies

[01](01-foundation.md), [02](02-supabase-schema.md), [04](04-authorization-rls.md), [06](06-groups-tasks-table.md).

## Architecture & design choices

### The registry

A `CellTypeDef<TValue, TConfig>` interface plus a registry keyed by `column.type`:

```ts
// lib/cells/types.ts
export type CellTypeId =
  | "text" | "long_text" | "status" | "priority" | "person" | "date"
  | "timeline" | "number" | "currency" | "checkbox" | "file" | "link"
  | "tags" | "rating" | "email" | "phone" | "country" | "vote" | "week"
  | "location" | "updated_by" | "created_by" | "created_at_col" | "formula";

export type CellRow = {
  task_id: string;
  column_id: string;
  text_value: string | null;
  number_value: number | null;
  boolean_value: boolean | null;
  date_value: string | null;
  date_end_value: string | null;
  json_value: unknown;
  label_id: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type CellTypeDef<TValue, TConfig = Record<string, never>> = {
  id: CellTypeId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  defaultConfig: TConfig;
  defaultValue: TValue | null;

  // Codec: row ↔ value
  fromRow: (row: CellRow | undefined) => TValue | null;
  toRow: (value: TValue | null) => Partial<CellRow>;

  // Renderers
  Cell: ComponentType<{ value: TValue | null; config: TConfig; row: TaskRow }>;
  Editor: ComponentType<{
    value: TValue | null;
    config: TConfig;
    onChange: (next: TValue | null) => void;
    onClose: () => void;
  }>;

  // Optional: per-column settings UI (shown in add-column modal & column header settings)
  ConfigEditor?: ComponentType<{ config: TConfig; onChange: (c: TConfig) => void }>;

  // Aggregation: how to summarize a column of values for a group footer / dashboard
  aggregations: AggregationKind[];
  aggregate: (values: TValue[], kind: AggregationKind, config: TConfig) => string;

  // Filter operators: which operators apply, and how to evaluate
  filterOperators: FilterOperator[];
  matchesFilter: (value: TValue | null, op: FilterOperator, operand: unknown) => boolean;

  // Sort: comparator
  compare: (a: TValue | null, b: TValue | null) => number;

  // Type conversion: when a column changes type from this to another
  convertTo: Partial<Record<CellTypeId, (value: TValue | null) => unknown>>;
};
```

A registry maps `id → def`:

```ts
// lib/cells/registry.ts
import { textType } from "@/components/cells/text/def";
import { statusType } from "@/components/cells/status/def";
// ...
export const cellRegistry = {
  text: textType,
  long_text: longTextType,
  status: statusType,
  // ...
} satisfies Record<CellTypeId, CellTypeDef<any, any>>;
```

The registry is the single point of truth. Every consumer (`<TableCell />`, filter UI, sort, aggregator, conversion) reads through it. Adding a new type means: define one folder under `components/cells/<type>/`, add it to the registry, ship.

### Why one big interface vs multiple small ones

Cell types have many concerns that *interact* — the editor produces a value the codec writes; the filter operates on the same value the renderer displays; aggregations need the comparator to find min/max. Keeping them in one definition makes the contract explicit and prevents drift. The downside (a fat interface) is mitigated by per-type folders.

### Cell type catalog

Detailed list with representative `value` shapes and storage strategy. The storage key is which `cell` row column holds the value.

| Type id | Display | Value type | Storage column | Config |
|---|---|---|---|---|
| `text` | "Notes", short text | `string` | `text_value` | none |
| `long_text` | Markdown / rich-text body | `string` (Tiptap JSON serialized) | `text_value` | `{ richText: boolean }` |
| `status` | colored pill | `{ labelId: uuid }` | `label_id` | `{ allowsEmpty: boolean }` |
| `priority` | colored pill | `{ labelId: uuid }` | `label_id` | same as status |
| `person` | avatar pile | `{ userIds: uuid[] }` | `json_value` | `{ multi: boolean }` |
| `date` | date picker | `{ iso: string }` | `date_value` | `{ withTime: boolean, format: 'short' \| 'long' }` |
| `timeline` | date range bar | `{ start: iso, end: iso }` | `date_value` + `date_end_value` | `{ withTime }` |
| `number` | numeric | `number` | `number_value` | `{ decimals: int, suffix?: string }` |
| `currency` | $1,234.56 | `number` | `number_value` | `{ currency: string }` |
| `checkbox` | ☐/☑ | `boolean` | `boolean_value` | none |
| `file` | file thumbnails | `{ attachmentIds: uuid[] }` | `json_value` | `{ multi: boolean }` |
| `link` | URL with title | `{ url: string, label?: string }` | `json_value` | none |
| `tags` | multi-select chips | `{ values: string[] }` (free-form) or label-id-backed (chosen: free-form for v1) | `json_value` | `{ allowedValues?: string[] }` |
| `rating` | ★★★☆☆ | `number` (0..max) | `number_value` | `{ max: int (default 5) }` |
| `email` | email link | `string` | `text_value` | none |
| `phone` | tel: link | `string` | `text_value` | none |
| `country` | flag + name | `string` (ISO 3166 alpha-2) | `text_value` | none |
| `vote` | thumbs up count | `{ userIds: uuid[] }` | `json_value` | none |
| `week` | week-of-year picker | `{ year: int, week: int }` | `json_value` | none |
| `location` | map pin | `{ lat: number, lng: number, label?: string }` | `json_value` | none |
| `updated_by` | actor avatar | derived from `task.updated_by` + `task.updated_at` | n/a (read-through) | none |
| `created_by` | actor avatar | derived from `task.created_by` + `task.created_at` | n/a | none |
| `created_at_col` | created timestamp | derived from `task.created_at` | n/a | none |
| `formula` | computed | `string` (rendered) | n/a (computed at read time) | `{ expression: string }` |

The three "derived" columns (`updated_by`, `created_by`, `created_at_col`) read from the parent task row, not from the `cell` table. Their cell editor is read-only. They're useful for the UI to put alongside other columns.

`formula` is a placeholder for a future expression engine. Schema accepts it; renderer shows "—" until the engine ships.

### Storage write pattern

When a cell editor produces a new value, the server action computes the `Partial<CellRow>` via `def.toRow(value)` and upserts:

```ts
async function setCellValue({ taskId, columnId, value }) {
  const def = cellRegistry[col.type];
  const patch = def.toRow(value);                // sets exactly one of text/number/.../label_id
  await supabase.from("cell").upsert({
    task_id: taskId,
    column_id: columnId,
    ...patch,
    updated_by: userId,
  });
  await logActivity({
    boardId: col.board_id,
    actorId: userId,
    action: "task.cell_changed",
    taskId,
    columnId,
    payload: { from: prevValue, to: value, columnType: col.type },
  });
}
```

`toRow` *only* writes the relevant column; other value columns must be explicitly nulled to clear stale values when the type was just converted.

### Editor lifecycle

A single `<CellEditor />` orchestrator reads `def.Editor` and renders it in a Popover. State machine:

```
Idle → (click cell) → Open
Open → (Enter / blur / external close) → Save → Idle
Open → (Esc) → Cancel → Idle
```

For inline editors that don't need a popover (text, checkbox), the cell renders the editor inline. For popover-based editors (status, person, date), the cell shows the read-mode view; clicking opens a Radix Popover anchored to the cell.

The orchestrator handles the optimistic update + server action + rollback dance once, so per-type editors don't repeat the pattern.

### Add-column modal

Multi-step:

1. Pick type (grid of icons + labels, with descriptions on hover).
2. Configure: title (default to type label), per-type config via `def.ConfigEditor`.
3. (For status/priority) Define labels.

Server action `createColumn({ boardId, type, title, config, position })` inserts the row. For status/priority, also inserts the default label set ("Working on it", "Done", "Stuck" — colors from a fixed palette).

### Column header dropdown

Click column header chevron → dropdown:

- Rename
- Sort: ascending / descending / none
- Filter: opens the filter panel ([11](11-filtering-views.md))
- Hide
- Resize (manual; drag the header edge)
- Move left / right
- Duplicate column (copies type, config, but no cell values)
- Change type → submenu of compatible types (uses `convertTo`)
- Settings (per-type config)
- Delete (admin+)

### Column type conversion

`convertTo` defines per-source-type conversions. Examples:

- `text → number`: parse as number; null on failure.
- `text → email`: keep value; show validation warning if not valid email.
- `number → text`: stringify.
- `date → timeline`: copy to `start`; null `end`.
- `status → text`: copy label title.
- `text → status`: try to match an existing label by title; create label if not found and admin+.
- `tags → text`: join values with comma.

Conversions that lose data (status → number) prompt the user with "This will clear all values in this column. Continue?"

The conversion runs in a transaction: update column type, run a SQL `update` that uses a per-type SQL fragment to migrate values. For complex conversions, do it row-by-row in the server action.

### Aggregations

Group footer shows aggregates per column. Default aggregation per type:

- text/long_text/email/phone: count of non-empty
- number/currency: sum
- date/timeline: range (earliest – latest)
- status/priority: %-by-label
- person: unique users
- checkbox: % checked
- rating: average
- file: count
- tags: unique values

Users can change the aggregation per group/board via the column header. Persists in `view.config`.

### Filter operators per type

```ts
type FilterOperator =
  | "equals" | "not_equals"
  | "contains" | "not_contains"
  | "starts_with" | "ends_with"
  | "is_empty" | "is_not_empty"
  | "in" | "not_in"
  | "lt" | "lte" | "gt" | "gte"
  | "between"
  | "before" | "after" | "today" | "this_week" | "this_month";
```

Each cell type's `def.filterOperators` lists which apply. Status: `equals`, `not_equals`, `is_empty`, `in`. Number: numeric ops. Date: temporal ops + "today/this_week/...". The actual filter UI lives in [11](11-filtering-views.md); definitions land here.

### Cell editor library

Each cell type's editor uses the right shadcn primitive:

- text/long_text: shadcn Input or Tiptap.
- status/priority: Popover + Command list of labels.
- person: Popover + Command searching users (workspace members).
- date: Popover + Calendar (shadcn Calendar / react-day-picker).
- timeline: Popover + dual Calendar.
- number/currency: Input with type=number; format on blur.
- checkbox: shadcn Checkbox inline.
- file: opens a [10](10-attachments.md) drop zone in the cell.
- link: Popover with URL + label inputs.
- tags: Popover + Command + free-text creation.
- rating: hover-and-click stars.
- email/phone/country: Input with format hints.

### Person column: workspace member resolution

The editor's command list shows workspace members. Selecting one adds their `user_id` to `value.userIds`. Display: avatar pile with overflow ("+2"). Click avatar → popover with full-name, link to profile.

Members come from a server-fetched list cached in workspace context ([05](05-workspaces-boards.md)).

### Status / priority labels

Labels live in `label` table. The status/priority editor lists them, plus an "Add label" option (admin+). Editing a label (title, color) is a separate modal accessed from the column settings. Renaming a label updates the one row; cells continue to reference it by id. The current schema uses stable id references precisely to avoid cascade-rename bugs.

### Updated-by / created-by / created-at columns

Read-through. Renderer reads `task.updated_by` (joined to `profile`) and `task.updated_at`. No editor (read-only). Useful especially for the table's "Last updated" column visible in the screenshots.

### Tags column

Free-form tags stored in `cell.json_value.values: string[]`. No `tag` table; we don't need cross-task search yet. Aggregator unique-counts. Filter ops: `contains`, `not_contains`, `is_empty`. If we later need typed tags with colors per workspace, promote to a `tag` table; data shape is forward-compatible.

### Formula column

The schema accepts type `formula`. The renderer shows "—" and links to a "coming soon" tooltip. The expression engine is its own future epic — likely a small DSL referencing `{Column Title}` parsed via [Chevrotain](https://chevrotain.io/) or similar. Listed here so the column type id is stable from day one.

### Activity log payloads

Cell changes record:

```json
{
  "action": "task.cell_changed",
  "task_id": "...",
  "column_id": "...",
  "payload": {
    "columnType": "status",
    "from": { "labelId": "..." },
    "to": { "labelId": "..." }
  }
}
```

The activity feed renderer ([09](09-comments-activity.md)) uses the cell-type registry to render "from/to" via `def.Cell` in a compact form.

### Server actions

In addition to those from [06](06-groups-tasks-table.md):

- `createColumn`, `updateColumn`, `reorderColumn`, `duplicateColumn`, `deleteColumn`, `changeColumnType`
- `createLabel`, `updateLabel`, `deleteLabel`, `reorderLabel`
- `setCellValue` (the workhorse)
- `bulkSetCellValue({ taskIds, columnId, value })` for bulk-action toolbar from [06](06-groups-tasks-table.md)

### Performance

- `<TableCell />` is `React.memo`'d on `(value, config)`; rendering 5000 × 8 = 40,000 cells must not retrigger on unrelated updates.
- The cell store keys cells by `${task_id}:${column_id}` for O(1) lookup.
- Editor mounts only when the cell is opened (lazy via `<Suspense>`).

### Storybook coverage

Each cell type has stories: empty, populated, in-edit-mode, with config variations. This is the single best argument for keeping Storybook ([01](01-foundation.md) open question).

## Visual fidelity requirements

This is the epic where every cell type in the registry gets its visual contract. Cells are 90% of the board's surface area — fidelity here is the difference between "looks like Monday" and "looks like a styled HTML table." Refer to [`component-system.md §2.4`](component-system.md#24-cell-components-per-type) for the per-type table.

Must-match across all cell types:

- **Cell skeleton** — `min-width: 140px`, `height: 36px`, `1px solid --color-border-strong` border. Don't deviate.
- **Focus state** — `outline: 1px solid --color-primary` (`#0073ea`) on inputs and contenteditable cells. Hover preview uses `outline: 1px solid --color-border-strong`.
- **Optimistic update** with no in-flight chrome — cells flick to the new value instantly; no spinner.

Per-type must-matches:

- **`<StatusCell />` / `<PriorityCell />`** — full-bleed bg = label color, centered white label text, **diagonal "fold" reveal in top-right on hover**. The fold animates `border-width 0 → 10×10 → 15×15px` over `--motion-base` with `transition-delay: .2s`. This is the single most distinctive interaction in the product — must match. Empty state bg `--color-label-gray` (`#c4c4c4`). See [component-system.md §3.4](component-system.md#34-statuslabeleditor-popover) for the locked spec (the original interaction was documented in `_status-priority-picker.scss` in commit `a5d47c2`).
- **`<StatusLabelEditor />` popover** — 152px-wide chips, gap 8px, white-text-on-color, "Edit Labels" button at bottom with `1px solid --color-border-strong` top border. See [component-system.md §3.4](component-system.md#34-statuslabeleditor-popover).
- **`<PersonCell />`** — 26px avatars, `-5px` overlap, white border, `+N` overflow tile. Empty state shows muted person glyph in `--color-fg-subtle`.
- **`<DateCell />`** — centered text input, hover text → `--color-primary`, focus border `--color-primary`.
- **`<NumberCell />`** — centered numeric input, hover reveals `+`/`−` icons in `--color-primary` and a `clear` chip top-right (bg `--color-surface-hover`, radius 3px) over `--motion-base`.
- **`<CheckboxCell />`** — centered icon, checked = `--color-primary`, hover wash `rgba(0,0,0,0.05)` over `--motion-base` (note: checked state is **primary blue**, not green).
- **`<UpdatedByCell />`** — 26px avatar + relative-time string (`2h`, `5d`, `3w`) computed via the `calculateTime` utility.
- **All other cell types** (`text`, `long_text`, `email`, `phone`, `country`, `link`, `tags`, `rating`, `currency`, `vote`, `week`, `location`, `formula`, `created_by`, `created_at_col`) — inherit the cell skeleton, follow the picker patterns above for editor chrome, use `<MenuList />` for any dropdowns.

Default seed labels (these must match exactly — they're the user's first impression of the system):

| Type | Title | Color |
|---|---|---|
| Status | Done | `#00C875` |
| Status | Working on it | `#FDAB3D` |
| Status | Stuck | `#E2445C` |
| Status | Waiting for review | `#A25DDC` |
| Status | Pending | `#579BFC` |
| Status | (empty) | `#C4C4C4` |
| Priority | Critical | `#333333` |
| Priority | High | `#E2445C` |
| Priority | Medium | `#FDAB3D` |
| Priority | Low | `#579BFC` |
| Priority | (empty) | `#C4C4C4` |

These must be inserted in the [02](02-supabase-schema.md) seed; this epic relies on them existing.

**Aggregation row** at group footer: typography 14px (font-weight 500 for the number, 12px for "sum" sub-label in `--color-fg-muted`). See [component-system.md §2.2](component-system.md#22-groupheader) for the locked spec.

## Tasks

1. **Define the `CellTypeDef` interface** in `lib/cells/types.ts` with full TS strictness.
2. **Build the registry scaffolding** in `lib/cells/registry.ts` with empty stubs.
3. **Build the cell editor orchestrator** (`<CellEditor />`) that reads `def.Editor` and handles open/close/save/cancel + optimistic update.
4. **Implement cell types** — one PR per type or grouped:
   - Group A (text-y): `text`, `long_text`, `email`, `phone`, `country`, `link`
   - Group B (numeric): `number`, `currency`, `rating`, `checkbox`
   - Group C (label-backed): `status`, `priority`
   - Group D (people/time): `person`, `date`, `timeline`, `week`
   - Group E (collection): `tags`, `vote`, `file` (file links to [10](10-attachments.md) attachments)
   - Group F (derived/special): `updated_by`, `created_by`, `created_at_col`, `location`
   - Group G (stub): `formula` (renderer shows "—")
5. **Add-column modal** with type picker + per-type config editor.
6. **Column header dropdown** (rename/sort/filter/hide/duplicate/move/change-type/settings/delete).
7. **Column reorder** via dnd-kit horizontal Sortable.
8. **Column resize** (drag the header edge); persist width in `view.config` per user.
9. **Column visibility toggle** (per user, persisted via [11](11-filtering-views.md) saved views).
10. **Type conversion** logic: per-source `convertTo` map, transactional column update + cell migration.
11. **Aggregations**: implement `def.aggregate` for every type; render in group footer.
12. **Server actions** for columns, labels, cells.
13. **Bulk cell set** for [06](06-groups-tasks-table.md)'s bulk toolbar.
14. **Activity payload renderers** in [09](09-comments-activity.md) consume the registry.
15. **Storybook stories** for every cell type (if Storybook is in use).
16. **Tests**: unit tests for codecs, comparators, filter matchers, conversions; Playwright E2E for "add status column → set value on three tasks → group by status (preview only) → change column type to text → values become titles."

## Definition of done

- A user can configure a board with the columns shown in the audit screenshots: text, status, person, date, number/currency, file, link, tags, rating, last-updated.
- Adding a column shows a typed picker; default config is sensible.
- Setting a cell value updates instantly (optimistic), syncs to the database, and shows in the activity feed.
- Reordering columns via DnD works.
- Resizing a column persists across reloads (per user).
- Group footers show per-type aggregations correctly.
- Changing a column type from text → number on a column with values prompts a confirmation, runs the conversion, and is reversible only by changing type back (no automatic undo).
- Renaming a status label updates one row; tasks remain consistent (no cascade).
- Storybook (if present) covers all 24 cell types.
- Type conversion test suite exercises every documented `convertTo` path.

## Open questions

- **`tags` typed vs free-form.** Free-form is simpler. If a user wants color-coded tags consistent across the board, they should use a status column. Document that explicitly.
- **Per-task subitems.** Defer; revisit after this epic. Subitems = a child board hung off each task. Big.
- **Mirror / connect-boards / dependency.** Cross-board cell types. Out of scope for v1; document in 00 as deferred.
- **Formula DSL.** Decide later. For v1, leave the type registered with a "coming soon" renderer.
- **Number column suffix vs unit.** Should "%" be a number column with suffix or its own type? Recommend `number` with `config.suffix`.
- **`location` column input UX.** Geocoder vs manual lat/lng. Defer; ship manual-input first; integrate Mapbox later.
- **`week` column.** Mostly an HR/scheduling tool. Worth shipping in v1?
- **Read-only "lookup" / "rollup" cell types.** Out of scope until cross-board relations land.
- **Aggregation override per group**. Aggregations are board-level by default; per-group overrides ([11](11-filtering-views.md))?
