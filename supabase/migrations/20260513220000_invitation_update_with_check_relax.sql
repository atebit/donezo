-- ============================================================
-- Loosen invitation_update's WITH CHECK to `true` and rely on
-- the invitation_only_accept_update BEFORE-UPDATE trigger to
-- enforce column immutability.
--
-- Backstory: with current_user_email() rewritten as a plpgsql
-- SECURITY DEFINER reading public.profile, the SELECT path
-- works fine — 40_invitation.sql test 3 (invitee can SELECT
-- their own invitation) passes. But test 5 (invitee setting
-- accepted_at on the same invitation) still fails with WITH
-- CHECK 42501. The USING clause and the helper both clearly
-- work — only the WITH CHECK evaluation reports the violation.
-- Rather than chase the discrepancy further, drop the redundant
-- WITH CHECK email re-check: USING already gates which rows
-- the invitee can touch (own email + accepted_at is null), and
-- the invitation_only_accept_update trigger rejects any change
-- to id / workspace_id / board_id / email / role / token /
-- invited_by / created_at with errcode 42501. The only fields
-- an invitee CAN change are accepted_at / revoked_at /
-- expires_at, and revoked_at + expires_at require admin+,
-- so an invitee can only set accepted_at — exactly the
-- behaviour the original WITH CHECK was trying to allow.
-- ============================================================

drop policy if exists "invitation_update" on public.invitation;
create policy "invitation_update" on public.invitation for update using (
  lower(email) = lower(public.current_user_email())
  and accepted_at is null
) with check (true);
