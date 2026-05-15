# Epic 05: Workspaces & Boards — Dispatch Plan

**Status:** approved
**Drafted on:** 2026-05-07
**Approved on:** 2026-05-07

## Decisions locked by user

| # | Question | Decision |
|---|---|---|
| Q1 | Per-user vs per-board starring | **(a) Per-user** — `user_starred_board` table |
| Q2 | Board description column | **(a) Add `board.description` in Slice 1 migration** |
| Q3 | Templates dropdown | **(a) Show dropdown; only Blank enabled; others disabled with "Available later" tooltip** |
| Q4 | Trash auto-purge | **No cron — ever.** Permanent deletion is manual via the "Delete permanently" button in the trash page (admin+ only). No purge function in this epic or in epic 15. Soft-deleted boards persist until an admin explicitly deletes them. |
| Q5 | Storybook | **(a) Skip — no playground route** |
| Q6 | Workspace deletion confirmation | **(a) Type-the-name in a confirmation modal** |
| Q7 | Slug — old URL after rename | **(a) Old slug → 410 Gone; no redirect table** |
| Q8 | Invitation revoke/resend | **(a) `invitation.revoked_at` soft-revoke; resend = extend `expires_at`** |
| Q9 | Move board between workspaces | **(a) Deferred** |
| Q10 | Invitation role options | **(a) Admin / Member / Viewer only** |
| Q11 | Topbar stubs | **(a) Disabled-look icons with "Coming soon" tooltip** |
| Q12 | `<EditableTitle>` location | **(a) `components/shared/EditableTitle.tsx`** |
**Source epic doc:** `docs/conversion-plan/05-workspaces-boards.md`
**Branch (proposed):** `epic/05-workspaces-boards` off `main` (head: `6688849`)
**Sub-branch convention:** `epic/05-workspaces-boards/<slice-kebab>` PRing into the epic branch.

This epic stands up the entire authed application shell — sidebars, topbar, workspace pages, board layout — plus full CRUD on workspaces and boards, member management, invitation accept UI, and the trash flow. It is the largest UI-heavy epic so far. The plan partitions work along stable file boundaries so executors don't collide on the layout/sidebar/header surfaces.

---

## Preconditions verified

Confirmed against the repo on `main` at commit `6688849`:

### Schema present (`supabase/migrations/`)
- `20260506224930_initial_schema.sql` — full base schema, RLS enabled on all 15 tables.
- `20260506230238_view_board_pos_idx.sql` — `view.position` index.
- `20260507003509_avatars_bucket.sql` — Supabase Storage avatars bucket + 4 storage policies.
- `20260507120000_authz_helpers.sql` — `board.is_private` (default false), `role_rank`, `greater_role`, `role_for_board`.
- `20260507120100_rls_policies.sql` — 49 policies covering all 15 tables.
- `20260507120200_invitations_and_creation_rpcs.sql` — `invitation` table + RLS, invitation-only-accept-update trigger, invitation-gated `wsm_insert` / `bm_insert`, `create_workspace(p_name, p_slug)` RPC, `create_board(p_workspace_id, p_name, p_is_private)` RPC. Both RPCs are `security definer set search_path = public`.
- `20260507120300_board_delete_owner_only.sql` — `board_delete` policy tightened to workspace-owner-only.

### Schema columns referenced by the epic doc — current state
- `workspace`: `id`, `slug` (unique), `name`, `created_by`, `created_at`, `updated_at`, `deleted_at`. **No `last_workspace_id` on profile yet.**
- `board`: `id`, `workspace_id`, `name`, `created_by`, `created_at`, `updated_at`, `deleted_at`, `is_private`. **No `is_starred` column. No description column. No `column.icon` column yet.**
- `profile`: `id`, `email`, `display_name`, `avatar_url`, `created_at`, `updated_at`. **No `last_workspace_id` yet.**
- `invitation`: `id`, `workspace_id`, `board_id` (nullable for board-scoped), `email`, `role` ('admin'|'member'|'viewer'), `token`, `invited_by`, `accepted_at`, `expires_at` (default `now() + 14 days`), `created_at`. RLS-locked: invitee or admin+ can SELECT; admin+ INSERT (with `invited_by = auth.uid()`); UPDATE only by invitee on `accepted_at`; trigger blocks any other column from being updated. **No DELETE policy** — invitations are not deleted; they expire or are stamped accepted. **There is no `revoke_invitation` or `resend_invitation` flow yet.**
- `clone_board` SQL function does not exist. The `duplicate_board` RPC needed by this epic is net-new.
- `user_starred_board` table does not exist. Per-user starring is not implemented.

### Routes present in `app/`
- `app/(auth)/{sign-in,sign-up,forgot-password,reset-password,verify-email}/` — all wired.
- `app/(auth)/join/[token]/page.tsx` + `actions.ts` — **already implemented in epic 04.** Page renders a "You've been invited" form that calls `acceptInvitation` then redirects to `/`. Not styled with brand fidelity yet, but functional.
- `app/(app)/layout.tsx` — **stub: returns `<>{children}</>`.** No shell.
- `app/(app)/page.tsx` — **does not exist.** The current `/` route is `app/page.tsx` (foundation health-check page with `Sign in` link, build SHA, ping button — meant for epic 01 dev sanity).
- `app/(app)/account/{page.tsx,account-settings.tsx,actions.ts}` — present (epic 03).
- `app/(app)/w/[workspaceSlug]/` — `actions.ts` only (`createBoard`, `inviteToWorkspace`). **No `page.tsx`, no `layout.tsx`, no `settings/`, no `trash/` page.** The `settings/` directory exists with only a `.gitkeep`.
- `app/(app)/w/[workspaceSlug]/b/[boardId]/` — `actions.ts` (`inviteToBoard`) + empty `table/`, `kanban/`, `calendar/`, `timeline/`, `dashboard/`, `t/[taskId]/`, `settings/` directories (each with a single `.gitkeep`). **No `layout.tsx`, no `page.tsx`.**

### Server actions already present
- `app/(app)/actions.ts` — `createWorkspace({ name, slug })`. Calls `create_workspace` RPC. Maps unique-slug 23505 to a friendly VALIDATION error.
- `app/(app)/w/[workspaceSlug]/actions.ts` — `createBoard({ workspaceId, name, isPrivate })` (calls `create_board` RPC), `inviteToWorkspace({ workspaceId, email, role })` (inserts invitation; logs token; email send is epic 13).
- `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts` — `inviteToBoard({ boardId, email, role })`.
- `app/(auth)/join/[token]/actions.ts` — `acceptInvitation({ token })`.

The epic 05 task list calls for many additional server actions (rename, archive, restore, duplicate, star, set-last-workspace, member role updates, member removal, revoke/resend invitation, set-board-privacy, slug update, board description, etc.). **None of these exist.**

### Components / lib present
- `components/ui/` — `button.tsx` (Base UI + cva), `input.tsx`, `label.tsx`, `menu-list.tsx` (`<MenuList>` + `<MenuListItem>`), `sonner.tsx` (toaster).
- `components/{board,cells,activity,comments,filters,shared}/` — empty `.gitkeep` directories.
- `lib/icons.ts` — canonical Lucide re-exports. Has `IconStar`, `IconHome`, `IconLightning`, `IconSearch`, `IconPlus`, `IconMore`, `IconClose`, etc. **No `IconChevronDown`, `IconChevronLeft`, `IconChevronRight`, `IconBell`, `IconLogOut`, `IconSettings`, `IconTrash` (the existing `IconDelete` is `Trash2`), `IconArchive`, `IconCopy`, `IconLayout`, `IconLink`, `IconCalendar`, `IconKanban` (alias for Columns3), `IconUserPlus`, `IconCheck` (present), `IconUsers`** — many of these will need to be added in this epic.
- `lib/authorization/` — `getBoardRole`, `requireBoardRole`, `getWorkspaceRole`, `requireWorkspaceRole`, `ROLE_RANK`, `Role`.
- `lib/validations/` — `auth.ts`, `workspace.ts` (`CreateWorkspaceSchema`), `board.ts` (`CreateBoardSchema`), `invitation.ts` (`InviteToWorkspaceSchema`, `InviteToBoardSchema`, `AcceptInvitationSchema`). **No schemas yet for rename/slug-update/privacy/duplicate/star/archive/member-role/etc.**
- `lib/actions/with-user.ts` — `withUser` wrapper, `ActionResult<T>` typed result. Reuse without modification.
- `lib/auth/{current-user.ts, profile.ts, public-paths.ts}` — present, all post-RLS.
- `lib/supabase/{server.ts, client.ts, admin.ts, middleware.ts, types.ts, index.ts}`.
- `lib/utils/invitation-token.ts`.
- `lib/utils.ts` — `cn` helper.

### Tokens present (`app/globals.css`)
- All Monday-derived `@theme` tokens are already in place per epic-01-followup-2 Slice I: surface family, primary, fg/border, label palette (incl. selected/hover variants), 12-color group accents, overlay, layout sizes (`--size-rail-main: 66px`, `--size-rail-workspace: 230px`, cell sizes), radii, shadows (`--shadow-modal`, `--shadow-drawer`, `--shadow-card`, `--shadow-bulk-bar`), z-index ladder (`--z-board-header: 30`, `--z-modal: 51`, `--z-drawer: 100`, `--z-popover: 1000`, `--z-rail: 10`, `--z-overlay: 50`), motion durations (`--motion-instant/fast/base/medium/slow/drawer`), easing, fonts (`--font-sans` = Figtree, `--font-display` = Poppins).
- shadcn coexistence block is in place (epic 14 owns reconciliation).
- **Missing token flagged in `component-system.md` §1.1**: `--color-surface-nav-hover` (the baked `rgba(0,0,0,.6)` Main-sidebar hover wash). The doc explicitly says "token to add". This must land in this epic. (We will inline the value via Tailwind arbitrary class in the meantime if needed, but a named token is preferred — Slice 1 covers it.)

### Tooling
- `package.json`: pnpm 10, Next 15.5.16, React 19, Tailwind v4, `@base-ui/react`, `@hookform/resolvers`, `react-hook-form`, `zod`, `lucide-react`, `next-themes`, `pino`, `sonner`. Vitest is **not yet installed** (epic 15 owns runner setup); existing `pnpm test` script is `vitest run --passWithNoTests`. `pnpm test:e2e` is a stub that exits 0 with a "wired in epic 15" notice.
- **Storybook is NOT installed.** No `.storybook/` dir, no `storybook` dependency. The epic doc task #18 says "Storybook stories (if Storybook is used)". Treat as not-applicable for this epic (see Open question 5).

### Pre-existing typecheck noise (carried forward, not in scope here)
- Seven `TS2769` errors in `app/(auth)/{sign-in,sign-up,forgot-password,reset-password}/*-form.tsx` and `app/(app)/account/account-settings.tsx` from `zodResolver(...)` overload mismatch (Zod 4 vs `@hookform/resolvers`). Out of scope for epic 05; tracked per the epic-04 final review. Slices that introduce **new** `useForm` + `zodResolver` callsites in this epic should follow the same pattern as the existing forms (the type lints will keep failing the same way) — do not attempt to fix them in this epic. This is the user's call.

---

## Open questions for the user

These genuinely need a human call before dispatch. Sub-questions are grouped where the answer to one drives the others.

### Q1. Per-user vs per-board starring (epic doc § Open questions, marked "Bumping to this epic; recommend per-user")

The epic spec body still describes per-board starring (`board.is_starred`, sidebar "Starred" section). The Open questions section recommends per-user via a `user_starred_board(user_id, board_id, starred_at)` table.

Which?
- **(a) Per-user starring via new `user_starred_board` table.** RLS: insert/delete only by self where the user has board read access; SELECT only own rows. Sidebar joins to it. **Recommended.** Matches monday's actual behavior; cheap to add.
- **(b) Per-board starring via a new `board.is_starred` column.** Simpler but wrong for multi-user workspaces.

Either way, this is a new migration in this epic.

### Q2. Board description column

Tasks #6, #8, #10 reference editing the board description; spec also references `<BoardDescriptionModal />` (`component-system.md` §3.6). The current `board` table has **no description column**.

- **(a) Add `board.description text not null default ''` in the same Slice 1 migration as the other schema additions.** Recommended.
- **(b) Defer description to epic 06 / 09.**

### Q3. Templates scope for epic 05

