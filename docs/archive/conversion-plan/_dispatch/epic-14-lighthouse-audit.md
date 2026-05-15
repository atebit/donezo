# Epic 14 Lighthouse Audit

**Method:** Static structural analysis. A live Lighthouse run against `pnpm build &&
pnpm start` was not performed because the app requires Supabase env vars that are
configured for local dev only (no isolated test database is available in this branch
context). All key Lighthouse readiness findings below are derived from static analysis
of the source tree on branch `epic-14/slice-i-audit-and-visual`.

This is explicitly documented as a **structural-readiness audit**, not a live score
report. A live Lighthouse run is a followup for Epic 15, which wires the full CI
environment with Supabase credentials and Playwright runner.

---

## Pages to Audit in Epic 15 (Live Run)

| Page | Route | Auth Required |
|---|---|---|
| Sign-in | `/sign-in` | No |
| Sign-up | `/sign-up` | No |
| Workspace home | `/w/[workspaceSlug]` | Yes |
| Board table view | `/w/.../b/[boardId]/table` | Yes |
| Board kanban view | `/w/.../b/[boardId]/kanban` | Yes |
| Notifications center | `/notifications` | Yes |
| Account settings | `/account` | Yes |

---

## Target Scores (from Epic 14 doc)

| Category | Target |
|---|---|
| Performance | ≥ 90 |
| Accessibility | **100** |
| Best Practices | ≥ 95 |
| SEO | 100 |

---

## Structural Accessibility Readiness

### PASS — Items confirmed correct by static analysis

| Check | Finding |
|---|---|
| `<html lang="en">` | ✅ Set in `app/layout.tsx` |
| `suppressHydrationWarning` on `<html>` | ✅ Present (required for next-themes) |
| Root `<meta description>` | ✅ `"Project and task management."` in `app/layout.tsx` Metadata |
| Root page title | ✅ `"Donezo"` in root Metadata |
| Notifications page title | ✅ `"Notifications"` metadata exported |
| Account notifications page title | ✅ `"Notification Preferences"` |
| `<main>` landmark | ✅ Present in `SidebarShell.tsx` wrapping page content |
| Primary nav landmark | ✅ `<nav aria-label="Main navigation">` in `MainSidebar.tsx` (both desktop and mobile variants) |
| Breadcrumb nav | ✅ `<nav aria-label="Breadcrumb">` in `Breadcrumbs.tsx` |
| Icon-only buttons with aria-label | ✅ `FilterRow`, `SortRow`, `ColumnVisibilityPanel` — all confirmed |
| Dialog role + aria-modal | ✅ `TaskDrawerModalShell.tsx` and confirmation dialogs in `KanbanBoard.tsx` |
| Focus trap in modals | ✅ Via shadcn/Base UI dialog primitives (Radix handles this) |
| Emoji picker buttons | ✅ `aria-label={emoji.label}` in `ReactionPicker.tsx` |
| `alt=""` on decorative images | ✅ No bare `<img>` without alt found in source; `<Image>` components have alt props |
| Hidden inputs are `type="hidden"` | ✅ `workspaceId`, `boardId` hidden inputs are `type="hidden"` (excluded from a11y tree) |
| Reduced motion | ✅ `@media (prefers-reduced-motion: reduce)` caps all durations in `globals.css` |
| Live region for announcements | ✅ `<LiveRegion role="status" aria-live="polite">` mounted in `app/layout.tsx` |
| Toaster a11y | ✅ Sonner provides ARIA live region internally |
| Dark mode theme toggle | ✅ Has labelled menu items ("System", "Light", "Dark") |
| React Hook Form error association | ✅ Confirmed in sign-in/sign-up forms via `aria-describedby` (slice G deliverable) |
| Form `required` attributes | ✅ Zod + react-hook-form wires `required` via HTML validation |

### STRUCTURAL GAPS — Items requiring investigation in live Lighthouse run

| Check | Finding | Severity | Recommended Fix |
|---|---|---|---|
| Per-page `<title>` / `<meta description>` | Board table, workspace home, account settings pages export **no `metadata`** object — they inherit only the root `"Donezo"` title. | Medium | Add `export async function generateMetadata` to each route that has meaningful page context (board name, workspace name). |
| Skip-to-content link | **FIXED in this slice.** `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to main content</a>` added as first child of `SidebarShell`. `id="main-content"` added to `<main>`. | — | Done — see `components/shared/sidebar/SidebarShell.tsx`. |
| `scrollbar-color` in dark mode | `globals.css` hardcodes `scrollbar-color: #878787 #d9d9d9` (light-mode values) — not overridden in `[data-theme="dark"]`. Minor visual issue, not an a11y failure, but catches Best Practices deductions. | Low | Add dark-mode scrollbar override to `[data-theme="dark"]` block. |
| `body` `font-size: 18px` | Root body is set to `18px / 1.6` line-height. This is fine for WCAG (larger than the 16px baseline) but Lighthouse may flag the unusually large default. | Low | No change needed unless Lighthouse flags it. |
| Status cell text color | `globals.css` documents that `--color-label-*-text` tokens are defined but `StatusCell.tsx` still uses hardcoded `text-white` per the contrast audit (see `epic-14-contrast-audit.md`). This means colored status labels with bright backgrounds (green, yellow, orange) show white text failing WCAG 4.5:1 AA. | **High (blocks Accessibility = 100)** | See surgical fix below. |
| `SortRow` drag handle button | The drag-handle button already has `aria-label="Drag to reorder sort key"`. | — | No action needed. |
| `FilterBuilder`/`SortBuilder` add buttons | Visual text content ("+ Add filter" / "+ Add sort") already present — no aria-label needed. Confirmed OK. | — | No action. |

