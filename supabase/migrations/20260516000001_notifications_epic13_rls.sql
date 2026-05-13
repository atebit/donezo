-- ============================================================
-- Epic 13 — Notifications: RLS policies for new tables
-- Migration: 20260516000001_notifications_epic13_rls.sql
--
-- Tables covered:
--   1. notification_preference — user owns their own row (user_id = auth.uid()).
--   2. task_follower          — users can see their own rows; board members can
--                               see who follows tasks on boards they belong to.
--                               Writes are restricted to own user_id only.
--   3. task_reminder_sent     — no policies; RLS is enabled but only service-role
--                               (admin client) may read or write. This table is
--                               an internal cron idempotency guard and must never
--                               be exposed to browser clients.
--
-- Memory rule honoured: no policy subqueries its own table.
-- The task_follower SELECT join is routed through the pre-existing
-- SECURITY DEFINER helper public.role_for_board(board_id, user_id)
-- which does NOT touch task_follower, avoiding recursion.
-- ============================================================

-- ============================================================
-- 1. notification_preference policies
-- Simple self-ownership: each user manages only their own row.
-- ============================================================

create policy "notification_preference_select" on public.notification_preference
  for select using (
    user_id = (select auth.uid())
  );

create policy "notification_preference_insert" on public.notification_preference
  for insert with check (
    user_id = (select auth.uid())
  );

create policy "notification_preference_update" on public.notification_preference
  for update using (
    user_id = (select auth.uid())
  ) with check (
    user_id = (select auth.uid())
  );

create policy "notification_preference_delete" on public.notification_preference
  for delete using (
    user_id = (select auth.uid())
  );

-- ============================================================
-- 2. task_follower policies
--
-- SELECT: own rows always visible; additionally, any board member
--   can see the follower list for tasks on their boards (needed
--   for "who's following this task" UI and emitter fan-out queries).
--   The join goes through role_for_board (SECURITY DEFINER) which
--   avoids any self-referencing subquery on task_follower.
--
-- INSERT / UPDATE / DELETE: own user_id only.
-- ============================================================

create policy "task_follower_select" on public.task_follower
  for select using (
    user_id = (select auth.uid())
    or exists (
      select 1
        from public.task t
       where t.id = task_follower.task_id
         and public.role_for_board(t.board_id, (select auth.uid())) is not null
    )
  );

-- Use a single ALL policy for write operations so insert, update, and delete
-- share the same user_id = auth.uid() guard without duplicating logic.
create policy "task_follower_write" on public.task_follower
  for all using (
    user_id = (select auth.uid())
  ) with check (
    user_id = (select auth.uid())
  );

-- ============================================================
-- 3. task_reminder_sent — no RLS policies (service-role only)
--
-- RLS is enabled on task_reminder_sent (see DDL migration), but no
-- policies are defined. This means any attempt to SELECT, INSERT,
-- UPDATE, or DELETE from the authenticated role will fail with a
-- "new row violates row-level security policy" or return 0 rows
-- depending on the operation.
--
-- Only the service-role (admin client) bypasses RLS and can write
-- reminder records. This is intentional: the table is an internal
-- cron-guard and must not be accessible from browser clients or
-- server-side user-context calls.
-- ============================================================
