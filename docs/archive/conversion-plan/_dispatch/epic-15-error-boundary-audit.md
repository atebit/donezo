# Epic 15 — Error Boundary Audit

**Produced by:** Slice 1D executor (2026-05-13).
**Scope:** Every top-level segment (route group or layout-owning directory) under `app/(app)/`.

In Next.js App Router, an `error.tsx` in a directory catches errors thrown in that segment's subtree
(its `page.tsx`, sub-segments, and their children). An `error.tsx` in a parent catches errors from
all children that do not have their own closer boundary.

The root-level `app/error.tsx` and `app/global-error.tsx` are owned by Slice 1A and are excluded
from this table.

---

## Summary table

| Segment path | Layout exists? | error.tsx status | Notes |
|---|---|---|---|
| `app/(app)/` | yes | **existing** (`app/(app)/error.tsx`) — owned/wired by 1A | Top-level app shell boundary. Catches errors from all children that don't have a closer boundary. |
| `app/(app)/page.tsx` (redirect page) | — | not needed — no layout | Trivial redirect; an error here propagates to `app/(app)/error.tsx`. |
| `app/(app)/account/` | no layout | **not needed** | No layout; errors bubble to `app/(app)/error.tsx`. Account pages are low-risk (static forms). |
| `app/(app)/account/notifications/` | no layout | **not needed** | Sub-page of account; inherits account's boundary coverage from `app/(app)/error.tsx`. |
| `app/(app)/notifications/` | no layout | **added by this slice** (`app/(app)/notifications/error.tsx`) | Notification feed is async and user-facing enough that a dedicated boundary improves UX (avoids the whole app shell going to the error state for a notification query failure). |
| `app/(app)/w/` | no layout | **not needed** | No `page.tsx` in `w/` itself; purely a route prefix. |
| `app/(app)/w/[workspaceSlug]/` | yes | **added by this slice** (`app/(app)/w/[workspaceSlug]/error.tsx`) | The workspace layout loads workspace data and renders the sidebar. A boundary here prevents a workspace load failure from crashing the outer app shell. |
| `app/(app)/w/[workspaceSlug]/settings/` | yes | **not needed** | Settings pages are low-traffic admin flows. Errors here are caught by the workspace boundary (`[workspaceSlug]/error.tsx`) added by this slice, which is sufficient. |
| `app/(app)/w/[workspaceSlug]/settings/general/` | no layout | **not needed** | Sub-page of settings; covered by workspace boundary. |
| `app/(app)/w/[workspaceSlug]/settings/members/` | no layout | **not needed** | Sub-page of settings; covered by workspace boundary. |
| `app/(app)/w/[workspaceSlug]/settings/billing/` | no layout | **not needed** | Sub-page of settings; covered by workspace boundary. |
| `app/(app)/w/[workspaceSlug]/trash/` | no layout | **not needed** | Trash is a simple list; covered by workspace boundary. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/` | yes | **to be added by Slice 1A** (`app/(app)/w/[workspaceSlug]/b/[boardId]/error.tsx`) | Board boundary so a board crash does not destroy the workspace sidebar. Slice 1A spec explicitly owns this file — this audit confirms it is the right scope. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/` | yes | **not needed** | Low-traffic admin flow; covered by board boundary (1A). |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/` | no layout | **not needed** | Covered by board settings → board boundary chain. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/` | no layout | **not needed** | Covered by board boundary. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/t/[taskId]/` | no layout | **not needed** | Task direct-link page; covered by board boundary. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/@modal/` | parallel slot | **not needed** | `@modal` is a parallel route slot rendered in the board layout. Errors here propagate to the board boundary (1A). Adding a boundary inside a slot is unusual and adds no meaningful UX isolation here. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/@modal/(.)t/[taskId]/` | no layout | **not needed** | Intercepting route for the task drawer modal; rendered in the board layout slot. Covered by board boundary (1A). |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/kanban/` | no layout | **not needed** | View-mode sub-page; covered by board boundary. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/table/` | no layout | **not needed** | View-mode sub-page; covered by board boundary. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/calendar/` | no layout | **not needed** | View-mode sub-page; covered by board boundary. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/timeline/` | no layout | **not needed** | View-mode sub-page; covered by board boundary. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/dashboard/` | no layout | **not needed** | View-mode sub-page; covered by board boundary. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/form/` | no layout | **not needed** | Public form view; covered by board boundary. |

---

## Boundary coverage diagram

```
app/global-error.tsx          (1A — root layout crashes)
└── app/error.tsx             (1A — catches server-component errors at root)
    └── app/(app)/error.tsx   (1A — catches all app-shell errors)
        ├── app/(app)/notifications/error.tsx  (1D — notifications-scoped fallback)
        └── app/(app)/w/[workspaceSlug]/error.tsx  (1D — workspace-scoped fallback)
            └── app/(app)/w/[workspaceSlug]/b/[boardId]/error.tsx  (1A — board-scoped fallback)
```

---

## Decisions and rationale

1. **`account/` has no boundary** — account pages are static forms (profile, notification preferences).
   A failure here is unexpected enough that the app-shell boundary (`app/(app)/error.tsx`) is an
   appropriate fallback. Adding a boundary would give marginal UX benefit.

2. **`notifications/` gets a boundary** — the notification feed performs async data loading. If the
   feed errors (DB query, RLS issue, etc.), users should see a targeted "notifications failed" UI
   rather than the whole app-shell error state. Low cost, clear benefit.

3. **`[workspaceSlug]/` gets a boundary** — the workspace layout fetches workspace data and renders
   the sidebar. An error here (e.g. workspace deleted mid-session) should show a workspace-scoped
   message while keeping the outer shell (top-nav) intact.

4. **`[boardId]/` boundary is owned by 1A** — the epic doc explicitly calls out "so a board crash
   doesn't destroy the sidebar." Slice 1A adds `app/(app)/w/[workspaceSlug]/b/[boardId]/error.tsx`
   with Sentry wiring. This slice confirms that ownership and does not add a duplicate.

5. **Sub-pages within workspace / board** — no individual view boundaries added. Each view
   (`kanban/`, `table/`, etc.) is a thin page component; a crash is caught by the closest parent
   boundary. Adding per-view boundaries would be over-engineered for v1.

6. **`@modal` parallel slot** — parallel route slots render inside the parent layout. An error in
   `@modal` is caught by the board layout's error boundary (1A). Next.js does support `error.tsx`
   inside slots but the UX recovery is complex (which "slot" triggered, etc.). Deferred to a future
   polish pass if real crashes emerge here.
