-- ============================================================
-- Epic 04 — Slice D: invitation table + RLS + create_workspace / create_board RPCs
-- Timestamp must sort after 20260507120100_rls_policies.sql (Slice B).
-- All policies use (select auth.uid()) for plan-cache stability.
-- ============================================================

-- ============================================================
-- 1. invitation table
-- ============================================================

create table public.invitation (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspace(id) on delete cascade,
  board_id      uuid        references public.board(id) on delete cascade,
  email         text        not null,
  role          text        not null check (role in ('admin', 'member', 'viewer')),
  token         text        not null unique,
  invited_by    uuid        references auth.users(id) on delete set null,
  accepted_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '14 days'),
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 2. Index on lower(email) for invitee lookups
-- ============================================================

create index invitation_email_idx on public.invitation (lower(email));

-- ============================================================
-- 3. Enable RLS on invitation
-- ============================================================

alter table public.invitation enable row level security;

-- ============================================================
-- 4. RLS policies on invitation
-- ============================================================

-- SELECT: invitee on non-accepted rows OR admin+ on parent workspace/board
create policy "invitation_select" on public.invitation for select using (
  (
    lower(email) = lower((select email from auth.users where id = (select auth.uid())))
    and accepted_at is null
  )
  or
  public.role_rank((
    select role from public.workspace_member
     where workspace_id = invitation.workspace_id and user_id = (select auth.uid())
  )) >= public.role_rank('admin')
  or
  (
    board_id is not null
    and public.role_rank(public.role_for_board(board_id, (select auth.uid()))) >= public.role_rank('admin')
  )
);

-- INSERT: admin+ on workspace; if board_id is not null, admin+ on board too
create policy "invitation_insert" on public.invitation for insert with check (
  public.role_rank((
    select role from public.workspace_member
     where workspace_id = invitation.workspace_id and user_id = (select auth.uid())
  )) >= public.role_rank('admin')
  and (
    board_id is null
    or public.role_rank(public.role_for_board(board_id, (select auth.uid()))) >= public.role_rank('admin')
  )
  and invited_by = (select auth.uid())
);

-- UPDATE: invitee can mark own non-accepted invitation as accepted
create policy "invitation_update" on public.invitation for update using (
  lower(email) = lower((select email from auth.users where id = (select auth.uid())))
  and accepted_at is null
) with check (
  lower(email) = lower((select email from auth.users where id = (select auth.uid())))
);

-- No DELETE policy — invitations are never deleted by users.

-- ============================================================
-- 5. Before-update trigger restricting columns to accepted_at only
-- ============================================================

create or replace function public.invitation_only_accept_update()
returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id
    or new.workspace_id is distinct from old.workspace_id
    or new.board_id is distinct from old.board_id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.token is distinct from old.token
    or new.invited_by is distinct from old.invited_by
    or new.expires_at is distinct from old.expires_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'invitation: only accepted_at may be updated' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger invitation_only_accept_update
  before update on public.invitation
  for each row execute function public.invitation_only_accept_update();

-- ============================================================
-- 6. Replace wsm_insert with invitation-gated version
-- ============================================================

drop policy if exists "wsm_insert" on public.workspace_member;

create policy "wsm_insert" on public.workspace_member for insert with check (
  -- admin+ on the workspace
  public.role_rank((
    select role from public.workspace_member
     where workspace_id = workspace_member.workspace_id and user_id = (select auth.uid())
  )) >= public.role_rank('admin')
  or
  -- self-insert via valid workspace-scoped invitation
  (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation i
       where i.workspace_id = workspace_member.workspace_id
         and i.board_id is null
         and lower(i.email) = lower((select email from auth.users where id = (select auth.uid())))
         and i.role = workspace_member.role
         and i.accepted_at is null
         and i.expires_at >= now()
    )
  )
);

-- ============================================================
-- 7. Replace bm_insert with invitation-gated version
-- ============================================================

drop policy if exists "bm_insert" on public.board_member;

create policy "bm_insert" on public.board_member for insert with check (
  -- admin+ on the board (board admin or workspace admin via role_for_board on non-private boards)
  public.role_rank(public.role_for_board(board_member.board_id, (select auth.uid()))) >= public.role_rank('admin')
  or
  -- self-insert via valid board-scoped invitation
  (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation i
       where i.board_id = board_member.board_id
         and lower(i.email) = lower((select email from auth.users where id = (select auth.uid())))
         and i.role = board_member.role
         and i.accepted_at is null
         and i.expires_at >= now()
    )
  )
);

-- ============================================================
-- 8. create_workspace RPC
-- ============================================================

create or replace function public.create_workspace(p_name text, p_slug text)
returns public.workspace
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ws   public.workspace;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  insert into public.workspace (name, slug, created_by)
    values (p_name, p_slug, v_user)
    returning * into v_ws;
  insert into public.workspace_member (workspace_id, user_id, role)
    values (v_ws.id, v_user, 'owner');
  return v_ws;
end $$;

grant execute on function public.create_workspace(text, text) to authenticated;

-- ============================================================
-- 9. create_board RPC
-- ============================================================

create or replace function public.create_board(p_workspace_id uuid, p_name text, p_is_private boolean)
returns public.board
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_role  text;
  v_board public.board;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  select role into v_role from public.workspace_member
    where workspace_id = p_workspace_id and user_id = v_user;
  if v_role is null or public.role_rank(v_role) < public.role_rank('member') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.board (workspace_id, name, created_by, is_private)
    values (p_workspace_id, p_name, v_user, coalesce(p_is_private, false))
    returning * into v_board;
  if coalesce(p_is_private, false) then
    insert into public.board_member (board_id, user_id, role)
      values (v_board.id, v_user, 'owner');
  end if;
  return v_board;
end $$;

grant execute on function public.create_board(uuid, text, boolean) to authenticated;
