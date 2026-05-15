# Epic 16 — Board Remediation Smoke Checklist

**Run against:** local `pnpm dev` build with `supabase db reset` applied.
**Seed board:** "Epic 16 Smoke Board" at `/w/e2e-workspace/b/eeeeeeee-eeee-eeee-eeee-eeeeeeee1600`
**Groups:** Alpha (purple), Beta (yellow), Gamma (blush)
**Columns:** Task (text), Status A (status), Status B (status), Priority, Owner (person), Due Date (date), Points (number), Notes (text), Done (checkbox), Rating (rating)

---

## How to run this checklist

1. `supabase start && pnpm db:reset`
2. `pnpm dev`
3. Sign in as `e2e-user@donezo.test` / `e2e-test-password-12345`
4. Navigate to `/w/e2e-workspace/b/eeeeeeee-eeee-eeee-eeee-eeeeeeee1600`
5. Work through each section below; capture a screenshot for each section marked **[screenshot]**.
6. Paste screenshots into the PR description under each section heading.

---

## 1. Column alignment [screenshot]

**Test at:** 1280×800 and 1920×1080

- [ ] Column headers, task row cells, and group footer cells are all vertically aligned for each column.
- [ ] No column "drifts" by more than 1 px between header / body / footer rows.
- [ ] Horizontal scrolling does not break column alignment.
- [ ] The title column stays sticky-left when scrolling horizontally.
- [ ] The header row stays sticky-top when scrolling vertically.

---

## 2. Group accent colors [screenshot]

- [ ] Alpha group: purple accent (`#a25ddc`) appears on group title text, left row stripes (inset box-shadow), and group column header top border.
- [ ] Beta group: yellow accent (`#fbbc04`) appears in the same places.
- [ ] Gamma group: blush accent (`#f1e4de`) appears in the same places.
- [ ] Each group's accent is visually distinct from the others.
- [ ] The accent stripe on task rows does NOT consume a grid track (headers remain aligned).

---

## 3. Per-group column header [screenshot]

- [ ] Each group (Alpha, Beta, Gamma) has its own column header row above its tasks.
- [ ] The per-group column header repeats the column names and icons.
- [ ] The per-group column header top border matches the group's accent color.
- [ ] The per-group column header is passive (no resize handle, no drag-to-reorder).

---

## 4. Empty groups

- [ ] Collapse all tasks in one group (if possible) or delete all tasks to create an empty group.
- [ ] Verify: empty group does NOT render a footer aggregate row.
- [ ] Verify: empty group still renders its group header and per-group column header.

---

## 5. Status cell rendering [screenshot]

**Status A column (seeded values):**
- [ ] Alpha Task One — "Done": renders as a green filled pill with text "Done".
- [ ] Alpha Task Two — "Working on it": renders as an orange filled pill.
- [ ] Beta Task Two — "Stuck": renders as a red filled pill.
- [ ] Alpha Task Three — empty: renders as a subtle dashed-border tile (NOT a gray filled block).
- [ ] Gamma Task Three — empty: same dashed empty tile.

**Dashed empty tile spec:**
- [ ] Empty status cell is visually distinct from a set cell (dashed border, no fill color).
- [ ] Empty status cell renders smaller/lighter than a set cell.
- [ ] Hovering an empty status cell shows the "click to set" affordance (cursor pointer, hover bg).

---

## 6. Priority cell rendering [screenshot]

- [ ] Alpha Task One — "High": renders as a red/dark filled pill.
- [ ] Alpha Task Two — "Medium": renders as an orange filled pill.
- [ ] Beta Task One — "Low": renders as a blue filled pill.
- [ ] Alpha Task Three — empty: same dashed-border tile treatment as status.
- [ ] Empty priority cell does NOT render a gray filled block.

---

## 7. Text and other editable-value cells (no "Empty" placeholder) [screenshot]

Check each of these column types when a cell has no value:

- [ ] Notes column (text type) — blank cells show nothing (no "Empty" text).
- [ ] Due Date column (date type) — blank cells show nothing (no "—" dash).
- [ ] Points column (number type) — blank cells show nothing (no "—" dash).
- [ ] Owner column (person type) — blank cells show nothing.
- [ ] Rating column (rating type) — blank cells show hollow/outline stars (not "Empty" text).
- [ ] Done column (checkbox type) — unchecked cells show an unchecked checkbox state (not "Empty").

---

## 8. Cell editor popover anchoring [screenshot]

Test at **1280×800** and **1920×1080** viewports:

- [ ] Click a Status A cell → the label picker popover appears NEXT TO the cell (not at top-left of viewport).
- [ ] Click a Priority cell → popover appears next to the cell.
- [ ] Click an Owner (person) cell → popover appears next to the cell.
- [ ] Click a Due Date cell → date picker appears next to the cell.
- [ ] Click a Points (number) cell → number input appears next to the cell.
- [ ] No popover renders at viewport coordinates (0, 0).
- [ ] Popover left edge is within ~8 px of the triggering cell's left edge.

