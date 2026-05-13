-- ============================================================
-- Fix remaining infinite-recursion paths in RLS policies that
-- still subquery public.workspace_member directly.
--
-- 20260512100000 routed the workspace_* and wsm_* policies through
-- SECURITY DEFINER helpers (is_workspace_member / role_for_workspace),
-- but several other policies still inline `select ... from
-- public.workspace_member`. Whenever one of those policies is reached
-- transitively from within an in-progress workspace_member policy
-- evaluation (e.g. wsm_insert → invitation_select → workspace_member),
-- Postgres raises 42P17 (infinite recursion detected) — exactly the
-- failure reproduced by tests/policies/10_workspace.sql test 11.
--
-- This migration:
--   1. Adds a `shares_workspace_with` SECURITY DEFINER helper for
--      the profile_select "users in any shared workspace" check.
--   2. Rewrites every remaining policy that subqueries
--      workspace_member directly to call a SECURITY DEFINER helper
--      (is_workspace_member / role_for_workspace / shares_workspace_with).
--
-- Functionality is preserved — each rewrite is a direct mechanical
-- substitution of the inlined `select role from workspace_member ...`
-- (or `exists (select 1 from workspace_member ...)`) for the
-- equivalent helper call.
-- ============================================================

-- 1. shares_workspace_with helper -----------------------------

create or replace function public.shares_workspace_with(p_user_id uuid, p_with_user_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
      from public.workspace_member wm1
      join public.workspace_member wm2 on wm1.workspace_id = wm2.workspace_id
     where wm1.user_id = p_user_id
       and wm2.user_id = p_with_user_id
  )
$$;

grant execute on function public.shares_workspace_with(uuid, uuid) to authenticated, anon;

-- 2. invitation_select ----------------------------------------
-- This is the policy on the recursion path that breaks test 11.
-- wsm_insert.with-check selects from invitation; invitation_select
-- evaluates and subqueries workspace_member, hitting wsm_select on
-- a relation that is already mid-policy-evaluation.

drop policy if exists "invitation_select" on public.invitation;
create policy "invitation_select" on public.invitation for select using (
  (
    lower(email) = lower((select email from auth.users where id = (select auth.uid())))
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

-- 3. invitation_insert ----------------------------------------

drop policy if exists "invitation_insert" on public.invitation;
create policy "invitation_insert" on public.invitation for insert with check (
  public.role_rank(public.role_for_workspace(invitation.workspace_id, (select auth.uid())))
    >= public.role_rank('admin')
  and (
    board_id is null
    or public.role_rank(public.role_for_board(board_id, (select auth.uid())))
      >= public.role_rank('admin')
  )
  and invited_by = (select auth.uid())
);

-- 4. invitation_admin_update ---------------------------------

drop policy if exists "invitation_admin_update" on public.invitation;
create policy "invitation_admin_update" on public.invitation for update using (
  public.role_rank(public.role_for_workspace(invitation.workspace_id, (select auth.uid())))
    >= public.role_rank('admin')
  or (
    board_id is not null
    and public.role_rank(public.role_for_board(board_id, (select auth.uid())))
      >= public.role_rank('admin')
  )
);

-- 5. board_insert ---------------------------------------------

drop policy if exists "board_insert" on public.board;
create policy "board_insert" on public.board for insert with check (
  public.role_for_workspace(board.workspace_id, (select auth.uid())) in ('owner', 'admin', 'member')
);

-- 6. board_delete ---------------------------------------------

drop policy if exists "board_delete" on public.board;
create policy "board_delete" on public.board for delete using (
  public.role_for_workspace(board.workspace_id, (select auth.uid())) = 'owner'
);

-- 7. board_select_archived ------------------------------------

drop policy if exists "board_select_archived" on public.board;
create policy "board_select_archived" on public.board for select using (
  deleted_at is not null
  and public.role_for_workspace(board.workspace_id, (select auth.uid())) in ('owner', 'admin')
);

-- 8. profile_select -------------------------------------------

drop policy if exists "profile_select" on public.profile;
create policy "profile_select" on public.profile for select using (
  id = (select auth.uid())
  or public.shares_workspace_with((select auth.uid()), profile.id)
);
