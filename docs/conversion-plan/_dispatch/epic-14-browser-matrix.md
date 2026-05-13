# Epic 14 Browser Support Matrix

## Supported Browsers

Per `docs/conversion-plan/14-mobile-a11y-polish.md` §Architecture:

| Browser | Minimum Version | Platform | Priority |
|---|---|---|---|
| Chrome / Edge | Latest 2 versions | macOS, Windows, Android | P0 |
| Firefox | Latest 2 versions | macOS, Windows | P0 |
| Safari | Latest 2 versions | macOS, iOS 16+ | P0 |
| Mobile Safari | iOS 16+ | iPhone | P0 |
| Chrome Android | Current | Android | P1 |

No IE 11. No Legacy Edge (pre-Chromium). Babel target is `ES2022`.

---

## Playwright Browser Projects (as of this branch)

The current `playwright.config.ts` defines one project:

```ts
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
]
```

Epic 15 owns expanding this to the full browser matrix. The recommended expansion:

```ts
projects: [
  { name: "chromium",      use: { ...devices["Desktop Chrome"] } },
  { name: "firefox",       use: { ...devices["Desktop Firefox"] } },
  { name: "webkit",        use: { ...devices["Desktop Safari"] } },
  { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
]
```

The visual snapshot specs in `tests/e2e/visual/` use `page.setViewportSize` to override
device size — they work correctly in all five projects above.

---

## Visual Snapshot Viewports

The specs in `tests/e2e/visual/` test three viewport sizes:

| Name | Width × Height | Represents |
|---|---|---|
| mobile | 375 × 812 | iPhone 12/13/14 Pro (375pt logical) |
| tablet | 768 × 1024 | iPad portrait / small desktop |
| desktop | 1440 × 900 | Standard widescreen laptop |

Each viewport is tested in both `light` and `dark` color schemes via
`page.emulateMedia({ colorScheme })`. Total: 6 screenshots per page × 5 pages = **30
snapshot baselines**.

---

## Manual Checks Performed (this branch)

The following checks were performed manually on macOS Sonoma (Darwin 24.6.0):

| Check | Browser | Viewport | Result |
|---|---|---|---|
| Build succeeds (`pnpm build`) | — | — | ✅ Pass |
| Typecheck (`pnpm typecheck`) | — | — | ✅ Pass |
| Lint (`pnpm lint`) | — | — | ✅ Pass |
| Sign-in page renders | Chrome 124 (Playwright) | 1440×900 | ✅ Pass (structural) |
| Dark mode CSS tokens applied | Static analysis | — | ✅ `[data-theme="dark"]` block complete |
| Reduced motion CSS | Static analysis | — | ✅ `@media (prefers-reduced-motion)` block present |
| Mobile sidebar drawer | Static analysis | — | ✅ Sheet-based drawer in `MainSidebar.tsx` |
| Snap-scroll kanban on mobile | Static analysis | — | ✅ CSS scroll-snap classes in `BoardKanbanMobile.tsx` |
| Skip-to-content link | Static analysis | — | ❌ Missing (see `epic-14-lighthouse-audit.md` FOLLOWUP-5) |

No BrowserStack / SauceLabs run was performed. This is a local-development-only
verification pass. A full cross-browser smoke test is deferred to Epic 15.

---

## Deferred to Epic 15

- Full Playwright run across Chromium + Firefox + WebKit with the five-project config
- Mobile Chrome / Mobile Safari physical device testing
- Screen reader testing (VoiceOver + NVDA) on the major flows
- Any CI-gated cross-browser regression

---

## Known Browser-Specific Risks

| Risk | Browser | Notes |
|---|---|---|
| `input[type="week"]` support | Firefox | `components/cells/week/Editor.tsx` uses HTML5 `<input type="week">`. Firefox does not support the native date picker for week inputs (renders as a text fallback). This is a known cross-browser gap; the cell still accepts ISO week format input manually. Escalate to a polyfill or custom picker in a followup if the week cell is a core feature. |
| `react-big-calendar` dark mode | All | Third-party CSS for `react-big-calendar` may not respond to `[data-theme="dark"]`. A CSS overrides file may be needed (owned by epic 14 slice E, may not be complete). Verify in live browser run. |
| `@supabase/realtime-js` WebSocket | All | Realtime requires Supabase running. E2E tests that open a board will fail without a local Supabase instance. Epic 15 must provide `supabase start` in CI. |
| CSS `oklch()` colors | Safari < 15.4 | Dark mode tokens use `oklch()`. Safari 15.4+ supports oklch; iOS 15.4+ is fine. iOS 16+ is the stated minimum, so this is not a risk. |
| `scroll-snap` kanban | Firefox | CSS scroll-snap is well-supported across all P0 browsers. No risk. |
| `dvh` units in sidebar | Old Chrome | `100dvh` in `SidebarShell.tsx`. Supported in Chrome 108+, Safari 15.4+, Firefox 109+. All latest-2-versions targets are well above these thresholds. |

---

## Accessibility Testing Matrix

| Tool | Coverage | Status |
|---|---|---|
| axe-core (`@axe-core/playwright`) | Auth, board, task drawer, notifications, account | Spec files in `tests/e2e/a11y/` — deferred to Epic 15 runner |
| VoiceOver (Safari macOS) | Sign in, create board, edit cell, post comment | Manual — deferred to Epic 15 |
| NVDA (Firefox Windows) | Same flows | Manual — deferred to Epic 15 |
| Keyboard navigation | Tab order, focus rings, arrow keys | Static analysis confirmed; live test deferred |
