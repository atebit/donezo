# Epic 14 — Followup Round 3

## Review summary

- **Stage reviewed:** Stage 3 — Slice I + followup-2 (luminance-based label text color).
- **Commit range:** `f98a0b7..ae7d2ad` (slice I merge → followup-2 merge).
- **Verdict:** FOLLOWUP REQUIRED.
- **Definition-of-done items met:**
  - Followup-2 DoD all 9 items pass:
    - `lib/cells/label-text-color.ts` exists with both exports (`labelTextColor`, `relativeLuminance`); signatures match spec.
    - `components/cells/status/Cell.tsx` no longer contains `text-white`; rendered span color is sourced from `labelTextColor(label.color)` via inline style. Empty branch correctly leaves `textColor` as `null` and skips render of the span entirely.
    - `components/cells/status/StatusLabelEditor.tsx` no longer contains `text-white`; each chip button receives `color: labelTextColor(label.color)` on its inline style.
    - All 15 unit tests in `tests/unit/cells/label-text-color.test.ts` pass.
    - `pnpm typecheck` clean.
    - `pnpm lint` shows 5 pre-existing warnings only (baseline preserved).
    - `pnpm test --run tests/unit/cells/label-text-color.test.ts` passes (15/15).
    - Full suite: 30 pre-existing failed files, 3 pre-existing failed tests — baseline preserved, 0 new failures.
    - The eight palette colors that previously failed WCAG AA now render black text; `critical` (`#333333`) correctly renders white text.
  - Followup-2 forbidden-scope contract upheld:
    - No DB schema changes; no `label.text_color` column; no migration.
    - `app/globals.css` not modified by followup-2 (`f98a0b7..ae7d2ad` shows zero diff there).
    - No other cell components modified (`formula/`, `date/`, `person/`, `checkbox/`, etc. untouched).
    - `stores/board-store.ts`, `components/cells/TableCell.tsx`, `components/cells/CellEditor.tsx`, `components/cells/status/def.ts` untouched.
    - `components/board/table/LabelEditorModal.tsx`, `components/board/table/ColorPalette.tsx` untouched.
    - No legacy `frontend/` or `backend/` modifications.
  - Slice I deliverables all in place:
    - Bundle audit: `docs/conversion-plan/_dispatch/epic-14-bundle-audit.md`.
    - Lighthouse audit: `docs/conversion-plan/_dispatch/epic-14-lighthouse-audit.md`.
    - Browser matrix: `docs/conversion-plan/_dispatch/epic-14-browser-matrix.md`.
    - Visual snapshot specs under `tests/e2e/visual/` (5 page specs).
    - Skip-to-content link in `SidebarShell.tsx` with `id="main-content"` on `<main>`.
    - `@next/bundle-analyzer` wired behind `ANALYZE=true` in `next.config.ts`.

- **Definition-of-done items NOT met:**
  - **Epic 14 DoD line 325: "Lighthouse Accessibility = 100 on every key page."** A second site rendering `text-white` over a user-picked label color was missed by both the Slice G contrast audit and the Slice I Lighthouse audit:
    - **`components/activity/renderers/label.tsx` line 20.** The `label.created` activity renderer creates a label chip with `className="...text-white..."` and `style={{ backgroundColor: color ?? "var(--color-label-gray)" }}` where `color` is the persisted free-form hex from the original label payload. This is the *exact same* WCAG-AA defect that followup-2 just fixed in StatusCell — eight of the nine palette colors fail 4.5:1 against white text. The chip is rendered inside the task drawer activity tab (`components/board/tabs/ActivityTab.tsx`) and inside `BoardActivityModal`, both of which are reachable from the board table/kanban surfaces that Slice I audited; `tests/e2e/a11y/task-drawer.a11y.spec.ts` already exercises the drawer with axe-core. When any task in the audited surfaces has a `label.created` event in its history with one of the 8 affected palette colors, the axe `color-contrast` rule will fire and Lighthouse Accessibility cannot be 100.
  - The followup-2 spec's third escalation trigger was explicitly: "If a third site outside the two allowed files turns out to also need editing to satisfy the contrast rule, stop and escalate — do not silently expand scope." The executor correctly did not silently expand scope. This followup-3 is the escalated decision: fix the third site with the same surgical pattern.

