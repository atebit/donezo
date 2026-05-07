# Epic 05 — Workspaces & Boards

## Goal

The shell of the application: a workspace switcher, a board list per workspace, and full CRUD on boards. After this epic merges, a user can sign in, create a workspace, invite teammates, create boards, rename them, star them, archive/delete them, and navigate between them — but each board is still empty (groups/tasks land in [06](06-groups-tasks-table.md)).

## Why this is its own epic

Board membership, sidebar navigation, breadcrumbs, and the authed shell layout are shared infrastructure that every later epic plugs into. Building them separately keeps board-internal work in [06](06-groups-tasks-table.md) and beyond from re-doing shell concerns each time.

## In scope

- Authed app shell: sidebar (workspace switcher + board list), topbar (breadcrumbs, account menu, search), main content area.
- Workspace CRUD: create, rename, delete, member management.
- Board CRUD: create, rename, star/unstar, archive, restore, delete, duplicate, change description, move between workspaces (admin+).
- Workspace + board settings pages.
- Board home placeholder (until [06](06-groups-tasks-table.md)).
- Trash view (archived boards) per workspace.
- Workspace and board member management UIs (invite, change role, remove).
- The invitation accept flow UI (server actions live in [04](04-authorization-rls.md)).

## Out of scope

- Tasks, groups, columns ([06](06-groups-tasks-table.md), [07](07-column-system.md)).
- Realtime updates to the sidebar ([08](08-realtime-presence.md) — sidebar will refresh on revalidate-tag for now).
- Email-sending for invites ([13](13-notifications.md) — invitation rows persist; email is stubbed).
- Workspace-level dashboards / cross-board search ([11](11-filtering-views.md)).

## Dependencies

[01](01-foundation.md), [02](02-supabase-schema.md), [03](03-auth.md), [04](04-authorization-rls.md).

## Architecture & design choices

### Routes

```
app/
  (app)/
    layout.tsx                      # authed shell
    page.tsx                        # workspace home: redirects to last-viewed workspace
    w/[workspaceSlug]/
      layout.tsx                    # workspace context: provides workspace + role
      page.tsx                      # workspace dashboard: board grid
      settings/
        general/page.tsx            # name, slug, delete
        members/page.tsx            # member list, invite, role change
        billing/page.tsx            # placeholder; deferred
      trash/page.tsx                # archived boards
      b/[boardId]/
        layout.tsx                  # board context: provides board + role
        page.tsx                    # board home (table view in [06])
        settings/
          general/page.tsx          # title, description, privacy, archive, delete
          members/page.tsx          # board-specific membership
    account/page.tsx                # already in [03]
  (auth)/
    join/[token]/page.tsx           # invitation accept
```

### Workspace slug

Workspaces have a `slug` (unique) for URLs. Slugs default to a kebab-cased name; collisions append `-2`, `-3`, etc. Slugs are editable by owners; the old slug 301-redirects via middleware lookup.

For internal release, slugs are scoped per workspace (one workspace per company), so collisions are rare. Multi-org will need org-scoped slugs later.

### Selecting a workspace

