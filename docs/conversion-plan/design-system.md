# Donezo Design System (Locked)

This document is the **canonical visual contract** for the new Next.js + Tailwind app. It is sourced verbatim from the legacy CRA + SCSS frontend at `frontend/` (kept locally per [CLAUDE.md](../../CLAUDE.md)). Every token here must round-trip into `app/globals.css` and `tailwind.config.ts` exactly as defined; new code must reference tokens, never hex literals.

The legacy frontend is the **only** source of truth for color, type, spacing, motion, and component visuals. We are not redesigning the product. Where the legacy SCSS is silent or contradictory, this doc proposes a value and flags it (look for **GAP**).

> Translation rules — read first:
> - `frontend/` uses **SCSS variables**; we use **CSS custom properties** under Tailwind v4's `@theme`. The variable name maps 1:1 (e.g., `$workspace-hover` → `--color-workspace-hover`).
> - SCSS `darken($color, 20%)` is a build-time function that doesn't exist in CSS. Wherever the legacy code calls `darken($border-color, 20%)` we **bake the result into a new token** (`--color-border-strong`) and use that. Do not attempt to recreate `darken()` at runtime.
> - SCSS `rem($px)` and `em($px)` helpers convert px → rem against a 16px root. We use Tailwind's standard rem scale and the same conversions inline.
> - Legacy uses `react-icons` (Bs/Ai/Bi/Hi/Tb sets) and `@mui/icons-material`. New app uses **Lucide React** as the single icon source; mapping table below. Match shape/weight, not the exact icon family.
> - Legacy uses **MUI** + plain SCSS. New app uses **shadcn/ui (Base UI under the hood)**. We re-skin shadcn primitives with our tokens; we do not import MUI.

---

## 1. Color tokens

### 1.1 Source map

Every token below is lifted from `frontend/src/assets/styles/setup/_variables.scss`. The "Where" column is where the value already appears in legacy SCSS. The "New token" column is the CSS custom property name to add to `app/globals.css`. The "Tailwind class" column is the utility name once the token is wired into `@theme`.

> **Marketing-page tokens removed.** The legacy SCSS contained a deep-indigo + electric-violet palette and three home-page gradients (`$home-bg`, `$home-btn-bg-gradient`, etc.) for the public landing page. Per [00-overview.md](00-overview.md), the new app drops marketing entirely — the only public surface is the Google sign-in. None of the marketing tokens carry over.

#### 1.1.2 App surface

| Legacy SCSS | Hex | Role | New CSS variable | Tailwind utility |
|---|---|---|---|---|
| `$app-bg` | `#ffffff` | Default surface (board, modals, cards) | `--color-surface` | `bg-surface` |
| `$login-bg` | `#f7f7f7` | Auth-page wash ([_login-signup.scss:4](../../frontend/src/assets/styles/views/_login-signup.scss)) | `--color-surface-auth` | `bg-surface-auth` |
| `$sidebar-workspace-bg` | `#F6F7FB` | Workspace sidebar (left rail content) | `--color-surface-rail` | `bg-surface-rail` |
| `$sidebar-main-bg` | `#292f4c` | Main sidebar (icon column) — Monday-blue navy | `--color-surface-nav` | `bg-surface-nav` |
| `$board-description-bg` | `#f5f6f8` | Right-pane in board description modal | `--color-surface-info` | `bg-surface-info` |
| `$task-hover-color` | `#f4f5f8` | Row hover wash (task preview) | `--color-surface-row-hover` | `bg-surface-row-hover` |
| `$workspace-hover` | `#dcdfec` | Hover state on sidebar items, menu rows, board tools | `--color-surface-hover` | `bg-surface-hover` |
| `$workspace-board-active` | `#cce5ff` | Active board row in sidebar; "on-typing" cell highlight | `--color-surface-active` | `bg-surface-active` |
| `$primary-selected-color` | `#cce5ff` | Selected primary chip bg (filter active state) | `--color-primary-selected` | `bg-primary-selected` |
| `$primary-selected-hover-color` | `#aed4fc` | Hover on selected chip | `--color-primary-selected-hover` | `bg-primary-selected-hover` |
| `$card-selected-background-color` | `#d9f0ff` | Selected member chip in filter modal | `--color-card-selected` | `bg-card-selected` |
| `$member-modal-item-bg` | `#e5f4ff` | Member chip in member modal | `--color-chip-member` | `bg-chip-member` |

