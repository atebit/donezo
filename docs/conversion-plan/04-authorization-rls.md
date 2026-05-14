# Epic 04 — Authorization (RLS + Roles)

## Goal

Make Postgres the source of truth for authorization. Define the role hierarchy, write RLS policies for every table, and provide thin server-side helpers for cases where SQL alone isn't enough (e.g., admin-only mutations that need cross-table reasoning). Prove correctness with pgTAP policy tests.

## Why this is its own epic

A common flaw in prior-generation web apps is authorization living in commented-out or inconsistently enforced middleware. This architecture puts authorization in Postgres via RLS so it cannot be bypassed by application bugs. RLS policies are also notoriously easy to get subtly wrong (e.g., write-allow without a USING clause). They deserve a dedicated epic with tests.

## In scope

- Membership model and role hierarchy.
- RLS policies for every table created in [02](02-supabase-schema.md).
- A `role_for_board(board_id, user_id)` SQL function that other policies and the app reuse.
- Server-side authorization helpers for action-time gating (`requireBoardRole`, etc.).
- Sharing UX skeleton: invite-by-email pending tokens, accept route. (The full board-settings UI lands in [05](05-workspaces-boards.md); this epic ships the data + actions.)
- pgTAP test suite that asserts every policy.

## Out of scope

- Workspace + board CRUD UI ([05](05-workspaces-boards.md)).
- Sending invite emails ([13](13-notifications.md)).
- Audit log of authz changes (rolls into [09](09-comments-activity.md) activity events).

## Dependencies

[02](02-supabase-schema.md), [03](03-auth.md).

## Architecture & design choices

### Role hierarchy

Two scopes: workspace and board. A user's effective role on a board is the higher of (workspace role, board role).

| Role | Workspace | Board |
|---|---|---|
| owner | full control, billing, delete workspace | full control, delete board, manage members |
| admin | manage workspace settings, create/delete boards, manage members | full board control except delete |
| member | view all workspace boards (modulo board membership), create boards | edit tasks, columns, comments; cannot delete board or change members |
| viewer | read-only | read-only |

Workspace roles are mandatory; every workspace member has one. Board roles override the workspace role *upward* — e.g., a workspace `viewer` invited to a board as `member` becomes a `member` on that board only. Board roles never reduce below the workspace role.

Implementation: `effective_role(workspace_role, board_role) = max(workspace_role, board_role)` where `max` is on the rank ordering `viewer < member < admin < owner`.

### Public boards within a workspace

Most boards are visible to all workspace members. The `board_member` row exists when the board is "private" (custom membership) or to grant a non-workspace-member access (a contractor invited to a single board).

Two reads of "who can see this board?" exist depending on a `board.is_private` flag:

- `is_private = false` → anyone in the workspace with at least `viewer` role.
- `is_private = true` → only `board_member` rows count.

For v1, default `is_private = false`. The flag is added to the `board` table here (small migration); private boards UI lands in [05](05-workspaces-boards.md).

### The `role_for_board` function

Used by every policy that gates board content. SQL function, `security definer` so it can read `workspace_member` and `board_member` regardless of the caller's RLS:

```sql
create or replace function public.role_for_board(p_board_id uuid, p_user_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  ws_role text;
  b_role text;
  is_private boolean;
begin
  select b.is_private into is_private from public.board b where b.id = p_board_id;
  if is_private is null then
    return null;
  end if;

  select wm.role into ws_role
  from public.board b
  join public.workspace_member wm on wm.workspace_id = b.workspace_id and wm.user_id = p_user_id
  where b.id = p_board_id;

  select role into b_role
  from public.board_member
  where board_id = p_board_id and user_id = p_user_id;

  if is_private then
    return b_role;          -- private board: only explicit members
  else
    return greater_role(ws_role, b_role);
  end if;
end $$;
```

`greater_role(a, b)` is a small helper:

```sql
create or replace function public.greater_role(a text, b text)
returns text language sql immutable as $$
  select case
    when a is null then b
    when b is null then a
    when role_rank(a) >= role_rank(b) then a
    else b
  end
$$;

create or replace function public.role_rank(r text)
returns int language sql immutable as $$
  select case r when 'owner' then 4 when 'admin' then 3 when 'member' then 2 when 'viewer' then 1 else 0 end
$$;
```