Epic spec body says: "ship the **Blank** template only" in epic 05; "Other templates land alongside [07]". Confirm:
- **(a) Blank only.** Just creates the board row via `create_board` RPC; no example groups, no example tasks, no preset columns. The CreateBoardModal's "Template" dropdown is rendered but only Blank is selectable; other entries are disabled with a "Available later" tooltip. **Recommended; matches the doc.**
- **(b) Cut the Template dropdown entirely from epic 05.** Add it back in epic 07.

### Q4. Trash auto-purge cron

Epic spec § Trash says: "Auto-purge after 30 days. A scheduled Supabase Edge Function (or pg_cron job) hard-deletes boards where `deleted_at < now() - interval '30 days'`. Configured in [15]; function lives in `supabase/functions/purge-trash/`."

**Decision (user): No cron — ever.** Permanent deletion is 100% manual via the "Delete permanently" button in the trash page. There is no scheduled purge in this epic or in epic 15. Soft-deleted boards accumulate until an admin explicitly removes them. This eliminates `supabase/functions/purge-trash/` from scope entirely.

### Q5. Storybook

Task #18: "Storybook stories (if Storybook is used) for the major sidebar/topbar components." Storybook is not installed.

- **(a) Skip Storybook entirely in this epic.** Document component contracts via JSDoc + a small "playground" route under `app/(app)/_dev/components/` (gated to dev only, not behind any feature flag). **Recommended — Storybook is a lift this epic should not be carrying.**
- **(b) Stand up Storybook in this epic.** Adds significant scope (config, theme integration, MDX).
- **(c) Skip and add no playground.** No alternative documentation surface.

### Q6. Workspace deletion confirmation pattern

Epic doc § Open questions: "type the name vs require email re-auth. Type-the-name is industry standard."

- **(a) Type-the-name in a confirmation modal.** Recommended; matches the doc.
- **(b) Email re-auth.**

### Q7. Workspace slug uniqueness

Epic doc § Workspace slug: "Workspaces have a `slug` (unique) for URLs... Slugs are editable by owners; the old slug 301-redirects via middleware lookup." § Open questions: "globally unique vs workspace-local. Spec says global."

- **(a) Globally unique** (current schema constraint already enforces this). The slug change UX renames the workspace's URL; old slug → 410 (no redirect; defer redirect-table to a later epic). **Recommended for v1; the redirect table is a feature creep avoidance.**
- **(b) Globally unique + slug history table for redirects.** Adds a new `workspace_slug_history` table and middleware lookup. More work; defer.
- **(c) Workspace-local uniqueness.** Requires schema change; not recommended.

### Q8. Invitation revoke / resend semantics

Epic spec task #2 lists `revokeInvitation` and `resendInvitation` server actions. The current `invitation` table has **no DELETE RLS policy** (designed: "invitations are never deleted by users"). Resend is also undefined — does it issue a new token + extend `expires_at`, or just re-trigger the email?

- **(a) Revoke = soft-mark via a new column `revoked_at timestamptz null`** (added in Slice 1 migration). UI hides revoked rows from the pending list. RLS update policy expands to admin+ on `revoked_at` only (with the existing only-accept-update trigger updated to allow `revoked_at` mutations from admin+). Resend = update `expires_at = now() + 14 days` and re-log the token (epic 13 will send the actual email). **Recommended.**
- **(b) Revoke = hard delete via a new admin+ DELETE policy on `invitation`.** Simpler but loses audit trail.
- **(c) Defer revoke/resend to epic 13.** Pending invitations are listed read-only in this epic.

### Q9. Move-board-between-workspaces

Epic doc says deferred. Confirm:
- **(a) Confirm deferred.** Recommended.

### Q10. `invitation.role = 'owner'` is forbidden by check constraint

The existing constraint admits only `admin | member | viewer`. The CreateBoardModal flow has no place to set 'owner' anyway. The InviteModal role select must reflect this — confirm copy:
- **(a) Role select shows only Admin / Member / Viewer.** Recommended.
- **(b) Allow inviting as owner.** Requires schema change (drop owner from the check constraint exclusion); not recommended.

### Q11. Topbar global search + notification bell stubs

Epic doc § Topbar says: "Global search input ([11] for the implementation; here it's a placeholder that opens a modal stub)" and "Notification bell ([13]; stub here)."

- **(a) Render disabled-look icons** (`opacity-50 cursor-not-allowed`, hover disabled) with `aria-disabled="true"` and a tooltip ("Coming soon"). No modal stub, no popover. **Recommended; no behavior to leak across epics.**
- **(b) Render functional-looking buttons that open a "Coming soon" toast** when clicked.

### Q12. Where does the inline-editable title primitive live?

Epic doc says: "Inline-editable title pattern ships its first instance here on the board title — extract as a shared `<EditableTitle />` primitive, since [06] (group + task) and [09] (board description) all reuse it."

- **(a) Land in `components/shared/EditableTitle.tsx`.** Recommended; matches the existing `components/shared/` directory.
- **(b) Land in `components/ui/editable-title.tsx`.**

(Note: shadcn-style files are kebab-cased; bespoke shared components in this codebase have so far used PascalCase file names per `component-system.md`. This is consistent with `components/shared/Logo.tsx` etc. which are anticipated. Confirm.)

---

## Stack defaults (restated for executors)

From `CLAUDE.md` — non-negotiable unless `05-workspaces-boards.md` overrides:

