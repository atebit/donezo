# Epic 14 — Mobile, Accessibility, and Polish

## Goal

Take the desktop-first product to a credible mobile experience and a WCAG 2.1 AA-compliant a11y baseline. Add dark mode, refine the visual polish (loading skeletons, empty states, transitions), scaffold i18n, and run a coordinated audit pass that catches what feature epics missed.

## Why this is its own epic

A11y, mobile, and dark mode were addressed inline in earlier epics — but inconsistently. This epic is the coordinated audit + fix pass that brings everything to a consistent bar before launch.

## In scope

- Mobile layouts: responsive sidebar (drawer), board-list, table view in "stack" mode, task drawer full-screen on small viewports.
- Touch interactions: replace DnD with a "reorder mode" on touch devices; tap-to-edit; long-press context menus.
- Full a11y audit: ARIA, focus management, keyboard nav, screen reader testing, color contrast.
- Dark mode via `next-themes` with a user toggle in the account menu.
- Loading skeletons across major surfaces.
- Empty states across major surfaces (consolidated review).
- Transition / animation pass (Framer Motion or pure CSS — see decisions).
- Reduced-motion support.
- i18n scaffolding: `next-intl` setup with English-only translations, ready for additional locales.
- Browser support matrix and testing (latest 2 versions of Chrome, Firefox, Safari, Edge).

## Out of scope

- Native mobile app.
- Right-to-left layout support (defer; scaffold only).
- High-contrast mode (defer; rely on color choices).
- Print stylesheet (defer).
- Server-side translation; i18n stays client-side for v1.

## Dependencies

All prior epics (this is the polish pass).

## Architecture & design choices

### Responsive breakpoints

Tailwind defaults are fine: `sm: 640`, `md: 768`, `lg: 1024`, `xl: 1280`, `2xl: 1536`.

Three regimes:

- **Mobile** (<768px): single column, drawer sidebar, full-screen task view, table → list-card view.
- **Tablet** (768–1024): collapsible sidebar, table view with reduced columns, task drawer overlays.
- **Desktop** (≥1024): full layout from prior epics.

### Mobile sidebar

A drawer (shadcn Sheet) with the same content as the desktop sidebar. Hamburger button in the topbar opens it. Tapping outside or selecting a board closes it.

### Mobile board view: list-cards

The table doesn't fit on mobile. Instead, render each task as a card:

```
+------------------------------------+
|  ● Status pill   [Title text...]   |
|  Avatar pile                  ⋯    |
|  Due May 15  •  $1,200  •  4 files |
+------------------------------------+
```

Each card shows: title, status (if column exists), assignees, top-3 visible non-empty cells. Tap → task drawer (full-screen on mobile).

The table view code lives in `components/board/table/`; the card view lives in `components/board/cards/`. Shared toolbar.

### Touch DnD: reorder mode

Long-press a card → enters "reorder mode": cards get drag handles, regular tap is disabled, drag works via touch. Tap "Done" to exit. Same for groups.

dnd-kit handles touch sensors well. The "reorder mode" gate prevents accidental drags during scroll.

### Other views on mobile

- Kanban: horizontal swipe between lanes; lane = full-width screen at a time.
- Calendar: agenda mode (a vertical list) by default; month view available but hard to use.
- Timeline: degraded gracefully; render an "Open on desktop" message with a chart of dates as a mini overview.
- Dashboard: widgets stack vertically.
- Form: works fine.

### Accessibility

WCAG 2.1 AA target. Audit checklist:

#### Semantic HTML

- Headings nest properly (`h1` per page, `h2` for sections, no skips).
- Lists are `<ul>`/`<ol>`/`<li>`.
- Buttons are `<button>` (not divs with click handlers).
- Links are `<a>` with `href` (Next.js `<Link>`).

#### ARIA

- All interactive non-native elements have appropriate `role` + `aria-label` / `aria-labelledby`.
- Modals / dialogs: `role="dialog"` + `aria-modal="true"` + focus trap.
- Tabs: `role="tablist"` + `role="tab"` + `aria-selected`.
- Live regions for toasts and notification updates: `aria-live="polite"`.
- Form inputs: `<label>` association.

shadcn primitives (Radix-based) handle most of this automatically; the audit verifies and fills gaps in custom components.

#### Keyboard navigation

- Every interactive element is reachable via Tab.
- Tab order matches visual order.
- Focus visible at all times (focus rings on every interactive element; respect `:focus-visible`).
- Escape closes modals and popovers.
- Arrow keys navigate within tabs, menus, listboxes, calendar.
- Cmd/Ctrl-K opens global search.
- Cmd/Ctrl-/ shows keyboard shortcuts modal.
- Table view: arrow keys navigate cells, Enter to edit, Space to toggle selection. (Implementation in [06](06-groups-tasks-table.md) — verify here.)

