---

# Epic 16 — Followup-2 Dispatch Plan

**Status:** authored by epic-researcher Stage 3 + epic-level review pass.

**Trigger:** Stage 3 review found that two of Slice E's Playwright specs silently no-op against the current production code because the selectors they reach for aren't emitted:

- `board-grid-alignment.spec.ts` queries `[role="columnheader"]` and falls through `test.skip()` when no matches are found. **No production code emits this role.** Result: the DoD bullet *"column header column-N x-position equals every task row column-N x-position equals group footer column-N x-position, verified by a Playwright pixel-position test"* has zero CI enforcement.
- `cell-editor-anchor.spec.ts` queries `[data-popup], [role="dialog"], [data-radix-popper-content-wrapper]` and **returns without asserting** when none match. Base UI's `Popover.Popup` emits none of those; it emits `data-open / data-closed / data-side / data-align / data-instant`. Result: the DoD bullet *"opening any cell editor opens a popover next to the triggering cell, verified across two viewports by a Playwright test"* has zero CI enforcement.

Both are one-line production fixes plus a test hardening. Parallel-safe. No new functionality.

---

## Slice E-1 — Add `role="columnheader"` + harden grid alignment test

**Owner:** epic-executor (sonnet)

**Branch:** `epic-16/e-1-columnheader-role`

**Scope (writes):**
- `components/board/table/ColumnHeader.tsx` — add `role="columnheader"` to the outer `<div>`.
- `components/board/table/GroupColumnHeader.tsx` — same role on each per-column header div it renders.
- `tests/e2e/board-grid-alignment.spec.ts` — remove `test.skip()` branches; treat absence of `[role="columnheader"]` as hard failure.

**Forbidden scope:** any layout/style changes; any other component; any other test.

**Dependencies:** none — parallel with E-2.

**Spec:**

1. `ColumnHeader.tsx`: add `role="columnheader"` to the existing root `<div>` (around line 85). Keep all other attributes intact. The element already participates in a grid; this is an a11y improvement regardless.
2. `GroupColumnHeader.tsx`: same addition to each per-column header it renders. Read the file first — if it re-uses `ColumnHeader`, the role is inherited and no separate edit is needed. If it renders its own divs, add the role to each.
3. `board-grid-alignment.spec.ts`:
   - Replace `if (headerCount === 0) { test.skip(...); return; }` (around lines 42-47, 99-103) with `expect(headerCount, "ColumnHeader must expose role=columnheader").toBeGreaterThan(0);`.
   - Replace the `taskRowCount === 0` early return (around lines 61-64) with `expect(taskRowCount).toBeGreaterThan(0)`.
   - Keep the per-row `cellCount === 0 continue` loop as-is (sparse rows are fine).
4. Do not change the ±1 px tolerance. Do not broaden cell-selection logic.

**Definition of done:**
- `ColumnHeader.tsx` root carries `role="columnheader"`.
- `GroupColumnHeader.tsx` per-column headers carry `role="columnheader"` (either directly or via re-using `ColumnHeader`).
- `board-grid-alignment.spec.ts` has no `test.skip()` calls.
- `pnpm typecheck` and `pnpm lint` pass.
- Existing unit tests pass.

**Escalation triggers:**
- `GroupColumnHeader` re-uses `ColumnHeader` such that the role is inherited — note this and skip the second edit.
- Adding the role breaks an existing a11y test — escalate before working around.

---

## Slice E-2 — Tag `Popover.Popup` with `data-testid` + harden cell-editor anchor test

**Owner:** epic-executor (sonnet)

**Branch:** `epic-16/e-2-popup-testid`

**Scope (writes):**
- `components/cells/CellEditor.tsx` — add `data-testid="cell-editor-popup"` to the `Popover.Popup` element.
- `tests/e2e/cell-editor-anchor.spec.ts` — switch the selector to `[data-testid="cell-editor-popup"]`; remove the no-popover early-return so missing popover is hard fail.

**Forbidden scope:** changes to `Popover.Positioner` / `Popover.Portal` / `anchorEl` plumbing; any other editor file.

**Dependencies:** none — parallel with E-1.

**Spec:**

1. `CellEditor.tsx`: add `data-testid="cell-editor-popup"` to the existing `Popover.Popup` element (around line 207). No other change.
2. `cell-editor-anchor.spec.ts`:
   - Replace the popover-locator chain (around lines 119-122) with `const popover = page.locator('[data-testid="cell-editor-popup"]').first();`.
   - Remove the `if (!popoverVisible) { ... return; }` block (around lines 129-157) — replace with `await expect(popover).toBeVisible({ timeout: 3000 });` so a missing popover hard-fails.
   - Keep the bounding-box assertions intact (viewport-origin guard, horizontal overlap with cell).
   - Apply the same hardening to the priority editor block (around lines 213-221).
3. Do not change the `ANCHOR_LEFT_TOLERANCE` or the two-viewport loop.

**Definition of done:**
- `Popover.Popup` in `CellEditor.tsx` carries `data-testid="cell-editor-popup"`.
- `cell-editor-anchor.spec.ts` selects via that testid only; no fallback chains.
- The test fails (not silently skips) if the popover does not mount or anchors at viewport origin.
- `pnpm typecheck` and `pnpm lint` pass.

**Escalation triggers:**
- Adding the testid breaks an existing Vitest expectation on `CellEditor.tsx` output — escalate.
- The popover does not actually mount on click in the smoke-board state because the click target is wrong (e.g. status cells in unset state mount a different editor) — escalate with the reproduced selector chain.

---

## Pre-merge gate (PR-author responsibility, not executor)

- Manual smoke pass per `docs/conversion-plan/_dispatch/epic-16-smoke-checklist.md` against a freshly seeded board. Screenshots into the PR description.
- Run `pnpm test:e2e` after E-1 + E-2 land to confirm both newly hardened specs actually fail-fast against any regression.