- **pnpm only.** No npm/yarn lockfiles.
- **Next.js 15 App Router**, RSC-first. `"use client"` only where interactivity is required (sidebar collapse, modal open/close, optimistic star toggle, search input, inline edit).
- **Server Actions** for mutations. No `/api` route handlers.
- **TypeScript strict** with `verbatimModuleSyntax: true`. `import type` for type-only imports.
- **Biome 2.x** active. Use `logger` server-side. Default-export ban (`noDefaultExport`) — page/layout/error files are the only allowed default exports (Biome already permits these via convention).
- **Zod** validates server-action input. The same schema validates the React Hook Form via `zodResolver`.
- **uuid v4** ids from Postgres; **`timestamptz`** for times; **soft-delete** via `deleted_at`. Hard delete only via admin paths.
- **Migrations:** `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Never edit a deployed migration. Each new policy / function / table addition = a new migration file.
- **RLS-as-source-of-truth.** Server-side helpers (`requireWorkspaceRole`, `requireBoardRole`) are friendly-error layers, not the gate.
- **`lib/supabase/admin.ts` is the ONLY RLS-bypass path.** Service-role usage is documented per-callsite. Biome `noRestrictedImports` rule blocks it from client code.
- **No app-code DB writes from client components.** All writes go through server actions wrapped in `withUser`.
- **Visual fidelity.** Every component consumes tokens from `app/globals.css` `@theme` (sourced verbatim from `design-system.md`). Never use raw hex literals. Component visual contracts come from `component-system.md` §1.1, §1.2, §1.3, §2.1, §3.6, §3.7, §3.8, §8.2, §8.3.
- **Icons:** import only from `@/lib/icons`. The slice that needs an icon not yet exported there owns adding it (Slice 2 covers the bulk).
- **Forbidden-scope is a hard rule.** Escalate before editing a path another slice owns.

---

## Execution order

```
Stage 1 — schema + foundation contracts (parallel, 4 slices):
  1. Migration: profile.last_workspace_id, column.icon, board.description,
     user_starred_board table+RLS, invitation.revoked_at + accept-update trigger
     update, clone_board RPC                                     [SQL only]
  2. lib/validations/* schemas (rename, slug, privacy, archive, duplicate,
     star, set-last-workspace, member-role, revoke/resend invitation,
     update-board-description) + lib/icons.ts additions          [TS only]
  3. EditableTitle primitive in components/shared/EditableTitle.tsx
     + Avatar primitive components/shared/Avatar.tsx
     + MemberStack primitive components/shared/MemberStack.tsx
     + WorkspaceLogoTile components/shared/WorkspaceLogoTile.tsx
                                                                  [TS only, no app routes]
  4. lib/workspace-context.tsx + lib/board-context.tsx
     (React contexts — server-set initial value, client-readable via "use client" hook)
                                                                  [TS only]
            ↓ Stage 1 review pass
Stage 2 — server actions + invite/accept polish (parallel, 3 slices):
  5. Workspace actions (rename, slug update, delete) + last-workspace +
     member role/remove + revoke/resend invitation actions       [TS, app/(app) actions]
  6. Board actions (rename, set-description, set-privacy, star/unstar,
     archive, restore, delete, duplicate-via-clone_board RPC) +
     board-member role/remove                                    [TS, app/(app) actions]
  7. Invitation accept page brand polish (existing route)        [TSX, app/(auth)/join]
            ↓ Stage 2 review pass
Stage 3 — chrome (parallel, 3 slices):
  8. MainSidebar + WorkspaceSidebar + UserMenu + sidebar shell wiring
     (the persistent layout chrome)                              [components/shared/sidebar/, app/(app)/layout.tsx]
  9. Topbar (breadcrumbs + disabled search/bell stubs + account menu)
     + sonner toast wiring on shell                              [components/shared/topbar/]
  10. Empty-states + loaders for: no workspaces, no boards in workspace,
     favorites empty, no archived boards in trash; LastViewed widget
                                                                  [components/shared/empty-states/, components/shared/LastViewed.tsx]
            ↓ Stage 3 review pass
Stage 4 — workspace + board pages (parallel, 4 slices):
  11. Workspace landing (`/w/[slug]`) — board grid + create-board modal
     trigger + LastViewed widget                                 [app/(app)/w/[workspaceSlug]/page.tsx, components/shared/board-card/, components/shared/CreateBoardModal/]
  12. Workspace settings (general, members, billing-stub) + InviteModal
     + MemberModal                                               [app/(app)/w/[workspaceSlug]/settings/**, components/shared/MemberModal/, components/shared/InviteModal/]
  13. Workspace trash page                                       [app/(app)/w/[workspaceSlug]/trash/page.tsx]
  14. Board layout (header skeleton + view tabs only Table-active)
     + board home placeholder                                    [app/(app)/w/[workspaceSlug]/b/[boardId]/{layout.tsx,page.tsx}, components/board/BoardHeader.tsx]
            ↓ Stage 4 review pass
Stage 5 — board settings + last-mile wiring (parallel, 2 slices):
  15. Board settings (general + members)                         [app/(app)/w/[workspaceSlug]/b/[boardId]/settings/**]
  16. Last-viewed redirect at `/` + the `app/(app)/page.tsx`
     "create your first workspace" route + first-run onboarding  [app/(app)/page.tsx, app/page.tsx replaced]
            ↓ Stage 5 review pass
Sequential follow-ups (not parallel):
  F1. Apply Stage-1 migration to cloud (db:push) and regen
      lib/supabase/types.ts
  F2. Playwright spec stub at tests/e2e/05-workspaces-boards.spec.ts
      (the spec file lands; the runner is wired in epic 15 — pnpm test:e2e
      remains the documented stub)
            ↓ epic-level review pass
PR into main.
```

**Why this many stages:** the chrome (Stage 3) blocks the page work (Stage 4) because every page renders inside the shell. Server actions (Stage 2) block both, because pages call them. The contracts (Stage 1) block everything because pages, actions, and components all import them. Inside each stage, file scopes are disjoint; outside each stage, a Stage N+1 slice strictly imports from Stage N or earlier.

---

## Slice 1 — Migration: schema additions (last_workspace_id, column.icon, board.description, user_starred_board, invitation.revoked_at, clone_board RPC)

**Owner:** epic-executor (sonnet) · **Stage:** 1, parallel

### Files
- `supabase/migrations/<NEW_TS>_workspaces_polish.sql` (new; timestamp must sort after `20260507120300`)

### Spec

Single migration file delivering five schema additions and one RPC. The exact SQL:

```sql
-- 1. profile.last_workspace_id
alter table public.profile
  add column last_workspace_id uuid references public.workspace(id) on delete set null;

-- 2. column.icon (epic doc § Migration; needed for templates in epic 07; ship now to keep types stable)
alter table public."column" add column icon text;

-- 3. board.description (per Q2 — confirm before merge)
alter table public.board add column description text not null default '';

-- 4. user_starred_board (per Q1 — per-user starring)
create table public.user_starred_board (
  user_id     uuid not null references auth.users(id) on delete cascade,
  board_id    uuid not null references public.board(id) on delete cascade,
  starred_at  timestamptz not null default now(),
  primary key (user_id, board_id)
);
create index user_starred_board_board_idx on public.user_starred_board(board_id);
alter table public.user_starred_board enable row level security;

create policy "usb_select" on public.user_starred_board
  for select using (
    user_id = (select auth.uid())
  );

create policy "usb_insert" on public.user_starred_board
  for insert with check (
    user_id = (select auth.uid())
    and public.role_for_board(board_id, (select auth.uid())) is not null
  );

create policy "usb_delete" on public.user_starred_board
  for delete using (
    user_id = (select auth.uid())
  );

-- 5. invitation.revoked_at (per Q8(a) — soft revoke)
alter table public.invitation
  add column revoked_at timestamptz null;

-- Update the invitation_only_accept_update trigger to allow admin+ to set
-- revoked_at AND extend expires_at. (Resend = bump expires_at; revoke = set revoked_at.)
-- The existing trigger blocks every column except accepted_at; we replace it with
-- a more permissive trigger that allows accepted_at by invitee, and revoked_at +
-- expires_at by admin+ on the parent workspace/board.
create or replace function public.invitation_only_accept_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_is_admin boolean;
begin
  -- Permanent-immutable columns:
  if new.id is distinct from old.id
    or new.workspace_id is distinct from old.workspace_id
    or new.board_id is distinct from old.board_id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.token is distinct from old.token
    or new.invited_by is distinct from old.invited_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'invitation: only accepted_at, revoked_at, expires_at may be updated' using errcode = '42501';
  end if;

  -- accepted_at is set by invitee per existing wsm_insert/bm_insert RLS path; trigger does not gate.
  -- revoked_at + expires_at require admin+ on the parent.
  if (new.revoked_at is distinct from old.revoked_at)
     or (new.expires_at is distinct from old.expires_at)
  then
    select (
      public.role_rank((
        select role from public.workspace_member
        where workspace_id = new.workspace_id and user_id = v_caller
      )) >= public.role_rank('admin')
      or (
        new.board_id is not null
        and public.role_rank(public.role_for_board(new.board_id, v_caller)) >= public.role_rank('admin')
      )
    ) into v_is_admin;
    if not coalesce(v_is_admin, false) then
      raise exception 'invitation: only an admin may revoke or extend' using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

-- The existing UPDATE policy (invitation_update) only admits the invitee. Add a second policy
-- so an admin+ can update revoked_at / expires_at:
create policy "invitation_admin_update" on public.invitation
  for update using (
    public.role_rank((
      select role from public.workspace_member
       where workspace_id = invitation.workspace_id and user_id = (select auth.uid())
    )) >= public.role_rank('admin')
    or (
      board_id is not null
      and public.role_rank(public.role_for_board(board_id, (select auth.uid()))) >= public.role_rank('admin')
    )
  );

-- Acceptance + invitee-self-insert paths must also reject revoked invitations.
-- Update wsm_insert and bm_insert to require revoked_at is null.
drop policy if exists "wsm_insert" on public.workspace_member;
create policy "wsm_insert" on public.workspace_member for insert with check (
  public.role_rank((
    select role from public.workspace_member
     where workspace_id = workspace_member.workspace_id and user_id = (select auth.uid())
  )) >= public.role_rank('admin')
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation i
       where i.workspace_id = workspace_member.workspace_id
         and i.board_id is null
         and lower(i.email) = lower((select email from auth.users where id = (select auth.uid())))
         and i.role = workspace_member.role
         and i.accepted_at is null
         and i.revoked_at is null
         and i.expires_at >= now()
    )
  )
);

drop policy if exists "bm_insert" on public.board_member;
create policy "bm_insert" on public.board_member for insert with check (
  public.role_rank(public.role_for_board(board_member.board_id, (select auth.uid()))) >= public.role_rank('admin')
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation i
       where i.board_id = board_member.board_id
         and lower(i.email) = lower((select email from auth.users where id = (select auth.uid())))
         and i.role = board_member.role
         and i.accepted_at is null
         and i.revoked_at is null
         and i.expires_at >= now()
    )
  )
);

-- 6. clone_board RPC (used by duplicateBoard server action — Stage 2 / Slice 6)
-- Copies: board row (name = original.name + ' (Copy)', is_private = false, same workspace),
-- columns (preserving order, type, settings, name, icon),
-- labels (per column; rebuild label_id mapping),
-- groups (preserving position, name, color),
-- tasks (preserving position; created_by = caller; created_at/updated_at = now()),
-- cells (rewriting label_id via the mapping). SKIP: comments, activity, attachments, members.
-- Atomic; runs under caller's privileges (security definer with set search_path = public).
-- Caller must be at least 'member' on the source board (RLS check at the top).
create or replace function public.clone_board(p_board_id uuid)
returns public.board
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_src_board public.board%rowtype;
  v_new_board public.board%rowtype;
  v_col_map  jsonb := '{}'::jsonb;
  v_label_map jsonb := '{}'::jsonb;
  v_group_map jsonb := '{}'::jsonb;
  v_task_map  jsonb := '{}'::jsonb;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  v_role := public.role_for_board(p_board_id, v_user);
  if v_role is null or public.role_rank(v_role) < public.role_rank('member') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_src_board from public.board where id = p_board_id;
  if not found then
    raise exception 'board not found' using errcode = 'P0002';
  end if;

  insert into public.board (workspace_id, name, description, created_by, is_private)
    values (v_src_board.workspace_id, v_src_board.name || ' (Copy)', v_src_board.description, v_user, false)
    returning * into v_new_board;

  -- columns
  with src as (
    select * from public."column" where board_id = p_board_id order by position
  ), ins as (
    insert into public."column" (board_id, name, type, position, settings, icon)
    select v_new_board.id, name, type, position, settings, icon from src
    returning id, name, position
  ), pairs as (
    select s.id as src_id, i.id as new_id
      from src s join ins i on i.name = s.name and i.position = s.position
  )
  select coalesce(jsonb_object_agg(src_id::text, new_id::text), '{}'::jsonb)
    into v_col_map from pairs;

  -- labels (per column)
  with src as (
    select l.* from public.label l join public."column" c on c.id = l.column_id
     where c.board_id = p_board_id
  ), ins as (
    insert into public.label (column_id, name, color, position)
    select (v_col_map ->> src.column_id::text)::uuid, src.name, src.color, src.position
      from src
    returning id, column_id, name, position
  ), pairs as (
    select s.id as src_id, i.id as new_id
      from src s
      join ins i on i.column_id = (v_col_map ->> s.column_id::text)::uuid
                and i.name = s.name and i.position = s.position
  )
  select coalesce(jsonb_object_agg(src_id::text, new_id::text), '{}'::jsonb)
    into v_label_map from pairs;

  -- groups
  with src as (
    select * from public."group" where board_id = p_board_id and deleted_at is null order by position
  ), ins as (
    insert into public."group" (board_id, name, position, color)
    select v_new_board.id, name, position, color from src
    returning id, name, position
  ), pairs as (
    select s.id as src_id, i.id as new_id
      from src s join ins i on i.name = s.name and i.position = s.position
  )
  select coalesce(jsonb_object_agg(src_id::text, new_id::text), '{}'::jsonb)
    into v_group_map from pairs;

  -- tasks
  with src as (
    select * from public.task where board_id = p_board_id and deleted_at is null
  ), ins as (
    insert into public.task (group_id, board_id, title, position, created_by)
    select (v_group_map ->> src.group_id::text)::uuid, v_new_board.id,
           src.title, src.position, v_user
      from src
    returning id, group_id, title, position
  ), pairs as (
    select s.id as src_id, i.id as new_id
      from src s
      join ins i on i.group_id = (v_group_map ->> s.group_id::text)::uuid
                and i.title = s.title and i.position = s.position
  )
  select coalesce(jsonb_object_agg(src_id::text, new_id::text), '{}'::jsonb)
    into v_task_map from pairs;

  -- cells (rewrite task_id, column_id, label_id via the maps)
  insert into public.cell (
    task_id, column_id, text_value, number_value, boolean_value,
    date_value, date_end_value, label_id, json_value, updated_by
  )
  select
    (v_task_map ->> c.task_id::text)::uuid,
    (v_col_map  ->> c.column_id::text)::uuid,
    c.text_value, c.number_value, c.boolean_value,
    c.date_value, c.date_end_value,
    case when c.label_id is null then null else (v_label_map ->> c.label_id::text)::uuid end,
    c.json_value, v_user
  from public.cell c
  where c.task_id in (select id from public.task where board_id = p_board_id);

  -- if source board is_private, mirror the caller as board owner (matches create_board behavior)
  -- the new board is forced public above; skipping board_member seed here.

  return v_new_board;
end $$;

grant execute on function public.clone_board(uuid) to authenticated;
```

### Definition of done
- File compiles via `supabase db lint --linked` (pre-existing script).
- All five schema additions + the trigger replacement + the two policy replacements + the new policy + the RPC apply cleanly to a fresh DB.
- A `select column_name from information_schema.columns where table_name = 'profile' and column_name = 'last_workspace_id'` returns one row.
- A `select column_name from information_schema.columns where table_name = 'invitation' and column_name = 'revoked_at'` returns one row.
- `select count(*) from pg_policies where tablename = 'invitation'` returns 4 (select, insert, update, admin_update).
- `select prosecdef from pg_proc where proname = 'clone_board'` returns `t`.
- The migration file is the only file changed; no application code changes in this slice.
- Note: `pnpm db:push` and `pnpm db:types` are deferred to F1 (sequential follow-up) — this slice ships SQL only.

### Forbidden scope
- Does not touch any application TypeScript file.
- Does not modify any deployed migration.
- Does not touch the existing `wsm_insert` / `bm_insert` policy semantics beyond the surgical `revoked_at is null` addition.

### Escalation triggers
- If the user has not answered Q1 (per-user vs per-board starring), Q2 (board.description), or Q8 (revoke semantics) by dispatch time, **escalate before writing the migration**.
- If `clone_board` runs into RLS recursion under cloud-Supabase Postgres 14.x semantics for the `with ... insert ... returning` chain, return a needs-direction report — possible alternate is to break the CTE chain into discrete statements with a `pl/pgsql for ... loop`.
- If a deployed migration timestamp would conflict with this slice's filename, escalate.

---

## Slice 2 — Validations + icon module additions

**Owner:** epic-executor (sonnet) · **Stage:** 1, parallel

### Files
- `lib/validations/workspace.ts` (modify — add schemas)
- `lib/validations/board.ts` (modify — add schemas)
- `lib/validations/invitation.ts` (modify — add schemas)
- `lib/validations/profile.ts` (new — for the `setLastWorkspace` action)
- `lib/icons.ts` (modify — add missing icon exports)

### Spec

#### `lib/validations/workspace.ts` — add schemas next to the existing `CreateWorkspaceSchema`:

```ts
import { z } from "zod";

const SlugRegex = /^[a-z0-9-]+$/;

export const CreateWorkspaceSchema = z.object({ /* unchanged */ });
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

export const RenameWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1, "Name is required.").max(80),
});
export type RenameWorkspaceInput = z.infer<typeof RenameWorkspaceSchema>;

export const UpdateWorkspaceSlugSchema = z.object({
  workspaceId: z.string().uuid(),
  slug: z.string().min(2).max(40).regex(SlugRegex, "Use lowercase letters, numbers, and hyphens only."),
});
export type UpdateWorkspaceSlugInput = z.infer<typeof UpdateWorkspaceSlugSchema>;

export const DeleteWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  confirmName: z.string().min(1),       // user must type the name; server compares
});
export type DeleteWorkspaceInput = z.infer<typeof DeleteWorkspaceSchema>;

export const SetWorkspaceMemberRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
});
export type SetWorkspaceMemberRoleInput = z.infer<typeof SetWorkspaceMemberRoleSchema>;

export const RemoveWorkspaceMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type RemoveWorkspaceMemberInput = z.infer<typeof RemoveWorkspaceMemberSchema>;
```

#### `lib/validations/board.ts` — add schemas next to the existing `CreateBoardSchema`:

```ts
import { z } from "zod";

export const CreateBoardSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(5000).default(""),     // NEW — fed by CreateBoardModal
  isPrivate: z.boolean().default(false),
  template: z.enum(["blank"]).default("blank"),       // future-proof; only "blank" allowed in epic 05
});
export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;

export const RenameBoardSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(120),
});
export type RenameBoardInput = z.infer<typeof RenameBoardSchema>;

export const UpdateBoardDescriptionSchema = z.object({
  boardId: z.string().uuid(),
  description: z.string().max(5000),
});
export type UpdateBoardDescriptionInput = z.infer<typeof UpdateBoardDescriptionSchema>;

export const SetBoardPrivacySchema = z.object({
  boardId: z.string().uuid(),
  isPrivate: z.boolean(),
});
export type SetBoardPrivacyInput = z.infer<typeof SetBoardPrivacySchema>;