#### Screen reader

- Tested with VoiceOver (Safari) and NVDA (Firefox) on the major flows: sign in, create board, edit cell, post comment, mention.
- Live announcements for major state changes (cell updated, comment posted).
- Decorative icons have `aria-hidden="true"`.
- Important icons have accessible labels.

#### Color contrast

- All text vs background ≥ 4.5:1 (AA for body); ≥ 3:1 for large text and graphical elements.
- Status / priority label colors verified against background; white-text labels on dark colors only.
- Don't rely on color alone — pair color with shape or text (e.g., status pill has a label, not just a color dot).

#### Forms

- Errors associated with inputs via `aria-describedby`.
- `required` attributes on required inputs.
- Inline validation announces via `aria-live`.

### Dark mode

`next-themes` provides:

```tsx
<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

`globals.css` has `[data-theme="dark"]` overrides for every token:

```css
[data-theme="dark"] {
  --color-bg: oklch(15% 0 0);
  --color-bg-subtle: oklch(20% 0 0);
  --color-fg: oklch(98% 0 0);
  --color-fg-muted: oklch(70% 0 0);
  --color-border: oklch(28% 0 0);
  /* ... */
}
```

Charts (Recharts) need explicit dark-mode colors; pull from CSS variables.

Toggle in account menu: System / Light / Dark. Stores in `localStorage`.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Plus for any larger animations, gate behind `usePrefersReducedMotion()`.

### Animations

Choice: **CSS transitions for micro-interactions** (hover, focus, modal in/out), **Framer Motion only when needed** (drag previews, list reordering animations). Framer is heavy; keep it scoped.

Animation budget:

- Modal / drawer open/close: 150ms.
- Toast in/out: 200ms.
- Cell value flash on Realtime update: 600ms (gentle bg-color pulse).
- Task drawer slide-in: 200ms.
- Page transitions: none (Next.js handles via Suspense; avoid layout shift).

### Loading states

Three levels:

1. **Page skeletons** (RSC streaming). Each route has a `loading.tsx` that renders the skeleton shape.
2. **Cell-level skeletons** for delayed data (e.g., column avatars before profile fetch).
3. **Action pending states** (button spinner during server-action call).

Skeletons match the final layout to avoid CLS. shadcn provides a `<Skeleton />` primitive.

### Empty states

A standardized `<EmptyState />` component:

```tsx
<EmptyState
  icon={InboxIcon}
  title="No notifications yet"
  description="When teammates @mention you or assign you a task, you'll see it here."
  action={<Button>Configure preferences</Button>}
