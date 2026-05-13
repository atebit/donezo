-- ============================================================
-- Fix "permission denied for table users" surfaced after
-- 20260513100000 removed the recursion errors that had been
-- masking it.
--
-- The `authenticated` role does not have SELECT on auth.users
-- in the local Supabase stack. Several policies inlined
-- `select email from auth.users where id = (select auth.uid())`
-- as part of invitee/email-match checks; once those policies are
-- actually evaluated (now that the recursion no longer short-
-- circuits them), the bare SELECT against auth.users raises
-- 42501 from the GRANT system, before RLS ever runs.
--
-- Fix: add a SECURITY DEFINER helper `current_user_email()` that
-- looks up the caller's email under elevated privileges, then
-- rewrite each policy that needs the caller's email to call the
-- helper instead of subquerying auth.users directly.
-- ============================================================

-- 1. current_user_email helper --------------------------------

create or replace function public.current_user_email()
returns text language sql security definer set search_path = public stable as $$
  select email::text from auth.users where id = (select auth.uid())
$$;

grant execute on function public.current_user_email() to authenticated, anon;

-- 2. wsm_insert -----------------------------------------------
-- Mirror the body of 20260512100000_fix_wsm_select_recursion.sql, but use
-- the new helper for the invitee email match.

drop policy if exists "wsm_insert" on public.workspace_member;
create policy "wsm_insert" on public.workspace_member for insert with check (
  public.role_rank(public.role_for_workspace(workspace_member.workspace_id, (select auth.uid())))
    >= public.role_rank('admin')
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation i
       where i.workspace_id = workspace_member.workspace_id
         and i.board_id is null
         and lower(i.email) = lower(public.current_user_email())
         and i.role = workspace_member.role
         and i.accepted_at is null
         and i.revoked_at is null
         and i.expires_at >= now()
    )
  )
);

-- 3. bm_insert ------------------------------------------------
-- Mirror the body of 20260508000000_workspaces_polish.sql (revoked-aware
-- variant). Workspace-admins can also insert via role_for_board, which
-- already routes through a SECURITY DEFINER helper.

drop policy if exists "bm_insert" on public.board_member;
create policy "bm_insert" on public.board_member for insert with check (
  public.role_rank(public.role_for_board(board_member.board_id, (select auth.uid())))
    >= public.role_rank('admin')
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation i
       where i.board_id = board_member.board_id
         and lower(i.email) = lower(public.current_user_email())
         and i.role = board_member.role
         and i.accepted_at is null
         and i.revoked_at is null
         and i.expires_at >= now()
    )
  )
);

-- 4. invitation_select ---------------------------------------
-- Re-create on top of the 20260513100000 form, replacing the auth.users
-- subquery with the helper.

drop policy if exists "invitation_select" on public.invitation;
create policy "invitation_select" on public.invitation for select using (
  (
    lower(email) = lower(public.current_user_email())
    and accepted_at is null
  )
  or
  public.role_rank(public.role_for_workspace(invitation.workspace_id, (select auth.uid())))
    >= public.role_rank('admin')
  or
  (
    board_id is not null
    and public.role_rank(public.role_for_board(board_id, (select auth.uid())))
      >= public.role_rank('admin')
  )
);

-- 5. invitation_update ---------------------------------------
-- Invitee marks own non-accepted invitation as accepted.

drop policy if exists "invitation_update" on public.invitation;
create policy "invitation_update" on public.invitation for update using (
  lower(email) = lower(public.current_user_email())
  and accepted_at is null
) with check (
  lower(email) = lower(public.current_user_email())
);
