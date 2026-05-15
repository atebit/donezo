# Epic 16 — Board Grid Remediation

## Goal

The board view is the highest-stakes UI in the product and it currently misses the bar set by [06](06-groups-tasks-table.md) and [07](07-column-system.md). In-browser inspection (May 2026) showed the table painting groups + rows + footers that don't share a column axis, status cells rendering as gray rectangles, the status editor popping at viewport `(0,0)` instead of next to its cell, every group footer aggregating to `count` regardless of column type, group color stripes that don't read as per-group identity, and a sidebar/view-tab strip that desyncs from the active workspace. This epic re-grounds the table on a single shared column grid, fixes the cell editor anchor model, makes footer aggregation type-aware, restores per-group color identity, and cleans up the sidebar + view-tab + density-toggle polish gaps.

It is a *remediation* epic, not a re-do — the data model, cell registry, server actions, Realtime wiring, and activity logging from 06/07/08/09 stay intact. Only the rendering pipeline + a handful of state-wiring bugs change.

## Why this is its own epic

Epics 06 and 07 already landed and were reviewed. The bugs found in the May 2026 in-browser pass cross both surfaces (table chrome from 06, cell rendering from 07) plus stragglers from 05 (sidebar workspace state) and 11 (view tabs / density). Rolling them back into 06 or 07 would re-open closed epics and muddy their definition of done; rolling them into 14 (a11y/polish) would inflate that epic past its scope. A dedicated remediation epic keeps the diff reviewable and the rollback story clean.

It is also the first epic where the definition of done explicitly requires an **in-browser smoke pass against a fresh seeded board** — the same lesson called out in the pre-epic-09 and epic-15 retrospectives. Type-checking and Playwright cannot catch grid misalignment or popover anchor bugs.

## In scope

