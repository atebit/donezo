# Epic 14 — Followup Round 2

## Review summary

- **Stage reviewed:** Stage 3 — Slice I (Lighthouse + bundle + visual snapshots audit).
- **Commit range:** `238930b..f98a0b7` (post-followup-1/F4 → merge of Slice I).
- **Verdict:** FOLLOWUP REQUIRED.
- **Definition-of-done items met:**
  - Visual snapshot specs land under `tests/e2e/visual/` (5 pages × 6 viewport/scheme combos = 30 baselines, parked behind `test.skip` until Epic 15 wires the runner). Spec explicitly allowed this deferral.
  - Bundle audit doc landed at `docs/conversion-plan/_dispatch/epic-14-bundle-audit.md` with live `ANALYZE=true pnpm build` data, top-three offenders identified for the table route, and four followups filed (mime-db, Tiptap, react-big-calendar, Zod).
  - Lighthouse structural audit doc landed at `docs/conversion-plan/_dispatch/epic-14-lighthouse-audit.md` with `PASS` rows for every structural a11y check.
  - Browser-matrix doc landed at `docs/conversion-plan/_dispatch/epic-14-browser-matrix.md` (Chromium / Firefox / WebKit + Pixel 5 + iPhone 13; documented Firefox `input[type=week]`, react-big-calendar dark CSS, oklch iOS 16+ risks).
  - `@next/bundle-analyzer@16.2.6` wired behind `ANALYZE=true` in `next.config.ts` (wraps `withNextIntl(nextConfig)` in the correct order).
  - Skip-to-content link added to `SidebarShell.tsx` with `id="main-content"` on `<main>` (WCAG 2.4.1 bypass-blocks).
  - `pnpm typecheck` clean. `pnpm lint` clean modulo 5 pre-existing warnings. `pnpm test` baseline preserved (30 pre-existing failures, 0 new).
- **Definition-of-done items NOT met:**
  - **Epic 14 DoD line 325: "Lighthouse Accessibility = 100 on every key page."** The Slice G contrast audit already documented (and the Slice I Lighthouse audit re-flagged at HIGH severity) that `components/cells/status/Cell.tsx` and `components/cells/status/StatusLabelEditor.tsx` hardcode `text-white` over user-picked label backgrounds. Eight of nine label colors in the seed/palette fail WCAG 2.1 AA (4.5:1 body-text) with white text — the green, yellow, blue, gray, orange, red, purple, and pending swatches all need black text instead. Until this lands, status/priority cells on any board with these label colors (i.e. every default board) will fail axe-core's color-contrast rule and Lighthouse cannot return Accessibility = 100. Slice I correctly identified this and correctly punted it on slice-scope grounds, but Slice I's own spec line `"Fix only blocking Accessibility regressions (target = 100)"` makes this a DoD blocker for Epic 14 — it's a surgical, no-DB-change fix and belongs inside the epic.
- **Other issues found (filed for the orchestrator, NOT in this followup spec):**
  - `epic-14-lighthouse-audit.md` FOLLOWUP-7 — missing `generateMetadata` per-page titles on board table / workspace home / account settings. This is a Lighthouse SEO score concern, not Accessibility; Slice I's spec only mandates Accessibility = 100. Genuinely deferrable to a future epic.
  - `epic-14-lighthouse-audit.md` FOLLOWUP-9 — dark-mode `scrollbar-color` override missing in `[data-theme="dark"]`. Cosmetic, Best Practices score impact only, not a11y. Deferrable.
  - `epic-14-bundle-audit.md` FOLLOWUP-1..4 — bundle/perf followups (mime-db lazy, Tiptap lazy, react-big-calendar lazy, Zod tree-shake). Slice I's spec explicitly carves these out as "logged as followups, not fixed here." Deferrable.
  - `epic-14-contrast-audit.md` notes 3 menu-list focus-ring sites that intentionally use background-color focus indication (`menu-list.tsx`, `BoardSettingsMenu.tsx`, `ColumnHeaderMenu.tsx`). These are WCAG-compliant if background contrast is sufficient and the audit accepted them as-is. Deferrable.

## Followup slices

### Slice F2-1: StatusCell / StatusLabelEditor — dynamic black-or-white label text per WCAG AA luminance

- **Owner:** epic-executor (sonnet).
- **Scope (allowed paths — touch ONLY these):**
  - `lib/cells/label-text-color.ts` (NEW — pure utility module).
  - `components/cells/status/Cell.tsx` (modify — `text-white` → dynamic text color).
  - `components/cells/status/StatusLabelEditor.tsx` (modify — `text-white` → dynamic text color on each label chip).
  - `tests/unit/cells/label-text-color.test.ts` (NEW — unit tests for the utility).
