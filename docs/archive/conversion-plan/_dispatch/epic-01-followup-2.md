# Epic 01 — Followup Round 2 (Design-System Retrofit)

**Status:** approved, ready to dispatch
**Triggered by:** Locked-down design system docs ([`design-system.md`](../design-system.md), [`component-system.md`](../component-system.md)).
**Branch:** `epic/01-followup-design-system` (off current `main`)
**Reviewer verdict (this round):** N/A — this is a forward-spec, not a fix-up.

## Why this round exists

Epic 01 shipped foundation tokens as **placeholder OKLCH neutrals** (per `01-foundation.md`'s "initial set, expand as features need them" line). After the visual-fidelity audit, that contract was upgraded: tokens are now sourced **verbatim from the legacy `frontend/` SCSS** (Monday-derived blue/navy/yellow/green palette + 12 group accents + label palette + motion/z-index/shadow tokens). See [00-overview.md](../00-overview.md) and the locked specs.

This round retrofits epic 01's substrate with those tokens **before any UI epic (05+) starts**, so subsequent UI work consumes the canonical chrome and doesn't have to be re-skinned later.

## Decisions made by user (locked)

| # | Question | Decision |
|---|---|---|
| 1 | Keep dual `@theme` blocks (spec + shadcn) or unify? | **Keep both.** Per epic-01-followup-1 decision #1, unification defers to epic 14. This round updates **values** in both blocks; structure stays. |
| 2 | Token name reconciliation between spec (`--color-bg/fg/border`) and design-system.md (`--color-surface/fg/border`) | **Keep both names.** Add design-system.md tokens as the new canonical set; keep legacy aliases (`--color-bg`, `--color-primary-fg`) as synonyms so existing usages in `app/page.tsx` etc. don't break. Comment them as deprecated; remove in epic 14. |
| 3 | Marketing tokens / fonts | **Drop entirely.** No brand-violet, no home gradients, no Poppins-on-marketing. Poppins still loads for `h1`–`h6` because legacy `_base.scss` applied it app-wide. |
| 4 | Group-color palette user-pickable? | **Yes, locked to the 12 colors** from `util.service.js:65`. Exposed as `--color-group-1` … `--color-group-12`. Component code reads from tokens; users cannot free-pick. (Schema already enforces — labels store hex from a closed set.) |
| 5 | Icon discipline (no `react-icons`, no `@mui/icons-material`) | **Lock at the doc level**, not Biome. `lib/icons.ts` is the canonical re-export; reviewers police direct `lucide-react` imports during code review. (Adding a Biome rule for this would touch `biome.json`, which is a forbidden-scope file per epic-01-followup-1; we don't need automation here.) |
| 6 | Order of slice work | **Two parallel slices, disjoint file scope.** Slice I = `globals.css` + `app/layout.tsx` (substrate). Slice J = `lib/icons.ts` + `components/ui/menu-list.tsx` (additive primitives). |

## Issues being addressed

- **Visual fidelity contract drift.** Without this retrofit, every UI epic from 05 onward would either re-derive tokens (drift) or build against placeholders (need full re-skin later). This round is the substrate so neither happens.
- **Legacy `--color-bg` placeholder palette** in `app/globals.css` is OKLCH-neutral, not the Monday `#0073ea` / `#292f4c` / label palette specified in [`design-system.md`](../design-system.md).
- **Geist font** loaded by shadcn init in `app/layout.tsx` is the wrong family. Donezo uses **Figtree** (body) + **Poppins** (display per `_base.scss` h1–h6).
- **No `<MenuList />` primitive** exists. Every dropdown in epics 05/06/07/09/11 will need it; building it once now de-risks all of them.
- **No `lib/icons.ts`** module. Without one, executors will reach for legacy `react-icons` packages or import `lucide-react` ad-hoc, fragmenting the icon set.

## Issues acknowledged but not fixed in this round

- **Dark mode tokens.** Per [00-overview.md](../00-overview.md) and [14-mobile-a11y-polish.md](../14-mobile-a11y-polish.md), dark mode is owned by epic 14. `.dark` block in `app/globals.css` stays untouched (do not edit, do not delete). Dark-derivation rules already specced in [design-system.md §1.1.7](../design-system.md#117-overlay--misc).
- **shadcn token unification.** Per epic-01-followup-1 decision #1, the two `@theme` blocks coexist for now. Reconciliation is epic 14's problem. This round only **updates values**, not structure.
- **Custom date/time picker chrome.** Defer to [07](../07-column-system.md).
- **Status fold pixel-precise port.** Open question in [component-system.md §10](../component-system.md#10-open-questions); doesn't block this round.

## Slices

Two slices, disjoint file scope, run in parallel.

---

## Slice I — `globals.css` + fonts + body chrome

**Owner:** epic-executor (sonnet) · **Branch:** `epic/01-followup-design-system/slice-i` (off `epic/01-followup-design-system`; merges back via PR)

### Scope (files this slice may touch)

- `/app/globals.css` — replace **values** in the spec `@theme` block; replace **values** in shadcn's `:root` block; add new tokens (label colors, group colors, motion, z-index, shadow, surface variants, cell sizes); add scrollbar styles to `@layer base`; update body's `bg-*` / `text-*` if needed.
- `/app/layout.tsx` — replace `Geist` font import with `Figtree` (body) + `Poppins` (display) from `next/font/google`. Apply `--font-display` to `h1`–`h6` via `globals.css` (not in JSX).
- `/app/page.tsx` — only if existing `bg-bg` / `text-fg` references break after token rename. **Should not be needed** (we're keeping `--color-bg` and `--color-fg` as synonyms). If touched, change must be cosmetic only — no logic changes.

### Forbidden scope

- `/components/ui/button.tsx` — **do not touch.** Once shadcn `--primary` value is updated to Monday blue, the button auto-restyles. Verify with `pnpm dev` and a manual page reload — DO NOT edit JSX or class strings.
- `/components/ui/sonner.tsx` — do not touch. Sonner's theme wiring is fine; `useTheme()` still returns the placeholder, which is correct per epic-01-followup-1 decision.
- `/components/ui/menu-list.tsx` — owned by Slice J.
- `/lib/icons.ts` — owned by Slice J.
- The **`.dark` block** in `app/globals.css` — do not edit, do not delete. Owned by epic 14.
- The **`@theme inline` block** (shadcn-generated) in `app/globals.css` — do not delete or restructure. You **may** edit values inside `:root` that the inline block points at (`--primary`, `--background`, `--border`, etc.). The inline block itself stays as-is.
- Everything else: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `biome.json`, `next.config.ts`, `lib/env.ts`, `lib/utils.ts`, `lib/logger.ts`, `lib/supabase/`, `lib/auth/`, `lib/authorization/`, `lib/actions/`, `lib/validations/`, `lib/cells/`, `lib/realtime/`, `app/(app)/`, `app/(auth)/`, `app/api/`, `app/error.tsx`, `app/not-found.tsx`, `supabase/`, `tests/`, `docs/`, `.github/`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `.env.example`, legacy `frontend/` and `backend/`.

If you discover a need to edit any file outside the scope list, **stop and return a needs-direction report** per `.claude/agents/epic-executor.md`. Do not unilaterally expand scope.

### Dependencies on other slices

None. Independent of Slice J; runs in parallel.

### Spec

#### 1. Replace values in spec `@theme` block

The spec block currently holds OKLCH placeholders. Replace it **in place** with the canonical block from [design-system.md §1.2](../design-system.md#12-appglobalscss-block-canonical), with one modification: keep `--color-bg` and `--color-primary-fg` as **legacy aliases** so existing `app/page.tsx` (`bg-bg`, `text-fg/70`) doesn't break. Mark them deprecated in a comment.

The `@theme` block (lines 9–27 of current `globals.css`) becomes:

```css
@theme {
  /* App surface */
  --color-surface: #ffffff;
  --color-surface-auth: #f7f7f7;
  --color-surface-rail: #F6F7FB;
  --color-surface-nav: #292f4c;
  --color-surface-info: #f5f6f8;
  --color-surface-row-hover: #f4f5f8;
  --color-surface-hover: #dcdfec;
  --color-surface-active: #cce5ff;
  --color-primary-selected: #cce5ff;
  --color-primary-selected-hover: #aed4fc;
  --color-card-selected: #d9f0ff;
  --color-chip-member: #e5f4ff;

  /* Primary (Monday blue) */
  --color-primary: #0073ea;
  --color-primary-hover: #0060b9;
  --color-primary-foreground: #ffffff;
  --color-link: #1f76c2;
  --color-nav-icon: #6c6cff;

  /* Text & border */
  --color-fg: #323338;
  --color-fg-muted: #676879;
  --color-fg-subtle: #c5c7d0;
  --color-fg-strong: #1f1f21;
  --color-border: #d0d4e466;
  --color-border-solid: #d0d4e4;
  --color-border-strong: #a8aebb;   /* baked darken($border-color, 20%) */
  --color-border-rail: #8c93a3;     /* baked darken($border-color, 30%) */
  --color-shadow-card: #c3c6d4;

  /* Status / priority labels (Monday palette) */
  --color-label-green: #00c875;
  --color-label-green-hover: #0f9b63;
  --color-label-green-selected: #80e3ba;
  --color-label-yellow: #ffcb00;
  --color-label-yellow-hover: #c29e11;
  --color-label-yellow-selected: #ffe580;
  --color-label-blue: #579bfc;
  --color-label-blue-hover: #4c7cc1;
  --color-label-blue-selected: #abcdfd;
  --color-label-gray: #c4c4c4;
  --color-label-gray-hover: #98999a;
  --color-label-gray-selected: #e1e1e1;
  --color-label-orange: #FDAB3D;
  --color-label-red: #E2445C;
  --color-label-purple: #A25DDC;
  --color-label-pending: #579BFC;
  --color-label-critical: #333333;

  /* Group accents (12) */
  --color-group-1: #a25ddc;
  --color-group-2: #FBBC04;
  --color-group-3: #F1E4DE;
  --color-group-4: #FDCFE8;
  --color-group-5: #F28B82;
  --color-group-6: #FFF475;
  --color-group-7: #CCFF90;
  --color-group-8: #CBF0F8;
  --color-group-9: #A7FFEB;
  --color-group-10: #D7AEFB;
  --color-group-11: #E6C9A8;
  --color-group-12: #E8EAED;

  /* Overlay */
  --color-overlay: rgba(41, 47, 76, 0.7);

  /* Layout sizes */
  --size-cell-h: 36px;
  --size-cell-w: 140px;
  --size-cell-w-task: 336px;
  --size-cell-w-checkbox: 32px;
  --size-cell-w-conversation: 65px;
  --size-rail-main: 66px;
  --size-rail-workspace: 230px;

  /* Radii */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-pill: 9999px;

  /* Shadows */
  --shadow-modal: -3px 4px 14px rgb(0 0 0 / 20%);
  --shadow-drawer: -6px 0px 14px rgb(0 0 0 / 20%);
  --shadow-card: 0px 4px 8px rgb(0 0 0 / 20%);
  --shadow-bulk-bar: 0px 15px 50px rgba(0, 0, 0, 0.3);

  /* Z-index layers */
  --z-base: 0;
  --z-sticky: 2;
  --z-rail: 10;
  --z-board-header: 30;
  --z-overlay: 50;
  --z-modal: 51;
  --z-drawer: 100;
  --z-popover: 1000;

  /* Motion durations */
  --motion-instant: 100ms;
  --motion-fast: 150ms;
  --motion-base: 200ms;
  --motion-medium: 300ms;
  --motion-slow: 400ms;
  --motion-drawer: 600ms;

  /* Easing */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);

  /* Fonts (set by next/font/google in app/layout.tsx) */
  --font-sans: var(--font-figtree), "Roboto", "Rubik", system-ui, sans-serif;
  --font-display: var(--font-poppins), "Roboto", "Rubik", system-ui, sans-serif;

  /* Legacy aliases (deprecated; kept until epic 14 reconciliation). */
  --color-bg: var(--color-surface);
  --color-bg-subtle: var(--color-surface-rail);
  --color-primary-fg: var(--color-primary-foreground);
}
```

Notes on the block:
- `--color-bg` and `--color-bg-subtle` and `--color-primary-fg` are kept as `var()` aliases so `app/page.tsx`'s `bg-bg` / `text-fg/70` keep working. New code MUST use `--color-surface` / `--color-fg`.
- `--color-fg` and `--color-border` were already in the spec block under those names; values are now Monday-derived.
- `--font-sans` and `--font-display` reference `--font-figtree` and `--font-poppins`, which Slice I task #4 below will set via `next/font/google`.
- `--color-danger`, `--color-success`, `--color-warning` from the old spec block are removed — they were generic placeholders. New code uses the label palette directly (`--color-label-red` for danger, `--color-label-green` for success, `--color-label-yellow` for warning).

#### 2. Replace values in shadcn's `:root` block

The shadcn `:root` block (lines 80–113) drives every shadcn component (Button, Toaster, future Dialog/Popover/etc.). We MUST keep the variable names; we update the values to Monday-derived equivalents.

Replace lines 80–113 with:

```css
:root {
  /* Surfaces */
  --background: #ffffff;                           /* was: oklch(1 0 0) */
  --foreground: #323338;                           /* was: oklch(0.145 0 0) */
  --card: #ffffff;                                 /* was: oklch(1 0 0) */
  --card-foreground: #323338;
  --popover: #ffffff;
  --popover-foreground: #323338;

  /* Primary (Monday blue) */
  --primary: #0073ea;                              /* was: oklch(0.205 0 0) — neutral gray */
  --primary-foreground: #ffffff;

  /* Secondary / muted / accent — surface variants */
  --secondary: #F6F7FB;                            /* surface-rail */
  --secondary-foreground: #323338;
  --muted: #dcdfec;                                /* surface-hover */
  --muted-foreground: #676879;                     /* fg-muted */
  --accent: #cce5ff;                               /* surface-active */
  --accent-foreground: #323338;

  /* Status */
  --destructive: #E2445C;                          /* label-red */

  /* Inputs / borders / focus ring */
  --border: #d0d4e466;
  --input: #d0d4e466;
  --ring: #0073ea;                                 /* focus ring = primary */

  /* Charts (placeholders; epic 12 dashboard owns the real palette). Use label palette. */
  --chart-1: #00c875;
  --chart-2: #ffcb00;
  --chart-3: #579bfc;
  --chart-4: #FDAB3D;
  --chart-5: #A25DDC;

  /* Radius */
  --radius: 0.25rem;                               /* was: 0.625rem — Monday cells use 4px corners */

  /* Sidebar (shadcn's sidebar component tokens) */
  --sidebar: #292f4c;                              /* surface-nav */
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #0073ea;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #F6F7FB;                       /* surface-rail */
  --sidebar-accent-foreground: #323338;
  --sidebar-border: #d0d4e466;
  --sidebar-ring: #0073ea;
}
```

The `@theme inline` block (lines 37–78) maps these to Tailwind utility names — **do not touch** that block. It's shadcn-generated; the values it points at are what we just updated.

The `.dark` block (lines 115–147) — **do not touch**. Owned by epic 14.

#### 3. Add scrollbar styles to `@layer base`

Append to the existing `@layer base` block at the end of `globals.css`:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
    scrollbar-width: thin;
    scrollbar-color: #878787 #D9D9D9;
  }
  *::-webkit-scrollbar {
    width: 8px;
  }
  *::-webkit-scrollbar-track {
    background: #D9D9D9;
  }
  *::-webkit-scrollbar-thumb {
    border-radius: 25px;
    background-color: #A6A5A5;
  }
  body {
    @apply bg-background text-foreground;
    font-size: 18px;
    line-height: 1.6;
  }
  html {
    @apply font-sans;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
    margin: 0;
    padding: 0;
  }
}
```

This merges into the existing block — don't create a second `@layer base`. The `* { @apply border-border outline-ring/50; }` line is preserved (shadcn ships it).

The body font-size 18px + line-height 1.6 matches `_base.scss:50-54`. Heading `font-family: var(--font-display)` matches `_base.scss:46`.

#### 4. Swap Geist for Figtree + Poppins in `app/layout.tsx`

Current state (`app/layout.tsx`):

```ts
import { Geist } from "next/font/google";
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
// ...
<html ... className={cn("font-sans", geist.variable)}>
```

Replace with:

```ts
import { Figtree, Poppins } from "next/font/google";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
```

Update the `<html>` element:

```tsx
<html lang="en" suppressHydrationWarning className={cn("font-sans", figtree.variable, poppins.variable)}>
```

The body's `bg-bg text-fg antialiased` classes stay — those resolve through the legacy aliases we kept in step 1.

#### 5. Verify

After steps 1–4:

1. `pnpm typecheck` — green.
2. `pnpm lint` — green.
3. `pnpm build` — green.
4. `pnpm dev`, open `localhost:3000`:
   - Body background is white (`#ffffff`), not pinkish.
   - "Donezo" h1 renders in Poppins (display).
   - Body copy renders in Figtree (sans).
   - The "Ping" button (which is a `<Button>` from `components/ui/button.tsx`) renders with **Monday blue** (`#0073ea`) background — confirming shadcn `--primary` rewire worked.
   - The "Sign in" link renders with the new `--color-link` (`#1f76c2`).
   - Scrollbar (when present) is the thin gray Monday style.

If the button doesn't go Monday-blue, **stop and escalate** — that's the canary that the shadcn block rewire failed.

### Definition of done

- `app/globals.css` spec `@theme` block contains all canonical tokens from [design-system.md §1.2](../design-system.md#12-appglobalscss-block-canonical), with `--color-bg` / `--color-bg-subtle` / `--color-primary-fg` retained as legacy `var()` aliases.
- `app/globals.css` `:root` block contains Monday-derived values for shadcn variables (`--primary: #0073ea`, `--background: #ffffff`, `--foreground: #323338`, etc.).
- `app/globals.css` `.dark` block is unchanged. `@theme inline` block is unchanged in structure.
- `app/globals.css` `@layer base` includes scrollbar styles, body font-size 18px / line-height 1.6, and `h1`–`h6` `font-family: var(--font-display)`.
- `app/layout.tsx` loads Figtree + Poppins via `next/font/google`, no Geist import remaining.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` all green.
- Manual smoke test: dev server renders Monday blue Ping button, white surface, Figtree body, Poppins headings.

### Escalation triggers

- Ping button doesn't render Monday-blue after restart — shadcn variable rewire failed; investigate before pressing on.
- Existing usages outside the scope list break (e.g., `bg-bg` no longer resolves) — the alias setup needs revisiting; escalate.
- `next/font/google` request fails for Figtree or Poppins (network / Google Fonts unavailable) — escalate; do not silently fall back to a different font.
- Scrollbar styles break on macOS native (the `scrollbar-width: thin` declaration may collide with shadcn defaults) — escalate.

### Commits

Logical commits, e.g.:
- `tokens: replace placeholder palette with Monday-derived tokens in globals.css`
- `tokens: rewire shadcn :root values to Monday palette`
- `chore(layout): swap Geist for Figtree + Poppins`
- `style(base): add scrollbar + body typography to @layer base`

No amend, no force-push.

---

## Slice J — `lib/icons.ts` + `<MenuList />` primitive

**Owner:** epic-executor (sonnet) · **Branch:** `epic/01-followup-design-system/slice-j` (off `epic/01-followup-design-system`; merges back via PR)

### Scope (files this slice may touch)

- `/lib/icons.ts` — **new file.** Re-exports the Lucide icons named in [design-system.md §9.2](../design-system.md#92-mapping-table) under their canonical names. Code outside `lib/icons.ts` imports from this module.
- `/components/ui/menu-list.tsx` — **new file.** Implements the `@mixin menu-modal()` recipe from [_mixins.scss:107-132](../../../frontend/src/assets/styles/setup/_mixins.scss) per [component-system.md §3.2](../component-system.md#32-menumodal-recipe-mixin).

### Forbidden scope

- `/app/globals.css` — Slice I owns it. If you discover that `<MenuList />` needs a token that doesn't exist yet, **stop and escalate** so we can add it to Slice I's token list.
- `/app/layout.tsx` — Slice I owns it.
- `/components/ui/button.tsx` — do not touch.
- `/components/ui/sonner.tsx` — do not touch.
- `/biome.json` — do not add icon-discipline rules. Per decision #5, icon discipline is a code-review concern, not automation.
- Everything else in Slice I's forbidden-scope list, plus all of `lib/` outside the new file you create.

### Dependencies on other slices

None. Runs in parallel with Slice I. (Both can be dispatched simultaneously.)

### Spec

#### 1. Create `lib/icons.ts`

This module is the only place in the codebase allowed to import from `lucide-react`. It re-exports a curated set under canonical names that map back to legacy `react-icons` per the design-system mapping table.

```ts
/**
 * Canonical icon module.
 *
 * The ONLY file allowed to import from `lucide-react`. All other code imports
 * from `@/lib/icons`. Mapping back to legacy react-icons is documented in
 * `docs/conversion-plan/design-system.md` §9.2.
 */
export {
  // Workspace / brand
  Zap as IconLightning,
  Home as IconHome,
  Star as IconStar,
  Pin as IconPin,
  // Status / interaction
  Check as IconCheck,
  Square as IconSquare,
  Circle as IconCircle,
  CirclePlus as IconCirclePlus,
  CircleArrowDown as IconArrowDown,
  CircleArrowRight as IconArrowRight,
  // Menus / overflow
  MoreHorizontal as IconMore,
  MessageSquarePlus as IconCommentAdd,
  MessageCircle as IconComment,
  Maximize2 as IconExpand,
  // Common actions
  Plus as IconPlus,
  X as IconClose,
  XCircle as IconCloseCircle,
  Search as IconSearch,
  Trash2 as IconDelete,
  FilePlus as IconFileAdd,
  Bold as IconBold,
  Menu as IconMenu,
  LogIn as IconLogIn,
  // View kinds
  BarChart3 as IconViewDashboard,
  Columns3 as IconViewKanban,
  User as IconViewPerson,
} from "lucide-react";
```

Notes:
- Names use `Icon` prefix (e.g., `IconStar`) for greppability and to make a "canonical icon" easy to spot in JSX.
- Default Lucide size is `24px`; consumers pass `size={N}` per the design-system §9.2 guidance (`size={20}` for inline cell glyphs, `size={16}` for badges/counts).
- This list covers the icons enumerated in [design-system.md §9.2](../design-system.md#92-mapping-table). New icons get added to this file as later epics need them.

#### 2. Create `components/ui/menu-list.tsx`

The `<MenuList />` primitive implements the legacy `@mixin menu-modal()` chrome — used by ~10 different dropdowns across the app (group menu, task menu, board menu, login-logout, add-column, add-group, chart-type, etc.).

Per [component-system.md §3.2](../component-system.md#32-menumodal-recipe-mixin), the recipe is:

```ts
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Menu list primitive — the canonical chrome for dropdown menus across the app.
 *
 * Implements the legacy @mixin menu-modal() recipe from
 * frontend/src/assets/styles/setup/_mixins.scss:107-132.
 *
 * Usage:
 *   <MenuList>
 *     <MenuListItem onClick={...}>Rename</MenuListItem>
 *     <MenuListItem onClick={...}>Delete</MenuListItem>
 *   </MenuList>
 *
 * Wrap in a <Popover> or <Dialog> for positioning.
 */
export function MenuList({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0 rounded-md border bg-surface p-2 text-sm text-fg shadow-[var(--shadow-modal)]",
        "border-[color:var(--color-border-strong)]",
        "z-[var(--z-popover)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function MenuListItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left",
        "hover:bg-surface-hover",
        "focus-visible:bg-surface-hover focus-visible:outline-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

Token references must use the new tokens added by Slice I:
- `bg-surface` → `--color-surface`
- `text-fg` → `--color-fg` (works via legacy alias OR direct)
- `bg-surface-hover` → `--color-surface-hover`
- `border-[color:var(--color-border-strong)]` → `--color-border-strong`
- `shadow-[var(--shadow-modal)]` → `--shadow-modal`
- `z-[var(--z-popover)]` → `--z-popover`

If any of these utilities don't resolve at build time, that's a sign Slice I hasn't merged yet — **stop and escalate** rather than substituting a different value. Slice I and Slice J merge into the parent epic branch in either order; neither can ship without the other being correct.

#### 3. Verify

1. `pnpm typecheck` — green.
2. `pnpm lint` — green.
3. `pnpm build` — green. (You don't need a JSX usage of `<MenuList />` to verify — the file just needs to compile.)
4. Optional: import `<MenuList>` in `app/page.tsx` temporarily to eyeball it in `pnpm dev`. Revert the temporary import before committing.

### Definition of done

- `lib/icons.ts` exists with the named re-exports listed above.
- `components/ui/menu-list.tsx` exists with `<MenuList>` and `<MenuListItem>` exported.
- Both files compile clean. `pnpm typecheck` + `pnpm lint` + `pnpm build` green.
- No imports from `lucide-react` outside `lib/icons.ts` (verified by `grep -r "from \"lucide-react\"" --include="*.ts*" .` returning only the `lib/icons.ts` line).

### Escalation triggers

- Token utility (`bg-surface`, `bg-surface-hover`, etc.) doesn't resolve — Slice I likely incomplete or merged with bug; coordinate before continuing.
- A Lucide icon listed above doesn't exist in the installed `lucide-react` version (e.g., a rename happened upstream) — escalate; do not silently substitute.
- Existing `lucide-react` imports outside `lib/icons.ts` (currently in `components/ui/sonner.tsx`) — these are pre-existing and out of scope. Do **not** edit `sonner.tsx` to route through `lib/icons.ts`. Migration of the 5 existing icon imports there is deferred to epic 14 along with theme reconciliation; flag it in your handoff report so the followup-3 reviewer knows.

### Commits

Logical commits, e.g.:
- `lib(icons): add canonical lucide-react re-export module`
- `ui(menu-list): add MenuList primitive matching legacy @mixin menu-modal`

No amend, no force-push.

---

## After both slices land — review pass

1. Both slices PR into `epic/01-followup-design-system`. PR-into-main from the followup branch only after both are reviewed.
2. `epic-researcher` (Opus) runs the foundation review pass against the merged followup branch. Definition-of-done check:
   - All locked tokens from [design-system.md](../design-system.md) are in `app/globals.css`.
   - Figtree + Poppins load via `next/font/google`.
   - shadcn `<Button>` renders Monday blue without JSX changes.
   - `<MenuList />` primitive exists and compiles.
   - `lib/icons.ts` is the only `lucide-react` consumer (modulo the pre-existing `sonner.tsx`).
   - Scrollbar matches the legacy thin-gray style.
3. If the review pass surfaces gaps, write `epic-01-followup-3.md` and dispatch.
4. If clean: open the PR from `epic/01-followup-design-system` → `main`. Merge unblocks epic 04 re-planning.

## Cross-references

- Tokens: [`design-system.md`](../design-system.md)
- Component contracts: [`component-system.md`](../component-system.md)
- Original epic spec: [`01-foundation.md`](../01-foundation.md)
- Prior followup: [`_dispatch/epic-01-followup-1.md`](epic-01-followup-1.md)
- Executor rules: [`.claude/agents/epic-executor.md`](../../../.claude/agents/epic-executor.md)
