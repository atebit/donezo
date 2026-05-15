-- accept_invitation: SECURITY DEFINER RPC that performs invitation acceptance
-- with elevated privileges instead of relying on the self-insert RLS path.
--
-- Why: the bm_insert / wsm_insert "self-insert via a valid invitation" branch
-- is a chicken-and-egg RLS trap. In production a genuine brand-new invitee
-- (no workspace/board role, no pre-existing membership row) is rejected with
--   new row violates row-level security policy for table "board_member"
-- even though every component of the policy expression appears satisfiable.
-- The "successful" historical smokes only ever hit ON CONFLICT DO NOTHING on a
-- pre-existing row, so the fresh self-insert WITH CHECK was never actually
-- exercised until a real external user (jaydrawsthings@gmail.com) tried it.
--
-- This mirrors the established repo pattern (create_workspace, create_board,
-- clone_board, soft_delete_task): when RLS visibility/order makes a write
-- impossible for the caller's own role, move it into a SECURITY DEFINER
-- function that re-validates authorization explicitly and writes with
-- definer privileges. Authorization here = "the caller's email matches a
-- live, unrevoked invitation for this token", re-checked in the function.
--
-- The membership inserts are ON CONFLICT DO NOTHING so the function is
-- idempotent and also backfills membership for invitees who accepted before
-- this fix (already-accepted invitations still seed missing rows).

create or replace function public.accept_invitation(p_token text)
returns table (workspace_id uuid, board_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := (select auth.uid());
  v_email text;
  v_inv   public.invitation;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  v_email := public.current_user_email();
  if v_email is null then
    raise exception 'no email on profile' using errcode = '42501';
  end if;

  -- Definer privileges bypass invitation RLS; we re-validate by hand.
  select * into v_inv
    from public.invitation
   where token = p_token;

  if v_inv.id is null then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if lower(v_inv.email) <> lower(v_email) then
    raise exception 'invitation addressed to a different email'
      using errcode = '42501';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'invitation revoked' using errcode = '42501';
  end if;
  -- Expiry only gates first acceptance; an already-accepted invite still
  -- backfills membership idempotently below.
  if v_inv.accepted_at is null and v_inv.expires_at < now() then
    raise exception 'invitation expired' using errcode = '42501';
  end if;

  if v_inv.board_id is not null then
    insert into public.board_member (board_id, user_id, role)
      values (v_inv.board_id, v_user, v_inv.role)
      on conflict (board_id, user_id) do nothing;

    -- Board-only members still need a workspace_member row or workspace_select
    -- hides the workspace and navigation degrades. Seed the lowest role;
    -- ON CONFLICT preserves any existing higher role.
    insert into public.workspace_member (workspace_id, user_id, role)
      values (v_inv.workspace_id, v_user, 'viewer')
      on conflict (workspace_id, user_id) do nothing;
  else
    insert into public.workspace_member (workspace_id, user_id, role)
      values (v_inv.workspace_id, v_user, v_inv.role)
      on conflict (workspace_id, user_id) do nothing;
  end if;

  update public.invitation
     set accepted_at = now()
   where id = v_inv.id
     and accepted_at is null;

  workspace_id := v_inv.workspace_id;
  board_id     := v_inv.board_id;
  return next;
end $$;

grant execute on function public.accept_invitation(text) to authenticated;