`is_private` column needs to be added in the same migration as these functions:

```sql
alter table public.board add column is_private boolean not null default false;
```

### Policy patterns

Every table follows one of these patterns:

1. **Workspace-scoped (workspace, workspace_member):**
   - SELECT: row visible if user is a workspace_member.
   - INSERT/UPDATE/DELETE: only owners/admins; details below.
2. **Board-scoped read (board, group, column, label, task, cell, comment, attachment, activity, view):**
   - SELECT: `role_for_board(board_id, auth.uid()) is not null`.
3. **Board-scoped write:**
   - INSERT/UPDATE/DELETE: `role_for_board(...)` >= required role for that operation. E.g., editing a cell requires `member`; deleting a column requires `admin`.
4. **User-scoped (notification, profile):**
   - All ops: `user_id = auth.uid()` (with carve-outs for profile read by other users in the same workspace).

### Full policy set

All policies in `supabase/migrations/00000000000002_rls_policies.sql`.

```sql
-- ============================================================
-- Workspace
-- ============================================================
create policy "workspace_select" on public.workspace
  for select using (
    exists (
      select 1 from public.workspace_member wm
      where wm.workspace_id = workspace.id and wm.user_id = auth.uid()
    )
  );

create policy "workspace_insert" on public.workspace
  for insert with check (created_by = auth.uid());
-- (After insert, the app immediately inserts a workspace_member row with role='owner'.)

create policy "workspace_update" on public.workspace
  for update using (
    exists (
      select 1 from public.workspace_member wm
      where wm.workspace_id = workspace.id and wm.user_id = auth.uid() and wm.role in ('owner','admin')
    )
  );

create policy "workspace_delete" on public.workspace
  for delete using (
    exists (
      select 1 from public.workspace_member wm
      where wm.workspace_id = workspace.id and wm.user_id = auth.uid() and wm.role = 'owner'
    )
  );

-- ============================================================
-- Workspace members
-- ============================================================
create policy "wsm_select" on public.workspace_member
  for select using (
    workspace_id in (
      select workspace_id from public.workspace_member where user_id = auth.uid()
    )
  );

create policy "wsm_insert" on public.workspace_member
  for insert with check (
    -- adding self only via invite-accept (server action with service role) OR adding others if admin/owner
    (user_id = auth.uid()) or
    exists (
      select 1 from public.workspace_member wm
      where wm.workspace_id = workspace_member.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  );

create policy "wsm_update" on public.workspace_member
  for update using (
    exists (
      select 1 from public.workspace_member wm
      where wm.workspace_id = workspace_member.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  );

create policy "wsm_delete" on public.workspace_member
  for delete using (
    -- admin/owner can remove anyone; users can remove themselves
    user_id = auth.uid() or
    exists (
      select 1 from public.workspace_member wm
      where wm.workspace_id = workspace_member.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  );

-- ============================================================
-- Board
-- ============================================================
create policy "board_select" on public.board
  for select using (
    role_for_board(board.id, auth.uid()) is not null and deleted_at is null
  );

create policy "board_insert" on public.board
  for insert with check (
    exists (
      select 1 from public.workspace_member wm
      where wm.workspace_id = board.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin','member')
    )
  );

create policy "board_update" on public.board
  for update using (
    role_rank(role_for_board(board.id, auth.uid())) >= role_rank('member')
  );

create policy "board_delete" on public.board
  for delete using (
    role_rank(role_for_board(board.id, auth.uid())) >= role_rank('admin')
  );

-- ============================================================
-- Board members (only owners/admins manage; members can self-leave)
-- ============================================================
create policy "bm_select" on public.board_member
  for select using (
    role_for_board(board_member.board_id, auth.uid()) is not null
  );

create policy "bm_insert" on public.board_member
  for insert with check (
    role_rank(role_for_board(board_member.board_id, auth.uid())) >= role_rank('admin')
  );

create policy "bm_update" on public.board_member
  for update using (
    role_rank(role_for_board(board_member.board_id, auth.uid())) >= role_rank('admin')
  );

create policy "bm_delete" on public.board_member
  for delete using (
    user_id = auth.uid() or
    role_rank(role_for_board(board_member.board_id, auth.uid())) >= role_rank('admin')
  );

-- ============================================================
-- Group / Column / Label / Task / Cell / Comment / Attachment / Activity / View
-- All follow: select if any role; mutate if member+; structural ops if admin+.
-- Pattern shown for one table; repeat for the rest.
-- ============================================================

-- group
create policy "group_select" on public.group for select
  using (role_for_board(group.board_id, auth.uid()) is not null and deleted_at is null);
create policy "group_insert" on public.group for insert
  with check (role_rank(role_for_board(group.board_id, auth.uid())) >= role_rank('member'));
create policy "group_update" on public.group for update
  using (role_rank(role_for_board(group.board_id, auth.uid())) >= role_rank('member'));
create policy "group_delete" on public.group for delete
  using (role_rank(role_for_board(group.board_id, auth.uid())) >= role_rank('member'));

-- column (admin+ for structural changes)
create policy "column_select" on public.column for select
  using (role_for_board(column.board_id, auth.uid()) is not null);
create policy "column_insert" on public.column for insert
  with check (role_rank(role_for_board(column.board_id, auth.uid())) >= role_rank('admin'));
create policy "column_update" on public.column for update
  using (role_rank(role_for_board(column.board_id, auth.uid())) >= role_rank('admin'));
create policy "column_delete" on public.column for delete
  using (role_rank(role_for_board(column.board_id, auth.uid())) >= role_rank('admin'));

-- label (member+ to add status options)
create policy "label_select" on public.label for select using (
  exists (
    select 1 from public.column c
    where c.id = label.column_id and role_for_board(c.board_id, auth.uid()) is not null
  )
);
-- ... member+ for insert/update/delete, joined through column → board

-- task
create policy "task_select" on public.task for select
  using (role_for_board(task.board_id, auth.uid()) is not null and deleted_at is null);
create policy "task_insert" on public.task for insert
  with check (role_rank(role_for_board(task.board_id, auth.uid())) >= role_rank('member'));
create policy "task_update" on public.task for update
  using (role_rank(role_for_board(task.board_id, auth.uid())) >= role_rank('member'));
create policy "task_delete" on public.task for delete
  using (role_rank(role_for_board(task.board_id, auth.uid())) >= role_rank('member'));

-- cell — joined through task
create policy "cell_select" on public.cell for select using (
  exists (
    select 1 from public.task t
    where t.id = cell.task_id and role_for_board(t.board_id, auth.uid()) is not null
  )
);
create policy "cell_modify" on public.cell for all using (
  exists (
    select 1 from public.task t
    where t.id = cell.task_id
      and role_rank(role_for_board(t.board_id, auth.uid())) >= role_rank('member')
  )
);

-- comment
create policy "comment_select" on public.comment for select using (
  exists (
    select 1 from public.task t where t.id = comment.task_id
      and role_for_board(t.board_id, auth.uid()) is not null
  ) and deleted_at is null
);
create policy "comment_insert" on public.comment for insert
  with check (author_id = auth.uid() and exists (
    select 1 from public.task t where t.id = comment.task_id
      and role_rank(role_for_board(t.board_id, auth.uid())) >= role_rank('member')
  ));
create policy "comment_update" on public.comment for update
  using (author_id = auth.uid());           -- only the author edits their own
create policy "comment_delete" on public.comment for delete
  using (author_id = auth.uid() or exists (
    select 1 from public.task t where t.id = comment.task_id
      and role_rank(role_for_board(t.board_id, auth.uid())) >= role_rank('admin')
  ));

-- attachment
create policy "attachment_select" on public.attachment for select using (
  exists (select 1 from public.task t where t.id = attachment.task_id
    and role_for_board(t.board_id, auth.uid()) is not null)
);
create policy "attachment_modify" on public.attachment for all using (
  exists (select 1 from public.task t where t.id = attachment.task_id
    and role_rank(role_for_board(t.board_id, auth.uid())) >= role_rank('member'))
);

-- activity (read-only via app; writes happen via service role from server actions)
create policy "activity_select" on public.activity for select
  using (role_for_board(activity.board_id, auth.uid()) is not null);
-- no insert/update/delete policies → only service role writes.

-- view (saved views)
create policy "view_select" on public.view for select using (
  role_for_board(view.board_id, auth.uid()) is not null
  and (user_id is null or user_id = auth.uid())  -- private views hidden from others
);
create policy "view_modify" on public.view for all using (
  -- shared views require admin; personal views require ownership
  case
    when view.user_id is null then role_rank(role_for_board(view.board_id, auth.uid())) >= role_rank('admin')
    else view.user_id = auth.uid()
  end
);

-- ============================================================
-- Notifications & profile
-- ============================================================
create policy "notification_select" on public.notification for select
  using (user_id = auth.uid());
create policy "notification_update" on public.notification for update
  using (user_id = auth.uid());
-- inserts only via service role.

create policy "profile_select" on public.profile for select using (
  user_id = auth.uid() or
  -- visible to anyone in a shared workspace
  exists (
    select 1 from public.workspace_member wm1
    join public.workspace_member wm2 on wm1.workspace_id = wm2.workspace_id
    where wm1.user_id = auth.uid() and wm2.user_id = profile.user_id
  )
);
create policy "profile_update" on public.profile for update using (user_id = auth.uid());
-- inserts only via the auth trigger.
```

