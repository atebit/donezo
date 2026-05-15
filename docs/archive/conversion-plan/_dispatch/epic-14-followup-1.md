# Epic 14 — Followup Round 1

## Review summary

- **Stage reviewed:** Stage 2 (slices C, D, E, F, G, H), commits `b8d4faf..27d89ea`.
- **Verdict:** FOLLOWUP REQUIRED
- **Definition-of-done items met:**
  - Dark mode + theme toggle works, dark tokens land via `[data-theme="dark"]`.
  - `@custom-variant dark (&:is([data-theme="dark"] *))` correctly selects on the `data-theme` attribute (Slice F).
  - Reduced-motion media query caps animation/transition durations to 0.01ms.
  - Shadcn `<Sheet />` + `<Skeleton />` primitives present in `components/ui/`.
  - `<EmptyState />` primitive exists and existing primitives (`NoBoardsInWorkspace`, `NoWorkspaces`, `TrashEmpty`, `FavoritesEmpty`) compose it (Slice C).
  - 6 skeleton catalog layouts present (`BoardTableSkeleton`, `BoardKanbanSkeleton`, `BoardListSkeleton`, `DashboardSkeleton`, `NotificationCenterSkeleton`, `WorkspaceSidebarSkeleton`) and the 3 new `loading.tsx` files at workspace, board, notifications routes (Slice C).
  - `BoardCard`, `BoardCardList`, `BoardCardSkeleton`, `ReorderModeToggle` exist; `BoardTableView` gates table vs card list on `(min-width: 768px)` (Slice D).
  - `DndProviders` replaced `PointerSensor` with `MouseSensor + TouchSensor`; `TouchSensor` activation is gated on `reorderMode` via a 250ms long-press; "Done" pill exits reorder mode (Slice D).
  - Long-press 250ms entry + "Done" pill exit wired in `BoardCardList` / `ReorderModeToggle` (Slice D).
  - `TaskDrawer` full-screen on `<md:` via `useMediaQuery('(min-width: 768px)')` using the new `<Sheet />` (Slice E).
  - Kanban snap-scroll: container has `snap-x snap-mandatory md:snap-none`, lanes have `min-w-full md:min-w-0 snap-start` (Slice E).
  - `BoardTimelineMobile` renders `<EmptyState />` at `<md:`, gated inside `TimelineView` (Slice E).
  - Dashboard responsive: `breakpoints={{ lg: 1024, md: 768, sm: 0 }}` and `cols={{ lg: 12, md: 10, sm: 1 }}` matching the desktop col counts (Slice F).
  - `FormBuilder` footer collapses to `flex-col` on mobile, inputs are `w-full` (Slice F).
  - Sidebar files (`MainSidebar.tsx`, `WorkspaceSidebar.tsx`, etc.) already use CSS variables — no hardcoded hex (Slice F).
  - 5 axe-core specs at `tests/e2e/a11y/` (auth, board, task-drawer, notifications, account), `playwright.config.ts` exists, runner deferred to Epic 15 via `@ts-expect-error` (Slice G).
  - `LiveRegion.tsx` uses `role="status" aria-live="polite" aria-atomic="true"`; `useAnnouncer()` returns `(msg: string) => void`; mounted in `app/layout.tsx` (Slice G).
  - All in-scope RHF forms (sign-in/up, forgot/reset password, board + workspace settings, account, invite) wire `aria-describedby` + `required` + `role="alert"` (Slice G).
  - Contrast audit doc landed at `docs/conversion-plan/_dispatch/epic-14-contrast-audit.md` with computed ratios for all label colors (Slice G).
  - Focus-visible rings added to BoardArchive/Delete confirm modals + WidgetEditor (Slice G).
  - `next-intl` installed in `dependencies` (^4.11.2); `i18n/request.ts`, `next.config.ts` plugin, all 17 listed keys in `messages/en.json` (Slice H).
  - `app/layout.tsx` order: `<NextIntlClientProvider>` (outer, server-side `getMessages()`) → `<ThemeProvider>` → `<LiveRegion />` + `<Toaster />` + `{children}` — partition holds across slices A, G, H (Slice H).
  - Consumer wiring for ThemeToggle, NoBoardsInWorkspace, BoardCardList, NotificationList (Slice H).
  - i18n workflow doc landed (Slice H).
  - `pnpm typecheck` clean; `pnpm lint` has only 5 pre-existing warnings; targeted vitest 112 passed.
  - `app/globals.css` partition holds: `[data-theme="dark"]` block, `@media (prefers-reduced-motion: reduce)` block, `@custom-variant dark`, `--color-label-*-text` tokens — all coexist without overlap or selector cascade issues.