export const StarBoardSchema = z.object({
  boardId: z.string().uuid(),
  starred: z.boolean(),
});
export type StarBoardInput = z.infer<typeof StarBoardSchema>;

export const ArchiveBoardSchema = z.object({ boardId: z.string().uuid() });
export type ArchiveBoardInput = z.infer<typeof ArchiveBoardSchema>;

export const RestoreBoardSchema = z.object({ boardId: z.string().uuid() });
export type RestoreBoardInput = z.infer<typeof RestoreBoardSchema>;

export const DeleteBoardSchema = z.object({
  boardId: z.string().uuid(),
  confirmName: z.string().min(1),
});
export type DeleteBoardInput = z.infer<typeof DeleteBoardSchema>;

export const DuplicateBoardSchema = z.object({ boardId: z.string().uuid() });
export type DuplicateBoardInput = z.infer<typeof DuplicateBoardSchema>;

export const SetBoardMemberRoleSchema = z.object({
  boardId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
});
export type SetBoardMemberRoleInput = z.infer<typeof SetBoardMemberRoleSchema>;

export const RemoveBoardMemberSchema = z.object({
  boardId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type RemoveBoardMemberInput = z.infer<typeof RemoveBoardMemberSchema>;
```

#### `lib/validations/invitation.ts` — add to the existing file:

```ts
export const RevokeInvitationSchema = z.object({ invitationId: z.string().uuid() });
export type RevokeInvitationInput = z.infer<typeof RevokeInvitationSchema>;

export const ResendInvitationSchema = z.object({ invitationId: z.string().uuid() });
export type ResendInvitationInput = z.infer<typeof ResendInvitationSchema>;
```

#### `lib/validations/profile.ts` (new):

```ts
import { z } from "zod";

export const SetLastWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
});
export type SetLastWorkspaceInput = z.infer<typeof SetLastWorkspaceSchema>;
```

#### `lib/icons.ts` — add missing exports

The current re-export list (verbatim from the file) has: `IconViewDashboard, IconBold, IconCheck, IconCircle, IconArrowDown, IconArrowRight, IconCirclePlus, IconViewKanban, IconFileAdd, IconHome, IconLogIn, IconExpand, IconMenu, IconComment, IconCommentAdd, IconMore, IconPin, IconPlus, IconSearch, IconSquare, IconStar, IconDelete, IconViewPerson, IconClose, IconCloseCircle, IconLightning`.

Add (alphabetized within the existing groupings; preserve the only-file-allowed-to-import-lucide invariant):
- `IconArchive` from `Archive`
- `IconBell` from `Bell`
- `IconCalendar` from `Calendar` (for the disabled view-tabs label "Calendar")
- `IconChevronDown` from `ChevronDown`
- `IconChevronLeft` from `ChevronLeft`
- `IconChevronRight` from `ChevronRight`
- `IconChevronUp` from `ChevronUp`
- `IconClock` from `Clock` (for "last activity" microcopy)
- `IconCopy` from `Copy` (for duplicate)
- `IconLink` from `Link2`
- `IconLayout` from `LayoutGrid` (workspace landing grid empty-state)
- `IconLock` from `Lock` (private board indicator)
- `IconLogOut` from `LogOut`
- `IconMail` from `Mail`
- `IconRotateCcw` from `RotateCcw` (restore from trash)
- `IconSettings` from `Settings`
- `IconStarFilled` — **does not exist as a separate Lucide icon**; the legacy/spec uses `IconStar` filled vs outline; keep one icon and toggle CSS `fill` per `component-system.md` §1.3 ("Star: --color-label-yellow when filled").
- `IconUsers` from `Users`
- `IconUserPlus` from `UserPlus`
- `IconViewCalendar` from `Calendar` (alias if needed for tab label — same import, different name acceptable)
- `IconViewTimeline` from `BarChart3` (legacy used a horizontal-bars glyph; matches the existing `IconViewDashboard` aesthetic — `component-system.md` §9.2 says "Match shape/weight, not the exact icon family").
- `IconViewTable` from `Table2`

If the executor finds an exact better match in Lucide for any of the above, it must check `docs/conversion-plan/design-system.md` §9.2 first; if the doc names a different glyph for that role, follow the doc.

### Definition of done
- `pnpm typecheck` is green for the changed files (no `TS2769` regressions from already-failing files).
- All new schemas exist with the `*Schema` + `*Input` type pair shape.
- `lib/icons.ts` exports every icon listed above and only `lib/icons.ts` imports from `lucide-react` (Biome guard already enforces this elsewhere; add a Biome-ignore on this single line of `lib/icons.ts` if not already present).
- `pnpm lint` passes.

### Forbidden scope
- No server actions in this slice.
- No components in this slice.
- No migration files.
- Do not modify the existing `CreateBoardSchema` field types beyond adding `description` and `template` (`workspaceId`, `name`, `isPrivate` keep their existing types).

### Escalation triggers
- If a Lucide icon name listed above does not exist in the installed `lucide-react@1.14.0`, escalate with the proposed alternate.

---

## Slice 3 — Shared primitives: EditableTitle, Avatar, MemberStack, WorkspaceLogoTile

**Owner:** epic-executor (sonnet) · **Stage:** 1, parallel

### Files
- `components/shared/EditableTitle.tsx` (new)
- `components/shared/Avatar.tsx` (new)
- `components/shared/MemberStack.tsx` (new)
- `components/shared/WorkspaceLogoTile.tsx` (new)

### Spec

All four are pure presentation primitives. `EditableTitle` is `"use client"` (it owns input state); the other three are RSC by default.

#### `EditableTitle`

Implements `component-system.md` §2.1 verbatim. Contract:

```ts
type EditableTitleProps = {
  initialValue: string;
  onCommit: (next: string) => Promise<void> | void;       // called on blur or Enter; receives trimmed value
  className?: string;
  ariaLabel?: string;
  // size variant keys mirror the heading levels that consume this:
  variant?: "h1" | "h4" | "body";                          // h1 = board title, h4 = group, body = task
  placeholder?: string;
  readOnly?: boolean;
  // Returns string used as the row's "on-typing" attribute hook so callers can wash the row
  onEditingChange?: (editing: boolean) => void;
};
```

Behavior:
- Renders a `<blockquote contentEditable>` per the spec (NOT a `<input>` — the legacy element is `blockquote` and styling matches it).
- Single-click enters edit mode (no double-click). Cursor-text on hover.
- `Enter` commits and blurs; `Esc` reverts to `initialValue` and blurs.
- Blur commits (calls `onCommit(trimmed)`) iff value changed and is non-empty.
- If `onCommit` throws, revert to `initialValue` and emit a sonner error toast (`import { toast } from "sonner"`).
- Default border = none; hover outline `1px solid var(--color-border-strong)`, radius 5px; focus-visible outline `1px solid var(--color-primary)`, radius 5px.
- During editing (`onEditingChange(true)`), parent can apply the `bg-surface-active` "on-typing" wash; the primitive does NOT apply its own row wash.
- `variant="h1"`: 24px / letter-spacing 0.5px / `--color-fg`. `variant="h4"`: 18px / weight 600 / `--color-fg`. `variant="body"`: 14px / `--color-fg`.
- ARIA: when not editing, render an effective heading element (`role` follows variant: "heading" with `aria-level={1|4}` for h1/h4; none for body). When editing, the `contentEditable` element exposes `role="textbox"` and `aria-label`.

#### `Avatar`

```ts
type AvatarProps = {
  src?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: 22 | 24 | 26 | 30 | 37.4;        // exact px sizes from component-system.md (22 in member-modal, 24 in board-header pile, 26 in cells, 30 in activity, 37.4 in main-sidebar)
  borderColor?: "white" | "transparent";   // white border for stacks
  className?: string;
};
```

Behavior:
- Renders `<img>` when `src` is present; otherwise renders a circle with the first letter of `displayName ?? email`, bg `--color-label-blue`, fg white.
- Always rounded-full. Size sets both width and height. Default border 1.6px white when `borderColor === "white"` (the avatar stacks need white borders).

#### `MemberStack`

```ts
type Member = { id: string; displayName: string | null; email: string | null; avatarUrl: string | null };
type MemberStackProps = {
  members: Member[];
  max?: number;        // default 4; surplus shown as "+N"
  size?: 22 | 24 | 26;
  overlap?: number;    // px; default -5
  className?: string;
};
```

Behavior:
- Renders up to `max` `Avatar` items with `borderColor="white"` and the specified `overlap` margin-left between siblings.
- Surplus rendered as a same-size circle, bg white, `1px solid var(--color-border)`, text `--color-fg`, font-size 11px, content `+N`.
- Component-system spec: 24px diameter, `-5px` overlap, white border. § 1.3.

#### `WorkspaceLogoTile`

```ts
type WorkspaceLogoTileProps = {
  workspaceName?: string | null;
  size?: 30 | 24;
  className?: string;
};
```

Behavior per `component-system.md` §1.2:
- 30×30 rounded `8px` tile, bg `--color-label-green`, with the white "lightning" glyph (`IconLightning` from `@/lib/icons`) at 18px centered, plus a smaller home overlay (`IconHome`) at 10px in the bottom-right corner.
- For consistency, the tile glyph renders a `<title>` (SVG title via `aria-label`) of the workspace name when provided.

### Definition of done
- All four files compile under `pnpm typecheck`.
- Each component has a top-of-file JSDoc block referencing the relevant `component-system.md` section and the tokens consumed.
- No raw hex literals — every color comes from a token via Tailwind utility (`bg-label-green`, `text-fg`, etc.) or `style={{ ... var(--color-...) ... }}` only when a Tailwind class is unavailable.
- `EditableTitle` carries a unit test stub at `tests/unit/EditableTitle.test.tsx` verifying: enter commits, esc reverts, empty trimmed value reverts, `onCommit` throw triggers revert + toast. (The test stub may be skipped via `describe.skip` since vitest is not yet installed; the file lands so epic 15 picks it up.)

### Forbidden scope
- Does not touch any sidebar/topbar/page file.
- Does not touch `lib/icons.ts` — relies on Slice 2 for icon additions; if Slice 2 has not landed, prefer existing icons (`IconLightning`, `IconHome` are already present) and stub the rest by importing from `@/lib/icons` and accepting that one icon may not yet be exported (escalate if any required icon is genuinely missing).
- No server actions; no fetch calls.

### Escalation triggers
- If `Avatar` size 37.4 px causes Tailwind class generation to fail (it's an unusual fractional value) — fall back to inline `style={{ width: '37.4px', height: '37.4px' }}` and document it.

---

## Slice 4 — Workspace and board context providers

**Owner:** epic-executor (sonnet) · **Stage:** 1, parallel

### Files
- `lib/workspace-context.tsx` (new)
- `lib/board-context.tsx` (new)
- `hooks/use-workspace.ts` (new)
- `hooks/use-board.ts` (new)

### Spec

Both context providers follow the pattern named in the epic doc § Server-side data fetching: layouts fetch the row + role server-side and pass to a `"use client"` provider that wraps `children`.

#### `lib/workspace-context.tsx`

```tsx
"use client";
import { createContext, type ReactNode } from "react";
import type { Role } from "@/lib/authorization";