/>
```

Use across: board list (no boards), board (no groups), notification center (no notifications), search (no results), trash (empty).

### i18n scaffolding

`next-intl`:

- `messages/en.json` with all UI strings.
- `next.config.js` plugin for locale routing (deferred; ship single-locale).
- All user-facing strings flow through `t('key')`.

For v1: ship English-only. The scaffolding ensures we can add a locale later by translating one JSON file. Don't translate user-generated content.

### Performance polish

- Audit Lighthouse on key pages: target ≥ 90 on Performance, ≥ 95 on Best Practices, 100 on Accessibility, 100 on SEO.
- Fix Largest Contentful Paint regressions (if any) with `priority` on hero images.
- Code split per view kind ([12](12-alternate-views.md)) — verify.
- Bundle size budget: <300KB gzip on the board page (initial JS). Audit with `@next/bundle-analyzer`.

### Browser support matrix

- Chrome / Edge latest 2 versions.
- Firefox latest 2 versions.
- Safari latest 2 versions (mac + iOS).
- Mobile Safari iOS 16+.
- Chrome Android current.

No IE 11. Babel target `ES2022` matches.

### Visual polish checklist

A coordinated review pass over:

- Spacing rhythm (8px grid).
- Typography scale (per design tokens).
- Border radii consistency.
- Iconography (one icon library — Lucide).
- Color usage (no hardcoded hex; all via tokens).
- Empty states everywhere needed.
- Loading states everywhere needed.
- Error states everywhere needed.

### Design QA tools

- **Storybook** (if used): visual regression via Chromatic or Percy.
- **Playwright visual snapshots**: capture key screens at three viewports (mobile/tablet/desktop) per PR.

## Visual fidelity requirements

This epic adds dark mode, mobile responsive parity, and a polish pass — none of it should re-derive tokens. Pull from [`design-system.md`](design-system.md) and [`component-system.md`](component-system.md) only.

Must-match:

- **Dark mode tokens** — derive from the locked light tokens (don't reinvent the palette). Recommended approach in [design-system.md §1.1.7](design-system.md#117-overlay--misc): invert `--color-fg`/`--color-surface`, dial label saturation back ~10%, keep `--color-primary` close to `#0073ea`. Apply via `[data-theme="dark"]` overrides on `:root`.
- **Mobile `<MainSidebar />`** — fixed-bottom row at `8vh` height, gap `30px`, hidden tools, hamburger reveals workspace sidebar full-width. See [component-system.md §1.1](component-system.md#11-mainsidebar-icon-column) (mobile contract documented there).
- **Mobile `<WorkspaceSidebar />`** — open state takes 100vw; toggle pill hidden.
- **Reduced motion** — `@media (prefers-reduced-motion: reduce)` overrides any animation longer than `--motion-base` (200ms) to `0ms`. Critically: the workspace-sidebar collapse, board drawer slide-in, and status-fold reveal all need this guard.
- **Skeleton states** — the current app uses shadcn `<Skeleton />` throughout; audit and fill any surfaces that still show a spinner or blank flash. Match the ~36px row height for table skeletons so the page doesn't shift layout on hydration.
- **`<EmptyState />` primitive** — used in trash, no-boards, no-tasks-in-group, favorites-empty. Lock typography: title font-display 24px weight 500, body 14px in `--color-fg-muted`, CTA = primary button.
- **Color contrast** — every label color in [§1.1.5](design-system.md#115-status--priority-palette-monday-colors) must hit WCAG AA against white text. The orange (`#FDAB3D`) and yellow (`#ffcb00`) labels use **black** text at smaller sizes — verify all combinations.
- **Animation pass** — all micro-interactions from [§8.3](design-system.md#83-recurring-micro-interaction-patterns) must work after the polish pass; if any have regressed, fix here.

Don't introduce new tokens here. Only consume.

## Tasks

### Mobile

1. **Responsive sidebar drawer** at <768px.
2. **Topbar mobile mode**: hamburger + workspace name + bell + avatar.
3. **Board list cards view** on mobile.
4. **Reorder mode** (long-press to enter; tap "Done" to exit) for groups + tasks.
5. **Task drawer full-screen on mobile.**
6. **Kanban swipe-between-lanes**.
7. **Calendar agenda mode**.
8. **Timeline degraded view + "Open on desktop" CTA**.
9. **Dashboard stack vertically**.

### Accessibility

10. **A11y audit** of every page using axe-core (Playwright integration). Fix failures.
11. **Keyboard navigation**: ensure tab order, focus visibility, arrow-key nav in tables, modals, popovers.
12. **Screen reader pass** with VoiceOver + NVDA on major flows.
13. **Color contrast audit** of every status/priority label color combo.
14. **Live regions** for toasts and notification arrivals.
15. **Form-error associations** verified.

### Dark mode

16. **`next-themes` provider** at root layout.
17. **Dark token set** in `globals.css`.
18. **Theme toggle** in account menu (System / Light / Dark).
19. **Chart colors** wired to CSS variables.
20. **Visual diff** of every page in dark mode.

### Polish

21. **`<EmptyState />` component** + use everywhere.
22. **`<Skeleton />`** layouts for major routes.
23. **Animation pass**: micro-interactions via CSS, Framer for drag previews only.
24. **Reduced motion**: wrap heavy animations behind `usePrefersReducedMotion`.
25. **Lighthouse audit**: hit targets per page; fix.
26. **Bundle audit**: trim per-route JS to budget.

### i18n

27. **Install `next-intl`** with single-locale config.
28. **Move strings to `messages/en.json`**. All UI text via `t('...')`.
29. **Document the workflow** for adding a locale.

### QA

30. **Playwright visual snapshots** at mobile/tablet/desktop on key pages.
31. **Browser matrix testing** (Sauce Labs or BrowserStack — or manual on a list).

## Definition of done

- Lighthouse Accessibility = 100 on every key page.
- All axe-core checks pass on automated tests.
- Mobile board UX is usable: sign in → see boards → open one → add a task → set status → comment.
- Dark mode toggle works; every screen has dark variants.
- Reduced-motion users see no jarring animations.
- All UI strings flow through `t()`; English-only ships.
- Bundle on the board page is <300KB gzip.
- Visual snapshots cover the main flows; no unexplained diffs.

## Open questions

- **i18n scope.** Internal tool likely doesn't need it for v1. If users are all English-speaking, drop to "we'll do it later, but not now." Recommend: scaffold but don't extract every string yet — just the obvious ones (buttons, page titles).
- **Dark mode default.** System (current plan) vs Light. System is friendlier.
- **Mobile-first features**: anything that mobile would do *better* than desktop? Maybe a "scan a QR to a task" — defer.
- **Touch DnD vs reorder mode.** Reorder mode is friendlier but adds a tap. Test with users.
- **Browser-matrix testing**: BrowserStack costs. For internal tool, may skip and rely on Playwright + manual.
- **Accessibility certification.** Out of scope for an internal tool, but maintaining the WCAG 2.1 AA bar means we're ready if it's later required.