- **Definition-of-done items NOT met:**
  - **`BoardCalendarAgenda` is orphan dead code.** Slice E created `components/board/calendar/BoardCalendarAgenda.tsx` as the mobile-aware wrapper but never wired it into `app/(app)/w/[workspaceSlug]/b/[boardId]/calendar/page.tsx`. The calendar route still renders `<CalendarView />` directly, with no `forceMobileAgenda` prop, so on mobile the user sees the (unusable) month grid by default — not the agenda. Slice E DoD: "Calendar agenda mode forced on `<md:`" — unmet. (Recorded in the review prompt's "NOTE" call-out — confirmed by reading the page).
  - **Notification center empty state not composing `<EmptyState />`.** `components/notifications/NotificationList.tsx` lines 51-58 still render hardcoded `<p>` tags inside an ad-hoc `<div>` (Slice H wired the i18n strings but did not adopt the primitive). The empty-state inventory (item 5) explicitly tagged this surface for `<EmptyState />` adoption, and the epic doc names "notification center (no notifications)" as a target.
  - **Board no-groups empty state not composing `<EmptyState />`.** `components/board/table/EmptyStates.tsx` `NoGroupsEmptyState` is still an ad-hoc bordered card with a `<Button>`. The inventory (item 7) said a downstream slice should refactor it. No slice in Stage 2 owned this. The epic doc names "board (no groups)" as a target.
  - **Task drawer overlapping ARIA dialogs on mobile.** `TaskDrawerModalShell` wraps `<TaskDrawer>` in an outer `<div role="dialog" aria-modal="true">`. On `<md:`, `<TaskDrawer>` ALSO renders a Base UI `<Sheet>` (whose Popup adds its own `role="dialog" aria-modal="true"`), with a second `<SheetOverlay>` backdrop on top of the modal shell's existing backdrop. Two nested dialogs + two backdrops = real WCAG/screen-reader issue (Slice E flagged this as "potential" but did not resolve). The Sheet also has no `<SheetTitle>` / `aria-labelledby` — Base UI Dialog requires a title for AT discoverability.

- **Other issues found (NON-blocking — Stage 2 still proceeds; recorded so they aren't lost):**
  - **`.dark {}` block in `app/globals.css` lines 268-300 is dead code** (next-themes uses `[data-theme="dark"]`). Slice F flagged this. Recommended deletion; non-functional regression, so not gating Stage 2.
  - **`--color-label-*-text` tokens orphaned.** Slice G defined them in `globals.css` but no component consumes them. This is the documented half-fix for the StatusCell text-color contrast issue — the real fix (per the contrast audit doc) requires adding a `text_color` column to the `label` table in a future epic. The tokens are a stub awaiting that follow-up. **Defer this fix to a future epic** (would need a DB migration; outside Stage 2 scope per the audit doc's stated boundary).
  - **`BoardCard` assignee placeholder shows raw UUID slices** (`userId.slice(0, 2).toUpperCase()`) instead of resolving to display names. Visual polish miss; not a DoD blocker. **Defer to a polish followup or epic 15.**
  - **`NoTasksInGroupHint` compact inline hint kept as-is.** Inventory item 3 explicitly recommended leaving it compact (it's a per-row hint inside the table, not a full empty state). **Genuinely deferrable.**

- **Stage 3 (Slice I) — items to incorporate when that spec is written:**
  - Lighthouse audit on key pages targeting Accessibility = 100.
  - Bundle audit with `@next/bundle-analyzer` verifying board page ≤ 300KB gzip.
  - Playwright visual snapshot specs at mobile/tablet/desktop, light + dark.
  - Browser matrix testing doc.
  - Slice I should also opportunistically delete the `.dark {}` dead block in `app/globals.css` while consolidating the dark-mode audit.

- **Epic 15 (CI / runtime) — items already correctly deferred:**
  - Wiring `pnpm test:e2e` to a real Playwright runner.
  - Installing `@testing-library/react` + `jsdom` for the 165 currently-skipped RTL tests.
  - Auth fixtures + seed scripts for the axe specs in `tests/e2e/a11y/` (currently `test.skip(true)`).
  - The 2 pre-existing test failures in `tests/unit/BoardActivityFilters.test.tsx` and `tests/unit/BoardTable-realtime-mount.test.tsx` — both gated on RTL availability.

---

## Followup slices

All four followups are tiny and parallel-safe (file scopes do not overlap). They can be dispatched concurrently.

### Slice F1: Wire `BoardCalendarAgenda` into the calendar route

- **Owner:** epic-executor (sonnet)
- **Scope (files this slice may touch — and ONLY these):**
  - `app/(app)/w/[workspaceSlug]/b/[boardId]/calendar/page.tsx` — swap the `CalendarView` import + render for `BoardCalendarAgenda`.
- **Forbidden scope:**
  - `components/board/calendar/CalendarView.tsx` — do not modify; it already accepts `forceMobileAgenda` and that contract is fine.
  - `components/board/calendar/BoardCalendarAgenda.tsx` — do not modify; the wrapper is correct.
  - Any other file. This is a one-line wiring change.
- **Spec:**
  ```tsx
  // app/(app)/w/[workspaceSlug]/b/[boardId]/calendar/page.tsx
  import { BoardCalendarAgenda } from "@/components/board/calendar/BoardCalendarAgenda";

  export default function CalendarPage() {
    return <BoardCalendarAgenda />;
  }
  ```
  Update the JSDoc header on the page to reflect the responsive split (BoardCalendarAgenda forces `forceMobileAgenda={true}` on `<md:`, otherwise delegates unchanged).
- **Tests:** no new tests required. The existing `tests/unit/board/calendar/BoardCalendarAgenda.test.tsx` source-contract tests already assert the wrapper's behaviour. Optionally add a one-line check that `app/(app)/w/[workspaceSlug]/b/[boardId]/calendar/page.tsx` imports `BoardCalendarAgenda`.
- **Definition of done:**
  - `app/(app)/w/[workspaceSlug]/b/[boardId]/calendar/page.tsx` renders `<BoardCalendarAgenda />`, not `<CalendarView />`.
  - `pnpm typecheck` + `pnpm lint` clean.
  - Existing `BoardCalendarAgenda` unit tests still green.
- **Escalation triggers:** none expected; this is a one-line change. If you discover that the dynamic-import shell `CalendarViewLoader.tsx` is actually the canonical entry point used elsewhere (not just `CalendarView`), escalate before swapping — the wiring may need to flow through the loader instead.

### Slice F2: Refactor notification empty state + no-groups empty state to use `<EmptyState />`

- **Owner:** epic-executor (sonnet)
- **Scope (files this slice may touch — and ONLY these):**
  - `components/notifications/NotificationList.tsx` — replace the inline `<div>...<p>{t("title")}</p>...</div>` empty branch (lines ~51-58) with `<EmptyState />`.
  - `components/board/table/EmptyStates.tsx` — replace `NoGroupsEmptyState`'s ad-hoc bordered-card body with `<EmptyState />`. Keep the same `onAddGroup` callback contract.
  - `messages/en.json` — add the `empty.noGroups.title` + `empty.noGroups.description` keys (or reuse existing if any). Existing `empty.noNotifications.*` keys are already present.
- **Forbidden scope:**
  - `components/shared/empty-states/EmptyState.tsx` — do not modify the primitive.
  - `components/board/table/BoardTable.tsx` — do not touch (it just renders `<NoGroupsEmptyState onAddGroup={…}/>`; that call stays valid).
  - Any other notification or table file.
- **Spec:**
  - **NotificationList** (`components/notifications/NotificationList.tsx`):
    - Replace the empty `<div>...</div>` branch with:
      ```tsx
      const t = useTranslations("empty.noNotifications");
      // ...
      if (notifications.length === 0) {
        return (
          <EmptyState
            icon={IconBellOff}
            title={t("title")}
            description={t("description")}
          />
        );
      }
      ```
    - Import: `import { EmptyState } from "@/components/shared/empty-states/EmptyState";` and `import { IconBellOff } from "@/lib/icons";` (`IconBellOff` already exists per the Slice C diff).
    - Do NOT touch the grouped notifications branch.
  - **NoGroupsEmptyState** (`components/board/table/EmptyStates.tsx`):
    - Refactor to:
      ```tsx
      import { EmptyState } from "@/components/shared/empty-states/EmptyState";
      import { IconLayers } from "@/lib/icons";
      import { Button } from "@/components/ui/button";
      import { useTranslations } from "next-intl";

      export function NoGroupsEmptyState({ onAddGroup }: NoGroupsEmptyStateProps) {
        const t = useTranslations("empty.noGroups");
        return (
          <EmptyState
            icon={IconLayers}
            title={t("title")}
            description={t("description")}
            action={<Button onClick={onAddGroup}>{t("addGroup")}</Button>}
          />
        );
      }
      ```
    - `NoTasksInGroupHint` stays as-is (the inventory documented it as intentionally compact).
    - `"use client"` is already at the top of the file (NoGroupsEmptyState already needs it for `onAddGroup`); ensure `useTranslations` is callable.
  - **messages/en.json** — add:
    ```json
    "noGroups": {
      "title": "No groups yet",
      "description": "Add your first group to start organizing tasks.",
      "addGroup": "Add group"
    }
    ```
    inside the existing `"empty"` namespace.
- **Tests:**
  - Add `tests/unit/notifications/NotificationList.empty.test.tsx` — module-shape test that asserts `NotificationList.tsx` imports `EmptyState` and `IconBellOff` (mirrors the Slice E pattern of source-contract tests, since RTL is Epic 15 scope). Or extend the existing notification test file if one exists.
  - Add `tests/unit/board/table/NoGroupsEmptyState.test.tsx` — same source-contract pattern: asserts the file imports `EmptyState`, `IconLayers`, and uses `useTranslations("empty.noGroups")`.
  - Update `tests/unit/i18n/messages.test.ts` — no manual updates needed; the test will auto-discover the new keys via its grep pass and will fail if any key is missing from `en.json`. Verify it stays green after the change.
- **Definition of done:**
  - `NotificationList` renders `<EmptyState>` (with translated copy) when `notifications.length === 0`.
  - `NoGroupsEmptyState` composes `<EmptyState>` with `<Button>` action (preserving the `onAddGroup` contract).
  - `messages/en.json` includes `empty.noGroups.{title,description,addGroup}`.
  - `pnpm typecheck`, `pnpm lint`, and the i18n messages test are all green.
- **Escalation triggers:**
  - If `IconLayers` is not exported from `@/lib/icons`, check the diff range — Slice C added it. If genuinely missing, add it as a one-line export from `lucide-react`'s `Layers` icon (and only that).
  - If `useTranslations` cannot be called inside `EmptyStates.tsx` because the file isn't a client component (it currently has `"use client"`, so it should be fine), escalate.

### Slice F3: Fix overlapping ARIA dialogs on mobile task drawer

- **Owner:** epic-executor (sonnet)
- **Scope (files this slice may touch — and ONLY these):**
  - `components/board/TaskDrawer.tsx` — when rendering the mobile `<Sheet>` branch, add a visually-hidden `<SheetTitle>` referencing the task title so Base UI Dialog has a labelled name (required by AT).
  - `components/board/TaskDrawerModalShell.tsx` — remove the duplicate ARIA dialog wrapper when the child is responsible for its own dialog semantics. The simplest correct shape: keep the outer `role="dialog" aria-modal="true"` ONLY for the desktop variant; on mobile (<768px), have `TaskDrawerModalShell` render just an Esc-key handler and let the inner `<Sheet>` provide both the dialog role and the backdrop.
- **Forbidden scope:**
  - `components/ui/sheet.tsx` — do not touch the primitive.
  - Any other component.
- **Spec:**
  - The fix can be done EITHER:
    - **Option A (recommended — minimal):** In `TaskDrawerModalShell.tsx`, detect mobile via `useMediaQuery('(min-width: 768px)')` and on mobile DO NOT render the outer `role="dialog"` wrapper + outer backdrop. Let `TaskDrawer`'s mobile `<Sheet>` handle dialog semantics + backdrop natively. The Esc-key handler is kept (defensive — Base UI's Sheet already handles Esc internally, but leaving it doesn't hurt).
    - **Option B:** Make the outer `<div>` in `TaskDrawerModalShell` lose its `role="dialog" aria-modal="true"` attributes entirely (treat it as a styling container), and rely entirely on the inner content (the desktop `<div>` or the mobile `<Sheet>`) to provide the dialog role. The desktop `<div>` in `TaskDrawer.tsx` would need to gain `role="dialog" aria-modal="true" aria-label="Task details"` to compensate.
    - Pick Option A — it preserves desktop behavior (single dialog from `TaskDrawerModalShell`) and lets the mobile Sheet own its own semantics. Less code churn.
  - On mobile, the inner `<Sheet>` MUST have a `<SheetTitle>` (visually hidden via `sr-only`) referencing the task title. Use Base UI's `SheetTitle` primitive from `components/ui/sheet.tsx`:
    ```tsx
    <SheetContent ...>
      <SheetTitle className="sr-only">{task.title || "Untitled"}</SheetTitle>
      {innerContent}
    </SheetContent>
    ```
  - Keep `showCloseButton={false}` on mobile (the existing close affordance is the visible task title bar + Esc + backdrop tap on the Sheet's own overlay).
- **Tests:**
  - Add (or extend `tests/unit/board/TaskDrawer.mobile.test.tsx`) a module-shape test asserting that:
    - `TaskDrawer.tsx` imports `SheetTitle` from `@/components/ui/sheet`.
    - `TaskDrawer.tsx` renders `<SheetTitle>` inside the mobile `<SheetContent>` branch.
    - `TaskDrawerModalShell.tsx` calls `useMediaQuery('(min-width: 768px)')` and uses the value to gate the outer dialog wrapper.
- **Definition of done:**
  - Mobile task drawer has exactly one ARIA dialog (the Sheet), one backdrop (Sheet's), and a labelled name via `<SheetTitle>`.
  - Desktop task drawer behavior unchanged.
  - `pnpm typecheck` + `pnpm lint` clean.
- **Escalation triggers:**
  - If Option A breaks the desktop slide-in animation (the outer keyframe is currently on the dialog wrapper div), escalate — the animation needs to move to a non-role-bearing element on desktop. Likely it doesn't; the animation is on the inner panel div, not the outer.
  - If Base UI's Sheet uses a non-portal-mounted dialog that conflicts with the Esc-key handler in `TaskDrawerModalShell`, escalate before suppressing the handler.

### Slice F4: (Optional, not gating Stage 2) Delete `.dark {}` dead-code block

This is **NOT a Stage 2 blocker** — list it here so it lands either in this followup round or as part of Slice I's Stage 3 cleanup. Orchestrator's call: dispatch it now if cheap, or fold into Slice I.

- **Owner:** epic-executor (sonnet)
- **Scope:** `app/globals.css` lines ~268-300 (the `.dark { ... }` block).
- **Forbidden scope:** any other token, the `[data-theme="dark"]` block, the `@custom-variant`.
- **Spec:** Delete the `.dark {}` block entirely. next-themes is configured with `attribute="data-theme"`, so the `.dark` selector never matches; the block is unreachable.
- **Tests:** existing dark-mode tests should remain green (they rely on `[data-theme="dark"]`).
- **Definition of done:** `.dark {}` block removed; `pnpm typecheck`, `pnpm lint`, and the dark-mode tests still green.
- **Escalation triggers:** if any component (shadcn `dark:` classes, etc.) actually depends on the `.dark` selector, the deletion will be visible at runtime — verify by grepping for `class="dark"` or `className.*dark"` first.

---

## Sequential follow-ups (after F1-F3 land)

- Reviewer re-runs Stage 2 review against the merged followup. Verifies all four DoD gaps are closed.
- Stage 3 (Slice I) is then dispatched per the original dispatch plan.

## Open questions for the user

None. The four gaps above are clear DoD misses; the fixes are surgical and unambiguous.
