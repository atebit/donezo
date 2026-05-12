-- Epic 11 — patch create_board RPC to insert a shared "Main table" view.
-- Uses create or replace with the SAME signature as 20260507120200_invitations_and_creation_rpcs.sql.
-- DO NOT add another grant execute — already granted in the original migration.

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
  -- Epic 11 — default shared "Main table" view.
  -- Idempotency guard: skip if a shared Main table already exists (shouldn't happen on create).
  insert into public.view (board_id, owner_id, name, kind, config, is_shared, position)
    select v_board.id, null, 'Main table', 'table', '{}'::jsonb, true, 0
    where not exists (
      select 1 from public.view
        where board_id = v_board.id and is_shared = true and name = 'Main table'
    );
  return v_board;
end $$;

-- Grant unchanged — already exists in 20260507120200_invitations_and_creation_rpcs.sql.
