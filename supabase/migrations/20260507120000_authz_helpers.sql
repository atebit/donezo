-- Migration: is_private flag + role helper functions
-- Slice A of epic 04 (Authorization / RLS)

-- 1. Add is_private column to board
alter table public.board add column is_private boolean not null default false;

-- 2. role_rank: maps a role text to an integer for comparison
create or replace function public.role_rank(r text)
returns int language sql immutable as $$
  select case r
    when 'owner'  then 4
    when 'admin'  then 3
    when 'member' then 2
    when 'viewer' then 1
    else 0
  end
$$;

-- 3. greater_role: returns the higher-ranked of two roles (nulls treated as absent)
create or replace function public.greater_role(a text, b text)
returns text language sql immutable as $$
  select case
    when a is null then b
    when b is null then a
    when public.role_rank(a) >= public.role_rank(b) then a
    else b
  end
$$;

-- 4. role_for_board: returns the effective role of a user on a board,
--    accounting for is_private and soft-delete. Returns null when the user
--    has no access, the board does not exist, or the board is soft-deleted.
create or replace function public.role_for_board(p_board_id uuid, p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  ws_role       text;
  b_role        text;
  v_is_private  boolean;
  v_deleted_at  timestamptz;
begin
  if p_user_id is null then return null; end if;

  select b.is_private, b.deleted_at
    into v_is_private, v_deleted_at
    from public.board b
   where b.id = p_board_id;

  if v_is_private is null then return null; end if;   -- board not found
  if v_deleted_at is not null then return null; end if; -- soft-deleted

  select wm.role into ws_role
    from public.board b
    join public.workspace_member wm
      on wm.workspace_id = b.workspace_id and wm.user_id = p_user_id
   where b.id = p_board_id;

  select role into b_role
    from public.board_member
   where board_id = p_board_id and user_id = p_user_id;

  if v_is_private then
    return b_role;
  else
    return public.greater_role(ws_role, b_role);
  end if;
end $$;

-- 5. Grant execute to authenticated and anon roles
grant execute on function public.role_rank(text)              to authenticated, anon;
grant execute on function public.greater_role(text, text)     to authenticated, anon;
grant execute on function public.role_for_board(uuid, uuid)   to authenticated, anon;