### Table grid (the big one)
- Replace the three flex strips in `components/board/table/` with **one CSS grid** that owns the column axis. Header row, every group header + body + footer, and the board's "+ add task / + add group" affordances all render as children of that grid (or nested grids that inherit the same `grid-template-columns`).
- Per-group **column header repeat** inside each group section (the [Monday pattern](#references)) — currently we have one global header and the per-group color stripe is the only thing tying rows to their group.
- Sticky-top header row and sticky-left title column survive the grid switch (CSS `position: sticky` on the appropriate grid items).
- Group accent color applied to: group title text, the left stripe of every row in the group, the group header's "+ Add task" footer, and the group footer aggregate row. One CSS custom property (`--group-accent`) set on the group container so every descendant reads it.
- Group footer is hidden when the group has zero tasks (currently renders `0 count` × N).

### Cell rendering polish
- Empty text cells render visually empty (no `"Empty"` placeholder text), with a hover affordance instead.
- Set status cells render as **colored pills with label text inside** — currently they render as gray rectangles even when set. Empty status cells render as a subtle dashed-border tile to read as "click to set," not as a filled gray block.
- Column header shows the **user-given column name**, not the type label. Type is shown as a leading icon. (Default name on create remains the type label, but it must be editable in place.)

### Status / cell editor popover anchor
- The cell editor popover (`components/cells/CellEditor.tsx`) currently mounts a hidden `<span>` as `Popover.Trigger` with no anchor, which is why it renders at viewport `(0,0)`. Switch to Base UI's `anchor` prop pattern: pass the actual cell DOM node (looked up by `data-task-id` + `data-column-id`, or threaded through a context) into `Popover.Root` as the anchor, keep the `Popover.Portal` wrapper (avoids the SSR error called out in memory `donezo-base-ui-popover-portal.md`), and drop the hidden trigger span.
- All cell editors that use this orchestrator inherit the fix; verify by opening status, priority, person, date, number editors.

### Group footer aggregation defaults
- Footer aggregation is already type-aware (`def.aggregate`), but every type currently defaults to `count` because that's the first entry in most `aggregations` arrays. Audit each cell type's default and pick the one that matches Monday's behavior:
  - `date` / `timeline` → **range** (`min … max`), shown as a date-range pill.
  - `number` / `currency` / `rating` → **sum**, shown with the type's display formatter.
  - `status` / `priority` / `tags` → **label distribution** rendered as a stacked proportional bar (per the locked spec in [component-system.md](component-system.md)).
  - `person` → **unique count** with avatar stack.
  - `text` / `long_text` / `link` / `email` / `phone` / `country` / `location` → **count of non-empty** (current default is fine; render as `N / M` not bare `N count`).
  - `checkbox` → **% checked**.
  - `file` → **total count of files**.
- The default-aggregation pick is a property of the cell type definition (a new `defaultAggregation: AggregationKind` field, or reorder `aggregations[0]`), so users can still override per column via the column header menu (already wired by 07).

### Sidebar workspace state
- `WorkspaceSwitcher` falls back to "Select workspace" when `currentWorkspace` is null, but the workspace IS active (the breadcrumb proves it). Trace the state wiring from the board RSC down to the sidebar client component — the server-loaded workspace must reach the switcher, not just the breadcrumb. Likely a missing context provider or a server prop that isn't being passed past the board route boundary.
- The "Select a workspace to see your boards" empty state must not render when a workspace is active. List that workspace's boards in the sidebar instead.

### View tabs
- `createView` does not check for name collisions; users have ended up with duplicate "Main table" and "My view" tabs. Add a uniqueness constraint at the server-action level (and a friendly UI for "Main table (2)" if the user genuinely wants a second). Decision required: should `name` be unique per `(board_id, name)`? Recommend yes, with an auto-suffix on collision. See open questions.
- Visually distinguish the active view tab (current state is hard to read).
- Move the **density toggle** (`Compact / Default / Spacious`) out of the primary toolbar and into the view's settings overflow menu — it's a per-view preference, not a board-level top-level action.

### Item detail drawer scaffold (stretch)
- Monday's right-side drawer (Updates, Files, Activity Log, custom views) is a first-class surface. We have the data ([09](09-comments-activity.md), [10](10-attachments.md)) but no entry point. Add a row-hover "open updates" affordance + a minimal drawer that opens to a tab strip with Updates/Files/Activity Log placeholders wired to existing data. Full polish stays in [14](14-mobile-a11y-polish.md). **Stretch — drop from in-scope if it threatens parallel-safety.**

## Out of scope

- Touching the data model, server actions, RLS, Realtime, or activity logging — those stay as 02/04/06/07/08/09 left them.
- Adding new cell types or new aggregation kinds. We only re-order existing `aggregations` arrays and add a `defaultAggregation` field if needed.
- Reworking column reorder / resize / DnD — that's already shipped and not the source of the misalignment.
- Mobile responsive treatment of the new grid — defer to [14](14-mobile-a11y-polish.md).
- Building the full Updates composer / Activity Log filtering UI — those are 09's job; we only provide the entry point.
- Investigating the pink/red gradient in screenshot 2. It is almost certainly Next.js dev-mode error/HMR overlay, not our code. If a smoke pass on a clean prod build reproduces it, file a follow-up.

## Dependencies

- [06](06-groups-tasks-table.md) — table renderer is being rewritten on top of its data + DnD layer.
- [07](07-column-system.md) — cell registry is the substrate; we only touch defaults + the editor anchor.
- [05](05-workspaces-boards.md) — sidebar/workspace state plumbing.
- [09](09-comments-activity.md) — Activity Log entry point if the stretch drawer ships.
- [11](11-filtering-views.md) — view tabs + density persistence.
- [component-system.md](component-system.md) §2.2 (`<GroupHeader />`), §2.3 (`<TaskRow />`) — the locked visual contracts this remediation must finally hit.
- [design-system.md](design-system.md) — `--color-group-1..12` tokens, `--motion-base`, `--color-surface-active` "on-typing" wash already exist; reuse them.

## Architecture & design choices

### One grid to rule them

The board table becomes a single CSS grid with a column-template derived from the column list:

```tsx
const gridTemplate = useMemo(
  () =>
    [
      "minmax(--checkbox, --checkbox-width)",
      `minmax(${TITLE_MIN_WIDTH}px, ${getColumnWidth(titleColumn)}px)`,
      ...otherColumns.map((c) => `minmax(${MIN_WIDTH}px, ${getColumnWidth(c)}px)`),
      "auto", // add-column affordance
    ].join(" "),
  [columns, columnWidths],
);
```

Header row, each group's header, each task row, each group footer, and the "+ add task" / "+ add group" affordances are direct grid items (or `display: contents` containers whose children participate in the parent grid). This guarantees the column axis is shared by construction — there is no way for header + body + footer to drift.

The TanStack Virtual integration stays: the virtualizer renders a flattened list of "row descriptors" (group-header, task, group-footer, add-task) and each descriptor renders as a grid item with `grid-column: 1 / -1` for the full-width descriptors (group header, add-task footer) or with each cell in its own grid cell for task rows.

Sticky behavior: `position: sticky; left: 0` on the title cell of each row, `position: sticky; top: 0` on the column header row. The grid does not break sticky positioning as long as the row containers don't add `overflow: hidden`.

### Per-group color as a CSS custom property

```tsx
<div
  className="group-section"
  style={{ "--group-accent": `var(${colorToToken(group.color)})` } as CSSProperties}
>
  <GroupHeader />   {/* title text: color: var(--group-accent) */}
  <GroupColumnHeader />  {/* repeated column header, top border var(--group-accent) */}
  {tasks.map((t) => <TaskRow task={t} />)}  {/* left stripe: var(--group-accent) */}
  <GroupFooter />   {/* top border: var(--group-accent) */}
  <AddTaskRow />
</div>
```

One CSS variable, set once per group. Every descendant reads it. No prop drilling.

### Cell editor anchor

Current (broken):
```tsx
<Popover.Trigger render={<span />} style={{ display: "none" }} aria-hidden="true" />
<Popover.Portal>
  <Popover.Positioner sideOffset={0} align="start">
```

Target: use Base UI's controlled anchor pattern. The cell's DOM node (which already has `data-task-id` + `data-column-id`) is captured by the orchestrator via a ref. `Popover.Root` is given that anchor and the trigger is dropped entirely:

```tsx
<Popover.Root open onOpenChange={onClose}>
  <Popover.Portal>
    <Popover.Positioner anchor={anchorEl} sideOffset={0} align="start">
      <Popover.Popup>
        <def.Editor {...editorProps} />
      </Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>
```

`anchorEl` is the cell node looked up on open. The Portal wrapper stays (memory: `donezo-base-ui-popover-portal.md`).

### Type-aware footer defaults

A new field on `CellTypeDef`:

```ts
defaultAggregation: AggregationKind;
```

The footer renderer reads `def.defaultAggregation` first, falls back to `def.aggregations[0]` for back-compat. Per-cell-type defaults are listed in the in-scope section above.

Render side: the `aggregate(...)` return type extends from `string` to `string | AggregateRenderDescriptor` so a `label_distribution` aggregation can return a structured payload (`{ kind: "label_distribution", segments: [{labelId, count, color}] }`) that the footer renderer paints as the stacked bar. Existing string returns continue to render as text.

### Sidebar workspace state

Audit task: trace `currentWorkspace` from the RSC layout down to `WorkspaceSwitcher`. If the prop isn't reaching it, prefer a server-loaded `<WorkspaceProvider>` context so every sidebar widget reads the same source of truth. Avoid a parallel client fetch — the RSC already has the workspace.

### View name dedupe

```ts
// server action createView
const { data: existing } = await supabase
  .from("view")
  .select("name")
  .eq("board_id", input.boardId);

const name = uniqueName(input.name ?? "Main table", existing?.map((v) => v.name) ?? []);
```

`uniqueName("Main table", ["Main table"])` → `"Main table (2)"`. Simple, no schema change.

## Tasks

1. **Replace flex layout in `BoardTable` + `StickyHeader` + `TaskRow` + `GroupHeader` + `GroupFooter` with a single CSS grid.** Derive `grid-template-columns` from the column list. Confirm sticky-top header and sticky-left title column survive.
2. **Add a `GroupColumnHeader` component** rendered inside each group section, sharing the same grid-template.
3. **Set `--group-accent` per group section** and update all group-themed surfaces to read it.
4. **Hide the group footer when `tasks.length === 0`.**
5. **Status cell rendering**: when value is set, render colored pill with label text. When unset, render an empty-state tile (no gray block). Audit priority cell for the same gap.
6. **Text/long-text cells**: drop `"Empty"` placeholder; rely on hover affordance.
7. **Column header**: show user-given name (default to type label on create); type icon is a leading glyph.
8. **Fix cell editor anchor in `CellEditor.tsx`**: capture cell DOM node ref, pass to `Popover.Positioner` anchor, remove hidden trigger.
9. **Add `defaultAggregation` to `CellTypeDef`** and fill in per-type defaults per the table in In Scope.
10. **Extend `aggregate(...)` return type** to support structured payloads for label-distribution and date-range; render the new payloads in `GroupFooter`.
11. **Sidebar workspace state**: trace the `currentWorkspace` prop, fix the missing wiring so `WorkspaceSwitcher` shows the active workspace and the boards list populates.
12. **View name dedupe** in `createView` server action via `uniqueName(...)` helper.
13. **Active view tab styling** — distinguish active from inactive in the tab strip.
14. **Move density toggle** from primary toolbar into a view-settings overflow menu.
15. **Stretch — item detail drawer scaffold**: row-hover affordance + drawer with Updates/Files/Activity Log tab strip wired to existing data. Drop from scope if it endangers parallel-safety.
16. **In-browser smoke pass** on a freshly seeded board with all 26 cell types represented across at least 3 groups. Add a Playwright test that captures the column header + first row of each group and asserts pixel x-position equality of every cell.

## Definition of done

- Loading a board renders one CSS grid where the column header's column-N x-position equals every task row's column-N x-position equals the group footer's column-N x-position. Verified by a Playwright pixel-position test.
- Each group renders its own re-displayed column header above its rows, and its accent color appears on the group title, the row left stripes, and the footer top border.
- Empty groups do not render a footer aggregate row.
- Status (and priority) cells render as colored pills when set; as a click-to-set affordance when unset.
- Opening any cell editor (status, priority, person, date, number) opens a popover **next to the triggering cell**, not at viewport origin. Verified across two viewports (1280×800 and 1920×1080) by a Playwright test.
- Each cell-type's group footer aggregation matches the per-type table in In Scope. Label-distribution and date-range render as their structured payloads.
- Sidebar shows the active workspace and that workspace's boards on every board page. The "Select a workspace…" empty state never shows while a workspace is active.
- `createView` returns a unique view name. Duplicate "Main table" tabs cannot be created via the UI.
- The active view tab is visually distinct from inactive view tabs.
- The density toggle no longer occupies primary toolbar space.
- Playwright E2E covers: open board → confirm column alignment → open status editor on a row → confirm anchor → switch workspace via sidebar → confirm boards list updates → create a new view named "Main table" → confirm it auto-suffixes.
- An in-browser smoke pass has been performed and documented in the PR description (screenshots of the seeded board).

## Open questions

- **View name policy**: auto-suffix on collision (`"Main table" → "Main table (2)"`) vs. reject with a UI error? Recommend auto-suffix — matches Google Drive / Figma behavior and avoids a modal.
- **Stretch drawer**: in or out? Including it makes the epic substantially bigger and the drawer is partially redundant with future [09](09-comments-activity.md) work. Recommend **drop from scope**, file as its own mini-epic 17.
- **Per-group column header**: Monday repeats it per group; is that the right call when there are 10+ groups (the header appears 10+ times)? Recommend yes for parity, and revisit if it becomes a scroll-perf issue.
- **Title column in the registry**: currently special-cased outside the cell registry. Worth bringing into the registry so it participates in the same code paths (aggregation, filtering, etc.)? Probably yes long-term, but **out of scope here** — would expand the epic past remediation.
- **Pink/red gradient banner in screenshot 2**: confirmed not our code based on the audit. If a clean prod build reproduces it, open a follow-up.

## References

- May 2026 in-browser comparison vs. real Monday instance (screenshots in PR description on landing).
- Memory: `donezo-base-ui-popover-portal.md` (keep Popover.Portal wrapper).
- Memory: `donezo-pre-epic-09-bugfix-pass.md`, `donezo-epic-15-test-debt.md` (in-browser smoke pass is mandatory for this epic's DoD).
