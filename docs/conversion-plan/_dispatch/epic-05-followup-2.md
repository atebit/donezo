# Epic 05 — Followup Round 2 (Stage 3)

Companion to [`epic-05-stage-3-review.md`](./epic-05-stage-3-review.md). Four parallel-safe surgical slices fixing the four definition-of-done gaps identified in the Stage 3 review. None of these slices add new scope; each undoes a specific drift introduced in Stage 3.

All slices are owned by `epic-executor` (sonnet). All slices target the `epic/05-workspaces-boards` branch directly (no worktree isolation — Stage 3 redispatch lessons apply).

Stack defaults to restate (CLAUDE.md): pnpm, Next.js 15 App Router RSC-first, Server Actions, TS strict, Tailwind v4 with `var(--color-*)` token consumption, no raw hex/rgba, Zustand for UI-only state, no `as any`, no `as <wrong-narrow-union>`. Do not touch legacy `frontend/` or `backend/`.

---

## Slice F2.1 — Wire `WorkspaceSidebar` to `WorkspaceContext.sidebarBoards`

### Files
- `components/shared/sidebar/WorkspaceSidebar.tsx` (modify)
- `components/shared/sidebar/SidebarShell.tsx` (modify — drop the now-unused `boards`/`activeBoardId` plumbing if any)
- `components/shared/sidebar/BoardList.tsx` (modify — input contract change only; logic unchanged)

### Spec

The Stage-4 hand-off contract (epic doc lines 1239–1269 and the F1.2 `WorkspaceContext.sidebarBoards` amendment) requires that the workspace layout, not the root `(app)` layout, owns the board data. Slice 11 will populate `WorkspaceContext` via `<WorkspaceProvider sidebarBoards={...}>`. The sidebar must read from that context.

Today, `WorkspaceSidebar` accepts `boards?: SidebarBoards | undefined` as a prop and never receives one (`SidebarShell` does not forward it). Replace the prop with a context read:

1. In `WorkspaceSidebar.tsx`:
   - Remove the `boards` and `activeBoardId` props from `WorkspaceSidebarProps`. Keep `workspaces`.
   - Read `const ctx = useWorkspaceMaybe()` once. Derive:
     - `currentWorkspace = ctx?.workspace ?? null`
     - `sidebarBoards = ctx?.sidebarBoards ?? undefined`
   - Pass `sidebarBoards` (rename to whatever signals "may be absent") into `<BoardList initialBoards={sidebarBoards} ...>`.
   - For the active-board highlight, derive `activeBoardId` from `usePathname()` segments — match `/w/<slug>/b/<boardId>` and pull `boardId`. (Importing a `useBoardMaybe()` here is also acceptable but optional; pathname parsing is sufficient and avoids a context dependency.)
   - Type imports: `SidebarBoards` already exists in `@/lib/workspace-context`. Reuse it; do not redefine the local `type SidebarBoards = {...}` shape unless the existing export is unsuitable. If the existing `SidebarBoard` type lacks `workspace_id` (it does — see `lib/workspace-context.tsx:6-10`), either (a) extend the context type to include `workspace_id` (preferred — `loadSidebarBoards` already returns it), or (b) leave the context type as-is and have the sidebar drop the field for routing purposes (the slug comes from `currentWorkspace.slug`, so `workspace_id` is unused at the row-render level). Take path (a) — minor type-widening that prevents future drift.

2. In `lib/workspace-context.tsx`: add `workspace_id: string` to the `SidebarBoard` type so the context shape matches `loadSidebarBoards`'s return shape and `BoardList`'s internal `SidebarBoard`.

3. In `BoardList.tsx`: ensure the local `SidebarBoard` type reuses or matches the canonical `lib/workspace-context` export. If the duplicate type definition is dropped in favor of importing, `OptimisticBoard` keeps the `& { starred: boolean }` extension. No logic changes; the optimistic update path stays identical.

4. In `SidebarShell.tsx`: no longer forwards `boards` or `activeBoardId` (it never did; just confirm and clean up any stale prop plumbing if present).

5. The "Select a workspace to see your boards" empty branch in `WorkspaceSidebar` (when `currentWorkspace == null`) stays unchanged — it correctly handles `/account` and the pre-Slice-11 transitional render.

