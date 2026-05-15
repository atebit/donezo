-- Re-assert the invitee-email-match helper and the membership self-insert
-- policies in their canonical, helper-based form.
--
-- Why: a brand-new user (no workspace/board roles, no pre-existing membership
-- row) accepting a board-scoped invitation hit
--
--   new row violates row-level security policy for table "board_member"
--
-- on the self-insert at app/(auth)/join/[token]/actions.ts. Earlier variants of
-- bm_insert / wsm_insert inline `select email from auth.users where id =
-- auth.uid()`; the `authenticated` role has no SELECT on auth.users, so that
-- subquery is permission-denied / silent-NULL and the self-insert branch
-- evaluates false. The fix (20260513200000 / 20260513210000) routes the email
-- match through the SECURITY DEFINER helper public.current_user_email(), but if
-- production's migration state lags the repo the older auth.users-inlining
-- policy is still active. Existing admins never noticed (they pass via the
-- role_for_board branch); re-accepts hit ON CONFLICT DO NOTHING; only a true
-- first-time invitee exercises the self-insert WITH CHECK.
--
-- This migration is idempotent and safe to apply even when prod is already
-- current — it just re-creates objects in their final form so prod converges.

-- 1. current_user_email helper — plpgsql, reads public.profile.
--    (Canonical form from 20260513210000_fix_current_user_email_helper.sql:
--    `language sql ... set search_path = public stable` parsed `stable` as part
--    of the search_path literal, leaving the function VOLATILE + inlinable,
--    which defeated SECURITY DEFINER and re-introduced the auth.users 42501 /
--    silent-NULL path.)
create or replace function public.current_user_email()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email::text into v_email
    from public.profile
    where id = (select auth.uid());
  return v_email;
end
$$;

grant execute on function public.current_user_email() to authenticated, anon;

-- 2. wsm_insert — workspace-scoped invitee self-insert via the helper.
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

-- 3. bm_insert — board-scoped invitee self-insert via the helper.
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