A user with multiple workspaces gets a switcher in the sidebar. Last-viewed workspace persists in `profile.last_workspace_id` (add column in this epic's migration). Visiting `/` redirects to `/w/<slug>` based on that, falling back to the first workspace, falling back to a "create your first workspace" page.

### Server-side data fetching

Every page is a Server Component. Layouts load the data the page tree needs and pass to children via React context (created in `lib/workspace-context.tsx`).

```ts
// app/(app)/w/[workspaceSlug]/layout.tsx
export default async function WorkspaceLayout({ params, children }) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspace")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();

  if (!workspace) notFound();

  const role = await getWorkspaceRole(workspace.id);
  if (!role) notFound();           // RLS would also reject; explicit notFound is friendlier

  return (
    <WorkspaceProvider workspace={workspace} role={role}>
      <SidebarShell>{children}</SidebarShell>
    </WorkspaceProvider>
  );
}
```

### Sidebar

Components:

- `<WorkspaceSwitcher />` — dropdown listing all workspaces the user belongs to. Selecting one navigates to that workspace's home.
- `<BoardList />` — collapsible list grouped by "Starred" and "All boards". Filtered by search input. Stars persist in `board.is_starred` (per-user starring is a [11](11-filtering-views.md) concern; v1 stars are board-level).
- `<NewBoardButton />` — opens the create-board modal.
- `<UserMenu />` (footer) — avatar + dropdown to account settings, sign out, theme toggle.

Sidebar is `"use client"` for the search input and collapse state. Data is passed in from the server layout.

### Topbar

- Breadcrumbs: `Workspace › Board` (or `Workspace › Settings`).
- Global search input ([11](11-filtering-views.md) for the implementation; here it's a placeholder that opens a modal stub).
- Notification bell ([13](13-notifications.md); stub here).
- Account menu (mirrors UserMenu in sidebar; redundant on desktop but useful on mobile).

### Workspace settings — General

- Name (editable, slug regenerated on save).
- Slug (editable; warning about breaking links).
- Delete workspace (owner-only, soft delete; type the workspace name to confirm).

### Workspace settings — Members

Table with columns: avatar+name, email, role (dropdown for admin/owner), joined date, action (remove).

Above the table:
- "Invite members" button → modal with email input(s) + role select. Submits multiple emails at once. Server action `inviteToWorkspace` ([04](04-authorization-rls.md)).
- Pending invitations section: list of unaccepted invites with "Resend" and "Revoke" actions.

### Board settings — General

- Title, description.
- Visibility toggle: workspace-wide vs private (`is_private` column).
- Archive (soft delete; sets `deleted_at`).
- Restore (clears `deleted_at`; only visible from trash).
- Permanent delete (owner-only, type to confirm).

### Board settings — Members

Visible only when `is_private = true`. Otherwise: a notice "This board is visible to all workspace members. Make it private to manage members individually."

When private: table mirroring workspace members.

### Trash

`/w/<slug>/trash` lists archived boards. Each row: board title, archived date, "restore" button, "delete permanently" button (admin+).

Auto-purge after 30 days. A scheduled Supabase Edge Function (or pg_cron job) hard-deletes boards where `deleted_at < now() - interval '30 days'`. Configured in [15](15-observability-testing-cicd.md); function lives in `supabase/functions/purge-trash/`.

### Create-board modal

Modal launched from the sidebar. Fields:

- Title (required).
- Description (optional).
- Visibility (workspace / private).
- Template (dropdown): Blank, "Project tracker," "Content calendar," "Bug tracker," "OKRs."

Templates create the board with a preset column set + a few example groups/tasks. Template definitions live in `lib/templates/`. Each is a function that, given a freshly-created board id, runs a sequence of inserts. Templates are an extensibility point; v1 ships with 4–5.

For epic 05, ship the **Blank** template only. Other templates land alongside [07](07-column-system.md) (column types) since they need column-config knowledge.

### Duplicate board

Server action `duplicateBoard({ boardId })`:

1. Insert a new board row with `title = original.title + " (Copy)"`, same workspace.
2. Copy columns (preserving order, types, configs, labels).
3. Copy groups.
4. Copy tasks (without their `created_at`/`updated_at` history).
5. Copy cells (referencing new label_ids based on a label-id mapping).
6. Skip: comments, activity, attachments, members.

Implemented in a SQL function `clone_board(p_board_id, p_actor_id)` returning the new board id, called from the server action. Atomicity matters; the function runs in a transaction.

### Board home (placeholder)

`app/(app)/w/[slug]/b/[boardId]/page.tsx` initially renders an empty state: "This board is empty. Add your first group." Once [06](06-groups-tasks-table.md) lands, it renders the table view.

### Optimistic updates

Sidebar actions (star, rename, archive) are optimistic via `useOptimistic`. Failure rolls back and shows a toast.

### Caching

Server-rendered pages use Next.js's `fetch` cache only for static-ish reads (workspace list — cheap, infrequent). Per-board reads opt out of cache (`{ cache: 'no-store' }`) — the table view's data must always be fresh.

After mutations, server actions call `revalidateTag` on tags like `workspace:<id>`, `board:<id>`, `boards:<workspaceId>`. Components fetch with `next: { tags: [...] }` to participate.

### Migration: profile.last_workspace_id + label icons

```sql
-- supabase/migrations/00000000000003_workspaces_polish.sql
alter table public.profile
  add column last_workspace_id uuid references public.workspace(id) on delete set null;

-- Optional now, for the create-board modal's templates:
alter table public.column add column icon text;
```

## Visual fidelity requirements

This epic stands up the app shell and is the first to render Donezo's chrome to a logged-in user. Every component below has a locked spec in [`component-system.md`](component-system.md). Source tokens from [`design-system.md`](design-system.md) — never invent new values.

Must-match components (review screenshots before merge):

- **`<MainSidebar />`** — bg `--color-surface-nav` (`#292f4c`), 66px wide rail, hover wash `rgba(0,0,0,.6)` with 10px radius. Avatar `scale(.9)` on hover. Mobile bottom-bar variant per [component-system.md §1.1](component-system.md#11-mainsidebar-icon-column).
- **`<WorkspaceSidebar />`** — bg `--color-surface-rail` (`#F6F7FB`), `230px` open / `30px` collapsed. Width animates over `--motion-slow`; inner content opacity fades `0 → 1` with **0.25s delay** so it appears after the rail finishes. Toggle pill on right edge animates padding asymmetrically on hover. See [§1.2](component-system.md#12-workspacesidebar-slide-out-workspace-panel).
- **`<BoardHeader />`** — sticky bar with title (inline-editable per [§2.1](component-system.md#21-inline-editable-title-blockquote-pattern)), star (`--color-label-yellow` filled), board tools row, member avatar pile (24px, `-5px` overlap, white border), view tabs (only "Table" enabled in this epic; active tab gets 2px bottom border `--color-primary`). See [§1.3](component-system.md#13-boardheader-top-of-board).
- **`<CreateBoardModal />`** — 500px wide centered modal with `--shadow-modal`. See [§3.7](component-system.md#37-createboardmodal-centered).
- **`<MemberModal />` / `<InviteModal />`** — 360px panel, member chips bg `--color-chip-member` (`#e5f4ff`), radius `8px`. See [§3.8](component-system.md#38-membermodal--invitemodal).
- **`<BoardDescriptionModal />`** — 850×550 two-pane modal with right pane bg `--color-surface-info`. See [§3.6](component-system.md#36-boarddescriptionmodal-centered-two-pane).
- **Active board row** in workspace sidebar uses `--color-surface-active` (`#cce5ff`).
- **Workspace logo glyph** — 30×30 rounded-8px tile bg `--color-label-green` with white "lightning" + home overlay. See [§1.2](component-system.md#12-workspacesidebar-slide-out-workspace-panel).
- **Favorites empty-state** — 80px star, line-height 1.5. See [§8.3](component-system.md#83-favorites-empty-state).
- **`<LastViewed />`** workspace landing widget — see [§8.2](component-system.md#82-lastviewed).

Inline-editable title pattern ([component-system.md §2.1](component-system.md#21-inline-editable-title-blockquote-pattern)) ships its first instance here on the board title — extract as a shared `<EditableTitle />` primitive, since [06](06-groups-tasks-table.md) (group + task) and [09](09-comments-activity.md) (board description) all reuse it.

## Tasks

1. **Migration** for `profile.last_workspace_id` and `column.icon`.
2. **Server actions** in `app/(app)/actions.ts`:
   - `createWorkspace({ name })`
   - `renameWorkspace({ id, name })`, `updateWorkspaceSlug({ id, slug })`, `deleteWorkspace({ id })`
   - `createBoard({ workspaceId, title, isPrivate })`
   - `renameBoard({ id, title })`, `updateBoardDescription`, `setBoardPrivacy`, `starBoard`, `archiveBoard`, `restoreBoard`, `deleteBoard`, `duplicateBoard`
   - `setLastWorkspace({ workspaceId })`
   - Member management: `setWorkspaceMemberRole`, `removeWorkspaceMember`, `setBoardMemberRole`, `removeBoardMember`, `revokeInvitation`, `resendInvitation`
3. **Build the authed shell layout** with sidebar + topbar in `app/(app)/layout.tsx`.
4. **Sidebar components**: `WorkspaceSwitcher`, `BoardList`, `NewBoardButton`, `UserMenu`. Client components where state is needed; server-rendered initial data.
5. **Workspace landing page** (`/w/[slug]`): grid of board cards (title, members avatars, last activity date placeholder, star toggle, click-through to board).
6. **Workspace settings — General page.** Form with name / slug / delete.
7. **Workspace settings — Members page.** Table + invite modal + pending invitations list.
8. **Board layout** (`/w/[slug]/b/[boardId]/layout.tsx`): board header with title (inline edit), star, settings menu, member avatar pile, view tabs (placeholders for kanban/calendar/timeline/dashboard, only "Table" enabled).
9. **Board home placeholder.** Empty state with CTA.
10. **Board settings — General page.** Form + privacy toggle + archive/delete.
11. **Board settings — Members page.** Conditional on `is_private`.
12. **Trash page** with restore + permanent-delete actions.
13. **Invitation accept page** (`/join/[token]`). Public route (in `(auth)`); `acceptInvitation` server action.
14. **`Blank` template** for create-board flow. (Other templates land later.)
15. **Sidebar search** input filters board list client-side.
16. **Empty states** for: no workspaces (create first), no boards in workspace (create first board), no archived boards (trash).
17. **Last-viewed workspace** behavior in `app/(app)/page.tsx`.
18. **Storybook stories** (if Storybook is used) for the major sidebar/topbar components.
19. **Playwright tests:** sign in → create workspace → create board → rename → star → archive → restore → delete. Invite a second user (mocked email) → accept → confirm role.

## Definition of done

- A new user lands on `/` post-auth and is prompted to create a workspace (or directed to one if they were invited).
- Creating a workspace, board, then renaming and starring works end-to-end with optimistic updates.
- Archiving a board removes it from the sidebar and adds it to trash; restoring brings it back.
- Inviting a teammate by email creates an invitation row; visiting the join URL adds them as a workspace member with the chosen role.
- Workspace owners can delete the workspace; admins cannot. Verified in tests.
- The board layout renders the title, member avatars, and view tabs (only "Table" enabled).
- All routes are server-rendered; navigating doesn't refetch the workspace list unnecessarily.

## Open questions

- **Per-user starring vs per-board starring.** Current schema is per-board. Real monday is per-user. If we want per-user, add a `user_starred_board(user_id, board_id, starred_at)` table. Recommend per-user; cheap to add. Bumping to this epic.
- **Board favorites order**: starred boards in their own section (current plan) vs sort-by-starred-first inline. Current plan is clearer.
- **Workspace deletion confirmation**: type the name vs require email re-auth. Type-the-name is industry standard.
- **Slug uniqueness**: globally unique vs workspace-local. Spec says global; revisit if multi-tenant grows.
- **Templates**: should templates be DB-stored (editable) or code (versioned with migrations)? Code is simpler; DB-stored unlocks "save board as template." Defer; start with code.
- **Move board between workspaces**: useful but rare. Deferred.
