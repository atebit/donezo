# Epic 05 — Stage 3 Review

## Review summary

- **Stage reviewed:** Stage 3 — chrome (slices 8 sidebar shell, 9 topbar, 10 empty-states + LastViewed).
  Commits on `epic/05-workspaces-boards`:
  - `110275b` — Slice 10 (empty-states + LastViewed). Landed prior to the F1 doc commit but is unambiguously Stage-3 work.
  - `397a2c8` — Slice 9 (Topbar + breadcrumbs + search/bell stubs).
  - `09b67ab` — Slice 8 (MainSidebar, WorkspaceSidebar, UserMenu, sidebar-store, layout rewire, plus an authorized cross-slice swap of Slice 9's placeholder Avatar for `<UserMenu variant="small" />`).
- **Verdict:** **FOLLOWUP REQUIRED.**
- Followup spec: [`epic-05-followup-2.md`](./epic-05-followup-2.md).

### Definition-of-done items met

**Slice 8 — sidebar shell**
- `app/(app)/layout.tsx` is a server component; calls `requireUser`, queries `workspace_member` with the embedded `workspace:workspace_id(...)` projection and the `is("workspace.deleted_at", null)` embedded filter, renders `<SidebarShell>`. Soft-deleted workspaces yield a null `workspace` projection that `extractWorkspace` correctly drops; surviving rows pass through.
- `MainSidebar` renders a 66px rail with `--color-surface-nav` background, brand glyph at the top via `WorkspaceLogoTile size={30}`, disabled Search/Notifications tool buttons, and `UserMenu variant="main"` at the bottom. Tool container is 56×36 per spec.
- `WorkspaceSidebar` is a `"use client"` component with width animation (`width var(--motion-slow) var(--ease-standard)`), inner content opacity transition with the 250ms delay on expand, edge-pinned collapse pill on the right edge, search input wired to the Zustand store, and `WorkspaceSwitcher`/`NewBoardButton` in the header tools. The `NewBoardButton` placeholder modal carries the required `// TODO: Slice 11 wires CreateBoardModal here` comment.
- `WorkspaceSwitcher` lists all workspaces from the layout query, marks the current workspace bold, links to `/w/<slug>` via Base UI `Menu.Item render={<Link/>}`.
- `BoardList` filters by the `search` Zustand state, splits starred vs unstarred, renders a per-row star toggle that calls `starBoard` inside `startTransition` with `useOptimistic`. The optimistic state will revert on a thrown error or on a `{ ok: false }` action result via `useOptimistic`'s base-state reset (transition completes → reset to recomputed `allBoards`).
- `UserMenu` imports the real `signOut` action from `@/app/(auth)/actions`, ships an Account settings link, a disabled Theme toggle marked "Coming soon" per Q11, and a Sign out item. Spec mentioned `<MenuList>` primitive but Base UI `Menu` is functionally equivalent; not blocking.
- `stores/sidebar-store.ts` uses Zustand v5 `create<T>()`, no persist (correct — collapse + search are session-scoped UI state per CLAUDE.md "Zustand for UI-only state").
- `app/globals.css` adds **only** the `--color-surface-nav-hover: rgba(0, 0, 0, 0.6)` token. No other drift.
- `package.json` adds `zustand@^5.0.13` (single dependency, expected).
- The cross-slice edit of `Topbar.tsx` (Slice 8 swapping the placeholder Avatar for `<UserMenu variant="small" />`) is one import + one element; no drift to other Slice 9 code.

**Slice 9 — topbar**
- `Topbar` height 48px, bottom border `--color-border-strong`, padding `0 24px`, gap `16`, items left-to-right: breadcrumbs, flex spacer, SearchStub, NotificationBellStub, UserMenu.
- `Breadcrumbs` reads `usePathname()`, parses `/account`, `/w/<slug>`, `/w/<slug>/settings/[section]`, and `/w/<slug>/b/<boardId>/[subsection]`, and consumes `useWorkspaceMaybe()` / `useBoardMaybe()` exactly as F1.1 made available. Outside `/w/...` and `/account`, returns `null` (no breadcrumb chrome) — consistent with the spec's pathname coverage.
- `SearchStub` and `NotificationBellStub` render `aria-disabled="true"` triggers with opacity-50 and a Base UI `<Tooltip>` containing "Coming soon", per Q11.
- All Topbar tokens are consumed via Tailwind utility classes (`text-[var(--color-fg)]`, `bg-[var(--color-surface)]`, etc.); no raw hex.

**Slice 10 — empty-states + LastViewed**
- All five files compile, each exports a single named component (no defaults — matches Biome rule).
- `FavoritesEmpty` renders the 80px star + "Easily Access Your Favorite Boards" copy at 15px / line-height 1.5, per `component-system.md` §8.3.
- `TrashEmpty` renders a 24px archive icon + "No archived boards." in fg-muted.
- `NoWorkspaces` and `NoBoardsInWorkspace` accept the `onCreate?: () => void` callback prop the spec explicitly required (so Slice 16 / Slice 11 own the modal triggers).
- `LastViewed` accepts `boards: LastViewedBoard[]` with a relative-time helper, MemberStack at 22px (valid — MemberStack `size?: 22 | 24 | 26`), and renders nothing when `boards.length === 0`. Stage-5 will compute the data; component contract is clean.

**Cross-slice / lint / typecheck**
- `pnpm lint` is clean across all 110 files.
- `pnpm typecheck` reports zero new errors. The 7 pre-existing `react-hook-form` × Zod 4 resolver errors in `(auth)/**-form.tsx` are unchanged from epic 03/04 and tracked on the dispatch plan's risk list — not introduced by this stage.
- No legacy `frontend/` or `backend/` paths were touched.

### Definition-of-done items NOT met / issues introduced

1. **Stage-4 hand-off contract is broken.** `WorkspaceContext` already provides `sidebarBoards: { starred, boards }` (added in F1.2 specifically so Stage 4 can populate the sidebar without re-rendering `SidebarShell`). However, `WorkspaceSidebar` does **not** read `sidebarBoards` from `useWorkspaceMaybe()` — it accepts a `boards?: SidebarBoards` prop instead, and `SidebarShell` never forwards one. As shipped, when Slice 11 lands `<WorkspaceProvider sidebarBoards={...}>` in `app/(app)/w/[workspaceSlug]/layout.tsx`, the sidebar will continue to render zero boards because the data path the F1.2 amendment created is unused. This is the integration boundary called out at lines 1239–1269 of `epic-05.md` and it does not work end-to-end.

2. **`UserMenu` ships an unsound type cast.** `components/shared/sidebar/UserMenu.tsx:36` writes `size={avatarSize as 37.4 | 26 | 30 | 24 | 22}` where `avatarSize = 28` for the small variant. `28` is **not** in `Avatar`'s `size` union (`22 | 24 | 26 | 30 | 37.4`); the cast is the same class of safety violation as `as any` (CLAUDE.md: "no `as any`" — narrow-but-wrong is worse, not better). The spec explicitly specified the small variant at 26px (epic doc; dispatch plan slice 9 line 1331 — "smaller variant"). Fix is mechanical: drop the literal 28, use 26.

3. **`NoBoardsInWorkspace` is rendered inside the sidebar's board list.** `BoardList.tsx:73-79` renders `<NoBoardsInWorkspace>` when `optimisticBoards.length === 0`. Per spec, `NoBoardsInWorkspace` is the workspace-landing-page card (`app/(app)/w/[slug]/page.tsx`, slice 10 line 1372) — a centered card with a 24px H2 and primary CTA. Inside a 230px sidebar rail it overflows the layout. The sidebar itself should fall back to a small inline "No boards yet" hint, not the page-level empty state. Slice 11's workspace landing page is the correct home for `NoBoardsInWorkspace`.

4. **Raw `rgba(...)` literal in `MainSidebar.tsx:131`.** The `NavToolButton` component sets `color: "rgba(255, 255, 255, 0.6)"` inline. CLAUDE.md and the slice DoD both forbid raw color literals. The intended color is the muted-white nav-icon foreground; promote it to a token (suggest `--color-fg-on-nav`) in `app/globals.css` and consume it via either Tailwind class or `var(...)`. Note: the spec's `--color-surface-nav-hover` token defined this round is a **background** color, not the foreground — they are distinct values.

### Other observations (non-blocking, not part of followup)

- **Heavy inline `style={{...}}` usage** across Slices 8 and 10 (and in `BoardListItem`, `WorkspaceSwitcher`, `UserMenu`). Tokens are correctly consumed via `var(--color-*)`, so no DoD line is violated, but the Tailwind-v4 convention in CLAUDE.md is utility-class-first. Functional, just not idiomatic. Fold into Stage-4-or-later cleanup; do not block the epic on it.
- **`Topbar.tsx` is `"use client"`** even though its only direct consumer-of-React-state is the children (`Breadcrumbs`, `SearchStub`, etc., each `"use client"` themselves). Topbar could be a server component that composes client children. RSC-first soft drift; one-line change at any point.
- **`BoardList` does not surface `{ ok: false }` action errors.** When `starBoard` returns a failure result, the optimistic state correctly reverts (transition ends → `useOptimistic` resets to base; base unchanged because no `revalidateTag` ran), but the user sees a star flicker on then off with no explanation. UX gap, not a DoD failure. Spec does not require a toast on star errors. Defer.
- **Slice 8 used Base UI `Menu` directly instead of the project's `<MenuList>` primitive** in `components/ui/menu-list.tsx`. Functionally equivalent; both are Base UI underneath. Not blocking. Consider standardizing in a later polish pass.
- **`loadSidebarBoards` in `lib/sidebar-data.ts` is currently unreferenced.** Slice 11 owns the call site (`app/(app)/w/[workspaceSlug]/layout.tsx`). Confirmed correct hand-off.
- **`NoWorkspaces`, `TrashEmpty`, and `LastViewed` are unreferenced.** Slice 16 (NoWorkspaces, LastViewed) and Slice 13 (TrashEmpty) are the call sites. Spec DoD: "All five files compile and render in isolation" — met.
- **`useOptimistic` correctness note for hand-off.** When Slice 11's `<WorkspaceProvider>` lands and F2.1 (below) wires `WorkspaceSidebar` to read `sidebarBoards` from context, the `BoardList` initial-data prop will become non-undefined. The optimistic-update logic should continue to work without modification (the recomputed `allBoards` from props remains the rebase target).
- **Embedded-filter SQL semantics in `app/(app)/layout.tsx`.** PostgREST's `is("workspace.deleted_at", null)` without `!inner` is a join-side filter, not a parent filter. Surviving deleted-workspace rows yield `workspace: null` and are dropped by `extractWorkspace` in `SidebarShell`. Functionally correct and matches the spec's exact pattern; flagging it because it relies on a non-obvious PostgREST behavior worth a future code comment.

### Hand-off notes for Stage 4

- After F2 lands, Slice 11's `app/(app)/w/[workspaceSlug]/layout.tsx` will:
  1. Resolve the `workspaceSlug` to a workspace + role.
  2. Call `loadSidebarBoards(workspace.id)`.
  3. Wrap children in `<WorkspaceProvider workspace={...} role={...} sidebarBoards={...}>`.
- `WorkspaceSidebar` will then read `currentWorkspace` and `sidebarBoards` from `useWorkspaceMaybe()` (post-F2.1). No `boards` prop is needed on `<SidebarShell>` or `<WorkspaceSidebar>`.
- `NewBoardButton` placeholder modal is the integration point for Slice 11's `<CreateBoardModal />`. Slice 11 should swap the implementation in-place.
- The breadcrumb chain already supports `/w/<slug>/b/<boardId>` and `/w/<slug>/b/<boardId>/<view>`; Slice 14's `<BoardProvider>` will populate `useBoardMaybe()` and the human-readable board name will replace the boardId in the chain automatically.
- Slice 13 (workspace trash) imports `<TrashEmpty>`; Slice 16 imports `<NoWorkspaces>` and `<LastViewed>`.


---

## Re-review pass — followup-2 verification

**Reviewer:** epic-researcher (Opus)
**Date:** 2026-05-07
**Commit range under review:** `09b67ab..4246f0e` (the four followup-2 slices: F2.3 `d589e08`, F2.2 `075ea3e`, F2.4 `b91263f`, F2.1 `4246f0e`).
**Files changed:** 7 — `app/globals.css`, `components/shared/sidebar/BoardList.tsx`, `components/shared/sidebar/MainSidebar.tsx`, `components/shared/sidebar/UserMenu.tsx`, `components/shared/sidebar/WorkspaceSidebar.tsx`, `lib/workspace-context.tsx`, `tests/unit/workspace-sidebar.test.tsx`. All inside the followup-2 declared scopes; no out-of-scope drift.

### Gap-by-gap verification

#### F2.1 — `WorkspaceSidebar` reads `sidebarBoards` from context — CLOSED

- `WorkspaceSidebarProps` (`WorkspaceSidebar.tsx:17-19`) is now `{ workspaces: Workspace[] }`. The `boards` and `activeBoardId` props are gone.
- `useWorkspaceMaybe()` is read at line 27; `currentWorkspace` and `sidebarBoards` are derived from `ctx?.workspace` and `ctx?.sidebarBoards` respectively.
- Pathname-based `activeBoardId` derivation (`WorkspaceSidebar.tsx:32-34`) uses regex `/\/w\/[^/]+\/b\/([^/]+)/`, correctly matching `/w/<slug>/b/<boardId>` and longer paths like `/w/<slug>/b/<boardId>/<view>`.
- `BoardList` receives `initialBoards={sidebarBoards}` at `WorkspaceSidebar.tsx:134`. `BoardListProps` has been updated to `{ workspaceSlug, activeBoardId, initialBoards }` (`BoardList.tsx:19-23`).
- `SidebarBoard` is unified: defined canonically in `lib/workspace-context.tsx:6-11` with `workspace_id` field added; `BoardList.tsx:6` imports it and re-exports for backward compat. The duplicate local definition is gone.
- `SidebarShell.tsx:46` now calls `<WorkspaceSidebar workspaces={flatWorkspaces} />` with no `boards` prop — the only call site is correctly migrated.
- Unit test stub exists at `tests/unit/workspace-sidebar.test.tsx`, uses `describe.skip(...)` matching the slice-15 precedent, with `@ts-expect-error` on the testing-library/vitest imports per F1.2 convention. Two test bodies seeded: outside-provider empty-state copy, and inside-provider board-group rendering.

#### F2.2 — `<NoBoardsInWorkspace>` no longer rendered inside the sidebar — CLOSED

- `BoardList.tsx` no longer imports `NoBoardsInWorkspace` (verified by grep). The empty-state branch (`BoardList.tsx:62-70`) now renders a small inline `"No boards yet"` paragraph at 13px muted, sized to fit the 230px sidebar rail.
- `components/shared/empty-states/NoBoardsInWorkspace.tsx` itself is untouched (`git log` of the empty-states directory shows zero commits in the followup-2 range), preserving it for Slice 11's workspace-landing page.
- `workspaceName` prop vestige cleanup verified: `grep "workspaceName"` against both `BoardList.tsx` and `WorkspaceSidebar.tsx` returns nothing. F2.1's full prop refactor cleanly removed the `_workspaceName` placeholder F2.2 had introduced — no underscore-prefixed dead inputs remain.

#### F2.3 — `UserMenu` Avatar size cast removed — CLOSED

- `UserMenu.tsx:18`: `const avatarSize: 37.4 | 26 = variant === "main" ? 37.4 : 26;` — typed as the exact union, no cast.
- `UserMenu.tsx:36`: `<Avatar ... size={avatarSize} ... />` — no `as` clause anywhere on the call site.
- `Avatar`'s `size` prop accepts `22 | 24 | 26 | 30 | 37.4` (`components/shared/Avatar.tsx:9`); `37.4 | 26` is a structurally valid subset, so the type-checker accepts the assignment without coercion.
- Small variant correctly resolves to 26 (matching the original spec).

#### F2.4 — `MainSidebar` raw `rgba(...)` tokenized — CLOSED

- New token `--color-fg-on-nav: rgba(255, 255, 255, 0.6);` added at `app/globals.css:16`.
- `MainSidebar.tsx:131`: `color: "var(--color-fg-on-nav)"` — token consumed.
- Grep for `rgba\(|#[0-9a-f]{3,8}\b` against `components/shared/sidebar/MainSidebar.tsx` returns zero matches — no other raw color literals remain.

### Quality gates

- **`pnpm lint`:** clean (`No fixes applied.` across 111 files).
- **`pnpm typecheck`:** 7 errors total, all in the pre-existing `app/(auth)/*` and `app/(app)/account/*` Zod 4 / RHF resolver category. Zero new errors. The followup-2 scope (`workspace-sidebar.test.tsx`, the four sidebar files, `lib/workspace-context.tsx`, `app/globals.css`) is type-clean.

### Verdict

**CLEAN.** All four gaps from the original Stage 3 review are closed. Stage 3 is done.

### Notes for Stage 4

The hand-off contract called out in the original review is now intact:

- `WorkspaceContext.sidebarBoards` is the canonical source for the workspace sidebar's board list. When Slice 11 wraps `app/(app)/w/[workspaceSlug]/layout.tsx` children in `<WorkspaceProvider workspace={...} role={...} sidebarBoards={...}>`, `WorkspaceSidebar` will pick up the data automatically — no plumbing changes needed in `SidebarShell`.
- The unified `SidebarBoard` type (with `workspace_id`) lives in `lib/workspace-context.tsx`. Slice 11's `loadSidebarBoards(workspace.id)` (`lib/sidebar-data.ts`) already returns this shape; if Slice 11 needs to extend the row (e.g. with `last_viewed_at` for the LastViewed empty state), do it in `lib/workspace-context.tsx` so all consumers track in lockstep.
- `NoBoardsInWorkspace` is preserved and unreferenced — Slice 11's workspace-landing page (`app/(app)/w/[workspaceSlug]/page.tsx`) is the intended call site.
- The pre-existing Zod 4 / RHF resolver type errors in auth and account forms remain unaddressed and are out of Epic 05 scope. Recommend tracking them as a separate cleanup task (likely a `react-hook-form` major-version bump or a Zod 3↔4 adapter); they should not block Epic 05 merging.
- Non-blocking observations from the original review (heavy inline `style={{...}}`, `Topbar.tsx` could be RSC, `BoardList` has no error toast on `starBoard` failure, Slice 8 used Base UI `Menu` directly instead of the `<MenuList>` primitive) are still applicable but explicitly deferred.
