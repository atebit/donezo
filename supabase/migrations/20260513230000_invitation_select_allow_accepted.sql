-- ============================================================
-- Let invitees SELECT their own invitations after acceptance.
--
-- The original invitation_select policy from 20260507120200
-- guarded the email-match branch with `and accepted_at is null`,
-- which means: an invitee can only see the row while it has
-- never been accepted. Combined with `RETURNING` on the
-- accept-mutation, this produced a self-defeating policy:
--
--   1. invitee runs UPDATE invitation SET accepted_at = now()
--      ... RETURNING id;
--   2. Postgres needs to re-check SELECT policy on the new row
--      to materialise the RETURNING value.
--   3. accepted_at is no longer null → first OR branch fails;
--      invitee has no workspace/board admin role → other
--      branches fail.
--   4. Postgres raises "new row violates row-level security
--      policy for table invitation".
--
-- 40_invitation.sql test 5 (invitee can set accepted_at on
-- own invitation) is exactly this case, and the test was
-- written against the documented contract — the policy is
-- the side that needs adjusting.
--
-- Drop the `accepted_at is null` qualifier from the email-match
-- branch so an invitee can see invitations addressed to them
-- regardless of acceptance state. They still cannot see
-- invitations addressed to anyone else (test 4 still passes),
-- and admin branches are unchanged.
-- ============================================================

drop policy if exists "invitation_select" on public.invitation;
create policy "invitation_select" on public.invitation for select using (
  lower(email) = lower(public.current_user_email())
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