### Server-side authorization helpers

RLS handles row visibility. The app sometimes needs to *check* a role before composing a UI (e.g., "show 'Delete board' button if user is admin+"). For that:

```ts
// lib/authorization/board.ts
import { createClient } from "@/lib/supabase/server";

export async function getBoardRole(boardId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("role_for_board", { p_board_id: boardId, p_user_id: (await supabase.auth.getUser()).data.user!.id });
  return data ?? null;
}

export const ROLE_RANK = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;

export async function requireBoardRole(boardId: string, minRole: keyof typeof ROLE_RANK) {
  const role = await getBoardRole(boardId);
  if (!role || ROLE_RANK[role as keyof typeof ROLE_RANK] < ROLE_RANK[minRole]) {
    throw { code: "forbidden", message: "Insufficient permissions" };
  }
  return role;
}
```

Usage in a server action:

```ts
export const deleteColumn = withUser(async ({ supabase }, { columnId }) => {
  const { data: col } = await supabase.from("column").select("board_id").eq("id", columnId).single();
  if (!col) throw { code: "not_found", message: "Column not found" };
  await requireBoardRole(col.board_id, "admin");
  await supabase.from("column").delete().eq("id", columnId);
});
```

The RLS policy is the actual enforcement; the app-level check provides a friendlier error than "RLS denied." Both run.

