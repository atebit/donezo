# Epic 07 — Followup Round 2

## Review summary

- **Stage reviewed:** Stage 5 (slices S19–S22). Commit range `09582e3..HEAD`. Four commits: `f773dc9` (S19), `5ccc5f6` (S20), `06b49f1` (S21), `c938611` (S22).
- **Verdict:** FOLLOWUP REQUIRED (one structural integration gap that breaks column DnD end-to-end; everything else CLEAN).

### Definition-of-done items met

- **S19** — `<StickyHeader />` now renders one `<ColumnHeader />` per visible column. Title column resolved as min-position text column with safe fallback to first visible column. Sticky-left positioning on title column preserved. `<BoardLevelCheckbox />` and `<AddColumnButton />` retained at left/right edges. Hidden-column filter via `columnPrefsByBoard` works. `<ColumnResize />` wraps each header (resize verified working). `<ColumnReorder />` SortableContext wraps non-title columns.
- **S20** — `<TaskRow />` renders title cell + per-column `<TableCell />` for each visible non-title column. Widths read from `columnPrefsByBoard` with 140px fallback. `<DndProviders>` accepts an optional `onColumnReorder` callback and dispatches `kind === "column"` correctly without breaking task/group dispatch (overKind narrowing for tasks intact). `<BoardTable />`'s `handleColumnReorder` computes new position via `positionBetween` with insert-before/insert-after based on direction-of-move, optimistically applies `applyColumnUpsert`, calls `reorderColumn`, and reverts on error.
- **S21** — `<GroupFooter />` created and wired as a `kind: "group-footer"` virtualizer row (not a wrapping div — guardrail #29 satisfied). `RowEntry` union extended; `DEFAULT_HEIGHTS["group-footer"] = 36` matches `h-9`; `rowKey` returns `gf:${group.id}`. Aggregations are computed per visible non-title column via `def.aggregate(values, def.aggregations[0], { ...config, _labels })`. Defensive try/catch returns "—" on throw. Aggregate signature matches `lib/cells/types.ts` (3-arg `(values, kind, config)`). Title slot renders empty (correct — aggregations don't apply to titles). Leading 60px spacer matches TaskRow's stripe(6) + drag handle(~22) + checkbox(32) chrome.
- **S22** — `<BulkActionBar />` Apply column value flow now wired: Step-1 column picker (filtered to the 9 bulk-settable types per Q10) → Step-2 inline editor for the chosen column. `bulkSetCellValue` called with `{ taskIds, columnId, value }`. Snapshot-based optimistic + revert. `BulkApplyConfirmDialog` (Base UI `<Dialog>`) gates selections > 25 (CONFIRM_THRESHOLD = 25) — guardrail #8 satisfied (no `window.confirm`). Editors rendered inline regardless of `editorMode` to avoid nested popovers; this is sound because all S15-normalized editors are content-only.
- **Guardrails** — #5 (Base UI Popover/Dialog), #6 (cell skeleton consumed via `getCellDef`), #7 (cell types referenced by short string id), #8 (no `window.confirm`), #11 (N/A — no creates in stage 5), #15 (one new `as any` in BulkActionBar:724 with `biome-ignore` rationale; precedent already established in `CellEditor.tsx` and `TableCell.tsx` per Followup-1's "intentionally NOT followups" — accepted), #16 + #17 (no role-gating regressions; column write actions remain `>= admin` server-side), #20 (no `task.board_id` writes), #25 (Apply column value is now real, not a stub), #26 (file scope respected — each slice touched only its authorized files), #29 (GroupFooter is a virtualizer row, not a wrapping div).
- **Lint + typecheck** — confirmed clean per orchestrator briefing (291 files).

### Definition-of-done items NOT met

1. **Column header drag-and-drop reorder is non-functional end-to-end.** Two compounding gaps:

   **Gap A — `<ColumnHeader />` never integrates `useColumnSortable`.** Reading `components/board/table/ColumnHeader.tsx` (128 lines, last touched in S17 commit `f9aac16`), the file imports nothing from `./ColumnReorder` and never registers a sortable node. No `setNodeRef`, no spread of `attributes`/`listeners`/`style`. The `useColumnSortable(columnId)` hook exported by S18's `ColumnReorder.tsx` (which itself documents `// composed into ColumnHeader by S19`) has zero callers in the repo (`grep -rn useColumnSortable components/` returns only the definition site). The result: there is no DOM element registered with dnd-kit as draggable for any column header. Drag attempts produce no `onDragStart`/`onDragEnd` events.

   **Gap B — `<StickyHeader />` is rendered OUTSIDE the `<DndProviders>` (`<DndContext>`) wrapper.** In `components/board/table/BoardTable.tsx` lines 766–782, the JSX tree is:
   ```
   <div ref={containerRef}>
     <StickyHeader />                ← OUTSIDE
     <TableScrollContext.Provider>
       <DndProviders>                 ← starts here
         <SortableContext items={groupIds}>
           <TableVirtualizer ... />
         </SortableContext>
       </DndProviders>
     </TableScrollContext.Provider>
     <BulkActionBar />
   </div>
   ```
   Even if Gap A were fixed, `<ColumnReorder />`'s `<SortableContext>` (rendered inside StickyHeader) would have no parent `<DndContext>`, so `useSortable()` would warn / no-op and drag-end events would never reach `handleColumnReorder`.

   This contradicts S19's DoD line: "Column reorder (drag) and resize (drag handle) both work via S18 wrappers." Resize works (ColumnResize wraps each header). Reorder does not.

   **Root cause analysis (for the record, not a fix-target):** S18's spec scope was `ColumnReorder.tsx` + `ColumnResize.tsx` + `use-column-resize.ts` only — forbidden from touching `ColumnHeader.tsx`. S19's scope was strictly `StickyHeader.tsx` only — also forbidden from touching `ColumnHeader.tsx`. Neither slice owned the file where `useColumnSortable` had to be composed. The S19 executor should have escalated when discovering the integration gap; instead it shipped a SortableContext with no sortables inside it. This is a planning-phase scoping miss as much as an execution miss.

### Other observations (intentionally NOT followups)

- **Per-row store reads in `<TaskRow />` and `<GroupFooter />`.** Both components subscribe to `columns` / `columnPrefsByBoard` / `boardId` directly. O(R) reads where R is visible-row count, but each is cheap and Zustand selectors are referentially-equal. Documented in S20 done-report as acceptable v1.
- **Title-column identification logic duplicated three times** (StickyHeader S19, TaskRow S20, GroupFooter S21). Not DRY but each duplicate is identical and behaves consistently. Extract to `lib/board/title-column.ts` in epic-14 polish, not now.
- **`as any` cast at `BulkActionBar.tsx:724`** for `column.settings as any`. Has biome-ignore rationale. Borderline against guardrail #15, but precedent set by Followup-1's accepted `as any` in `CellEditor.tsx` / `TableCell.tsx` (4+1 sites). Same architectural cause: the per-type config types are heterogeneous and cannot be discriminated at the orchestrator boundary without a per-type dispatch wrapper. Accepted.
- **`@ts-expect-error` for `columnId` extra prop on `<EditorComponent />` (BulkActionBar:729)** is consistent with guardrail #15's allowance. Acceptable.
- **No `applyCellDelete` revert path in BulkActionBar** for taskIds where no prior cell existed. Documented v1 limitation in S22 spec; user is informed via toast. Acceptable.
- **GroupFooter passes `(TValue | null)[]` as `values` to `def.aggregate`**, while the type signature is `TValue[]`. The defensive try/catch absorbs any aggregator that throws on null. Per-type aggregators that pre-filter nulls (sum, avg) work fine; aggregators that count nulls (count_empty) work fine. No observed runtime regression. Tighten in epic-14 polish, not now.

---

## Followup slices

### Followup slice F2 — wire `useColumnSortable` into `<ColumnHeader />` AND move `<StickyHeader />` inside `<DndProviders>`

**Owner:** epic-executor (sonnet) · **Sequential, two-file scope (one file each).**

**Files (only):**
- `components/board/table/ColumnHeader.tsx` (modify — integrate `useColumnSortable` so each column header is a draggable node)
- `components/board/table/BoardTable.tsx` (modify — relocate `<StickyHeader />` to live inside `<DndProviders>` so the SortableContext inside StickyHeader has a parent DndContext; do NOT change any other behavior)

**Forbidden scope:** any other file. No changes to `ColumnReorder.tsx`, `ColumnResize.tsx`, `DndProviders.tsx`, `TaskRow.tsx`, `GroupFooter.tsx`, `BulkActionBar.tsx`, `StickyHeader.tsx`, or any cell component. No new files.

**Spec:**

1. **`<ColumnHeader />` (Gap A):**
   - Import `useColumnSortable` from `./ColumnReorder`.
   - Call `const { setNodeRef, attributes, listeners, style, isDragging } = useColumnSortable(column.id);` at the top of the component body.
   - Apply `setNodeRef` to the outer `<div>` and merge the returned `style` into the existing `style` prop (preserving `width: 'var(--size-cell-w)'`). When `isDragging`, set `opacity: 0.85` and `zIndex: 2` on the inline style (mirror group/task pattern in epic-06).
   - Spread `{...attributes} {...listeners}` on the outer `<div>` (Monday-style: the entire header is the drag handle — no separate grip icon). The chevron button, EditableTitle input, sort indicator, and resize handle remain interactive — Base UI / native-input event semantics already stop drag activation when those elements receive pointerdown. The 4px PointerSensor activation distance defined in `DndProviders` further protects against accidental drags during click/edit. **Do not** add an explicit drag-handle button.
   - **Title column case:** the title column is intentionally non-draggable (it stays sticky-left). To preserve this, accept an optional `draggable?: boolean` prop on `<ColumnHeader />` (default `true`). When `draggable === false`, skip the `useColumnSortable` call entirely and render the existing static `<div>` (no `setNodeRef`, no `attributes`, no `listeners`). The title column header in `<StickyHeader />` then passes `draggable={false}` (this is a one-line change in StickyHeader, but **StickyHeader is NOT in the file scope of this followup** — instead, restrict the change to: read `column.position` and any other free signal already in `Column` to detect title? Better: lift the decision to the prop. Since touching StickyHeader would expand scope, take this alternative: **always** call `useColumnSortable`, but in StickyHeader the title-column `<ColumnHeader />` is wrapped in a `sticky left-0` div that already prevents reorder visually — and dragging it would still fire `handleColumnReorder` in BoardTable, which compares positions and would actually allow re-sorting it. To avoid that bug while staying in-scope, **add the optional `draggable?: boolean` prop to `<ColumnHeader />` and update `<StickyHeader />` in the same followup.** Add StickyHeader.tsx to the file scope (single-line change: add `draggable={false}` on the title-column `<ColumnHeader />`).

   Updated **Files (only)** for clarity: `ColumnHeader.tsx`, `StickyHeader.tsx`, `BoardTable.tsx`.

2. **`<BoardTable />` (Gap B):**
   - Move the `<StickyHeader />` render call from line 767 (currently above the `<TableScrollContext.Provider>`) to be the first child INSIDE `<DndProviders>`, BEFORE the `<SortableContext items={groupIds}>` wrapper. The new structure should be:
     ```
     <div ref={containerRef} className="flex flex-col flex-1 min-h-0">
       <TableScrollContext.Provider value={scrollContextValue}>
         <DndProviders
           onGroupReorder={handleGroupReorder}
           onTaskReorder={handleTaskReorder}
           onColumnReorder={handleColumnReorder}
         >
           <StickyHeader />
           <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
             <TableVirtualizer ref={tableRef} rows={rows} renderRow={renderRow} />
           </SortableContext>
         </DndProviders>
       </TableScrollContext.Provider>
       <BulkActionBar />
     </div>
     ```
   - Do NOT move `<BulkActionBar />`. Do NOT alter the `containerRef` / keyboard listener attachment site. Do NOT change `handleColumnReorder` / `handleTaskReorder` / `handleGroupReorder` logic.
   - Verify the existing sticky positioning still works: `<StickyHeader />` uses `sticky top-0` + `--z-sticky`. Since the new parent (`<DndContext>` from `DndProviders`) is a fragment-equivalent `<DndContext>` wrapper that does NOT introduce a new positioned/overflow ancestor, sticky positioning remains relative to the same scroll container (the virtualizer's `<div ref={scrollRef}>` is still the closest scroll ancestor). **However**, sticky positioning depends on the sticky element being a direct or near-direct child of a scrollable ancestor's flow. Confirm that `<DndContext>` does not render a wrapper element that breaks the sticky behavior. If sticky breaks after the move, escalate — the fix may require a different DnD topology (e.g., wrapping the entire `<div ref={containerRef}>` in `<DndProviders>`, or hoisting the column-DnD context separately).

3. **`<StickyHeader />` (Gap A part 2 — title column non-draggable):**
   - Find the line that renders the title column header (currently inside the `sticky left-0` wrapper div). Pass `draggable={false}` to `<ColumnHeader column={titleColumn} />`. No other changes.

**Definition of done:**
- `useColumnSortable` is called in `<ColumnHeader />` and the returned `setNodeRef` / `attributes` / `listeners` are applied to its outer `<div>`.
- The title column passes `draggable={false}` and renders without sortable wiring.
- `<StickyHeader />` is rendered inside the `<DndContext>` (from `<DndProviders>`).
- Dragging a non-title column header reorders columns: optimistic reorder in store → `reorderColumn` server action → success reconciles, failure reverts and toasts. Verify by manual smoke test against a board with ≥ 3 columns.
- The title column is not draggable; pointer-down on the title header does not initiate a drag.
- Group reorder and task reorder still work (the change is purely additive with respect to the existing DnD wiring).
- Column resize still works (the resize handle is `<button>` with `position: absolute right-0` inside the ColumnResize wrapper; it is a focusable interactive element that should not initiate a drag — confirm by manual test).
- Inline column rename (clicking the EditableTitle) still enters edit mode without triggering a drag (4px activation distance protects this).
- `pnpm typecheck` and `pnpm lint` pass clean.

**Escalation triggers:**
- If sticky positioning of `<StickyHeader />` breaks after relocating it inside `<DndProviders>`, escalate. Do NOT add wrapper divs or restructure the layout to compensate without architectural review (guardrail #29's spirit applies here too).
- If column drag visually overlaps / clips under `<BulkActionBar />` or `<TaskOverflowMenu />` due to z-index conflicts, escalate — the `--z-sticky` (2) vs drag-overlay z-index hierarchy may need a follow-up tweak that is out of scope for a "wire it up" fix.
- If `useColumnSortable` returns props whose types do not cleanly spread onto a `<div>` (e.g., type mismatch on `attributes`), do NOT use `as any` — escalate. The fix may be a small type adjustment in `ColumnReorder.tsx` (which is then in scope for this followup if and only if the issue is a true type bug, not a design change).

**Guardrails applied:** #5 (Base UI N/A — dnd-kit), #15 (no `as any` — use the typed return of `useColumnSortable`; if a type mismatch surfaces, escalate rather than cast), #26 (file scope: `ColumnHeader.tsx`, `StickyHeader.tsx`, `BoardTable.tsx` only), #29 (no new layout wrappers; relocate, don't add).

---