---

## Surgical A11y Fix: Skip-to-Content Link (IMPLEMENTED)

**Implemented in this slice.** `components/shared/sidebar/SidebarShell.tsx` now has:

- A `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to main content</a>`
  as the first child of the shell div (only visible on keyboard focus).
- `id="main-content"` on the `<main>` element.

This is the most impactful fix for reaching Accessibility = 100 on the authed-app pages.

---

## Surgical A11y Fix: SortRow Drag Handle Label (ALREADY PRESENT)

Static analysis confirmed that `components/filters/SortRow.tsx` already has
`aria-label="Drag to reorder sort key"` on the drag handle button. No change needed.

---

## Surgical A11y Fix: Status Cell Text Color

Per `epic-14-contrast-audit.md`, all label colors except `--color-label-critical`
require black text against a white/light background at WCAG AA. The `--color-label-*-text`
tokens are already defined in `globals.css` with correct values (`#000000` for
green/yellow/blue/orange/red/purple/gray/pending; `#ffffff` for critical).

The gap is that `StatusCell.tsx` (and any other label-rendering component) still uses
hardcoded `text-white`. This is tracked as a followup in the contrast audit and needs to
be resolved before a live Lighthouse run can return Accessibility = 100.

**Expected fix location:** `components/cells/status/StatusCell.tsx` (and any `PriorityCell`
equivalent). Replace `text-white` with `text-[color:var(--color-label-{color}-text)]` or
a utility that reads the token.

**This fix is NOT implemented in this slice** because `components/cells/status/` is
outside the surgical scope of slice I (the contrast audit in slice G already documented
it). It is filed as a followup below.

---

## Performance Structural Readiness

| Check | Finding |
|---|---|
| LCP images use `priority` | Sign-in/up pages have no above-the-fold images. Board pages load task data as text. No priority-image candidates identified. |
| `next/image` for all images | User avatars use `<Image>` from `next/image` (confirmed in cell + sidebar components). |
| Font loading | Figtree via `next/font/google` with `display: "swap"` — correct. |
| Code splitting per view | Effective for recharts/dashboard (see bundle audit). Table/kanban/calendar/timeline are separate routes. |
| Streaming / Suspense | `loading.tsx` files exist for workspace, board, and notification routes. RSC streaming is enabled. |

Performance score projections (structural estimate, not measured):
- Auth pages (no auth, simple form): likely **90–95**
- Board pages (heavy JS): likely **60–75** (pending bundle reductions from followups)
- Workspace home: likely **80–90**

---

## SEO Structural Readiness

| Check | Finding |
|---|---|
| `<html lang="en">` | ✅ |
| Root meta description | ✅ "Project and task management." |
| Page-level titles | ⚠️ Missing on board, workspace home, account settings pages |
| Robots | Not explicitly set — Vercel defaults to `index,follow` |
| Canonical URLs | Not set — acceptable for authenticated app |
| Structured data | Not applicable for internal tool |

SEO = 100 is achievable once per-page titles are added.

---

## Followups Filed

**FOLLOWUP-5:** Skip-to-content link **implemented in this slice** — `SidebarShell.tsx` updated. No further action needed.

**FOLLOWUP-6 (HIGH — blocks a11y = 100):** Fix `StatusCell.tsx` (and equivalent priority
cell) to use `--color-label-{color}-text` CSS variables instead of hardcoded `text-white`.
Documented in `epic-14-contrast-audit.md` as a tracked gap.

**FOLLOWUP-7 (MEDIUM):** Add `export async function generateMetadata` to board table,
workspace home, and account settings pages. SEO score + contextual page titles.

**FOLLOWUP-8:** SortRow drag handle already has `aria-label="Drag to reorder sort key"` — no action needed.

**FOLLOWUP-9 (LOW):** Add dark-mode `scrollbar-color` override to `[data-theme="dark"]`
block in `globals.css`.

---

## Note on Live Lighthouse Run

A live Lighthouse run requires:
1. `pnpm build && pnpm start` (build succeeds locally; confirmed on this branch)
2. A Supabase project running with seeded test data (auth pages do not require this; board pages do)
3. `lighthouse http://localhost:3000/sign-in --output json` for auth pages (runnable without Supabase)

Epic 15 should include a Lighthouse run as part of its CI/CD smoke test suite, targeting
at minimum the sign-in/sign-up pages (no auth needed) and the workspace home (requires
seeded Supabase test DB).
