# Epic 14 — Slice G: Color Contrast Audit

**Date:** 2026-05-13  
**Scope:** Label palette from `design-system.md §1.1.5` — all label colors vs white text and black text.  
**Standard:** WCAG 2.1 Level AA — 4.5:1 for normal text, 3:1 for large text (≥18px normal weight, or ≥14px bold).

---

## Label Palette Contrast Ratios

Label text in status/priority cells is 12px (`text-xs` in Tailwind), which is **below large-text threshold**. Therefore **4.5:1 AA body text** standard applies.

| Label | Color | vs White (AA body) | vs Black (AA body) | Verdict | Recommended text |
|---|---|---|---|---|---|
| done-green | `#00c875` | 2.21 — **FAIL** | 9.52 — **PASS** | Needs fix | **black** |
| egg_yolk / yellow | `#ffcb00` | 1.52 — **FAIL** | 13.79 — **PASS** | Needs fix | **black** |
| bright-blue | `#579bfc` | 2.80 — **FAIL** | 7.50 — **PASS** | Needs fix | **black** |
| explosive / gray | `#c4c4c4` | 1.74 — **FAIL** | 12.04 — **PASS** | Needs fix | **black** |
| working-orange | `#fdab3d` | 1.90 — **FAIL** | 11.07 — **PASS** | Needs fix | **black** |
| stuck-red | `#e2445c` | 4.03 — **large only** | 5.22 — **PASS** | Needs fix | **black** (vs black passes; vs white fails for body text) |
| review-purple | `#a25ddc` | 4.09 — **large only** | 5.14 — **PASS** | Needs fix | **black** (same situation) |
| pending-blue | `#579bfc` | 2.80 — **FAIL** | 7.50 — **PASS** | Needs fix | **black** |
| critical-black | `#333333` | 12.63 — **PASS** | 1.66 — **FAIL** | OK as-is | **white** |

**Summary:** 8 of 9 label colors require **black text** for WCAG AA compliance. Only `critical-black (#333333)` correctly uses white text. The legacy app already used black text for orange and yellow (confirmed by spec); the issue is that the current `StatusCell` uses hardcoded `text-white` for all labels.

---

## Design Token Fix (globals.css)

The following `--color-label-*-text` tokens have been added to `globals.css` `@theme` block to express the correct foreground color per label:

```css
/* Label text colors — correct foreground per WCAG AA */
--color-label-green-text: #000000;
--color-label-yellow-text: #000000;
--color-label-blue-text: #000000;
--color-label-gray-text: #000000;
--color-label-orange-text: #000000;
--color-label-red-text: #000000;
--color-label-purple-text: #000000;
--color-label-pending-text: #000000;
--color-label-critical-text: #ffffff;
```

---

## Cell Rendering Followup (out of scope for Slice G)

**Problem:** `components/cells/status/Cell.tsx` uses hardcoded `text-white` for all label text, causing AA failures on 8 of 9 label colors.

**Required fix (followup slice):** Replace `text-white` with a dynamic text color based on the label's background. Options:
1. Add a `textColor` property to the label record in the DB (already has `color`; add `text_color` column defaulting to `#000000`).
2. Or compute the accessible text color from the background via CSS `color-contrast()` (not yet supported in all browsers as of 2026).
3. Or use a per-label-color CSS variable convention: when rendering a label, apply `color: var(--color-label-{name}-text)` alongside `background: {label.color}`. This requires the label color name (slug) to be derivable at render time.

**Recommended approach for the followup:** Add `text_color` to the label record (default `#000000`, except `critical-black` which gets `#ffffff`). The DB seed in epic 02 should be updated. `StatusCell` then reads `label.textColor` instead of hardcoding `text-white`.

---

## Focus Rings Audit

**Status: Addressed in Slice G.**

The following elements had `focus-visible:outline-none` without a visible focus indicator and were fixed:

| Component | Fix |
|---|---|
| `BoardArchiveConfirmModal.tsx` — Cancel + Archive buttons | Added `focus-visible:ring-2 focus-visible:ring-*` |
| `BoardDeleteConfirmModal.tsx` — Cancel + Delete buttons | Added `focus-visible:ring-2 focus-visible:ring-*` |
| `WidgetEditor.tsx` — Close, Cancel, Save widget buttons | Added `focus-visible:ring-2 focus-visible:ring-*` |

**Elements verified as intentionally using background-color focus indication (menu items):**

These use `focus-visible:bg-surface-hover` as their focus indicator — a background color change. While this is WCAG-compliant if the contrast between states is sufficient, a ring would be more universally recognizable. These are in menu/dropdown contexts where Base UI manages focus; left as-is since refactoring them is out of slice scope. Flagged for followup:

- `components/ui/menu-list.tsx` — menu items
- `components/board/BoardSettingsMenu.tsx` — menu items
- `components/board/table/ColumnHeaderMenu.tsx` — menu items

---

## Form aria-describedby Audit

**Status: All in-scope forms wired in Slice G.**

| Form | Fields fixed |
|---|---|
| `sign-in-form.tsx` | email, password — added `aria-describedby` + `required` + `role="alert"` on error `<p>` |
| `sign-up-form.tsx` | displayName, email, password — same |
| `forgot-password-form.tsx` | email — same |
| `reset-password-form.tsx` | password — same |
| `CreateBoardModal.tsx` | Already had `aria-describedby`. Verified OK. |
| `CreateWorkspaceModal.tsx` | Already had `aria-describedby`. Verified OK. |
| `InviteModal.tsx` | emails (+ hint id), role — added `aria-describedby` + `required` + `role="alert"` |
| `board settings general-form.tsx` | board-name, board-description — added `aria-describedby` + `required` + `role="alert"` |
| `workspace settings general-form.tsx` | name, slug — added `aria-describedby` + `required` + `role="alert"` |
| `account-settings.tsx` | displayName, email, password — added `aria-describedby` + `required` + `role="alert"` |

**Pattern applied:** Error `<p>` elements now have unique `id` attributes. Inputs reference the error id via `aria-describedby` (only when an error is present — no dangling references). Error paragraphs have `role="alert"` for live announcement. Required fields have the `required` attribute.

---

## Followups for Orchestrator

1. **StatusCell text color** — 8/9 label colors fail WCAG AA with current `text-white`. Needs a new followup slice to add `text_color` to labels DB schema + update `StatusCell.tsx` to use it. (Cannot be done in Slice G — cell rendering logic is forbidden scope.)
2. **Menu item focus rings** — menu items use background-color focus indication. Consider adding a thin ring alongside the background change for better discoverability.
3. **PriorityCell** — shares the same status-cell pattern (uses `StatusCell`-like rendering). Same text-color fix needed once status cell is addressed.
