-- Epic 05: restore_board RPC
-- Needed because role_for_board returns null for soft-deleted boards,
-- so a user-session UPDATE cannot clear deleted_at via the board_update policy.
create or replace function public.restore_board(p_board_id uuid)
returns public.board
language plpgsql security definer set search_path = public as $$
declare
  v_user       uuid := auth.uid();
  v_workspace  uuid;
  v_ws_role    text;
  v_board      public.board%rowtype;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  -- Read the board (including soft-deleted rows) via security definer bypass.
  select * into v_board from public.board where id = p_board_id;
  if not found then
    raise exception 'board not found' using errcode = 'P0002';
  end if;
  if v_board.deleted_at is null then
    raise exception 'board is not archived' using errcode = 'P0001';
  end if;

  v_workspace := v_board.workspace_id;

  -- Require caller to be workspace admin+.
  select wm.role into v_ws_role
    from public.workspace_member wm
   where wm.workspace_id = v_workspace
     and wm.user_id = v_user;
  if public.role_rank(v_ws_role) < public.role_rank('admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Clear deleted_at.
  update public.board set deleted_at = null, updated_at = now()
   where id = p_board_id
  returning * into v_board;

  return v_board;
end $$;

grant execute on function public.restore_board(uuid) to authenticated;
