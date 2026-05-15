# Epic 16 — Followup Round 1

## Review summary

- **Stage reviewed:** Stage 2 — Slice C (type-aware footer aggregation + status/priority empty tile + drop `"Empty"` placeholder) and Slice G (item-detail drawer scaffold). Diff range `1150721..c046ea6` on `epic/16-board-remediation`.
- **Verdict:** FOLLOWUP REQUIRED

### Definition-of-done items met

Slice C:
- `CellTypeDef.defaultAggregation?: AggregationKind` added (`lib/cells/types.ts`).
- `aggregate(...)` return type widened to `string | AggregateRenderDescriptor`.
- `lib/cells/aggregate-descriptors.ts` exports all 6 descriptor kinds.
- `components/board/table/AggregateRender.tsx` paints `text`, `count_non_empty`, `label_distribution`, `date_range`, `percent_checked`, `unique_count_avatars` (count-only — see gap below).
- `GroupFooter.tsx` `FooterCell` body fills the Slice A seam using `def.defaultAggregation ?? def.aggregations[0]`.
- All cell `def.ts` files for `date`, `timeline`, `number`, `currency`, `rating`, `status`, `priority`, `tags`, `person`, `text`, `long_text`, `link`, `email`, `phone`, `country`, `location`, `checkbox`, `file` carry a correct `defaultAggregation` (verified by grep).
- Status + priority unset state renders the new dashed `EmptyCellTile` (priority shares status's `Cell` via re-export, so one change covers both).
- Text-family cells (`text`, `long_text`, `email`, `phone`, `link`, `country`) drop the literal `"Empty"` string.
- 25 Vitest cases in `tests/unit/aggregate-render.test.tsx` covering each descriptor kind.
- `widget-data.ts` compatibility fix is minimal (one branch on `typeof raw === "string"`); accepted as scope-creep-but-necessary.

Slice G:
- `components/board/item-drawer/ItemDrawer.tsx` mounts a right-anchored Base UI `Sheet` with Updates / Files / Activity Log tabs and a disabled `+` placeholder tab with tooltip.
- `TaskRow.tsx` reveals a `MessageSquareIcon` speech-bubble button on row hover, with correct `aria-label` and `data-testid="open-item-drawer"`.
- `useItemDrawerStore` (Zustand) provides `open / close / setActiveTab / reset` with stable action references.
- Drawer closes via Esc, outside-click (Base UI Dialog default), and the explicit X button.
- `UpdatesTab`, `FilesTab`, `ActivityLogTab` consume existing data (comments / attachments / activity store slices).
- `ActivityLogTab` correctly passes `labelsByColumn` into the activity renderer ctx — Slice F's label hydration reaches the drawer cleanly.
- `ItemDrawer` is mounted on the table page, which is correct given the affordance only renders on `TaskRow`.

### Definition-of-done items NOT met

1. **`unique_count_avatars` descriptor renders count text only, not the avatar stack** that the epic doc and dispatch plan both name as the visual. Epic doc §"Group footer aggregation defaults": *"person → unique count with avatar stack."* Dispatch plan §"Slice C / DoD": *"avatar stack + count for person."* The current `AggregateRender.tsx:106-115` returns `<span>{count}</span>`. This is the visual the user will see in every populated person-column footer; shipping count-only misses the DoD.

2. **6 of 12 spec-listed cell types still render an em-dash `—` placeholder.** Dispatch plan §"Slice C scope" listed twelve `Cell.tsx` files that should "drop the `\"Empty\"` placeholder; render a blank cell that still hover-affords":
   - text, long_text, email, phone, link, country — **fixed** (literal "Empty" string removed).
   - number, currency, rating, week, date, location — **not changed**. Their pre-Stage-2 state was a muted em-dash `—`, not the literal word "Empty". Slice C left them alone, presumably reading the spec as targeting the literal string only.

   The epic doc §"Cell rendering polish" wording is ambiguous in isolation ("Empty text cells render visually empty (no `\"Empty\"` placeholder text), with a hover affordance instead"), but the dispatch plan generalized it to all twelve types — and the user intent (per epic §"Why this is its own epic" and the in-browser audit) is that editable-value cells should not show any default-state placeholder. The em-dash reads as "placeholder text" the same way "Empty" did.

### Other issues found

3. **Speech-bubble affordance position overlaps the drag handle by ~7px.** Both elements sit in the off-canvas zone left of the row. Drag handle: `absolute left-0 -translate-x-full` (occupies roughly `[-W_handle, 0]`). Speech-bubble: `absolute left-0 -translate-x-full ml-[-40px] w-7` (occupies `[-68, -40]`px). Per `component-system.md §2.3`, the drag handle is specified at `left: -47px, width: 41px` (occupies `[-47, -6]`). Overlap is small (`[-47, -40]`) and lives in the off-canvas zone, so it's not a layout bug — but the chat icon may sit underneath the drag glyph on hover. Visual smoke pass should verify before Slice E captures a screenshot.

   This is not a DoD failure on Slice G — the spec said "positioned per `component-system.md §2.3`" and §2.3 lists "comment-add icon (default)" reveals on hover without giving a pixel coord. Flagging for Slice E's visual smoke checklist rather than as a followup blocker.

4. **`ActivityLogTab` passes an empty `profiles` map**, so activity entries render `userId` instead of display name. Slice G's report acknowledged this; the epic doc §"Out of scope" excluded "the full Updates composer / Activity Log filtering UI" but said nothing explicit about profile resolution. Spec did not require it. **Accept as-is for v1**; if the user later flags this in smoke, file a polish followup.

5. **`FilesTab` has no upload affordance** — read-only viewer. Spec §"Out of scope": "Read-only consumption of existing data only." Acceptable.

6. **Tags `label_distribution` uses a single uniform color** (`var(--color-surface-hover)`) for every segment because tags are free-form strings with no server-defined colors. Slice C flagged this. The stacked bar will read as one solid segment when tags exist. Acceptable for v1 — tag-color polish is out of scope.

7. **Reset-on-board-navigation behavior** lives inside `ItemDrawer` (`useEffect` on `boardId`) rather than `BoardDataProvider`. Verified the implementation: each fresh mount with non-null `boardId` calls `reset()`, which clears `openItemId` and tab. Because the drawer is mounted per-table-page and the route remounts on board change, the in-memory Zustand state gets cleared correctly on each new board. Works as-is.

8. **Drawer mount is on `app/(app)/w/[workspaceSlug]/b/[boardId]/table/page.tsx` rather than the board layout.** Other views exist (kanban, calendar, dashboard, timeline, form). For v1, only `TaskRow` exposes the speech-bubble affordance, so the table-only mount is functionally complete. **Note for future:** when kanban / calendar grow their own drawer entry points (e.g. kanban card click), they will need to either (a) mount their own `<ItemDrawer />` or (b) hoist the mount to the board layout. Not a Stage-2 followup item; record this as a Stage-3 / future-epic note in the orchestrator's followups list.

9. **Slice C report claimed 43 tests** in `aggregate-render.test.tsx`; actual count is 25 `it(...)` blocks (likely double-counted nested describes). The 25 cover every descriptor branch with multiple cases each. DoD ("each descriptor branch covered") is met. No followup.

---

## Followup slices

Two surgical followups. Parallel-safe — they touch disjoint files.

### Slice C-1 — Person aggregation: render avatar stack + count

**Owner:** epic-executor (sonnet)

**Branch:** `epic/16-board-remediation/c1-person-avatar-stack`

**Scope (writes):**
- `components/board/table/AggregateRender.tsx` — replace the count-only `unique_count_avatars` branch with an avatar stack + count visual.

**Allowed reads (no writes):**
- `components/cells/person/Cell.tsx` — reference for avatar size, overlap, and avatar-component reuse.
- `components/cells/person/Editor.tsx` — same.
- `stores/board-store.ts` — if profile / avatar lookup needs the same selector pattern the person Cell already uses.
- `components/shared/Avatar.tsx` (or wherever the existing avatar component lives — verify by grep).

**Forbidden scope:**
- Any `components/cells/**` (the descriptor is built by `person/def.ts`; only the renderer changes).
- `lib/cells/aggregate-descriptors.ts` — `unique_count_avatars` already carries `userIds: string[]`. No descriptor change needed.
- `app/**`, `stores/**` outside reads.

**Dependencies on other slices:** none — parallel with Slice C-2 below.

**Spec:**

1. Replace the body of `case "unique_count_avatars":` in `AggregateRender.tsx`. Current implementation renders only `<span>{count}</span>`.

2. New visual:
   - Render an avatar stack of up to **3** avatars (the first three entries of `userIds`), each `20px × 20px` (group footer is smaller than a task row; `--size-avatar-sm` if defined, otherwise inline `20px`). Overlap by `-6px` like the existing person Cell pattern (verify the exact overlap by reading `components/cells/person/Cell.tsx`; reuse the same constant if exposed).
   - If `count > 3`, append a `+N` chip after the avatars (e.g. `+2` when count is 5).
   - To the right of the avatar stack, render the total `count` as small muted text (`text-[13px] font-medium text-[color:var(--color-fg-muted)] tabular-nums`).
   - When `count === 0`, keep the existing `—` muted-em-dash fallback. Do not render an empty avatar stack.

3. Avatar component reuse: use whatever avatar primitive `person/Cell.tsx` uses today (likely an `<Avatar />` from `components/shared/` or an inline `<img>` with profile fallback). **Do not introduce a new avatar component.** If profile resolution is unavailable in the footer (no profiles map in scope), fall back to initial-letter avatars derived from `userId` — the existing person Cell already handles this fallback case; mirror its behavior.

4. Accessibility: outer container `role="img"` with `aria-label={\`\${count} people\`}`. Each avatar is `aria-hidden="true"` (the role/label is on the parent).

**Definition of done:**
- `unique_count_avatars` descriptor renders an avatar stack (up to 3 visible) + a `+N` overflow chip when applicable + a count number.
- The empty case (`count === 0`) still shows the muted em-dash.
- Existing Vitest cases for `unique_count_avatars` in `tests/unit/aggregate-render.test.tsx` are updated to assert the avatar-stack render path (e.g. count of DOM elements with the avatar role, presence of the `+N` chip at counts > 3, em-dash at count 0).
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- No reusable avatar component exists in the codebase, only inline `<img>` usage scattered across the person Cell. Escalate before extracting a new shared primitive — the orchestrator may want that to be its own slice.
- Avatar overlap/size constants are inconsistent between `person/Cell.tsx` and `person/Editor.tsx`. Escalate with both values so the orchestrator picks the canonical one.

---

### Slice C-2 — Drop em-dash placeholder from 6 remaining spec-listed cell types

**Owner:** epic-executor (sonnet)

**Branch:** `epic/16-board-remediation/c2-empty-cell-placeholders`

**Scope (writes):**
- `components/cells/number/Cell.tsx`
- `components/cells/currency/Cell.tsx`
- `components/cells/rating/Cell.tsx` — note: rating is a special case (see Spec 2 below).
- `components/cells/week/Cell.tsx`
- `components/cells/date/Cell.tsx`
- `components/cells/location/Cell.tsx`

**Forbidden scope:**
- Any `def.ts` file. Empty-state rendering lives in `Cell.tsx` only.
- `components/cells/_shared/EmptyCellTile.tsx` — that tile is for status/priority's dashed click-to-set affordance; numeric/date/location cells get a completely empty cell, not a dashed tile.
- `components/cells/text/**`, `long_text/**`, `email/**`, `phone/**`, `link/**`, `country/**` — already fixed by Slice C.

**Dependencies on other slices:** none — parallel with Slice C-1.

**Spec:**

1. **number, currency, week, date, location:** in the empty branch of each Cell renderer (where the cell currently emits `<span … className="text-[color:var(--color-fg-muted)]">—</span>`), replace the em-dash span with `null` (or simply don't render the inner content; keep the outer cell container so the hover outline still affords a click). Mirror the pattern used by `text/Cell.tsx` after Slice C — render the outer `<div>` cell container, and inside it render the value-string `<span>` only when there is a value.

2. **rating:** rating's "empty" state is rendering `max` hollow stars (per the existing implementation — `filled = value ?? 0` so a null value renders all hollow stars). It does **not** render an em-dash. The right behavior here is the open question described below. **Recommended interpretation**: rating is already "visually empty enough" because hollow stars are an active affordance, not a placeholder string. However, the dispatch plan named rating in the list of 12. To resolve without expanding scope, the executor should:
   - Leave the hollow-star pattern as the v1 rating empty state (do NOT change it).
   - Add an inline comment in `rating/Cell.tsx` explaining why rating was kept as-is even though the dispatch plan listed it.
   - If the user disagrees during smoke pass, file a polish followup.

3. **All 6 files:** keep `aria-hidden` / muted-color styling that was already there for the value-rendered branch. Only the empty branch changes.

4. The cell container's `hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)]` class **must remain** on the outer `<div>` — that's the hover affordance the spec says replaces the placeholder.

5. **No new tests required.** These are visual-only changes already covered by Slice E's smoke pass. If a Vitest for any of these cells exists today (verify by grep), update its empty-state assertion to expect an empty container rather than an em-dash; if no such test exists, do not create one.

**Definition of done:**
- `number`, `currency`, `week`, `date`, `location` Cells render a completely empty container (with hover outline) when their value is null.
- `rating` Cell continues to render hollow stars (intentionally retained — see Spec 2).
- `pnpm typecheck` and `pnpm lint` pass.
- Any existing Vitest cases that asserted the em-dash were updated, not deleted.

**Escalation triggers:**
- Existing Vitest cases that asserted `"—"` in any of these cell renderers fail and the executor cannot determine whether the test was a regression guard or a snapshot. Escalate with the test name.
- `rating/Cell.tsx` has additional empty-state behavior not captured here that conflicts with the "leave hollow stars" recommendation. Escalate before changing.

---

## Open questions for the user

1. **Em-dash interpretation for `rating`.** The dispatch plan listed `rating` among the twelve cells to "drop the `\"Empty\"` placeholder", but rating never had an `"Empty"` string — it renders hollow stars when value is null, which is arguably an affordance rather than a placeholder. Slice C-2 currently recommends leaving rating's hollow stars in place. **If the user wants hollow stars also suppressed when value is null, say so before the executor dispatches — that would change the Slice C-2 spec.** Recommended: keep hollow stars (matches Monday). No action needed unless the user disagrees.

2. **Profile resolution in `ActivityLogTab`.** Currently shows `userId` strings, not display names. Spec did not require it but it will look raw during the smoke pass. **If we want display-name resolution before Slice E's smoke pass, file a Slice G-1 followup; otherwise defer to a v1.1 polish item.** Recommended: defer.