#### 1.1.3 Primary action (Monday blue)

This is the brand-anchor color of the app — used for primary buttons, active tabs, focus rings, comment-count badges, and "live edit" outlines. It must not drift.

| Legacy SCSS | Hex | Role | New CSS variable | Tailwind utility |
|---|---|---|---|---|
| `$board-btn` | `#0073ea` | Primary action bg (New Item, Save), active-tab underline, focus outline | `--color-primary` | `bg-primary` / `text-primary` / `border-primary` |
| `$primary-hover-color` | `#0060b9` | Primary hover (button + tab) | `--color-primary-hover` | `bg-primary-hover` |
| `$link-color` | `#1f76c2` | Inline links inside body copy (board description) | `--color-link` | `text-link` |
| `$text-color-on-primary` | `#ffffff` | Foreground over primary | `--color-primary-foreground` | `text-primary-foreground` |
| `$menu-icon-color` | `#6c6cff` | Apps/menu glyph in main nav | `--color-nav-icon` | `text-nav-icon` |

#### 1.1.4 Text & border

| Legacy SCSS | Hex / value | Role | New CSS variable | Tailwind utility |
|---|---|---|---|---|
| `$primary-text-color` | `#323338` | Default body & heading text | `--color-fg` | `text-fg` |
| `$workspace-icon-color` | `#676879` | Secondary text, sidebar icons, muted labels | `--color-fg-muted` | `text-fg-muted` |
| `$chat-icon-color` | `#c5c7d0` | Inactive chat/comment icon | `--color-fg-subtle` | `text-fg-subtle` |
| `$dark-black` | `#1f1f21` | Hard-contrast text (rare) | `--color-fg-strong` | `text-fg-strong` |
| `$border-color` | `#d0d4e466` (40% alpha) | Soft cell/border lines | `--color-border` | `border-border` |
| `$layout-border-color` | `#d0d4e4` | Solid layout borders, icon-hover wash | `--color-border-solid` | `border-border-solid` |
| `darken($border-color, 20%)` | `#a8aebb` (baked) | Stronger cell borders, focus-visible outlines, divider lines — used pervasively in legacy | `--color-border-strong` | `border-border-strong` |
| `darken($border-color, 30%)` | `#8c93a3` (baked) | Sidebar separator lines | `--color-border-rail` | `border-border-rail` |
| `$task-box-shadow-color` | `#c3c6d4` | Task card shadow color, activity row separator | `--color-shadow-card` | (use in shadow tokens) |

> **Why we bake `darken()`**: SCSS computes it at build time from a hex with 40% alpha; replicating it in CSS at runtime is brittle. The baked values above were computed by applying SCSS's HSL `darken` to the source. If a future change to `--color-border` is needed, recompute these and update.

#### 1.1.5 Status / priority palette ("Monday colors")

These five named colors are the canonical label palette. They map to default status labels (`Done`, `Working on it`, `Stuck`, etc.) and are referenced from `frontend/src/services/board.service.js`. This palette **must** seed the database in [02](02-supabase-schema.md).

| Legacy name | Hex | Hover | Selected | Selected (60% α) | New CSS variable group |
|---|---|---|---|---|---|
| done-green | `#00c875` | `#0f9b63` | `#80e3ba` | `rgba(128,227,186,.6)` | `--color-label-green-*` |
| egg_yolk | `#ffcb00` | `#c29e11` | `#ffe580` | — | `--color-label-yellow-*` |
| bright-blue | `#579bfc` | `#4c7cc1` | `#abcdfd` | — | `--color-label-blue-*` |
| explosive (gray) | `#c4c4c4` | `#98999a` | `#e1e1e1` | — | `--color-label-gray-*` |