### Invitations

Invitation flow lives partly in this epic (the data + actions) and partly in [05](05-workspaces-boards.md) (the UI) and [13](13-notifications.md) (the email).

```sql
create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  board_id uuid references public.board(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','member','viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  token text not null unique,                -- random 32-byte
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitation_email_idx on public.invitation(email) where accepted_at is null;
```

Server actions:

- `inviteToWorkspace({ workspaceId, email, role })` — admin+ only. Inserts an invitation row. Triggers an email ([13](13-notifications.md)).
- `inviteToBoard({ boardId, email, role })` — board admin+ only.
- `acceptInvitation({ token })` — looks up the row, checks token + expiry + email match (`auth.users.email = invitation.email`), inserts the appropriate `workspace_member` and/or `board_member`, marks `accepted_at`.

`acceptInvitation` runs with the user's session — no service role. RLS allows the user to insert their own membership row. The service role is only used to *update* the invitation row's `accepted_at` after success (so the user can't tamper).

### Service-role usage policy

The service role bypasses RLS. Use it sparingly:
- Auth trigger that creates `profile` rows (already a `security definer` function — no service role needed).
- Activity log writes from server actions.
- Notification creation.
- Invitation `accepted_at` updates.

Service-role operations live in `lib/supabase/admin.ts`. The file can only be imported from server-only code; ESLint rule `no-restricted-imports` enforces this.

### Testing: pgTAP

`tests/policies/` contains `*.sql` files run via `pg_prove` against a fresh local DB. Each file:

1. Inserts test users and memberships.
2. `set local role authenticated; set local request.jwt.claim.sub = '<test-user-id>';`
3. Asserts SELECT/INSERT/UPDATE/DELETE outcomes match expectations.

Example assertions:

- A workspace `viewer` cannot insert a task.
- A board `member` cannot delete a column.
- A non-member cannot SELECT a private board's tasks.
- A board `admin` can update the board's title but not delete it (workspace owner only).
- The author of a comment can delete their own comment; a regular member cannot.

CI runs the policy tests on every PR via `pg_prove tests/policies/*.sql` against the ephemeral CI database.

## Tasks

1. **Add `is_private` column to `board`** in a new migration. Default false.
2. **Write `role_rank`, `greater_role`, `role_for_board` functions** in the same migration.
3. **Write the RLS policy migration** with every policy in this doc. One migration file: `00000000000002_rls_policies.sql`.
4. **Add `invitation` table** in a third migration (separate to keep concerns clean).
5. **Build `lib/authorization/board.ts`** with `getBoardRole`, `requireBoardRole`, `ROLE_RANK`.
6. **Build `lib/authorization/workspace.ts`** with the analogous helpers.
7. **Extend `withUser`** with optional `requireBoardRole` / `requireWorkspaceRole` decorators (or document that callers add them inline). Recommend inline; less magic.
8. **Server actions: invitations.** `inviteToWorkspace`, `inviteToBoard`, `acceptInvitation`. Email send is stubbed (logs to console); wired in [13](13-notifications.md).
9. **Server action: workspace creation.** Creates `workspace` row + `workspace_member(role='owner')` in a transaction. Use a SQL function for atomicity.
10. **Server action: board creation.** Creates `board` row; if `is_private`, also creates `board_member(role='owner')` for the creator.
11. **Document the role matrix** in `docs/conversion-plan/04-authorization-rls.md` (this file — done) and reference from [05](05-workspaces-boards.md).
12. **Write pgTAP test suite.** Cover every policy. Aim for ~50 assertions across 5 files (one per role boundary).
13. **CI integration.** Add a `policies` job to `.github/workflows/ci.yml` that boots Supabase and runs pgTAP. Wired fully in [15](15-observability-testing-cicd.md); stub here.

## Definition of done

- All 15 tables in the schema have RLS policies; none are `disable row level security`.
- The pgTAP suite runs locally via `pnpm test:policies` and passes.
- A signed-in viewer cannot delete a task at the database level (verified by test).
- A signed-in member cannot delete a column at the database level (verified by test).
- A non-member of a private board cannot SELECT its rows (verified by test).
- Inviting a user via email creates a row and (after accept) the corresponding membership.
- The `role_for_board` function returns the correct role for every (board, user) combination tested.
- The service-role client is the only path that bypasses RLS, and its usage is documented.

## Open questions

- **Cross-workspace identity**: a user can be a member of multiple workspaces. The signed-in session represents *the user*, not "the user-in-workspace-X." UI scopes by workspace; RLS doesn't need a current-workspace concept. Confirm this is fine for v1.
- **Role granularity**: do we need a `commenter` role between `viewer` and `member` (can comment but not edit cells)? Probably not for v1; add later as a board-only role.
- **External "guest" role**: a contractor invited to one board, with no workspace access. Currently expressed as: workspace_member with role `viewer` + board_member with role `member`. Workable but exposes the workspace member list. Alternative: skip workspace_member; private boards already allow this. Recommend the latter — make `is_private` boards the canonical "guest" path.
- **Audit of permission changes**: should role changes write to `activity`? Yes, but it's a [09](09-comments-activity.md) concern.
- **Public read-only boards** (share-link mode): out of scope for v1. Easy to bolt on later via a `share_token` column on `board` and a special policy.