- **Forbidden scope (do NOT touch these — out of scope for this followup):**
  - **DB schema.** Do NOT add a `text_color` column to `label`. Do NOT write a migration. Do NOT regenerate `lib/supabase/types.ts`. The audit's "proper fix" of a DB column is a future epic; this followup is the surgical stopgap.
  - **`app/globals.css`.** The `--color-label-{color}-text` tokens that Slice G added are unused by this slice and stay where they are. Do NOT delete them. Do NOT add new tokens.
  - **Any other cell.** Do NOT modify `components/cells/{date,checkbox,file,formula,location,person,rating,vote,week,text,number,...}/Cell.tsx`. The tooltip `text-white` in `components/cells/formula/Cell.tsx` (line 42) is on a `--color-fg-strong` dark background and is WCAG-correct — leave it alone.
  - **The board store, the column registry, the cell type defs.** None of `stores/board-store.ts`, `components/cells/TableCell.tsx`, `components/cells/CellEditor.tsx`, or `components/cells/status/def.ts` need editing.
  - **The label editor modal palette.** `components/board/table/LabelEditorModal.tsx` and `components/board/table/ColorPalette.tsx` already meet contrast on their swatch grid (no overlaid text on the swatches themselves) — do not touch.
  - Legacy `frontend/` or `backend/` directories.

- **Architectural decision (locked — do not deviate):**
  The contrast audit's recommended fix of `text-[color:var(--color-label-{color}-text)]` is **not implementable as-stated** because `label.color` is persisted as a free-form hex string (the resolved `#RRGGBB`), not a token slug. There is no slug at render time, so `var(--color-label-{slug}-text)` cannot be constructed.
  The locked approach for this followup is **luminance-based text color** computed from the background hex at render time. This is deterministic, requires zero schema changes, and works for both the 12-swatch palette and any future custom-color input.

- **Spec — new utility `lib/cells/label-text-color.ts`:**

  Export exactly two functions:

  ```ts
  /**
   * Returns the WCAG-AA-compliant foreground color ("#000000" or "#ffffff")
   * for text rendered on top of the given background hex.
   *
   * Uses the relative-luminance formula from WCAG 2.1 §1.4.3. A background
   * with relative luminance above 0.179 (≈ contrast ratio 4.5:1 against
   * #000) returns "#000000"; otherwise returns "#ffffff".
   *
   * Accepts:
   *   - "#RRGGBB" (case-insensitive)
   *   - "#RGB" shorthand (e.g. "#fff")
   * Anything else falls back to "#000000" (safe-default; pairs with the
   * gray empty-state background).
   */
  export function labelTextColor(bgHex: string): "#000000" | "#ffffff";

  /**
   * Computed relative luminance per WCAG 2.1 §1.4.3. Exported for testing
   * and for any future caller that needs the raw number.
   */
  export function relativeLuminance(bgHex: string): number;
  ```

  Implementation requirements:
  - Pure functions. No DOM, no React, no Zustand.
  - `relativeLuminance` implements the standard sRGB linearization:
    - For each channel c in [0..1]: `c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4`
    - Returns `0.2126*R + 0.7152*G + 0.0722*B`.
  - Threshold for switching from black to white text: **0.179**. (This is the standard threshold; it correctly produces black text for the 8 palette colors that fail at 4.5:1 against white and produces white text only for the `critical` swatch `#333333`.)
  - The `#RGB` shorthand expansion is `"#abc" → "#aabbcc"`.
  - Invalid input (missing `#`, non-hex chars, wrong length) returns `"#000000"`. Do not throw.

- **Spec — `components/cells/status/Cell.tsx` modification:**

  Inside `StatusCellInner`, after the existing `const bgColor = label?.color ?? "var(--color-label-gray)";` line, add:

  ```ts
  const textColor = label ? labelTextColor(label.color) : "var(--color-label-fg-muted)"; // see note
  ```

  Note: the empty state has no text (no `labelName` to render), so the `textColor` is unused in the empty branch. Skip the empty-state computation by computing `textColor` only when `label` resolves, e.g.:

  ```ts
  const textColor = label ? labelTextColor(label.color) : null;
  ```

  Then on the existing `<span className="text-xs font-medium text-white truncate px-2 select-none">`:
  - **Remove** the `text-white` utility from the className.
  - **Add** an inline `style={{ color: textColor ?? undefined }}` on the same `<span>`.

  Do not change the surrounding `<div>`, the `role="img"`, the `aria-label`, the fold animation, or any other attribute. The diff for this file should be ~3 lines.