- **Other issues found (filed back to the orchestrator's epic-level followup list, NOT in this followup spec):**
  - **Dark-mode tooltip text-white on `bg-[color:var(--color-fg-strong)]`.** `--color-fg-strong` is intentionally inverted between themes (light = `#1f1f21`, dark = `oklch(98% 0 0)`). In light mode the existing pattern `<Tooltip.Popup className="...bg-[color:var(--color-fg-strong)] ... text-white">` is WCAG-AAA. In dark mode it becomes white-on-near-white = contrast failure. Affected files (at least): `components/cells/formula/Cell.tsx`, `components/board/PresencePile.tsx`, `components/board/table/ColumnHeaderMenu.tsx` (3 sites), `components/board/table/AddColumnModal.tsx`, `components/board/table/AddColumnButton.tsx`, `components/board/timeline/TimelineScaleSwitcher.tsx` if applicable, plus any other Tooltip.Popup matching this pattern. This is NOT a Stage 3 blocker because neither the contrast audit nor the Lighthouse audit ran in dark mode (the audited 5 pages were tested light-mode only per `epic-14-lighthouse-audit.md`). It is a real bug that deserves its own followup — but the fix touches 7+ files and requires an architectural decision about the right token for tooltip text (likely `var(--color-bg)` or `var(--color-surface)` to invert with `--color-fg-strong`). File for the epic-level review pass, not for Stage 3.
  - **`epic-14-lighthouse-audit.md` FOLLOWUP-7** (per-page `generateMetadata` for SEO) — explicitly an SEO score concern, not Accessibility. Deferrable per Slice I spec's "fix only blocking Accessibility regressions" carve-out.
  - **`epic-14-lighthouse-audit.md` FOLLOWUP-9** (dark-mode scrollbar-color) — Best Practices score only, not a11y. Deferrable.
  - **`epic-14-bundle-audit.md` FOLLOWUP-1..4** (mime-db, Tiptap, react-big-calendar, Zod) — bundle/perf; Slice I spec explicitly carves these out as deferrable.
  - **`epic-14-contrast-audit.md` menu-list focus-ring sites** (3 files) — accepted by audit, deferrable.

## Followup slices

### Slice F3-1: Activity label renderer — adopt labelTextColor for label.created chip

- **Owner:** epic-executor (sonnet).
- **Scope (allowed paths — touch ONLY these):**
  - `components/activity/renderers/label.tsx` (modify — `text-white` → dynamic text color on the `label.created` chip).
- **Forbidden scope (do NOT touch these — out of scope for this followup):**
  - **Any other activity renderer.** `components/activity/renderers/{group,attachmentRenderers,task,comment,cell,column,_shared}.tsx` are NOT in scope. The other label.* renderers in the same file (`label.renamed`, `label.recolored`, `label.reordered`, `label.deleted`) do not render a colored label chip — they render plain quoted text inside `<span className="font-medium">`. Do NOT modify them.
  - **DB schema.** Do NOT add a `text_color` column to `label` or to `activity_event.payload`. Do NOT write a migration.
  - **`app/globals.css`.** The `--color-label-{color}-text` tokens stay where they are. Do NOT add new tokens.
  - **Other label-color rendering surfaces.** `components/cells/status/Cell.tsx` and `components/cells/status/StatusLabelEditor.tsx` are already fixed by followup-2; do not re-edit. `components/board/timeline/TimelineBar.tsx` renders `text-white` over `var(--color-primary)` (`#0073ea`), which passes WCAG AA (~4.78:1) — and the surrounding `<span>` is also `aria-hidden="true"`; leave it alone.
  - **Dark-mode tooltip `text-white` sites.** That issue is filed back to the orchestrator's epic-level followup queue, NOT this slice. Do not touch any `Tooltip.Popup` in any file.
  - **The label activity payload shape.** Do not change what `getPayloadField<string>(event.payload, "color")` returns — the persisted activity payload is immutable history; we read `color` as-is.
  - Legacy `frontend/` or `backend/` directories.

- **Architectural decision (locked — do not deviate):**
  Use the existing `lib/cells/label-text-color.ts` utility that followup-2 added. Do NOT introduce a parallel implementation, a different threshold, or a different fallback policy. The `color` value here may be `null` or `undefined` (the activity payload could be missing the field); in that case the chip already falls back to `backgroundColor: "var(--color-label-gray)"`, and the foreground color should fall back to `"#000000"` to match — `labelTextColor("var(--color-label-gray)")` returns `"#000000"` correctly via its invalid-input safe-default branch (the CSS-variable string is not a valid hex). To make this intent explicit rather than incidental, the slice **must** call `labelTextColor(color ?? "")` so the safe-default path is hit deterministically.

- **Spec — `components/activity/renderers/label.tsx` modification:**

  Inside the `"label.created"` renderer (lines 12–30), on the inner `<span>` that renders the label name:

  Current (around line 19–24):
  ```tsx
  <span
    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white ml-1"
    style={{ backgroundColor: color ?? "var(--color-label-gray)" }}
  >
    {name}
  </span>
  ```

  Required:
  1. Add import at the top of the file (alongside `import { ActivityLine, getPayloadField, resolveActor } from "./_shared";`):
     ```ts
     import { labelTextColor } from "@/lib/cells/label-text-color";
     ```
  2. **Remove** the `text-white` utility from the className.
  3. **Extend** the inline style with the dynamic foreground color:
     ```tsx
     style={{
       backgroundColor: color ?? "var(--color-label-gray)",
       color: labelTextColor(color ?? ""),
     }}
     ```

  Do NOT change the className apart from removing `text-white`. Do NOT change the `inline-flex`, `items-center`, `px-1.5 py-0.5`, `rounded`, `text-xs`, `font-medium`, `ml-1` utilities. Do NOT change the `{name}` content. Do NOT change the surrounding `<ActivityLine>` wrapper, the `actor` resolution, or the conditional render of `{name ? ... : ""}`.

  The diff for this file should be ~3 lines: one import, one className edit, one style edit.

- **No new test file required.** The unit-test coverage for `labelTextColor` already exists at `tests/unit/cells/label-text-color.test.ts` (15 cases including the safe-default for invalid input that this slice depends on). Adding a renderer-specific test here would be RTL-level (rendering activity events with mocked payloads), and the existing axe-core e2e spec at `tests/e2e/a11y/task-drawer.a11y.spec.ts` is the right level for end-to-end verification once Epic 15 wires the runner.

  Do NOT add a new test file. Do NOT extend `label-text-color.test.ts`.

- **Definition of done (testable):**
  1. `components/activity/renderers/label.tsx` no longer contains the string `text-white` anywhere in the file.
  2. The file imports `labelTextColor` from `@/lib/cells/label-text-color`.
  3. The `label.created` renderer's inner `<span>` has `color: labelTextColor(color ?? "")` on its inline style.
  4. No other lines in the file are changed.
  5. `pnpm typecheck` is clean (no new errors).
  6. `pnpm lint` is clean (no new warnings — 5 pre-existing warnings stay the baseline).
  7. `pnpm test --run` baseline preserved (30 pre-existing failed files; do not introduce new failures).

- **Escalation triggers (return needs-direction; do not invent):**
  - If `labelTextColor` would need to do anything other than read the hex string and return `"#000000"` / `"#ffffff"`, stop and escalate. The fix is intentionally a one-liner.
  - If the audit surfaces a fourth `text-white`-over-label-color site that this slice did not anticipate, stop and escalate — do not silently expand scope.
  - If the `color` payload field is found to use a non-hex format (e.g. a token slug) on any historical event, stop and escalate. The current contract is that `payload.color` holds the same `#RRGGBB` hex that `label.color` does at write time; if archaeology shows otherwise, this slice's fallback needs revisiting.
  - If `pnpm test --run` baseline shifts (i.e. the count of pre-existing failed files or pre-existing failed tests changes), stop and report — that means something else regressed.

- **Forbidden in commit messages / PR body:**
  - Do not claim this enables a "live Lighthouse run." It removes the final known WCAG-AA color-contrast blocker on label rendering in the audited surfaces; the live run is still Epic 15's job.
  - Do not advertise the dark-mode tooltip text-white issue as fixed by this slice. It is explicitly filed for a separate followup.

## Open questions for the user

None. The fix is the same pattern as followup-2: reuse the `labelTextColor` utility that already exists; the file is a single renderer; the third escalation trigger from followup-2 has been resolved by this scoped expansion.