### Definition of done
- Outside `/w/...`, `WorkspaceSidebar` renders the "Select a workspace" copy.
- Inside `/w/<slug>` (after Slice 11 lands its `<WorkspaceProvider sidebarBoards={...}>`, **simulated for this slice's tests via a unit test that renders `WorkspaceSidebar` with a mock context**), `BoardList` receives the boards from context and renders them.
- `WorkspaceSidebar` exposes no `boards` prop. `SidebarShell` exposes no `boards` prop.
- The active row highlight resolves correctly when the pathname matches `/w/<slug>/b/<boardId>(/...)?`.
- `pnpm lint` and `pnpm typecheck` are clean.
- Add a unit test (`tests/unit/workspace-sidebar.test.tsx` — Vitest + React Testing Library) that renders `<WorkspaceSidebar workspaces={[...]} />` once **outside** a `<WorkspaceProvider>` (asserts the empty-state copy is visible) and once **inside** a `<WorkspaceProvider>` with two starred + two unstarred boards (asserts both groups render). The test may `describe.skip` if RTL infrastructure is not yet set up in this repo — match the existing precedent in `tests/unit/board-actions.test.ts` and `tests/unit/workspace-actions.test.ts`. If RTL is not yet wired, write the test as `describe.skip` with the assertions inline so a future DX pass can drop the `.skip`.

### Forbidden scope
- Do not touch any Slice 11 file (`app/(app)/w/[workspaceSlug]/layout.tsx`, `app/(app)/w/[workspaceSlug]/page.tsx`).
- Do not modify `loadSidebarBoards` in `lib/sidebar-data.ts`.
- Do not modify `useWorkspace`/`useWorkspaceMaybe` in `hooks/use-workspace.ts`.
- Do not modify the `BoardList` filter / starred-split / `useOptimistic` logic.
- Do not modify `MainSidebar`, `Topbar`, `WorkspaceSwitcher`, `UserMenu`, `NewBoardButton`.

### Escalation triggers
- If extending `lib/workspace-context.tsx`'s `SidebarBoard` to include `workspace_id` causes a downstream type error you cannot resolve in this slice's file scope, **stop and escalate** — do not narrow back; the workspace_id must round-trip cleanly.
- If the unit-test infrastructure (RTL, jsdom) is fundamentally absent, ship `describe.skip` per the precedent and note it in the done report; do not stand up new test infra in this slice.

---

## Slice F2.2 — Replace `WorkspaceSidebar`'s page-empty-state with an inline "no boards" hint

### Files
- `components/shared/sidebar/BoardList.tsx` (modify)
- `components/shared/sidebar/WorkspaceSidebar.tsx` (read-only — no changes expected)

### Spec

`BoardList.tsx:73-79` currently renders `<NoBoardsInWorkspace workspaceName={...} />` when `optimisticBoards.length === 0`. That component is the workspace-landing-PAGE empty state (centered card, 24px H2, primary CTA — see `components/shared/empty-states/NoBoardsInWorkspace.tsx`). Inside a 230px-wide sidebar rail it overflows; per the slice 10 spec (dispatch plan line 1372), `NoBoardsInWorkspace` is owned by `app/(app)/w/[slug]/page.tsx`.

In `BoardList.tsx`:
1. Remove the import of `NoBoardsInWorkspace`.
2. Remove the `workspaceName` prop from `BoardListProps` (and the call site in `WorkspaceSidebar.tsx` if it currently passes it — verify).
3. In the `optimisticBoards.length === 0` branch, render an inline hint:
   - A small left-aligned `<p>` inside `<div className="flex flex-col gap-1">`, font-size 13, color `var(--color-fg-muted)`, padding `8px`.
   - Copy: `"No boards yet"`.
   - When `search` is non-empty AND there are no matches, the existing `regularBoards.length === 0 && search` branch already handles that messaging — leave it.
4. The Favorites empty state (`<FavoritesEmpty />`) remains in the starred section as before. That is correctly placed.

### Definition of done
- `<NoBoardsInWorkspace>` is no longer imported by `BoardList.tsx`.
- `BoardList` renders only sidebar-sized chrome when the board count is zero.
- `WorkspaceSidebar` no longer passes `workspaceName` to `BoardList` (if it does today; confirm and remove).
- `pnpm lint` and `pnpm typecheck` are clean.
- No raw hex/rgba introduced.

### Forbidden scope
- Do not modify `components/shared/empty-states/NoBoardsInWorkspace.tsx` itself — it stays available for Slice 11's workspace-landing page.
- Do not change the `useOptimistic` / `starBoard` wiring.
- Do not touch the Favorites empty state.

### Escalation triggers
- None expected. If the prop removal cascades into unexpected types in a non-Slice-8 file, stop and escalate.

---

## Slice F2.3 — Fix `UserMenu` Avatar size cast

### Files
- `components/shared/sidebar/UserMenu.tsx` (modify)

### Spec

`UserMenu.tsx:36` writes:

```ts
size={avatarSize as 37.4 | 26 | 30 | 24 | 22}
```

…where `avatarSize = variant === "main" ? 37.4 : 28`. The literal `28` is **not** in `Avatar`'s `size` union (`22 | 24 | 26 | 30 | 37.4`). The cast lies, violating CLAUDE.md's TS-strict / no-`as-any` posture (a narrow-but-wrong cast is the same class of failure).

Per dispatch-plan slice 9 line 1331 ("smaller variant") and the legacy `component-system.md` Avatar spec (small variant = 26px), the small variant must be `26`.

Change:
- `const avatarSize = variant === "main" ? 37.4 : 28;` → `const avatarSize: 37.4 | 26 = variant === "main" ? 37.4 : 26;`
- Drop the `as 37.4 | 26 | 30 | 24 | 22` cast at the call site. Pass `size={avatarSize}` directly. The narrowed union type lets it satisfy `Avatar`'s `size?: 22 | 24 | 26 | 30 | 37.4` without a cast.

### Definition of done
- No `as` cast on `<Avatar size={...}>` in `UserMenu.tsx`.
- Small variant renders at 26px (visually verified via screenshot or pixel-measured `width`/`height` style on the rendered `<Avatar>`).
- `pnpm lint` and `pnpm typecheck` are clean.

### Forbidden scope
- Do not modify `components/shared/Avatar.tsx`.
- Do not modify `MainSidebar.tsx` (it only passes `variant="main"`, which is already 37.4 — correct).
- Do not modify `Topbar.tsx` (it only passes `variant="small"` — the fix flows through transparently).

### Escalation triggers
- If the spec for the small avatar size changed in `component-system.md` to a value outside the Avatar union (e.g. 28 truly intended), stop and escalate. The Avatar union itself would need extension and that is out of scope.

---

## Slice F2.4 — Replace raw `rgba(...)` literal in `MainSidebar` with a token

### Files
- `app/globals.css` (modify — add one token)
- `components/shared/sidebar/MainSidebar.tsx` (modify)

### Spec

`MainSidebar.tsx:131` sets `color: "rgba(255, 255, 255, 0.6)"` on `NavToolButton`. CLAUDE.md and slice 8 DoD forbid raw color literals. The intended color is the muted-white nav-icon foreground, distinct from the existing `--color-surface-nav-hover` (which is the nav button's hover *background*).

1. In `app/globals.css`, under the existing `@theme` block adjacent to `--color-surface-nav-hover`, add a new token:

   ```
   --color-fg-on-nav: rgba(255, 255, 255, 0.6);
   ```

   Place the line so the additions stay grouped with `--color-surface-nav` / `--color-surface-nav-hover`. Do not modify any other token.

2. In `components/shared/sidebar/MainSidebar.tsx`, change the inline style to consume the token:

   ```ts
   color: "var(--color-fg-on-nav)",
   ```

   The `disabled` state already applies `opacity: 0.4` on top — that stacks correctly with the token.

### Definition of done
- `MainSidebar.tsx` contains zero raw hex/rgba literals (verify via grep: `rg "#[0-9a-fA-F]{3,8}\b|rgba\(" components/shared/sidebar/MainSidebar.tsx` returns nothing).
- `app/globals.css` adds exactly one new token (`--color-fg-on-nav`); no other line changes.
- The hover-affordance behavior on nav tools is unchanged (`--color-surface-nav-hover` remains the hover background).
- `pnpm lint` is clean.

### Forbidden scope
- Do not introduce or rename other tokens.
- Do not change the actual rgba value (`rgba(255, 255, 255, 0.6)`); only its location.
- Do not modify any other component file.

### Escalation triggers
- If a token with the same intent already exists under a different name (e.g. `--color-fg-inverse-muted`), stop and escalate so we do not introduce a duplicate.

---

## Cross-slice notes

- F2.1 and F2.2 both touch `BoardList.tsx`. **Sequence them**: F2.2 first (drop `NoBoardsInWorkspace` and `workspaceName` prop), then F2.1 (which retypes `initialBoards`). Or merge them into a single executor task — they are small enough. Recommended: dispatch F2.2 first, then F2.1, then F2.3 and F2.4 in parallel with each other.
- F2.3 and F2.4 are file-disjoint from each other and from F2.1/F2.2; they are safe to parallelize at any point in the schedule.
- After all four slices land, Stage 3 review re-runs against the new diff. If clean, Stage 4 is unblocked.

## Open questions for the user

None. Each gap maps to a deterministic fix backed by an existing spec line. Proceed with dispatch.