- **Spec — `components/cells/status/StatusLabelEditor.tsx` modification:**

  Inside the `labels.map((label) => (...))` block (around line 81–93), the `<button>` for each label chip currently uses `className="... text-white ..."` and `style={{ backgroundColor: label.color }}`. Apply the same fix:
  - **Remove** the `text-white` utility from the className.
  - **Add** the dynamic color to the existing inline `style`:
    `style={{ backgroundColor: label.color, color: labelTextColor(label.color) }}`.

  Do not change the `aria-selected`, `role="option"`, the hover transition, the `Clear` button (which already uses a token-driven muted fg), the `Edit Labels` footer, or anything else in this file.

- **Spec — `tests/unit/cells/label-text-color.test.ts` (NEW):**

  Vitest unit tests, no React/RTL involved. Must cover at minimum:
  1. `labelTextColor("#00c875")` returns `"#000000"` (green, palette).
  2. `labelTextColor("#ffcb00")` returns `"#000000"` (yellow, palette).
  3. `labelTextColor("#579bfc")` returns `"#000000"` (blue/pending, palette).
  4. `labelTextColor("#c4c4c4")` returns `"#000000"` (gray, palette).
  5. `labelTextColor("#fdab3d")` returns `"#000000"` (orange, palette).
  6. `labelTextColor("#e2445c")` returns `"#000000"` (red, palette).
  7. `labelTextColor("#a25ddc")` returns `"#000000"` (purple, palette).
  8. `labelTextColor("#333333")` returns `"#ffffff"` (critical, palette).
  9. `labelTextColor("#000000")` returns `"#ffffff"` (pure black).
  10. `labelTextColor("#ffffff")` returns `"#000000"` (pure white).
  11. `labelTextColor("#FFF")` returns `"#000000"` (shorthand, uppercase).
  12. `labelTextColor("not-a-color")` returns `"#000000"` (invalid input, safe default).
  13. `labelTextColor("")` returns `"#000000"` (empty string, safe default).
  14. `relativeLuminance("#ffffff")` is approximately `1.0` (within 0.001).
  15. `relativeLuminance("#000000")` is approximately `0.0` (within 0.001).

  All 15 must pass. No skipped tests.

- **Definition of done (testable):**
  1. `lib/cells/label-text-color.ts` exists with the two exported functions.
  2. `components/cells/status/Cell.tsx` no longer contains the string `text-white` and the rendered `<span>` color is driven by `labelTextColor(label.color)`.
  3. `components/cells/status/StatusLabelEditor.tsx` no longer contains the string `text-white` and each label `<button>` has `color: labelTextColor(label.color)` on its inline style.
  4. `tests/unit/cells/label-text-color.test.ts` passes all 15 cases.
  5. `pnpm typecheck` is clean (no new errors).
  6. `pnpm lint` is clean (no new warnings — the 5 pre-existing warnings remain the baseline).
  7. `pnpm test --run tests/unit/cells/label-text-color.test.ts` passes.
  8. Full `pnpm test --run` baseline preserved (30 pre-existing failures; do not introduce new ones).
  9. After this slice lands, the eight palette colors that previously failed WCAG AA (green/yellow/blue/gray/orange/red/purple/pending) render their label text as black on the status cell and inside the label-picker popover; the `critical` swatch (`#333333`) renders its text as white. Verify this manually by reading the rendered className/style on the two files.

- **Escalation triggers (return needs-direction; do not invent):**
  - If `labelTextColor` would need to do anything other than read the hex string from `label.color` and return one of two literal strings, stop and escalate. The fix is intentionally minimal.
  - If a third site outside the two allowed files turns out to also need editing to satisfy the contrast rule, stop and escalate — do not silently expand scope.
  - If `text-white` proves load-bearing on a non-label element inside `Cell.tsx` or `StatusLabelEditor.tsx` (e.g. on the diagonal fold pseudo-element), leave that occurrence alone — the fold uses `rgba(255,255,255,0.3)` as a stylistic overlay border, not as text. Confirm by reading the surrounding code; do not delete fold-related styling.
  - If the `--color-label-fg-muted` token used as a fallback above does not actually exist in `globals.css`, simply pass `undefined` for the empty branch — the empty branch renders no text, so the color is moot. (Confirmed for this followup: empty branch has no `<span>`, so the `textColor` is only ever read inside the `{labelName && ...}` block.)
  - If `pnpm test --run` baseline shifts (i.e. the count of pre-existing failures changes), stop and report — that means something else regressed.

- **Forbidden in commit messages / PR body:**
  - Do not claim this enables a "live Lighthouse run." It removes the only known a11y blocker for label rendering; the live run is still Epic 15's job.
  - Do not advertise a DB-column followup as "next step here." The audit notes it; the orchestrator owns whether to file it.

## Open questions for the user

None. The fix path is unambiguous: luminance-based black/white text color is the standard WCAG-AA solution, the existing token names cannot be used directly because the slug is not stored in the row, and adding a DB column is explicitly out of scope for Epic 14 (the audit acknowledges this).