export type WorkspaceContextValue = {
  workspace: { id: string; slug: string; name: string };
  role: Role;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspace,
  role,
  children,
}: {
  workspace: WorkspaceContextValue["workspace"];
  role: Role;
  children: ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={{ workspace, role }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
```

#### `hooks/use-workspace.ts`

```ts
"use client";
import { useContext } from "react";
import { WorkspaceContext, type WorkspaceContextValue } from "@/lib/workspace-context";

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
```

#### `lib/board-context.tsx`

```tsx
"use client";
import { createContext, type ReactNode } from "react";
import type { Role } from "@/lib/authorization";

export type BoardContextValue = {
  board: {
    id: string;
    name: string;
    description: string;
    is_private: boolean;
    workspace_id: string;
    created_by: string | null;
    deleted_at: string | null;
  };
  role: Role;
  isStarred: boolean;          // current user's star state
};

export const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({
  board,
  role,
  isStarred,
  children,
}: {
  board: BoardContextValue["board"];
  role: Role;
  isStarred: boolean;
  children: ReactNode;
}) {
  return (
    <BoardContext.Provider value={{ board, role, isStarred }}>
      {children}
    </BoardContext.Provider>
  );
}
```

#### `hooks/use-board.ts`

```ts
"use client";
import { useContext } from "react";
import { BoardContext, type BoardContextValue } from "@/lib/board-context";

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside <BoardProvider>");
  return ctx;
}
```

### Definition of done
- All four files compile under `pnpm typecheck`.
- Each provider/hook has a JSDoc one-liner.
- Biome `noDefaultExport` rule satisfied (none of these files default-export).
- Files placed in `lib/` and `hooks/` (the existing `hooks/` directory has only an empty `.gitkeep`; this is the first real file).

### Forbidden scope
- No app routes touched.
- No components touched.
- Do not include any data-fetching logic — these are pure providers.

### Escalation triggers
- None expected.

---

## Slice 5 — Workspace server actions (rename, slug, delete, last-workspace, member, invitation revoke/resend)

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel
**Depends on:** Stage 1 (Slice 1 migration applied via F1; Slice 2 schemas).

### Files
- `app/(app)/actions.ts` (modify — already exists with `createWorkspace`)
- `app/(app)/w/[workspaceSlug]/actions.ts` (modify — already exists with `createBoard`, `inviteToWorkspace`)
- `app/(app)/w/[workspaceSlug]/settings/general/actions.ts` (new — `renameWorkspace`, `updateWorkspaceSlug`, `deleteWorkspace`)
- `app/(app)/w/[workspaceSlug]/settings/members/actions.ts` (new — `setWorkspaceMemberRole`, `removeWorkspaceMember`, `revokeInvitation`, `resendInvitation`)

(Note: actions live next to the route that calls them per the `CLAUDE.md` convention. Splitting `general/` and `members/` into their own actions files matches the route partition; the settings page slices in Stage 4 will import them.)

### Spec

All actions wrap with `withUser`, validate input via the schemas from Slice 2, call `requireWorkspaceRole` for friendly-error gating, perform the mutation under the user's session (RLS is the gate), then `revalidateTag` on relevant tags and return the row(s) needed by the caller.

Concrete signatures and the contracts each enforces:

#### `app/(app)/actions.ts` — add `setLastWorkspace`

```ts
export const setLastWorkspace = withUser(async ({ supabase, userId }, raw) => {
  const input = SetLastWorkspaceSchema.parse(raw);
  // Defense-in-depth: verify membership before update; RLS is still the gate.
  await requireWorkspaceRole(input.workspaceId, "viewer");
  const { error } = await supabase
    .from("profile")
    .update({ last_workspace_id: input.workspaceId })
    .eq("id", userId);
  if (error) throw { code: "DB", message: error.message };
});
```

#### `app/(app)/w/[workspaceSlug]/settings/general/actions.ts`

- `renameWorkspace({ workspaceId, name })` — `requireWorkspaceRole(id, 'admin')`; update `workspace.name`; `revalidateTag('workspace:'+id)` and `revalidatePath('/w/'+slug)`.
- `updateWorkspaceSlug({ workspaceId, slug })` — `requireWorkspaceRole(id, 'owner')`; update `workspace.slug`; on `23505` → friendly VALIDATION error "That slug is taken." with `field: "slug"`; on success return the new slug so the caller can `redirect(``/w/${newSlug}/settings/general``)`.
- `deleteWorkspace({ workspaceId, confirmName })` — `requireWorkspaceRole(id, 'owner')`; load workspace and assert `confirmName === workspace.name` (strict match); set `deleted_at = now()`; redirect to `/`.

(All three return `ActionResult<{...}>` via the `withUser` wrapper.)

#### `app/(app)/w/[workspaceSlug]/settings/members/actions.ts`

- `setWorkspaceMemberRole({ workspaceId, userId, role })` — `requireWorkspaceRole(workspaceId, 'admin')`; if target role is 'owner', additionally require caller is 'owner' (server-side defense-in-depth — RLS would also reject); update `workspace_member` row.
- `removeWorkspaceMember({ workspaceId, userId })` — `requireWorkspaceRole(workspaceId, 'admin')`; delete from `workspace_member`. RLS already admits self-leave or admin+ removal.
- `revokeInvitation({ invitationId })` — load invitation under user session (RLS limits visibility); `requireWorkspaceRole(invitation.workspaceId, 'admin')` (or board-admin if board-scoped — call `requireBoardRole(invitation.boardId, 'admin')` instead); update `revoked_at = now()`. The new `invitation_admin_update` policy + the updated trigger make this work.
- `resendInvitation({ invitationId })` — same role check; update `expires_at = now() + interval '14 days'`. (Email is logged, not sent — epic 13 wires Resend.)

All actions cap their work to a single Supabase round-trip where possible. Errors logged via `logger`. PII is fine in dev logs (we already log invitation tokens for dev convenience).

### Definition of done
- Each action file is `"use server"` (top of file directive).
- Each action accepts unknown input and `parse()`s it via the Slice 2 Zod schema.
- Each action calls a `requireWorkspaceRole` (or `requireBoardRole` for board-scoped invitations) before the mutation.
- Each action either throws a `{code, message[, field]}`-shaped object on a known failure or lets the supabase error fall through with `code: "DB"`.
- `pnpm typecheck` is green for these files.
- A unit smoke test stub at `tests/unit/workspace-actions.test.ts` (skipped) documents intended behavior.

### Forbidden scope
- Does not touch any UI / route pages — those land in Stage 4.
- Does not touch `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts` — that file is Slice 6's.
- Does not touch the existing `inviteToWorkspace`.
- Does not modify `lib/authorization/*`.

### Escalation triggers
- If `revokeInvitation` cannot update `revoked_at` because of an unanticipated RLS or trigger conflict (Slice 1 covers both, but if Slice 1 is buggy this is the slice that hits it first), escalate.
- If `requireBoardRole` is needed but the invitation is workspace-scoped (`board_id is null`) the action should only call `requireWorkspaceRole`. The branching is unambiguous; do not invent new role helpers.

---

## Slice 6 — Board server actions (rename, description, privacy, star, archive, restore, delete, duplicate, member ops)

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel
**Depends on:** Stage 1 (Slice 1 migration applied via F1; Slice 2 schemas).

### Files
- `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts` (modify — already has `inviteToBoard`; add the rest)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions.ts` (new — settings-page-scoped subset; or, reuse the parent file — see below)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/actions.ts` (new — board-scoped member ops)

The split between `actions.ts` (root) and `settings/{general,members}/actions.ts` matches the route tree. To prevent Slice 8/14 sidebar-action calls from having to import from settings paths, place the **board-broad** actions (rename, star, archive, restore, duplicate, delete) in the root `actions.ts`; place the **settings-only** actions (set-description, set-privacy) in `settings/general/actions.ts`; place the member-table ops in `settings/members/actions.ts`.

### Spec

Place in **root** `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts`:

- `renameBoard({ boardId, name })` — `requireBoardRole(boardId, 'member')`; update `board.name`; revalidate.
- `starBoard({ boardId, starred })` — `requireBoardRole(boardId, 'viewer')`; on `starred=true`: upsert into `user_starred_board (user_id=auth.uid(), board_id)`. On `starred=false`: delete the row. RLS already restricts to self.
- `archiveBoard({ boardId })` — `requireBoardRole(boardId, 'admin')`; set `deleted_at = now()`. (RLS `board_update` admits ≥ member; the friendly-error layer raises the bar to admin.)
- `restoreBoard({ boardId })` — admin+; clear `deleted_at`. **Caveat:** `board_select` policy filters `deleted_at is null`. Restoring requires reading the soft-deleted row first. The action must use the admin client (`@/lib/supabase/admin`) for the read, then update via the user session — OR — restructure as a single `update ... set deleted_at = null where id = ? returning *` which bypasses the read-side filter (the UPDATE policy admits even soft-deleted rows because the policy does not check `deleted_at`). **Use the second path.** Confirm by inspecting `20260507120100_rls_policies.sql` lines 112–115: `board_update` does NOT filter on `deleted_at`. So `update board set deleted_at = null where id = ?` works under the user's session.
  Wait — `board_update` policy at the existing file is `for update using ( public.role_rank(public.role_for_board(board.id, ...)) >= ... )` and `role_for_board` returns null for soft-deleted boards (line 49 of authz_helpers). So `role_for_board` filtering blocks the update. **Escalate before implementing** if the executor finds this is the case in the merged main; the spec for this slice intentionally surfaces the question.
  **Direction for the executor:** if `role_for_board` filters soft-deleted, the executor should add a `clear_board_deleted_at(p_board_id uuid)` RPC in Slice 1's migration **as a followup** — escalate to the researcher and the planner will issue a delta. Do not invent the RPC inline; do not import the admin client.
- `deleteBoard({ boardId, confirmName })` — workspace-owner only (RLS enforces — the `board_delete` followup migration locked this down). Server-side, additionally check `requireWorkspaceRole(board.workspace_id, 'owner')` for friendly error; load board to compare `confirmName === board.name`; then `delete from board where id = ?`.
- `duplicateBoard({ boardId })` — `requireBoardRole(boardId, 'member')`; `supabase.rpc('clone_board', { p_board_id: boardId })`; return the new board id so caller can navigate.

Place in **`settings/general/actions.ts`**:

- `updateBoardDescription({ boardId, description })` — `requireBoardRole(boardId, 'member')`; update `board.description`.
- `setBoardPrivacy({ boardId, isPrivate })` — `requireBoardRole(boardId, 'admin')`; update `board.is_private`. **Note:** when going public→private, the existing workspace-derived membership chain stops applying; consider seeding `board_member` with the caller as `owner`. Match the `create_board` RPC behavior (it seeds the creator as `board_member.owner` only when `is_private = true`). For `setBoardPrivacy(true)`, server action should additionally upsert `board_member { board_id, user_id: auth.uid(), role: 'owner' }` so the caller doesn't lock themselves out.

Place in **`settings/members/actions.ts`**:

- `setBoardMemberRole({ boardId, userId, role })` — `requireBoardRole(boardId, 'admin')`; update `board_member`.
- `removeBoardMember({ boardId, userId })` — `requireBoardRole(boardId, 'admin')`; delete from `board_member`.

All actions revalidate appropriate tags: `board:<id>`, `boards:<workspaceId>`. Star revalidates `starred:<userId>`.

### Definition of done
- Every action validated, role-gated, and uses the user's session for the mutation.
- `restoreBoard` either works via direct UPDATE under the user's session (the executor must verify `role_for_board`'s `deleted_at` filter does or does not block UPDATE — see direction above) **or** an escalation report is filed.
- `pnpm typecheck` green.
- Test stub at `tests/unit/board-actions.test.ts` (skipped).

### Forbidden scope
- Does not touch the existing `inviteToBoard` action.
- Does not touch any UI / page file.
- Does not touch `lib/supabase/admin.ts`.
- Does not modify `lib/authorization/*`.

### Escalation triggers
- The `restoreBoard` RLS path. **Escalate before guessing.**
- If `clone_board` returns an error from the seeded data (see Slice 1) — escalate; do not work around in TS.

---

## Slice 7 — Invitation accept page brand polish

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel

### Files
- `app/(auth)/join/[token]/page.tsx` (modify — already exists with a working but unstyled form)
- `app/(auth)/layout.tsx` (read-only reference — do not modify here unless the auth layout needs `surface-auth` background; epic 03 already styles it)

### Spec

The existing route already calls `acceptInvitation` correctly. This slice polishes the page to match the auth aesthetic from epic 03 (Logo, Figtree font, white card on `--color-surface-auth` page wash). It also pre-loads the invitation row server-side so the page can show **who invited the user, to which workspace/board, and as what role** before they click Accept. RLS already permits the invitee to SELECT their own non-accepted invitation.

Server-component data fetch:

```ts
const supabase = await createClient();
const { data: inv } = await supabase
  .from("invitation")
  .select(`
    id,
    role,
    accepted_at,
    revoked_at,
    expires_at,
    email,
    workspace:workspace_id(id, name, slug),
    board:board_id(id, name),
    inviter:invited_by(id, display_name, avatar_url, email)
  `)
  .eq("token", token)
  .maybeSingle();
```

If `!inv` → render the not-found state. If `inv.accepted_at` → "This invitation has already been used." If `inv.revoked_at` or `expires_at < now()` → "This invitation is no longer valid." Otherwise render: workspace logo tile, "{inviter name} invited you to join the {workspace name} workspace as {role}" copy, an Accept button (`<form action={accept}>` per existing pattern), and a small Decline button (decline = navigate away; no server mutation in v1).

If invitee email does not match the signed-in user's email (case-insensitive), surface a "This invitation was sent to {email}; sign in with that account to accept." message and a "Sign out and try another account" button.

Visual fidelity: matches `component-system.md` §6.1 (`<LoginSignup />`) form chrome — white card, padding, drop-shadow none/subtle, primary button. Reuse the `<Logo />` component if it exists in `components/shared/Logo.tsx` (epic 01 followup landed it — verify); if not, use the workspace logo tile primitive from Slice 3 instead.

### Definition of done
- Page is RSC; the `accept` server-action wrapper inside the page is `"use server"` (existing pattern).
- All four invitation-state branches (active / accepted / expired / revoked) render distinct copy.
- Email-mismatch branch renders.
- Sonner toast not used here — page-level error state is the design (matches the existing implementation's `?error=` query-param pattern).
- Page passes `pnpm lint` + `pnpm typecheck`.
- No raw hex literals.

### Forbidden scope
- Does not modify `acceptInvitation` server action.
- Does not modify the auth layout.
- Does not touch any other page.

### Escalation triggers
- If the invitation row's RLS does not let the page see `inviter` profile join (RLS for `profile` admits same-workspace peers; the invitee is not yet a workspace member at this moment), the join may return null. **Plan B:** select the inviter via `auth.users` is not allowed under RLS; select via `profile` — and the policy at `20260507120100:434-443` permits "id = auth.uid()" or "same workspace member". The invitee is not yet a member, so this **will return null**. Either: (a) include only the inviter's email (which is on `invitation.invited_by` indirectly — actually no, the invitation has `invited_by uuid` referencing `auth.users`; we don't have a way to read the email). Or: (b) extend `invitation_select` to include the inviter's display name as a denormalized column. **Escalate** before picking. Recommended path is (b): add `inviter_display_name text` to invitation, populated by `inviteToWorkspace` / `inviteToBoard` — but that requires a Slice 1 schema add. Alternative: drop the inviter-name detail and only show "You've been invited to {workspace}." — Slice 7 should escalate on this and accept a delta.

---

## Slice 8 — MainSidebar + WorkspaceSidebar + UserMenu + shell layout wiring

**Owner:** epic-executor (sonnet) · **Stage:** 3, parallel
**Depends on:** Stages 1 + 2.

### Files
- `app/(app)/layout.tsx` (modify — currently a passthrough)
- `components/shared/sidebar/MainSidebar.tsx` (new)
- `components/shared/sidebar/WorkspaceSidebar.tsx` (new — `"use client"`)
- `components/shared/sidebar/WorkspaceSwitcher.tsx` (new — `"use client"`)
- `components/shared/sidebar/BoardList.tsx` (new — `"use client"`; receives initial data from server)
- `components/shared/sidebar/BoardListItem.tsx` (new)
- `components/shared/sidebar/NewBoardButton.tsx` (new — `"use client"`; opens `<CreateBoardModal />` from Slice 11)
- `components/shared/sidebar/UserMenu.tsx` (new — `"use client"`)
- `components/shared/sidebar/SidebarShell.tsx` (new — composes `MainSidebar` + `WorkspaceSidebar` + topbar slot + main content slot)
- `stores/sidebar-store.ts` (new — Zustand for sidebar collapse + search-text state)

### Spec

#### `app/(app)/layout.tsx`

Server component. Loads the signed-in user (already enforced by middleware), the user's workspace list, the active workspace (from URL or `profile.last_workspace_id`), and the active workspace's boards.

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { SidebarShell } from "@/components/shared/sidebar/SidebarShell";
// ... etc.

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: workspaces } = await supabase
    .from("workspace_member")
    .select("workspace:workspace_id(id, slug, name)")
    .eq("user_id", user.id)
    .is("workspace.deleted_at", null);

  // workspaces: { workspace: { id, slug, name } }[] under user session — RLS handles visibility

  return (
    <SidebarShell user={user} workspaces={workspaces ?? []}>
      {children}
    </SidebarShell>
  );
}
```

The active-workspace concept is **scoped to the URL**. The layout does NOT pre-load the active workspace's boards; `WorkspaceSidebar` lazily lists boards for whichever workspace is in the URL by reading from the `WorkspaceContext` provided by `app/(app)/w/[workspaceSlug]/layout.tsx` (Slice 11). Outside `/w/...` (e.g. `/account`), the sidebar shows a generic "select a workspace" state.

A separate server-side helper `lib/sidebar-data.ts` (this slice owns it):

```ts
export async function loadSidebarBoards(workspaceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { boards: [], starred: [] };

  const { data: boards } = await supabase
    .from("board")
    .select("id, name, is_private, workspace_id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("name");

  const { data: starred } = await supabase
    .from("user_starred_board")
    .select("board_id")
    .eq("user_id", user.id);

  const starredSet = new Set((starred ?? []).map(s => s.board_id));
  return {
    starred: (boards ?? []).filter(b => starredSet.has(b.id)),
    boards: (boards ?? []).filter(b => !starredSet.has(b.id)),
  };
}
```

This is called from `app/(app)/w/[workspaceSlug]/layout.tsx` (which Slice 11 owns) and the result is passed into `WorkspaceSidebar` via the workspace layout's children tree; the sidebar shell already exists, so the workspace layout does NOT re-render the shell — it just refreshes the board list portion. **This is the integration boundary between Slice 8 and Slice 11.** Slice 8 ships the sidebar component with a `boards` prop and a fallback "no workspace selected" state when `boards` is undefined; Slice 11 supplies the data.

#### `MainSidebar` — `component-system.md` §1.1 verbatim

Server component. 66px wide rail, bg `--color-surface-nav`. Sections: brand glyph at top (`<Logo />` mini variant — if `components/shared/Logo.tsx` does not exist, render the workspace logo tile primitive from Slice 3 sized at 30px), tools middle (Search disabled, Notifications disabled, see Q11), bottom UserMenu. Tool icon container 56×36px; avatar 37.4×37.4px white border. Hover applies `--color-surface-nav-hover` (= `rgba(0,0,0,0.6)`) — add this token to `app/globals.css` under `@theme` in this slice.

#### `WorkspaceSidebar` — `component-system.md` §1.2

Client. Width 230px open / 30px collapsed. Bg `--color-surface-rail`. Width animates over `--motion-slow`; inner content opacity 0→1 with `transition-delay: .25s`. Toggle pill on the right edge per spec. Sections: header (workspace logo tile + name from `WorkspaceContext`), workspace tools (Search/Add/Templates icons — Search opens nothing, Add opens CreateBoardModal, Templates is disabled), favorites section (uses Slice 10's empty-state when empty), board list.

State (in `stores/sidebar-store.ts`):
```ts
type SidebarState = {
  collapsed: boolean;
  search: string;
  setCollapsed: (v: boolean) => void;
  setSearch: (v: string) => void;
};
```

(Zustand. UI-only.)

`BoardList` filters by `search` client-side (case-insensitive contains on `name`). Active board row uses `bg-surface-active`. Star toggle on each row calls `starBoard` server action with optimistic `useOptimistic`.

#### `UserMenu`

Avatar (37.4px) + dropdown menu (use `<MenuList>` primitive). Items: account settings (link to `/account`), sign out (existing `signOut` action from epic 03), theme toggle (epic 14 owns dark mode — render the toggle as **disabled** in this epic with a "Coming soon" tooltip).

### Definition of done
- `app/(app)/layout.tsx` renders the shell on every authed route.
- Browser visits to `/account` show shell with "Select a workspace" empty state in the workspace rail; visits to `/w/<slug>` show the workspace's boards.
- Workspace switcher dropdown lists every workspace the user belongs to (verified via screenshot review).
- Sidebar collapse animates per spec (260ms+250ms staggered reveal).
- Star toggle on a board row is optimistic and reverts on error.
- All tokens consumed via Tailwind utilities; no raw hex literals.
- `pnpm lint` + `pnpm typecheck` green.

### Forbidden scope
- Does not modify any page (Stage 4 owns those).
- Does not modify any settings route.
- Does not modify board-internal components.
- Does not own the `<CreateBoardModal />` component — `NewBoardButton` imports it from Slice 11; until Slice 11 lands, render a placeholder modal with a TODO comment (the executor must escalate if the placeholder approach blocks the slice from compiling).
- Does not own topbar — Slice 9.

### Escalation triggers
- If `app/(app)/layout.tsx` cannot fetch the workspace list (RLS issue), escalate.
- If `<CreateBoardModal />` is referenced but Slice 11 hasn't landed yet — Stage 3 runs in parallel with Stage 4 NOT TRUE per the plan above, but parallelism within Stage 3 means Slice 11 isn't yet built. **Direction:** Slice 8 owns `NewBoardButton` as a button that opens a placeholder modal. Slice 11 swaps the implementation in.

---

## Slice 9 — Topbar (breadcrumbs, disabled search/bell, account menu)

**Owner:** epic-executor (sonnet) · **Stage:** 3, parallel

### Files
- `components/shared/topbar/Topbar.tsx` (new)
- `components/shared/topbar/Breadcrumbs.tsx` (new)
- `components/shared/topbar/SearchStub.tsx` (new — disabled, see Q11)
- `components/shared/topbar/NotificationBellStub.tsx` (new — disabled, see Q11)

### Spec

`Topbar` is rendered by `SidebarShell` (Slice 8) above the main content area. It is a horizontal bar `height: 48px`, bottom border `1px solid --color-border-strong`, padding `0 24px`, gap `16px`, items left-to-right: breadcrumbs, flex-grow spacer, search stub, notification bell stub, account menu (UserMenu reuse, smaller variant).

`Breadcrumbs` reads from `usePathname()`, parses `/w/<slug>/...` and `/w/<slug>/b/<boardId>/...`, and renders a list of `<Link>` chips separated by chevrons. The slice imports `useWorkspace()` and `useBoard()` (Slice 4) when those contexts are present (try/catch the `throw new Error("must be used inside ...")` pattern via a safe variant — Slice 4 may need a `useWorkspaceMaybe()` and `useBoardMaybe()` companion. **Direction:** rather than try/catch, Slice 4 should ship `useWorkspaceMaybe(): WorkspaceContextValue | null` and `useBoardMaybe(): BoardContextValue | null` alongside the throwing variants. Slice 9 imports the Maybe versions. **Slice 4 has been updated to ship both** — confirm in Slice 4's spec block.

(Cross-slice reconciliation: Slice 4's spec above only shows the throwing `useWorkspace`/`useBoard`. Add to Slice 4's definition of done: also export `useWorkspaceMaybe`, `useBoardMaybe`. — Treat this as a binding amendment.)

Search stub: render a non-interactive button `aria-disabled="true"` styled like the active search but tinted to `opacity-50`, with a tooltip "Coming soon" (use a Base UI `<Tooltip>`).

Notification bell: same treatment as search stub.

### Definition of done
- Topbar renders the correct breadcrumb chain on every page tree (`/account`, `/w/<slug>`, `/w/<slug>/settings/general`, `/w/<slug>/b/<boardId>`, etc.).
- Search and bell render disabled per Q11.
- `pnpm lint` + `pnpm typecheck` green.

### Forbidden scope
- Does not own the sidebar or any page.
- Does not implement search or notifications.

### Escalation triggers
- If Slice 4 has not shipped the Maybe-variant hooks, **wait for Slice 4** (parallelism within Stage 1 vs Stage 3 — Slice 4 is in Stage 1, so it has already landed by Stage 3). If they're missing, escalate; do not duplicate.

---

## Slice 10 — Empty states + LastViewed widget

**Owner:** epic-executor (sonnet) · **Stage:** 3, parallel

### Files
- `components/shared/empty-states/NoWorkspaces.tsx` (new)
- `components/shared/empty-states/NoBoardsInWorkspace.tsx` (new)
- `components/shared/empty-states/FavoritesEmpty.tsx` (new)
- `components/shared/empty-states/TrashEmpty.tsx` (new)
- `components/shared/LastViewed.tsx` (new)

### Spec

All RSC unless noted. Each empty state takes optional callbacks for primary/secondary CTAs.

- **`NoWorkspaces`** — Used by `app/(app)/page.tsx` first-run state. Centered card; H1 "Welcome to Donezo" 32px; body "Create your first workspace to get started." 14px in `--color-fg-muted`; primary button "Create workspace" — opens a `CreateWorkspaceModal` (which lives in Slice 16; until then the button links to a route that calls `createWorkspace` server action with default values — wait, that's wrong, you can't generate a default name. **Direction:** Slice 10 ships the empty state with a callback prop `onCreate?: () => void`; Slice 16 owns the modal trigger.)

- **`NoBoardsInWorkspace`** — Used by `app/(app)/w/[slug]/page.tsx`. Centered. H2 "{workspace name} is ready for its first board" 24px; primary CTA "Create board" with `onCreate?: () => void` callback (Slice 11 wires it to `<CreateBoardModal />`); secondary text "or pick a template" — disabled.

- **`FavoritesEmpty`** — `component-system.md` §8.3 verbatim. 80px star icon (`IconStar`), centered text "Easily Access Your Favorite Boards" (legacy copy — read from `frontend/src/cmps/sidebar/workspace-sidebar.jsx` if maintainer's local copy is available, otherwise use the generic "No favorites yet"), font 15px, line-height 1.5. Token: `text-fg`.

- **`TrashEmpty`** — Trash page empty state. "No archived boards." 24px icon (`IconArchive`), 14px copy in `--color-fg-muted`.

- **`LastViewed`** — `component-system.md` §8.2. Workspace landing widget: padding `32px 16px`, member info row gap 8px, avatar 26px (use Slice 3 `Avatar`). Render the last 5 boards the user opened. **Data source:** for v1, "last viewed" is approximated as `board.updated_at desc` filtered to boards the user has access to and not archived. (Real "last viewed" needs a `view_event` table — defer.) Render: board name, member stack (top 4), last-activity relative time ("2h ago", etc.).

### Definition of done
- All five files compile and render in isolation.
- Each empty state file exports a single named component (no default exports per Biome).
- Tokens consumed via Tailwind utilities.
- `pnpm lint` + `pnpm typecheck` green.

### Forbidden scope
- Does not own any page.
- Does not own the CreateBoardModal or CreateWorkspaceModal.
- Does not own the trash list rendering — only its empty state.

### Escalation triggers
- If the empty-state primary CTA truly needs to navigate before its modal lands (parallel-stage friction), escalate before adding a server action call.

---

## Slice 11 — Workspace landing page + CreateBoardModal + BoardCard

**Owner:** epic-executor (sonnet) · **Stage:** 4, parallel
**Depends on:** Stages 1 + 2 + 3.

### Files
- `app/(app)/w/[workspaceSlug]/layout.tsx` (new)
- `app/(app)/w/[workspaceSlug]/page.tsx` (new)
- `components/shared/board-card/BoardCard.tsx` (new)
- `components/shared/board-card/BoardCardGrid.tsx` (new)
- `components/shared/CreateBoardModal/CreateBoardModal.tsx` (new — `"use client"`)
- `components/shared/CreateBoardModal/index.ts` (new — re-export)

### Spec

#### `app/(app)/w/[workspaceSlug]/layout.tsx`

```tsx
import { notFound } from "next/navigation";
import { getWorkspaceRole } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { loadSidebarBoards } from "@/lib/sidebar-data";

export default async function WorkspaceLayout({
  params, children,
}: { params: Promise<{ workspaceSlug: string }>; children: React.ReactNode }) {
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
  if (!role) notFound();

  // Sidebar boards loaded here so the workspace's sidebar updates per-workspace.
  // The shell at app/(app)/layout.tsx renders the rail; this layout supplies the
  // boards prop via the WorkspaceProvider's value (extend it with `boards` and `starred`)
  // OR via a separate BoardListProvider. Recommended: extend WorkspaceContext to hold
  // a denormalized `sidebarBoards: { boards, starred }` field that <WorkspaceSidebar />
  // reads via useWorkspace(). Update Slice 4's WorkspaceContextValue type accordingly.
  const sidebarBoards = await loadSidebarBoards(workspace.id);

  return (
    <WorkspaceProvider workspace={workspace} role={role} sidebarBoards={sidebarBoards}>
      {children}
    </WorkspaceProvider>
  );
}
```

(Cross-slice reconciliation: Slice 4's `WorkspaceContextValue` must include `sidebarBoards: { starred: Board[]; boards: Board[] }`. Add to Slice 4 definition of done. — Treat as a binding amendment.)

#### `app/(app)/w/[workspaceSlug]/page.tsx`

Workspace landing. Renders `<LastViewed />` (Slice 10) then `<BoardCardGrid />`. The grid pulls from `useWorkspace().sidebarBoards`. Empty state: `<NoBoardsInWorkspace onCreate={openModal} />`.

#### `BoardCard`

Card chrome per general shadcn pattern; `--shadow-card`, white bg, border `1px solid --color-border-solid`, radius 8px, padding 16px. Content: board name (link to `/w/<slug>/b/<id>`), small description preview (truncate to 2 lines), member stack (top 4), last-activity relative time, star toggle in top-right.

#### `CreateBoardModal`

Per `component-system.md` §3.7. Centered modal, 500px wide, padding `16px 32px 32px`, radius 8px, shadow `--shadow-modal`. Use Base UI `Dialog`. H1 "Create board" 32px / 500. Form: title (text, required), description (textarea, optional), visibility (radio: workspace / private), template (select: Blank only — disabled "Coming soon" entries for the others, per Q3). Submit calls `createBoard` server action; on success, navigate to the new board's URL.

Form state: React Hook Form + `zodResolver(CreateBoardSchema)`. (See pre-existing typecheck noise note at top — RHF + Zod 4 type mismatch is documented; the form will still work at runtime.)

### Definition of done
- Workspace landing page renders for `/w/<slug>` and `/w/<slug>/` (Next.js handles trailing slash).
- Empty state renders when no boards.
- Board cards render in a CSS grid (3 columns desktop, 2 tablet, 1 mobile).
- CreateBoardModal opens from any "Create board" CTA, validates input, calls `createBoard`, navigates on success, surfaces friendly error toasts on failure.
- Visual fidelity matches the screenshot review of `<CreateBoardModal />`.
- `pnpm lint` + `pnpm typecheck` green.

### Forbidden scope
- Does not own the sidebar.
- Does not own the board layout (Slice 14).
- Does not own the workspace settings pages (Slice 12).

### Escalation triggers
- If `WorkspaceProvider` does not yet ship the `sidebarBoards` field (Slice 4 amendment didn't land in time), escalate.

---

## Slice 12 — Workspace settings: general, members, MemberModal, InviteModal

**Owner:** epic-executor (sonnet) · **Stage:** 4, parallel

### Files
- `app/(app)/w/[workspaceSlug]/settings/layout.tsx` (new — settings nav rail)
- `app/(app)/w/[workspaceSlug]/settings/page.tsx` (new — redirect to general)
- `app/(app)/w/[workspaceSlug]/settings/general/page.tsx` (new)
- `app/(app)/w/[workspaceSlug]/settings/general/general-form.tsx` (new — `"use client"`)
- `app/(app)/w/[workspaceSlug]/settings/general/delete-workspace-modal.tsx` (new — `"use client"`)
- `app/(app)/w/[workspaceSlug]/settings/members/page.tsx` (new)
- `app/(app)/w/[workspaceSlug]/settings/members/members-table.tsx` (new — `"use client"`)
- `app/(app)/w/[workspaceSlug]/settings/billing/page.tsx` (new — placeholder)
- `components/shared/MemberModal/MemberModal.tsx` (new — `"use client"`)
- `components/shared/InviteModal/InviteModal.tsx` (new — `"use client"`)

### Spec

#### Settings layout

Two-column: left settings rail with nav items "General", "Members", "Billing" (disabled, "Coming soon"); right pane = children. Active link uses `--color-surface-active`.

#### General page

Form to edit `name` (calls `renameWorkspace`) and `slug` (calls `updateWorkspaceSlug`; show warning copy "Changing the slug will break shared links."). Below the form, owner-only "Delete workspace" button opens `delete-workspace-modal.tsx` which prompts the user to type the workspace name. On confirm, calls `deleteWorkspace` and redirects to `/`.

Visual: white card on `--color-surface-rail` page wash, padding 24px, max-width 720px.

#### Members page

Table columns: Avatar+Name, Email, Role (dropdown), Joined, Actions (Remove). Above the table: "Invite members" button opens `<InviteModal />`. Below: "Pending invitations" section listing `invitation` rows where `accepted_at IS NULL AND revoked_at IS NULL` — each row shows email, role, "Resend" + "Revoke" buttons (calls `resendInvitation` / `revokeInvitation` from Slice 5).

Role dropdown disabled for the current user's own row (no self-demotion).

Use TanStack Table for the rendering layer if it's already a dependency. **Check:** `package.json` does not list `@tanstack/react-table` — it lands in epic 06. **Direction:** Slice 12 should render a plain semantic `<table>` with Tailwind utility classes; defer TanStack Table integration to epic 06. Match the visual contract (avatar+name first column, etc.) via `<table>` + `<thead>` + `<tbody>` + `<tr>` + `<td>`.

#### `MemberModal`

`component-system.md` §3.8. 360px wide desktop / 250px mobile. Member chips bg `--color-chip-member`, radius 8px, avatar 22×22. This component is reused by InviteModal as the member-list visual; here it shows the existing members of a workspace/board and is launchable from the BoardHeader's "members" tool (Slice 14) or the workspace settings members page.

#### `InviteModal`

`component-system.md` §3.8. Shares the chrome with MemberModal. Form: email input(s) (allow comma-separated; v1 sends one invitation per email — loop client-side and call `inviteToWorkspace` (or `inviteToBoard` if `boardId` prop is passed) once per email), role select (Admin / Member / Viewer per Q10). Submit shows progress toast "Sending invitations…"; on success, closes and refreshes the pending list (via `revalidateTag`).

### Definition of done
- All settings routes render under the settings layout.
- Owner can rename, change slug (with confirm), and delete the workspace; admin cannot delete (button disabled with tooltip).
- Members table renders + role changes work + remove works.
- InviteModal sends invitations; pending invitations list updates.
- Revoke + resend work and update the list.
- Visual fidelity matches `<MemberModal />` / `<InviteModal />` review.
- `pnpm lint` + `pnpm typecheck` green.

### Forbidden scope
- Does not modify `lib/authorization/*`, server actions (Slice 5), or the workspace landing page.
- Does not own board settings (Slice 15).

### Escalation triggers
- If a member-table column breaks under the plain-`<table>` approach (e.g. truly virtualized rendering needed for >100 members), escalate; defer virtualization to epic 06.

---

## Slice 13 — Workspace trash page

**Owner:** epic-executor (sonnet) · **Stage:** 4, parallel

### Files
- `app/(app)/w/[workspaceSlug]/trash/page.tsx` (new)
- `app/(app)/w/[workspaceSlug]/trash/trash-list.tsx` (new — `"use client"` for the row actions)

### Spec

Trash page lists archived boards (`board.deleted_at is not null`). **RLS issue:** `board_select` filters `deleted_at is null`, so the user session cannot see archived boards. This breaks the trash flow.

**Direction:** add an additional SELECT-side path. Two options:
- (a) Add a second policy `board_select_archived` admitting workspace admin+ to see soft-deleted boards. **Simplest.** Slice 1 amendment.
- (b) Add a `list_archived_boards(p_workspace_id uuid)` SQL function (`security definer`) that returns archived boards if the caller is admin+ on the workspace.

**Recommended:** (a). Add to Slice 1's spec — see "binding amendment" note. The new policy:

```sql
create policy "board_select_archived" on public.board for select using (
  deleted_at is not null
  and exists (
    select 1 from public.workspace_member wm
     where wm.workspace_id = board.workspace_id
       and wm.user_id = (select auth.uid())
       and wm.role in ('owner', 'admin')
  )
);
```

(Add to Slice 1.)

#### Trash UI

Rows: board name, archived date (relative + absolute on hover), member count, two actions: "Restore" (calls `restoreBoard`) and "Delete permanently" (admin+ — workspace owner — opens type-name confirmation; calls `deleteBoard`). Empty state from Slice 10.

Permission: server-side `requireWorkspaceRole(workspaceId, 'admin')` before rendering the page; viewers and members get a 404.

### Definition of done
- Trash page lists archived boards for admin+ in the workspace.
- Restore returns the board to the active list (sidebar refreshes).
- Permanent-delete (workspace-owner only) hard-deletes the row.
- `pnpm lint` + `pnpm typecheck` green.

### Forbidden scope
- Does not modify `archiveBoard` / `restoreBoard` server actions.
- Does not modify the sidebar.

### Escalation triggers
- If `restoreBoard` cannot succeed because `role_for_board` filters soft-deleted (cross-reference Slice 6 escalation), this slice will hit it too. **Single escalation report covers both** — orchestrator dispatches one fix.

---

## Slice 14 — Board layout (BoardHeader skeleton + view tabs) + board home placeholder

**Owner:** epic-executor (sonnet) · **Stage:** 4, parallel

### Files
- `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` (new)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (new — placeholder; epic 06 replaces)
- `components/board/BoardHeader.tsx` (new)
- `components/board/BoardViewTabs.tsx` (new — `"use client"`)
- `components/board/BoardStarToggle.tsx` (new — `"use client"`; optimistic)
- `components/board/BoardSettingsMenu.tsx` (new — `"use client"`; the `<MenuList>`-based overflow menu)

### Spec

#### Board layout

Server component. Loads board, role, isStarred (under user session). On not-found or no role, `notFound()`.

```tsx
const { data: board } = await supabase
  .from("board")
  .select("id, name, description, is_private, workspace_id, created_by, deleted_at")
  .eq("id", boardId)
  .is("deleted_at", null)
  .single();
if (!board) notFound();
const role = await getBoardRole(board.id);
if (!role) notFound();
const { data: starred } = await supabase
  .from("user_starred_board")
  .select("board_id")
  .eq("board_id", board.id)
  .maybeSingle();
const isStarred = Boolean(starred);

return (
  <BoardProvider board={board} role={role} isStarred={isStarred}>
    <BoardHeader />
    <BoardViewTabs />
    {children}
  </BoardProvider>
);
```

#### `BoardHeader` — `component-system.md` §1.3 verbatim

Sticky `top-0`, `z-[var(--z-board-header)]`, bg white. Padding `16px 30px 0 38px`. Layout left-to-right:
- Title H1 (uses `<EditableTitle variant="h1">`, calls `renameBoard`).
- `BoardStarToggle` (calls `starBoard`, optimistic).
- Board tools row: activity, members (opens `<MemberModal />`), invite (opens `<InviteModal boardId={...} />`), description (opens `<BoardDescriptionModal />`).
- Members avatar pile (use `<MemberStack />`).
- Right: `<BoardSettingsMenu />` overflow.

`<BoardDescriptionModal />` per `component-system.md` §3.6: 850×550 two-pane, right pane bg `--color-surface-info`. Left pane: `<EditableTitle variant="body">` for the description (uses `updateBoardDescription` server action). Right pane: created-by, members, workspace tile.

`BoardSettingsMenu` items: Rename (focuses the header title), Set description, Toggle privacy (admin+), Duplicate (member+; calls `duplicateBoard`), Archive (admin+; calls `archiveBoard`; navigates back to workspace home), Delete (workspace-owner; opens type-name confirm).

#### `BoardViewTabs`

Five tabs: Table (active, links to `./table` which is currently `app/(app)/w/[slug]/b/[boardId]/page.tsx`), Kanban, Calendar, Timeline, Dashboard. Only Table is enabled in this epic. Disabled tabs render with `opacity-50 cursor-not-allowed` + "Coming soon" tooltip. Active tab gets `border-b-2 border-primary` snap-on (no animation).

#### Board home placeholder

`page.tsx`: empty state "This board is empty. Add your first group." with a placeholder CTA (the Add-group flow lands in epic 06).

### Definition of done
- Visiting `/w/<slug>/b/<id>` renders the layout + placeholder.
- Inline title editing works (renames the board).
- Star toggle works optimistically.
- Description modal opens, edits save, closes.
- Settings menu items each route to or trigger the correct action.
- Visual fidelity matches `<BoardHeader />` review.
- `pnpm lint` + `pnpm typecheck` green.

### Forbidden scope
- Does not own board settings pages (Slice 15).
- Does not implement table/kanban/calendar content.

### Escalation triggers
- If `BoardProvider` does not yet exist with the new `isStarred` field — Slice 4 owns adding it; Slice 4 is in Stage 1 and should be done by Stage 4. Escalate if missing.

---

## Slice 15 — Board settings (general + members)

**Owner:** epic-executor (sonnet) · **Stage:** 5, parallel

### Files
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/layout.tsx` (new)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/page.tsx` (new — redirect to general)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/page.tsx` (new)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/general-form.tsx` (new — `"use client"`)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/page.tsx` (new)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/members-table.tsx` (new — `"use client"`)

### Spec

#### General

Form fields: name (`renameBoard`), description (`updateBoardDescription`), privacy toggle (`setBoardPrivacy` — admin+; warning copy when going public→private). Below the form: archive (admin+ → calls `archiveBoard`, navigates to workspace home), permanent-delete (workspace-owner only → type-name confirm modal → calls `deleteBoard`).

#### Members

Conditional on `is_private`. When `is_private=false`: render notice "This board is visible to all workspace members. Make it private to manage members individually." When `is_private=true`: render the members table mirroring the workspace members table. Use `setBoardMemberRole` / `removeBoardMember`. Pending board-scoped invitations (the existing `invitation.board_id is not null` rows) listed below with revoke/resend.

### Definition of done
- Settings routes render.
- Privacy toggle works and seeds `board_member` for the caller when going private.
- Archive returns to workspace home.
- Visual fidelity matches the workspace settings pages.
- `pnpm lint` + `pnpm typecheck` green.

### Forbidden scope
- Does not modify the board layout / header.
- Does not modify server actions.

### Escalation triggers
- If toggling `is_private=true` does not seed the caller into `board_member`, the user can lock themselves out (the workspace-derived role disappears for private boards). **Slice 6 already addresses this in `setBoardPrivacy`** — confirm the action does the seed.

---

## Slice 16 — Last-viewed redirect at `/` + first-run onboarding

**Owner:** epic-executor (sonnet) · **Stage:** 5, parallel

### Files
- `app/page.tsx` (modify — currently the foundation health-check page)
- `app/(app)/page.tsx` (new — the "create your first workspace" route)
- `components/shared/CreateWorkspaceModal/CreateWorkspaceModal.tsx` (new — `"use client"`)

### Spec

#### `app/page.tsx`

Replace the foundation health-check with a redirect-or-render gate:
- If unauthed: redirect to `/sign-in` (already enforced by middleware; this is defense-in-depth).
- If authed and has `profile.last_workspace_id` and that workspace is still alive: redirect to `/w/<slug>`.
- If authed and has at least one workspace membership: redirect to the first workspace's slug.
- If authed and no workspace memberships: render `<NoWorkspaces onCreate={openCreateWorkspaceModal} />` from Slice 10.

The modal `<CreateWorkspaceModal />` is its own client component with the same form chrome as `<CreateBoardModal />`. Calls `createWorkspace` server action; on success, navigates to the new workspace.

(Alternative pattern: place this gate at `app/(app)/page.tsx` and have `app/page.tsx` redirect unauthed users to sign-in, authed users to `/(app)`. Both work; pick whichever is simpler. Recommendation: keep `app/page.tsx` as the only entry; `(app)/page.tsx` is unnecessary if `app/page.tsx` does the gate.)

**Direction (binding):** put the gate in `app/(app)/page.tsx` (the route for `/`) and remove the foundation `app/page.tsx`. Move the foundation `_components/{ping-button,sign-out-button}.tsx` files to `app/(app)/_dev/` (or delete the ping button entirely; the sign-out button is reused in UserMenu — Slice 8 should already have its own; remove the standalone). Verify by running `pnpm dev` after the changes; `/` should land in the gate.

Wait — `app/page.tsx` (top level) and `app/(app)/page.tsx` both map to `/`. Two `page.tsx` files at the same effective path is a Next.js error. The `(app)` route group does not contribute to the URL. The current state has only `app/page.tsx`. The new state needs to either keep `app/page.tsx` only, or move the gate inside `(app)` and delete `app/page.tsx`. The simpler path: **delete `app/page.tsx` and add `app/(app)/page.tsx`.** This way the gate inherits the SidebarShell layout (which is fine — the shell renders gracefully when no workspace is selected).

### Definition of done
- After `pnpm dev`, `/` for an authed user with at least one workspace redirects to that workspace.
- For an authed user with no workspaces, `/` renders the create-first-workspace empty state inside the SidebarShell.
- Creating a workspace navigates to the new workspace's home.
- The foundation health-check page is removed.
- `pnpm lint` + `pnpm typecheck` green.

### Forbidden scope
- Does not modify middleware.
- Does not modify the SidebarShell.
- Does not touch `setLastWorkspace` server action's behavior — only consumes it.

### Escalation triggers
- If `app/page.tsx` references components that other slices/files depend on (the executor must `grep` first), escalate.

---

## Sequential follow-ups

### F1. Apply Stage 1 migration to cloud + regenerate types

After Slice 1 lands on the epic branch:
- Run `pnpm db:push` to apply `<NEW_TS>_workspaces_polish.sql` to cloud Supabase.
- Run `pnpm db:types` to regenerate `lib/supabase/types.ts`.
- Commit the regenerated types in a separate commit on the epic branch.
- All Stage 2+ slices block on F1 because they read the new schema fields via the generated types.

### F2. Playwright spec stub at `tests/e2e/05-workspaces-boards.spec.ts`

Authoring a spec file that documents the happy path; the runner is wired in epic 15 (`pnpm test:e2e` is the existing stub). The spec covers: sign in → land on first workspace → create board → rename → star → archive → restore → delete. Invite a second user (mocked) → accept → verify membership.

This is a single-file slice with no other dependencies; it lands at the end so it can reference all the routes and selectors that prior slices built.

---

## Risk notes

1. **`role_for_board` filters soft-deleted boards** (`20260507120000:49`). This breaks `restoreBoard` under user session. **Slice 1 amendment** adds `board_select_archived` for SELECT; UPDATE side may also need a similar relaxation. Surface this explicitly to the user as a binding question; the planner expects a delta from the researcher mid-flight.

2. **The `WorkspaceContextValue` shape evolves across slices.** Slice 4 ships the basic context; Slice 9 demands `useWorkspaceMaybe`/`useBoardMaybe`; Slice 11 demands `sidebarBoards`. The spec above marks both as binding amendments to Slice 4 — make sure the executor reads them together.

3. **CreateBoardModal is referenced by Slice 8 (`NewBoardButton`) but lives in Slice 11.** Stage 3 runs before Stage 4. Slice 8 must ship a placeholder modal stub; Slice 11's executor swaps in the real modal. The orchestrator must verify this hand-off in the Stage 3 review.

4. **RHF + Zod 4 typecheck noise.** Pre-existing, not in scope. New form callsites (CreateBoardModal, CreateWorkspaceModal, settings forms, InviteModal) will inherit the same errors. The reviewer should not flag these as new regressions; cite the epic-04 final review as the standing tracker.

5. **`clone_board` correctness.** The CTE-based copy is plausible but may surface edge cases under cloud Postgres 14.x. The migration includes the function but no pgTAP tests in this epic — **add a single `tests/policies/05_clone_board.sql` script** as part of Slice 1 to verify the copy round-trips column counts, group counts, task counts, and label remapping. (Runner is deferred; the file lands.)

6. **Storybook absence.** Without a visual playground, fidelity verification falls back to manual screenshot review. The reviewer should plan to spot-check the must-match components (MainSidebar, WorkspaceSidebar, BoardHeader, CreateBoardModal, MemberModal, InviteModal, BoardDescriptionModal) after Stage 3 and Stage 4 land.

7. **Trash auto-purge — intentionally absent.** User decision: no cron, ever. The "Delete permanently" button is the only purge path. No `supabase/functions/purge-trash/` directory, no pg_cron reference. Epic 15 does not change this. No slice should ship any purge infrastructure.

8. **Invitation accept inviter-name display.** Slice 7 escalation spelled out — likely needs a Slice 1 schema add or a copy compromise. Surface to user before Stage 2.

9. **Cross-workspace move-board** is deferred. No slice should accidentally ship the UI affordance.

10. **Pre-existing untracked `.claire/` worktree dir** is git-ignored; epic 04 final review noted. Not a regression.

11. **`activity` no-insert policy.** Star/archive/etc. do not write activity rows in this epic. Epic 09 owns activity logging. Slice 6's actions should not attempt to write activity rows.

12. **`notification` no-insert policy.** Invitation create logs to console (existing behavior). Email send is epic 13.

13. **`pnpm test` runs `vitest run --passWithNoTests`** — vitest is not installed; the script is a stub. Test stubs in `tests/unit/` ship with `describe.skip(...)`. No slice should attempt to wire vitest in epic 05.

14. **Token added in this epic:** `--color-surface-nav-hover` (= `rgba(0,0,0,0.6)`). Slice 8 owns adding it. Update `docs/conversion-plan/design-system.md` §1.1.2 to reflect the new token at the same time, **or** flag it as a doc followup at the end of the epic. Recommended: flag as a doc followup; design-system.md updates are not in this epic's task list.