Additional label colors used in the default seed (`board.service.js`) but without `-hover`/`-selected` variants in SCSS:

| Name | Hex | Used by default labels |
|---|---|---|
| working-orange | `#FDAB3D` | `Working on it`, `Medium` priority |
| stuck-red | `#E2445C` | `Stuck`, `High` priority |
| review-purple | `#A25DDC` | `Waiting for review` |
| pending-blue | `#579BFC` | `Pending`, `Low` priority |
| critical-black | `#333333` | `Critical` priority |

**GAP**: legacy lacks formal hover/selected ramps for orange/red/purple/critical-black. Recommend deriving them in [02](02-supabase-schema.md) seed using the same SCSS pattern (≈15% darken for hover, ≈35% lighten for selected). Until then, use single-tone for hover (no shift) and same color at 50% alpha for selected.

#### 1.1.6 Group color picker palette

`frontend/src/services/util.service.js:65` defines the 12-color palette offered to users for group accents (the colored left-bar on each group):

```
#a25ddc  #FBBC04  #F1E4DE  #FDCFE8  #F28B82  #FFF475
#CCFF90  #CBF0F8  #A7FFEB  #D7AEFB  #E6C9A8  #E8EAED
```

These should be exposed via `--color-group-1` through `--color-group-12` in `globals.css` so the [color-palette](#color-palette) component reads from tokens. Do not let users free-pick hex values — restrict to this palette to keep boards visually coherent.

#### 1.1.7 Overlay & misc

| Legacy SCSS | Value | Role | New CSS variable |
|---|---|---|---|
| `$react-modal-background` | `rgba(41, 47, 76, 0.7)` | Modal scrim (`.dark-screen`) | `--color-overlay` |

> **GAP — dark mode**: legacy has no dark-mode tokens. Epic [14](14-mobile-a11y-polish.md) adds them. When generating dark variants, derive from the light tokens (do not reinvent the palette): invert `--color-fg`/`--color-surface`, dial back saturation on labels by ≈10%, keep `--color-primary` close to `#0073ea` (Monday's dark-mode primary is essentially unchanged).

### 1.2 `app/globals.css` block (canonical)

Drop this in `app/globals.css` under the existing `@theme`. Replace the placeholder palette installed in [01](01-foundation.md).

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

  /* Primary */
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

  /* Labels (Monday palette) */
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
}
```

> **Tailwind v4 note**: Tailwind v4 reads `@theme` and auto-generates utilities. There is no separate `tailwind.config.ts` for tokens — but a `tailwind.config.ts` may still exist for plugins/content. Don't duplicate the tokens in JS; let `@theme` be the source.

---

## 2. Typography

### 2.1 Fonts

From `_variables.scss:82-83` and `_fonts.scss`:

```scss
$font-family: "Figtree", "Roboto", "Rubik", "Noto Kufi Arabic", "Noto Sans JP", sans-serif;
$title-font-family: "Poppins", "Roboto", "Rubik", "Noto Kufi Arabic", "Noto Sans JP", sans-serif;
```

- **Body / UI:** Figtree (loaded from `frontend/src/assets/fonts/Figtree-Regular.ttf`)
- **Headings / titles:** Poppins (loaded from `frontend/src/assets/fonts/Poppins-Regular.ttf`) — applied to `h1`–`h6` per [_base.scss:46](../../frontend/src/assets/styles/basics/_base.scss).

> **GAP**: legacy ships only a single weight per family (`Regular`). `_base.scss` and component SCSS reference `font-weight: 500/600/700` freely — meaning legacy is silently falling back to the system font for non-400 weights. We **fix this in the new app** by loading variable fonts via `next/font/google`.

#### 2.1.1 Loader (Next.js, in `app/layout.tsx`)

```ts
import { Figtree, Poppins } from 'next/font/google';

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
```

Then in `globals.css`:

```css
@theme {
  --font-sans: var(--font-sans), 'Roboto', 'Rubik', system-ui, sans-serif;
  --font-display: var(--font-display), 'Roboto', 'Rubik', system-ui, sans-serif;
}
```

`font-display` is applied to all `h1`–`h6`.

### 2.2 Base sizes

`_base.scss`:
- `body { font-size: 18px; line-height: 1.6; }`
- `html { line-height: 1.6; }`
- All `h1`–`h6` use `--font-display` with no margin/padding reset values.

> **Decision**: keep the 18px body baseline. Most app surfaces override down to 14px (table cells, modals) — see helper scale below. Don't cargo-cult Tailwind's 16px default; legacy boards visibly use 18px for prose.

### 2.3 Helper / utility scale

From `_helpers.scss` — these are the explicit sizes the legacy app uses. Match them in Tailwind utilities (Tailwind's `text-xs`/`text-sm`/`text-base` already cover most; expose the legacy-named ones too):

| Legacy class | Size | Tailwind equivalent | Common usage |
|---|---|---|---|
| `.fs12` | 12px | `text-xs` | Comment counts, statistic sums |
| `.fs14` | 14px | `text-sm` | Cell content, modal body, sidebar labels, comments |
| `.fs18` | 18px | `text-lg` | Default body |
| `.fs20` | 20px | `text-xl` | Section headers |
| `.fs24` | 24px | `text-2xl` | Board title (narrow+) |
| `.fs28` | 28px | `text-[28px]` | Modal headings |
| `.fs30` | 30px | `text-3xl` | (legacy marketing only — unused in new app) |

### 2.4 Weights (used in legacy)

`400` (default body), `500` (sidebar items, board info, group titles, secondary headings), `600` (group titles, sidebar favorites title), `700` (logo). No use of 800/900.

### 2.5 Line-heights

- Body: `1.6` (set on `html` and `body`)
- Board title (narrow+): `42px` (`_board-header.scss:234`)

> **GAP**: legacy doesn't define a line-height token system. Use Tailwind's defaults (`leading-tight 1.25`, `leading-snug 1.375`, `leading-normal 1.5`, `leading-relaxed 1.625`) and reach for explicit pixel values only when a specific component spec demands it.

---

## 3. Spacing scale

From `_variables.scss:73-79`:

```scss
$spacing-xs:    4px;
$spacing-small: 8px;
$spacing-medium:16px;
$spacing-large: 24px;
$spacing-xl:    32px;
$spacing-xxl:   48px;
$spacing-xxxl:  64px;
```

Tailwind's default scale (`1=4px, 2=8px, 4=16px, 6=24px, 8=32px, 12=48px, 16=64px`) already covers these 1:1. **Use Tailwind's numeric scale; don't introduce custom names.** A name-mapping cheatsheet for porting SCSS:

| Legacy | Tailwind |
|---|---|
| `$spacing-xs` | `1` (4px) |
| `$spacing-small` | `2` (8px) |
| `$spacing-medium` | `4` (16px) |
| `$spacing-large` | `6` (24px) |
| `$spacing-xl` | `8` (32px) |
| `$spacing-xxl` | `12` (48px) |
| `$spacing-xxxl` | `16` (64px) |

---

## 4. Layout dimensions

From SCSS, hard-coded constants that components depend on. These are part of the visual contract, not "magic numbers":

| Token | Value | Used in |
|---|---|---|
| `$workspace-width` | `255px` | Workspace sidebar open width (also `230px` literal in `_workspace-sidebar.scss:11` — keep `230px`; `255` is dead) |
| `$cell-height` | `36px` | All table cells (rows + headers) |
| `$cell-width` | `140px` | Default column min-width |
| `$cell-width-task` | `336px` | Task title column |
| `$cell-width-person` | `140px` | Person column |
| `$cell-width-conversation` | `65px` | Comments column |
| `$cell-width-checkbox` | `32px` | Bulk-select column |
| Main sidebar min width | `66px` | `_main-sidebar.scss:4` |
| Workspace sidebar (open) | `230px` | `_workspace-sidebar.scss:11` |
| Workspace sidebar (collapsed, narrow+) | `30px` | `_workspace-sidebar.scss:19` |
| Mobile bottom nav height | `8vh` | `_main-sidebar.scss:111` |
| Board header sticky offset | `0` (header) / `182–211px` (group/title) | `_group-preview.scss:39, 119` |

Expose these as CSS variables (`--size-cell-h`, `--size-cell-w`, `--size-cell-w-task`, etc.) so we don't hard-code in component code.

---

## 5. Radii

Legacy doesn't tokenize radii — it inlines them. Observed values:

| Value | Where |
|---|---|
| `4px` | Cell focus outlines, board active row, buttons in modals, board tools, status fold edge |
| `5px` | Primary action button (`.add-btn` board filter), task card kanban |
| `6px` | Board tools, sticky-div task corners |
| `8px` | Modals (dynamic-modal, board-modal), task card kanban inner, lightning workspace icon |
| `10px` | Sidebar hover wash radius |
| `25px` | Scrollbar thumb |
| `50%` | Avatars, comment count, member chips |

Lock to a tighter scale to clean this up:

```css
@theme {
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-pill: 9999px;
}
```

Map: most cell/button corners → `--radius-xs`, board-tool corners → `--radius-sm`, modals → `--radius-md`, sidebar hover wash → `--radius-lg`, pills/avatars/CTA → `--radius-pill`.

---

## 6. Shadows

Legacy inlines shadows too. Canonical values:

| Token | Value | Where |
|---|---|---|
| `--shadow-modal` | `-3px 4px 14px rgb(0 0 0 / 20%)` | Dynamic modal, member modal, login-logout, create-board |
| `--shadow-drawer` | `-6px 0px 14px rgb(0 0 0 / 20%)` | Board modal (right-side drawer when open) |
| `--shadow-card` | `0px 4px 8px rgb(0 0 0 / 20%)` | Kanban task card |
| `--shadow-bulk-bar` | `0px 15px 50px rgba(0, 0, 0, 0.3)` | Floating bulk-action bar |

---

## 7. Z-index layers

Lock these as named layers — legacy uses raw integers liberally, which causes stacking bugs:

| Layer | Value | Where used |
|---|---|---|
| `--z-base` | `0` | Default flow |
| `--z-sticky` | `2` | Sticky group/task headers |
| `--z-rail` | `10` | Login-logout, menu modal, dropdown chips |
| `--z-board-header` | `30` | Board header sticky bar |
| `--z-overlay` | `50` | Workspace toggle, dark-screen scrim |
| `--z-modal` | `51` | Create-board, board-description |
| `--z-drawer` | `100` | Board modal (right-side task drawer), invite modal, task-tools |
| `--z-popover` | `1000` | dynamic-modal (cell pickers / menus) |

Reference these in components (`z-[var(--z-modal)]`) instead of arbitrary integers.

---

## 8. Motion / micro-interactions

Legacy is **not formally tokenized**, but a clear pattern emerges across SCSS. Lock these tokens to dedupe:

### 8.1 Duration tokens

| Token | Value | Derived from |
|---|---|---|
| `--motion-instant` | `100ms` | `add-btn` color shift `.1s` ([_group-preview.scss:75](../../frontend/src/assets/styles/cmps/group/_group-preview.scss)) |
| `--motion-fast` | `150ms` | task-tools-modal opacity/transform `150ms` |
| `--motion-base` | `200ms` | All `.2s` transitions: sidebar items, sidebar workspace open/close inner content, hover sidebar, board filter active, group title-info opacity |
| `--motion-medium` | `300ms` | `.3s` transitions: sidebar icon-link bg, opacity ease |
| `--motion-slow` | `400ms` | board-filter add-btn `.4s`; workspace-sidebar collapse/expand `.4s` |
| `--motion-drawer` | `600ms` | board-modal (right-side drawer) transform `.6s` |

### 8.2 Easing

Legacy almost universally relies on browser default easing (`ease`) and a few explicit `ease-out`/`ease-in-out`. Standardize:

| Token | Value | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default for color/bg/transform on hover |
| `--ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | Drawer slide, sidebar collapse |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Status fold expand (`status-priority-picker`) |

Tailwind v4 already supplies `ease-in`/`ease-out`/`ease-in-out`; expose the named tokens on top.

### 8.3 Recurring micro-interaction patterns

These are the visible "Monday-feel" moments. Components implementing them must match the timing, not just the visual.

| Pattern | Spec | Source |
|---|---|---|
| **Row hover reveals** | Background `--color-surface-row-hover`, hidden controls (`task-menu .icon`, `open-task-details`, `add-number-icons`) opacity `0 → 1` over `--motion-base` | task-preview, group-preview, number-picker |
| **Sidebar item hover** | `bg-color` shift to `--color-surface-hover`, radius `4px`, transition `--motion-base` | workspace-sidebar `.workspace-btns > * { transition: .2s }` |
| **Workspace sidebar collapse** | Width animates `0 ↔ 230px` over `--motion-slow`; inner content opacity `0 ↔ 1` with `transition-delay: .25s` so it fades in *after* the rail finishes opening | _workspace-sidebar.scss:7-25 |
| **Toggle workspace pill** | Hover grows horizontal padding (`8px → 16px`) and color-flips to `--color-primary` over `--motion-base` | _workspace-sidebar.scss:194-208 |
| **Status pill "fold" reveal** | On status cell hover, a triangular fold grows from 0 → 10×10 → 15×15 px in the top-right corner, transitioning `border-width` over `--motion-base` with `transition-delay: .2s` | _status-priority-picker.scss:6-28 |
| **Avatar shrink-on-hover** | Logged-user avatar in main sidebar `transform: scale(.9)` over `--motion-base` | _main-sidebar.scss:48-53 |
| **Board "+ New Item" button** | Halves of split-button independently round their corners (5px) on hover over `--motion-slow`; bg → `--color-primary-hover` | _board-filter.scss:43-66 |
| **Search expand** | Search input width `58 → 140px` over `--motion-medium` on focus; chrome border on focus uses `--color-primary` | _board-filter.scss:90-110 |
| **Board drawer slide-in** | `transform: translateX(100% → 0)` over `--motion-drawer`, paired with shadow fade | _board-modal.scss:9-23 |
| **Active-tab indicator** | 2px bottom border in `--color-primary`; no animated underline (snap-on) | _board-header.scss:155-157, _board-modal.scss:58-60 |
| **Cell on-typing wash** | While editing: `bg-color` `--color-surface-active` (light blue `#cce5ff`) — signals "this cell is live" | _task-preview.scss:15-17, 128-131 |
| **Focus outline** | `outline: 1px solid --color-primary` on inputs/contenteditable cells; hover preview uses `outline: 1px solid --color-border-strong` | _task-preview.scss:147-153 |
| **Group color stripe** | 6px solid left border on `.sticky-div`, color = group's chosen accent. Defines the row's group identity visually | _group-preview.scss:299 |

### 8.4 Reduced motion

Legacy ignores `prefers-reduced-motion`. The new app must wrap any animation with duration > `--motion-base` in `@media (prefers-reduced-motion: no-preference)` — see [14](14-mobile-a11y-polish.md).

---

## 9. Iconography

### 9.1 Source

- Legacy: `react-icons` (Bs, Ai, Bi, Hi, Hi2, Tb sets) + `@mui/icons-material`. ~30+ icons used across the app.
- New app: **Lucide React** (`lucide-react`). One library. No MUI.

### 9.2 Mapping table

Match shape and visual weight, not the exact icon family. Below is the mapping for icons that carry product meaning. Decorative icons can be re-picked freely from Lucide.

| Legacy icon | Where used | Lucide equivalent |
|---|---|---|
| `BsFillLightningFill` | Workspace logo glyph (green tile) | `Zap` (filled) |
| `BsCheckSquare` / `BsSquare` | Checkbox cell | `Check` / `Square` |
| `BsBarChart` / `BsKanban` / `BsPersonCircle` | View tabs (Dashboard / Kanban / Person) | `BarChart3` / `Columns3` / `User` |
| `BsStar` | Star/favorite | `Star` |
| `BsPinAngle` | Pin | `Pin` |
| `BsArrowDownCircle` / `BsArrowRightCircle` | Section navigation arrows | `CircleArrowDown` / `CircleArrowRight` |
| `BsFillCircleFill` | Color-palette swatch | `Circle` (filled via `fill-current`) |
| `BsFillPlusCircleFill` | Add-circle CTA | `CirclePlus` |
| `BiDotsHorizontalRounded` | Row/group/board overflow menu | `MoreHorizontal` |
| `BiMessageRoundedAdd` | "Add comment" cell affordance | `MessageSquarePlus` |
| `BiLogIn` | Login | `LogIn` |
| `AiOutlinePlus` | Add-button glyph (rotates 45° to become "X") | `Plus` (rotation already specced) |
| `AiOutlineClose` / `AiFillCloseCircle` | Close button (modals, chips) | `X` / `XCircle` |
| `AiOutlineSearch` | Search | `Search` |
| `AiOutlineDelete` | Delete | `Trash2` |
| `AiOutlineFileAdd` | File picker cell | `FilePlus` |
| `AiOutlineBold` | Rich-text toolbar bold | `Bold` |
| `AiOutlineStar` / `AiOutlineMenu` | Outline star, hamburger | `Star` (outline) / `Menu` |
| `AiFillHome` | Home glyph (workspace icon overlay) | `Home` |
| `HiOutlineChatBubbleOvalLeft` | Inactive comment indicator | `MessageCircle` |
| `TbArrowsDiagonal` | "Open task" expand | `Maximize2` |

> **Spacing & sizing**: legacy icons run `font-size: 16–28px` mapped to `rem()` units. In the new app, default Lucide size is `24px`; pass `size={20}` for inline cell glyphs and `size={16}` for badges/counts. Use `stroke-width={2}` (Lucide default) for everything except `Maximize2` and other expand affordances which look better at `1.5`.

### 9.3 Custom assets

The legacy logo is a PNG (`frontend/src/assets/img/logo.png`). For the new app, create an SVG version preserving the silhouette. Until then, place the PNG in `public/logo.png` and use `next/image`. **Do not** ship the legacy `loader.gif`; the new app uses `<Skeleton />` (see [14](14-mobile-a11y-polish.md)).

---

## 10. Scrollbar

`_base.scss:1-20`:

```css
* {
  scrollbar-width: thin;
  scrollbar-color: #878787 #D9D9D9;
}
*::-webkit-scrollbar { width: 8px; }
*::-webkit-scrollbar-track { background: #D9D9D9; }
*::-webkit-scrollbar-thumb {
  border-radius: 25px;
  background-color: #A6A5A5;
}
```

Replicate verbatim in `globals.css`. The thin gray scrollbar is part of the visual identity — TanStack Virtual will inherit it.

---

## 11. Breakpoints

From `_variables.scss:86-88` and `_mixins.scss:3-25`:

| Legacy mixin | px | Tailwind class |
|---|---|---|
| `for-mobile-layout` | up to `460+40 = 500px` | `max-md:` (≤ 768) — *closest match* |
| `for-narrow-layout` | from `500px` | `md:` (≥ 768) — *closest match* |
| `for-normal-layout` | from `760px` | `lg:` (≥ 1024) — *closest match* |
| `for-wide-layout` | from `1000px` | `xl:` (≥ 1280) — *closest match* |

**Decision**: legacy breakpoints don't align with Tailwind's defaults and are smaller across the board. Use Tailwind defaults for the new app (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`). The legacy breakpoints were CRA-era assumptions about a single-screen reality; the new app should target modern device classes. Mobile parity is a [14](14-mobile-a11y-polish.md) deliverable.

---

## 12. How this lands

Implemented as an **epic 01 followup slice** ([`_dispatch/epic-01-followup-1.md`](_dispatch/epic-01-followup-1.md)) running before any further UI epic kicks off. After it merges, all subsequent UI epics (05+) consume this doc and [`component-system.md`](component-system.md) for their "Visual fidelity requirements" section — they never re-derive tokens.
