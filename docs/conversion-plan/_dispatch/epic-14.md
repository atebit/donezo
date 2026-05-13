# Epic 14: Mobile, Accessibility, and Polish — Dispatch Plan

## Preconditions verified

- Epics 01–13 merged into `main` (HEAD at `8163f92`, last merge: epic/13-notifications).
- Repo layout matches plan: `app/(app)/`, `app/(auth)/`, `components/board/{table,kanban,calendar,timeline,dashboard,form,shared}`, `components/{cells,comments,activity,filters,shared,ui,notifications,attachments,rich-text}`, `lib/`, `hooks/`, `stores/`, `emails/`.
- `next-themes@^0.4.6` already in dependencies (epic 14 needs it). Not yet wired into `app/layout.tsx` — verified.
- `framer-motion` NOT installed (animation slice will gate behind decision; CSS-only is the cheaper default and matches the epic doc's stated preference).
- `next-intl` NOT installed (i18n slice will add).
- `axe-core` / `@axe-core/playwright` NOT installed (a11y audit slice will add).
- Tailwind v4, shadcn `base-nova`, Base UI, design tokens locked in `docs/conversion-plan/design-system.md` and `app/globals.css` — already light-mode complete.
- shadcn `<Skeleton />` primitive NOT yet in `components/ui/` (only `button.tsx`, `input.tsx`, `label.tsx`, `menu-list.tsx`, `sonner.tsx`). Will be added by polish slice.
- shadcn `<Sheet />` NOT yet in `components/ui/`. Mobile slice will add.
- Existing `components/shared/empty-states/` already has some primitives — verify and consolidate, do not invent in parallel.
- Playwright wiring is deferred to epic 15 per `package.json` script (`test:e2e: echo 'playwright wired in epic 15' && exit 0`). Visual snapshots + axe-core E2E must therefore be planned as Vitest-only or as Playwright scaffolding that runs in epic 15. We will scaffold Playwright **specs only** (no CI wiring) and leave runtime to epic 15 — see Risk notes.
- Legacy `frontend/` and `backend/` are local-only / gitignored. No imports from them.

## Open questions for the user

Per the operator's standing instruction to proceed without pausing, decisions made (the user can redirect):

1. **Animation library.** The epic doc prefers "CSS for micro, Framer only for drag previews." dnd-kit already provides drag previews; we have no concrete need for Framer. **Decision:** CSS-only. Do not install framer-motion. If a specific interaction proves to need it later, add as a followup.
2. **i18n scope.** Doc recommends scaffold-don't-extract-everything. **Decision:** install `next-intl`, configure single-locale (`en`), extract only top-level navigation strings + page titles + button labels in shared primitives, and document the workflow. Do not retro-translate every existing string in this epic.
3. **Dark mode default.** **Decision:** `defaultTheme="system"` per the epic doc and design-system.md.
4. **Browser-matrix testing.** **Decision:** skip BrowserStack/SauceLabs; rely on Playwright on Chromium + Firefox + WebKit (scaffolded; run lands in epic 15). Document the matrix.
5. **Playwright runtime.** Since epic 15 owns CI wiring for Playwright, this epic scaffolds the visual snapshot + axe specs and a local `playwright.config.ts`, but the `pnpm test:e2e` script stays a no-op until epic 15. Slices write specs but do not change the script.
6. **Reorder mode UX.** Long-press to enter; tap "Done" pill to exit. Same for tasks and groups. dnd-kit `TouchSensor` with `delay: 250, tolerance: 5` for the long-press, and a Zustand UI flag `reorderMode` to gate sortable behavior on touch.

If the user disagrees with any of these, slice specs can be adjusted before dispatch.

## Stage 1 — Foundation (parallel-safe)

Three slices that do not touch each other's file scope. All must merge before stage 2 starts.

### Slice A: Dark mode + theme provider

- **Owner:** epic-executor (sonnet)
- **Scope:**
  - `app/layout.tsx` — wrap `{children}` with `<ThemeProvider>` from `next-themes`. Add `suppressHydrationWarning` on `<html>`. Do not touch any other content.
  - `components/shared/theme/ThemeProvider.tsx` — new client component, thin wrapper around `next-themes` `ThemeProvider` with `attribute="data-theme"`, `defaultTheme="system"`, `enableSystem`.
  - `components/shared/theme/ThemeToggle.tsx` — new client component, account-menu item (System / Light / Dark) using Base UI `Menu` or shadcn primitive already present. Persists via next-themes (which uses localStorage).
  - `app/(app)/_components/AccountMenu.tsx` (or whatever the existing account menu file is — locate first; if not exact name, add an item to the existing component without restructuring it). **Limit:** add one menu item only. Do not refactor.
  - `app/globals.css` — add `[data-theme="dark"] { ... }` overrides on `:root` for every token defined in light mode. Match the recipe in `design-system.md §1.1.7` (invert `--color-fg`/`--color-surface`, dial label saturation back ~10%, keep `--color-primary` at `#0073ea`). Add nothing else.
- **Forbidden scope:** any feature component (board/, cells/, comments/, etc.), any chart, any test outside `tests/unit/theme/`. No new tokens; only dark overrides of existing tokens.
- **Dependencies on other slices:** none.
- **Spec:**
  - Provider must render no UI; pure context.
  - Toggle order in menu: System, Light, Dark. Icon per option (Lucide: `Monitor`, `Sun`, `Moon`).
  - `ThemeToggle` MUST guard against SSR mismatch (`useEffect` to mark mounted, render a non-interactive placeholder pre-mount).
  - Persisted key: default `next-themes` key (`theme`).
  - All dark tokens MUST come from `design-system.md`; do not invent values. If a value isn't documented, escalate.
- **Tests:**
  - `tests/unit/theme/ThemeToggle.test.tsx` — renders three options, calls `setTheme` on click.
  - `tests/unit/theme/ThemeProvider.test.tsx` — wraps children, default theme `system`.
- **Definition of done:**
  - Toggle in account menu changes `data-theme` on `<html>` between `light`/`dark`/`system`.
  - Page renders correctly in both modes (manual smoke).
  - Vitest passes; typecheck passes; biome clean.
  - No new dependencies (next-themes already installed).
- **Escalation triggers:** account menu file does not exist (locate before assuming); a dark token value is undocumented in `design-system.md`; user-preference persistence conflicts with an existing localStorage key.

### Slice B: Mobile shell (drawer sidebar + topbar + reduced-motion + skeleton primitive)

- **Owner:** epic-executor (sonnet)
- **Scope:**
  - `components/ui/sheet.tsx` — add shadcn `Sheet` primitive (`pnpm dlx shadcn@latest add sheet`). Slice owns this file.
  - `components/ui/skeleton.tsx` — add shadcn `Skeleton` primitive. Slice owns this file.
  - `components/shared/sidebar/MainSidebar.tsx` and `WorkspaceSidebar.tsx` — add responsive behavior per `component-system.md §1.1` (mobile contract). Mobile (<768px): MainSidebar becomes a fixed-bottom row at `8vh`, gap `30px`, tools hidden; hamburger triggers a `Sheet` that renders WorkspaceSidebar full-width (`100vw`), toggle pill hidden.
  - `components/shared/topbar/Topbar.tsx` (or current filename — verify) — mobile mode: hamburger + workspace name + bell + avatar; full mode unchanged on `md:`+.
  - `hooks/useMediaQuery.ts` — new hook returning `boolean` for a Tailwind breakpoint (input: `'(min-width: 768px)'` etc.). SSR-safe (returns `false` until mount).
  - `hooks/usePrefersReducedMotion.ts` — new hook returning `boolean`.
  - `app/globals.css` — append a `@media (prefers-reduced-motion: reduce)` block that caps `animation-duration` / `transition-duration` to `0.01ms` for elements not explicitly opted out. Do not touch dark-mode tokens (slice A owns).
- **Forbidden scope:** dark mode tokens, board view files (`components/board/**`), cell files (`components/cells/**`), notification center, account menu items.
- **Dependencies on other slices:** none. Shares `app/globals.css` with slice A — **partition by section**: slice A owns the `[data-theme="dark"]` block (append at end of file under a `/* === dark mode === */` comment). Slice B owns the `@media (prefers-reduced-motion)` block (append under `/* === reduced motion === */`). Both append; neither edits the other's section. Merge stage will verify no overlap.
- **Spec:**
  - Sidebar drawer state lives in component-local state OR a small Zustand store key (`useUiStore.mobileSidebarOpen`). Pick the one already conventional in the repo (locate `stores/` first). If a `useUiStore` exists, add the key there; otherwise local state.
  - The drawer renders the **same** `WorkspaceSidebar` component used on desktop. No content duplication.
  - Mobile topbar height matches design-system token `--height-topbar` (already locked).
  - `usePrefersReducedMotion` uses `window.matchMedia('(prefers-reduced-motion: reduce)')` with event listener and SSR-safe default `false`.
- **Tests:**
  - `tests/unit/hooks/useMediaQuery.test.tsx` — mocks matchMedia, asserts response.
  - `tests/unit/hooks/usePrefersReducedMotion.test.tsx` — same.
  - `tests/unit/shared/sidebar/MainSidebar.mobile.test.tsx` — at <768px renders bottom row; hamburger click opens sheet; sheet renders WorkspaceSidebar.
- **Definition of done:**
  - Sidebar drawer opens/closes on hamburger click at <768px.
  - Above 768px, sidebar layout unchanged (visual regression check by tester).
  - Reduced-motion media query caps animations.
  - Vitest passes; typecheck passes; biome clean.
- **Escalation triggers:** existing sidebar files use a different name; existing Zustand UI store conflicts; design-system mobile contract is ambiguous (escalate with a quote).

### Slice C: Polish primitives — EmptyState + Skeleton layouts catalog

- **Owner:** epic-executor (sonnet)
- **Scope:**
  - `components/shared/empty-states/EmptyState.tsx` — consolidate (or create if missing) the canonical primitive matching the spec in epic doc (icon, title, description, optional action). Lock typography: title font-display 24px weight 500, body 14px in `--color-fg-muted`, CTA = primary button. If a primitive exists, refactor consumers — but only if scope stays inside `components/shared/empty-states/` and the call-sites directly referencing the old name.
  - `components/shared/empty-states/index.ts` — barrel.
  - **Inventory step (slice deliverable, not implementation):** the executor MUST audit and list every consumer site needing an empty state from the epic doc's enumeration (trash, no-boards, no-tasks-in-group, favorites-empty, notification center, search, board no-groups). Output the inventory as a markdown file at `docs/conversion-plan/_dispatch/epic-14-empty-state-inventory.md`. Do NOT modify the call-sites yet — that is stage 2 work where parallel slices own their own surfaces. The inventory is the handoff.
  - Skeleton layouts under `components/shared/skeletons/` — add ONE per major route shape: `BoardTableSkeleton.tsx`, `BoardKanbanSkeleton.tsx`, `BoardListSkeleton.tsx`, `DashboardSkeleton.tsx`, `NotificationCenterSkeleton.tsx`, `WorkspaceSidebarSkeleton.tsx`. Each is a server-safe pure presentational component composed of `<Skeleton />` (from slice B). Match ~36px table row height to avoid CLS.
  - Add `loading.tsx` files **only where they do not exist** under `app/(app)/w/[workspaceSlug]/`, `app/(app)/w/[workspaceSlug]/b/[boardId]/`, `app/(app)/notifications/`. Each `loading.tsx` renders the matching skeleton. Do not replace existing `loading.tsx` files; check `git ls-files app/**/loading.tsx` first.
- **Forbidden scope:** sidebar files (slice B), theme files (slice A), board view internals, cell components, notification rendering.
- **Dependencies on other slices:** depends on slice B for `<Skeleton />`. **This makes slice C SEQUENTIAL after B**, not parallel. Promote slice C to stage 2 (see below).

### Revised stage 1 = parallel slices A + B only.

## Stage 2 — Surface polish (parallel-safe, runs after stage 1 lands)

Six slices, each owns one surface. Empty-state and skeleton consumption + dark-mode visual verification happens inside each slice's scope.

### Slice C (now stage 2): Polish primitives — EmptyState + Skeleton layouts catalog

(Spec as above in stage 1; moved to stage 2 due to dependency on slice B.) Must merge before D–I dispatch (they consume it).

### Slice D: Mobile board — card list view + reorder mode

- **Owner:** epic-executor (sonnet)
- **Scope:**
  - `components/board/cards/` — new directory. Files:
    - `BoardCardList.tsx` — client component rendering tasks as cards on mobile.
    - `BoardCard.tsx` — single card (title, status pill, assignee avatars, top-3 visible non-empty cells, due/money/files summary). Tap opens task drawer.
    - `BoardCardSkeleton.tsx` — uses primitives from slice C.
    - `index.ts` — barrel.
  - `components/board/shared/ReorderModeToggle.tsx` — pill button shown only on touch + in reorder mode; tap to exit. Long-press anywhere on a card to enter.
  - `stores/useBoardUi.ts` (or wherever board UI state lives — verify) — add `reorderMode: boolean` and `setReorderMode`. If no store exists, scope to a small new one at `stores/useBoardMobileStore.ts`.
  - `components/board/table/` — gate the table view on `md:` breakpoint inside `BoardTable.tsx` or its parent. Below `md`, render `<BoardCardList />` instead. Locate the actual parent first (likely `components/board/table/BoardTable.tsx` or a wrapper in `components/board/`). Do NOT duplicate data fetching.
  - dnd-kit sensor wiring: add `TouchSensor` with activation constraint `{ delay: 250, tolerance: 5 }` to the existing sortable context for tasks and groups. Gate `sortable` behavior on `reorderMode === true` on touch devices; mouse drag stays as-is on desktop.
- **Forbidden scope:** non-table views (kanban/calendar/timeline/dashboard/form — other slices own); task drawer internals beyond confirming it goes full-screen on mobile (slice E owns); cell components themselves; sidebar; topbar.
- **Dependencies on other slices:** slice B (Sheet/Skeleton), slice C (EmptyState, BoardListSkeleton).
- **Spec:**
  - Card shows: title (truncate at 2 lines), status pill if a status column exists, top 3 visible non-empty cells (column.visible && cell.value), assignee avatars, and a summary row of `Due {date} • {money formatted} • {N files}` (omit any segment whose value is null).
  - On tap (no reorder mode): navigate to existing task drawer route.
  - Long-press 250ms triggers reorder mode; tap "Done" pill to exit. Reorder mode hides the tap-to-open affordance and enables drag handles on cards.
  - Empty state (no tasks): use `<EmptyState />` from slice C with `icon=ListChecks`, `title="No tasks yet"`, `description="Add your first task to get started."`, action = the existing "Add task" button if reachable, else omit.
- **Tests:**
  - `tests/unit/board/cards/BoardCard.test.tsx` — renders title, status pill, omits null segments.
  - `tests/unit/board/cards/BoardCardList.test.tsx` — renders cards from a fixture; empty state when zero tasks.
  - `tests/unit/board/cards/reorder-mode.test.tsx` — long-press toggles store flag; "Done" pill toggles it off.
- **Definition of done:**
  - On a viewport <768px, board page shows cards; no horizontal scroll.
  - Reorder mode works via long-press in tests (touch sensor mocked).
  - Above 768px, table view renders unchanged.
  - Vitest passes; typecheck; biome.
- **Escalation triggers:** the table view does not have a clean "below this component, render alternative" seam (would need a parent refactor — escalate, do not invent); the dnd-kit sortable context for groups+tasks is split across files and adding a touch sensor would require touching slice E or G's files.

### Slice E: Mobile task drawer + kanban swipe + calendar agenda + timeline mobile fallback

- **Owner:** epic-executor (sonnet)
- **Scope:**
  - `components/board/TaskDrawer.tsx` (file exists per repo listing) — add mobile fullscreen mode: at <768px render as a full-viewport sheet, otherwise existing overlay. Use `useMediaQuery('(min-width: 768px)')` from slice B.
  - `components/board/kanban/` — add `BoardKanbanMobile.tsx` (or extend the kanban container). Below `md`: snap-scroll between lanes one-at-a-time (CSS scroll-snap, `scroll-snap-type: x mandatory`, `scroll-snap-align: start`, lane = `100vw`). No new lib needed.
  - `components/board/calendar/` — add `BoardCalendarAgenda.tsx` defaulting on mobile (a vertical list of dates with task counts). Existing calendar continues to render on desktop. react-big-calendar supports `view="agenda"`; flip to that on `<md`.
  - `components/board/timeline/BoardTimelineMobile.tsx` — render `<EmptyState>` (slice C) with `title="Timeline works best on desktop"`, description, no CTA. Render only on `<md`.
- **Forbidden scope:** table view (slice D), dashboard (slice F), form view, board cards (slice D), sidebar, topbar, theme.
- **Dependencies on other slices:** slice B (useMediaQuery), slice C (EmptyState).
- **Spec:**
  - TaskDrawer mobile: full-viewport sheet from `components/ui/sheet.tsx`; existing close behavior preserved.
  - Kanban mobile: each `BoardKanbanLane` becomes a `scroll-snap-align: start` flex child in a `flex overflow-x-auto snap-x snap-mandatory` container. Lane width: `min-w-full` on `<md`.
  - Calendar agenda: pass `view="agenda"` and `defaultView="agenda"` props to react-big-calendar conditionally on `<md`.
- **Tests:**
  - `tests/unit/board/TaskDrawer.mobile.test.tsx` — at <768px, drawer is full-screen.
  - `tests/unit/board/kanban/BoardKanbanMobile.test.tsx` — renders lanes with snap classes.
  - `tests/unit/board/calendar/BoardCalendarAgenda.test.tsx` — agenda view on mobile.
  - `tests/unit/board/timeline/BoardTimelineMobile.test.tsx` — renders empty state at <md.
- **Definition of done:** each view degrades cleanly at <768px; desktop behavior unchanged; tests green.
- **Escalation triggers:** TaskDrawer is already rendered inside a Sheet that conflicts with a second Sheet; react-big-calendar agenda view has bugs in dark mode (escalate to fix order); kanban container is rendered by a parent that owns layout (avoid duplicate scroll containers).

### Slice F: Mobile dashboard + form + sidebar polish wiring

- **Owner:** epic-executor (sonnet)
- **Scope:**
  - `components/board/dashboard/` — make the existing react-grid-layout container responsive: on `<md`, force a single-column layout (override `cols` prop and breakpoints to stack vertically). Locate the existing layout config first; do not refactor the widget editor.
  - `components/board/form/` — verify mobile rendering (forms generally already responsive); ensure inputs are full-width on `<md`. Minimal CSS only.
  - `components/shared/sidebar/WorkspaceSidebar.tsx` and `MainSidebar.tsx` — verify dark-mode styling consumes tokens (no hardcoded hex); fix any drift. Slice B owned the structural mobile changes; this slice owns dark-mode token compliance for these files.
- **Forbidden scope:** other board views, cells, theme provider, drawer.
- **Dependencies on other slices:** slice A (dark tokens), slice B (sheet/skeleton + reduced-motion).
- **Spec:**
  - Dashboard mobile breakpoint: react-grid-layout `breakpoints={{ lg: 1024, md: 768, sm: 0 }}` and `cols={{ lg: N, md: N, sm: 1 }}` where N matches current desktop config.
  - Sidebar dark-mode: every color reference goes through CSS variables.
- **Tests:**
  - `tests/unit/board/dashboard/BoardDashboard.mobile.test.tsx` — at <768px, widgets stack.
- **Definition of done:** dashboard stacks at <md; sidebars render correctly in dark mode; no hardcoded hex in touched files; tests green.
- **Escalation triggers:** dashboard widgets have hardcoded colors that bleed in dark mode and would require widget-by-widget refactor; that escalates to a sub-slice rather than expanding scope.

### Slice G: A11y audit + axe-core wiring + live regions + form-error associations

- **Owner:** epic-executor (sonnet)
- **Scope:**
  - `pnpm add -D axe-core @axe-core/playwright` — installs axe runners.
  - `tests/e2e/a11y/` — new directory. Specs:
    - `auth.a11y.spec.ts` — sign-in, sign-up.
    - `board.a11y.spec.ts` — board page in table, kanban, calendar.
    - `task-drawer.a11y.spec.ts` — drawer open.
    - `notifications.a11y.spec.ts` — center.
    - `account.a11y.spec.ts` — settings + theme toggle.
  - `playwright.config.ts` — add (file may not exist; create a minimal config that runs against `localhost:3000` with `webServer.command = "pnpm dev"`). DO NOT change the `test:e2e` script (epic 15 owns CI wiring); add a local `test:a11y` script that runs only this directory if helpful. Actually: **skip script changes entirely**; specs are runnable manually and via epic 15.
  - `components/shared/a11y/LiveRegion.tsx` — new client component, a polite ARIA live region mounted near app root. Exposes `useAnnouncer()` hook returning `(msg: string) => void`. Sonner already handles toast a11y; this LiveRegion is for non-toast announcements (cell saved, comment posted) per the epic doc.
  - `app/layout.tsx` — mount `<LiveRegion />` (slice A also touches this file for ThemeProvider — **conflict**). Resolution: slice G ships after slice A is merged. List slice G as **stage 2 sequential after A merges**, which is the case since A is in stage 1. No conflict — re-edit at stage 2 time.
  - Sweep all form components used in app for `aria-describedby` linking error text to inputs and `required` attributes where applicable. **Limit:** only `react-hook-form` form pages already in the app (sign-in, sign-up, create board, create workspace, invite, board settings, task drawer cells). Each fix is a small targeted edit.
  - Audit and fix focus rings: confirm every interactive element shows `:focus-visible` ring. Use a single utility class from Tailwind already in `globals.css`. Only fix where missing.
  - Color-contrast audit of label palette per `design-system.md §1.1.5`. Verify orange/yellow labels carry black text where required. Output a written audit summary as a slice-deliverable file at `docs/conversion-plan/_dispatch/epic-14-contrast-audit.md` with each color + computed ratio. Fix any below-AA cases inside `globals.css` tokens or label component CSS.
- **Forbidden scope:** board view structural changes (slices D–F own), theme provider internals (slice A owns), mobile sheet structure (slice B owns).
- **Dependencies on other slices:** stage 1 (A + B merged) and slice C (EmptyState used in some audited pages).
- **Spec:**
  - Each `*.a11y.spec.ts` boots the app, logs in as a fixture user, navigates to the page, runs `new AxeBuilder({ page }).analyze()`, asserts `violations.length === 0`. Use the auth fixture pattern already in use elsewhere if present; otherwise the spec uses a seeded test user (escalate if no seed exists).
  - `LiveRegion` uses `role="status"` + `aria-live="polite"` + `aria-atomic="true"`.
- **Tests:** the a11y specs themselves are the tests. Plus `tests/unit/a11y/LiveRegion.test.tsx`.
- **Definition of done:**
  - axe specs exist and (when run locally / in epic 15 CI) pass with zero violations.
  - LiveRegion mounted; `useAnnouncer` callable.
  - Contrast audit doc produced and any AA failures fixed.
  - Forms have proper `aria-describedby` wiring.
  - `pnpm typecheck`, `pnpm lint` green.
- **Escalation triggers:** an existing component has a structural a11y bug that requires a real refactor (escalate as own sub-slice instead of expanding G's scope); no test-user seeding mechanism exists for Playwright (escalate — epic 15 may have to take this).

### Slice H: i18n scaffolding (next-intl)

- **Owner:** epic-executor (sonnet)
- **Scope:**
  - `pnpm add next-intl`.
  - `next.config.ts` — add `createNextIntlPlugin` per next-intl App Router single-locale recipe.
  - `i18n.ts` (project root, or `lib/i18n/index.ts`) — config exporting `locale: 'en'` and message loader.
  - `messages/en.json` — initial keys: `nav.home`, `nav.notifications`, `nav.account`, `nav.signOut`, `account.theme.system`, `account.theme.light`, `account.theme.dark`, `common.cancel`, `common.save`, `common.delete`, `common.add`, `empty.noBoards.title`, `empty.noBoards.description`, `empty.noTasks.title`, `empty.noTasks.description`, `empty.noNotifications.title`, `empty.noNotifications.description`. Limit scope: keys called from primitives owned by slice A/C and from sidebar/topbar nav.
  - `app/layout.tsx` — wrap with `NextIntlClientProvider` once messages loaded (server-side). **Conflict:** slices A and G also touch this file. **Sequencing:** slice H lands AFTER A and G in stage 2 (sequential within stage 2 after A+G merge). Plan dispatches H last in stage 2, or moves H to stage 3.
  - Update `components/shared/theme/ThemeToggle.tsx` (slice A) call-sites to use `t(...)` keys instead of hardcoded "System/Light/Dark". Slice H owns this edit because slice A ships first.
  - Update `components/shared/empty-states/*` consumers in `app/(app)/notifications/` and the no-boards empty state to consume `t('empty.*')` keys. **Limit:** only the keys listed in `messages/en.json`.
  - `docs/conversion-plan/_dispatch/epic-14-i18n-workflow.md` — short workflow doc: how to add a key, how to add a locale, where strings live, what's NOT extracted in v1.
- **Forbidden scope:** translating board internals, cell labels, comment UI, activity, attachments — defer to a future locale-add epic. Only top-level chrome + initial primitives this round.
- **Dependencies on other slices:** A, C, G (touches files those slices created).
- **Spec:**
  - Locale negotiation: hardcoded `'en'` for v1; do NOT enable locale routing prefixes.
  - Server components import from `next-intl/server`; client components from `next-intl`.
- **Tests:** `tests/unit/i18n/messages.test.ts` — every key referenced in app code resolves to a string in `en.json` (grep-based assertion).
- **Definition of done:** the listed keys flow through `t()`; English-only ships; doc landed; typecheck + lint green.
- **Escalation triggers:** next-intl client/server boundary collides with the existing layout (shouldn't; layout is server by default); existing strings are scattered in a way that exceeds the listed scope (defer — do not expand).

## Stage 3 — Cross-cutting integration (sequential)

### Slice I: Lighthouse + bundle audit + Playwright visual snapshots

- **Owner:** epic-executor (sonnet)
- **Scope:**
  - `tests/e2e/visual/` — Playwright snapshot specs at viewports `375x812` (mobile), `768x1024` (tablet), `1440x900` (desktop) for: workspace home, board table view, board kanban, notifications center, account settings (light + dark). Use `page.emulateMedia({ colorScheme })` and `expect(page).toHaveScreenshot()`. Snapshots committed under `tests/e2e/visual/__snapshots__/` — accept first-run.
  - `pnpm add -D @next/bundle-analyzer`. Wire it behind `ANALYZE=true` in `next.config.ts`.
  - Run `ANALYZE=true pnpm build` locally; produce a written audit at `docs/conversion-plan/_dispatch/epic-14-bundle-audit.md` listing per-route initial JS size and noting the board page status against the <300KB gzip budget. If over, identify the top three offenders.
  - Lighthouse: run against `pnpm build && pnpm start` for the auth, workspace home, board, notifications, account routes. Produce `docs/conversion-plan/_dispatch/epic-14-lighthouse-audit.md` with scores. Fix only blocking Accessibility regressions (target = 100); Performance fixes are optional in this slice (note as followups).
  - Document the browser support matrix in `docs/conversion-plan/_dispatch/epic-14-browser-matrix.md` (versions tested, manual checks performed).
- **Forbidden scope:** rewriting code based on audit findings beyond surgical fixes that get a11y to 100. Bundle/perf regressions get logged as followups, not fixed here.
- **Dependencies on other slices:** all of stage 1 + stage 2.
- **Spec:**
  - Visual snapshots: minimum 2 per page (light + dark); use `page.setViewportSize`.
  - Lighthouse scores reported per page in markdown table.
  - If bundle audit shows the board page > 300KB gzip initial JS, list specific code-split candidates (e.g., recharts on dashboard, react-big-calendar on calendar) and confirm whether epic 12's per-view code splitting is still effective.
- **Tests:** the visual specs themselves.
- **Definition of done:** specs land; audit docs land; any a11y regressions in audits are fixed; followups list filed.
- **Escalation triggers:** Lighthouse a11y < 100 on a key page due to a structural issue requiring more than a surgical fix; bundle budget breached and the fix would require a significant epic-12 refactor.

## Sequential follow-ups (after slices land)

- Reviewer (epic-researcher) runs the full epic-14 definition-of-done audit on the merged epic branch and emits `docs/conversion-plan/_dispatch/epic-14-followup-1.md` if anything is short. Loop until clean.
- Confirm `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` are all green on the epic branch before PRing to `main`.
- Any deferred Performance fixes from slice I get filed in the epic-14 followup doc, not silently dropped.

## Risk notes

- **Playwright runtime vs scaffolding.** Epic 15 owns CI wiring. Slices G and I produce spec files that will not run in CI this epic; they MUST be runnable locally with `pnpm dlx playwright test`. If `playwright` is not installed, slices add it as a devDependency. The `pnpm test:e2e` script stays a no-op (per epic 15 contract).
- **`app/layout.tsx` is touched by slices A, G, H.** Strict sequencing within stage 2: A merges in stage 1 → G is dispatched in stage 2 after A → H is dispatched in stage 2 after G. If we instead let two stage-2 slices edit `app/layout.tsx` in parallel, they will conflict. Orchestrator must enforce ordering OR pre-merge a layout.tsx scaffolding commit on the epic branch that already has all three wrappers, and then slices reach in to populate. Recommended: enforce ordering; it's only three slices.
- **`app/globals.css` is touched by slices A and B.** Partitioned by section comment, but the orchestrator should still run a merge-conflict pre-check.
- **Empty-state inventory crosses slice boundaries.** Slice C produces the inventory; consumer edits happen in slices D, E, F, G, H. Each consumer slice must verify it actually wires the new EmptyState in its files before claiming done. Reviewer will check.
- **No framer-motion.** If during stage 2 a slice claims it needs framer-motion for a specific micro-interaction, that's a `needs-direction` escalation, not a silent install.
- **Card list view vs existing table.** If table view's mobile rendering today is "horizontal scroll the whole table", slice D may need to insert its branch at a higher level than `BoardTable.tsx`. Executor should locate and report the seam before editing.
- **react-big-calendar dark mode.** Third-party CSS may not respond to `data-theme`; a CSS overrides file may be needed. Slice E owns this.
- **next-intl + RSC.** next-intl has a specific server/client split. Slice H must use `getMessages()` server-side and `NextIntlClientProvider` for client-tree access. The executor should pull from the latest next-intl App Router docs.
- **Account menu existence.** Slice A and slice H both touch the account menu component. Locate the file once and document its exact path before dispatch so both slices target it precisely. If the file is `app/(app)/_components/AccountMenu.tsx`, both slices use that. If not, both slices must update their scope on dispatch.
- **dnd-kit TouchSensor + existing PointerSensor.** Adding a TouchSensor next to an existing PointerSensor can cause double-fire on hybrid devices. Slice D must verify the existing sensor configuration in the sortable contexts and either replace PointerSensor with MouseSensor + TouchSensor or apply activation constraints to disambiguate.
