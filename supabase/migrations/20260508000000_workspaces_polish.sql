-- Epic 05: workspaces & boards schema additions

-- 1. profile.last_workspace_id
alter table public.profile
  add column last_workspace_id uuid references public.workspace(id) on delete set null;

-- 2. column.icon (needed for templates in epic 07; ship now to keep types stable)
alter table public."column" add column icon text;

-- 3. board.description
alter table public.board add column description text not null default '';

-- 4. user_starred_board (per-user starring)
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

-- 5. invitation.revoked_at (soft revoke)
alter table public.invitation
  add column revoked_at timestamptz null;

-- Replace the invitation_only_accept_update trigger to also allow admin+ to set
-- revoked_at and extend expires_at.
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

-- Add admin-update policy on invitation so admin+ can set revoked_at / extends expires_at
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

-- Update wsm_insert to reject revoked invitations
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

-- Update bm_insert to reject revoked invitations
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

-- 6. board_select_archived policy (needed by the trash page so admin+ can list
--    soft-deleted boards — the existing board_select policy filters deleted_at is null)
create policy "board_select_archived" on public.board for select using (
  deleted_at is not null
  and exists (
    select 1 from public.workspace_member wm
     where wm.workspace_id = board.workspace_id
       and wm.user_id = (select auth.uid())
       and wm.role in ('owner', 'admin')
  )
);

-- 7. clone_board RPC (used by duplicateBoard server action)
-- Copies: board row, columns (preserving order/type/settings/name/icon),
-- labels (per column; rebuild label_id mapping), groups (position/name/color),
-- tasks (position; created_by = caller; timestamps = now()),
-- cells (rewriting task_id/column_id/label_id via maps).
-- SKIP: comments, activity, attachments, members.
-- Atomic; security definer with set search_path = public.
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

  return v_new_board;
end $$;

grant execute on function public.clone_board(uuid) to authenticated;