---

## 9. Footer aggregations [screenshot]

For each group (check Alpha group as representative):

- [ ] **Status A column footer:** stacked colored bar showing label distribution (Done / Working on it / Stuck proportions).
- [ ] **Status B column footer:** same stacked bar (independent from Status A).
- [ ] **Priority column footer:** stacked bar for label distribution.
- [ ] **Due Date column footer:** date range pill showing `min … max` of set dates.
- [ ] **Points (number) column footer:** sum of set values (8 + 5 = 13 for Alpha group).
- [ ] **Owner (person) column footer:** avatar stack + count of unique owners.
- [ ] **Notes (text) column footer:** `N / M` format (e.g., "0 / 3" for Alpha if no notes are set).
- [ ] **Done (checkbox) column footer:** percentage checked (e.g., "33%" if 1 of 3 checked in Alpha).
- [ ] **Rating column footer:** sum of ratings.
- [ ] No footer cell shows raw "N count" text (the old bug).
- [ ] Footer aggregate rows have a top border in the group's accent color.

---

## 10. Sidebar workspace state [screenshot]

- [ ] Navigate to the smoke board (`/w/e2e-workspace/b/eeeeeeee-eeee-eeee-eeee-eeeeeeee1600`).
- [ ] The workspace switcher in the left sidebar shows "E2E Workspace" (not "Select workspace").
- [ ] The "Select a workspace to see your boards" empty state is NOT visible.
- [ ] The board list in the sidebar shows at least: "E2E Board" and "Epic 16 Smoke Board".
- [ ] Click the workspace switcher → the dropdown lists "E2E Workspace" as the current workspace.

---

## 11. View tabs [screenshot]

- [ ] The "Main table" tab is visible and active on board load.
- [ ] The active tab has a visible 2 px underline in the primary color (not just bold text).
- [ ] The inactive tabs are visually distinct (lighter text, no underline).
- [ ] Click the chevron on the active tab → the ViewTabDropdown opens.
- [ ] The ViewTabDropdown contains a Compact / Default / Spacious density selector.
- [ ] The density toggle does NOT appear in the primary toolbar above the tabs.

---

## 12. View name deduplication [screenshot]

- [ ] Click "Add view" → "New table view". A new tab appears named "New table view".
- [ ] Click "Add view" again → "New table view". The second tab appears as "New table view (2)".
- [ ] Click "Add view" a third time → "New table view". Third tab appears as "New table view (3)".
- [ ] No two tabs have identical names.

---

## 13. Item drawer [screenshot]

- [ ] Hover over a task row → the speech-bubble icon-button appears on the left of the title cell.
- [ ] Click the speech-bubble icon → the item drawer slides in from the right.
- [ ] Drawer width is approximately 480 px.
- [ ] Drawer header shows the task title (e.g., "Alpha Task One").
- [ ] **Updates tab:** is active by default; shows update/comment list or "No updates yet" empty state.
- [ ] **Files tab:** click it → shows file attachments list or "No files yet" empty state.
- [ ] **Activity Log tab:** click it → shows activity log or "No activity yet" empty state.
- [ ] **"+" placeholder tab:** appears grayed-out/disabled; hovering shows tooltip "Custom item views coming soon."
- [ ] Press Escape → drawer closes.
- [ ] Click the X button → drawer closes.

---

## 14. Two status columns independence [screenshot]

Navigate to Alpha Task One row:

- [ ] Status A shows "Done" (green pill).
- [ ] Status B is empty (dashed tile or blank) — it does NOT show "Done" from Status A.
- [ ] Click Status A → change to "Working on it" → Status B remains empty/unchanged.
- [ ] Click Status B → set to "In Progress" → Status A remains "Working on it" (or whatever was set).
- [ ] Reload the page → both columns retain their independent values.

---

## 15. Performance sanity check

- [ ] The board renders in under 3 seconds on a local dev build.
- [ ] Scrolling through 3 groups × 3 tasks is smooth (no visible jank).
- [ ] The per-group column header × 3 groups does not cause visible render lag.

---

## Sign-off

| Item                     | Pass | Fail | Notes |
|--------------------------|------|------|-------|
| Column alignment         |      |      |       |
| Group accent colors      |      |      |       |
| Per-group column header  |      |      |       |
| Empty groups no footer   |      |      |       |
| Status cell rendering    |      |      |       |
| Priority cell rendering  |      |      |       |
| No "Empty" placeholders  |      |      |       |
| Cell editor anchoring    |      |      |       |
| Footer aggregations      |      |      |       |
| Sidebar workspace state  |      |      |       |
| View tabs styling        |      |      |       |
| View name deduplication  |      |      |       |
| Item drawer              |      |      |       |
| Status column independence |    |      |       |
| Performance sanity       |      |      |       |

**Smoke runner:** _________________  
**Date:** _________________  
**Build:** `pnpm dev` / `pnpm build` + `pnpm start`  
