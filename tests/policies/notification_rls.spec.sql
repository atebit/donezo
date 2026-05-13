-- ============================================================
-- tests/policies/notification_rls.spec.sql
-- pgTAP assertions for notification and notification_preference RLS (Epic 13 Slice 1A).
--
-- Assertion count: 5
--
-- Coverage targets:
--   1. Service-role can insert into notification (no INSERT policy → service bypasses RLS).
--   2. User A can SELECT their own notification rows.
--   3. User A CANNOT SELECT user B's notification_preference.
--   4. User A CAN SELECT their own notification_preference.
--   5. task_reminder_sent is invisible to authenticated users (0 rows returned).
--
-- UUID prefix: aa... for users, bb... for other entities (no clash with other specs).
-- ============================================================

begin;

select plan(5);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
declare
  v_user_a uuid := 'aa000000-0000-0000-0000-000000000001'::uuid;
  v_user_b uuid := 'aa000000-0000-0000-0000-000000000002'::uuid;
  v_ws_id  uuid := 'bb000000-0000-0000-0000-000000000001'::uuid;
  v_board  uuid := 'bb000000-0000-0000-0000-000000000002'::uuid;
  v_group  uuid := 'bb000000-0000-0000-0000-000000000003'::uuid;
  v_task   uuid := 'bb000000-0000-0000-0000-000000000004'::uuid;
begin
  -- Users
  perform tests.make_user(v_user_a, 'user-a-notif@test.example');
  perform tests.make_user(v_user_b, 'user-b-notif@test.example');

  -- Workspace with both users as members
  perform tests.seed_workspace_with_roles(
    v_ws_id,
    jsonb_build_object(
      v_user_a::text, 'owner',
      v_user_b::text, 'member'
    )
  );

  -- Board (public) on the workspace
  perform tests.seed_board(v_board, v_ws_id, false);

  -- Group + task
  perform tests.seed_group(v_group, v_board);
  perform tests.seed_task(v_task, v_group, v_board);

  -- Insert a notification for user A (service-role, no INSERT policy needed).
  insert into public.notification (id, user_id, kind, payload)
  values (
    'cc000000-0000-0000-0000-000000000001'::uuid,
    v_user_a,
    'mention',
    jsonb_build_object(
      'actor_id', v_user_b::text,
      'board_id', v_board::text,
      'task_id',  v_task::text,
      'comment_id', 'cc000000-0000-0000-0000-000000000099'::text
    )
  );

  -- Insert a notification_preference row for user A only.
  insert into public.notification_preference (user_id, prefs, digest_enabled, digest_hour, digest_timezone)
  values (v_user_a, '{}'::jsonb, false, 9, 'UTC');

  -- Insert a task_reminder_sent row (service-role).
  insert into public.task_reminder_sent (task_id, kind)
  values (v_task, 'due_soon');
end $$;

-- ============================================================
-- Test 1: Service-role insert into notification works.
-- (Verified above via the seed DO block; assert the row exists.)
-- ============================================================

select is(
  (select count(*)::int
     from public.notification
    where id = 'cc000000-0000-0000-0000-000000000001'::uuid),
  1,
  'Service-role can INSERT into notification (no policy = service bypasses RLS)'
);

-- ============================================================
-- Test 2: User A can SELECT their own notification.
-- ============================================================

select tests.set_jwt_user('aa000000-0000-0000-0000-000000000001'::uuid);

select is(
  (select count(*)::int
     from public.notification
    where user_id = 'aa000000-0000-0000-0000-000000000001'::uuid),
  1,
  'User A can SELECT their own notification rows'
);

-- ============================================================
-- Test 3: User A CANNOT SELECT user B's notification_preference.
-- User B has no preference row, so this also confirms no row leakage.
-- Switch to user B and try to read user A's preference.
-- ============================================================

select tests.set_jwt_user('aa000000-0000-0000-0000-000000000002'::uuid);

select is(
  (select count(*)::int
     from public.notification_preference
    where user_id = 'aa000000-0000-0000-0000-000000000001'::uuid),
  0,
  'User B cannot SELECT user A''s notification_preference'
);

-- ============================================================
-- Test 4: User A CAN SELECT their own notification_preference.
-- ============================================================

select tests.set_jwt_user('aa000000-0000-0000-0000-000000000001'::uuid);

select is(
  (select count(*)::int
     from public.notification_preference
    where user_id = 'aa000000-0000-0000-0000-000000000001'::uuid),
  1,
  'User A can SELECT their own notification_preference'
);

-- ============================================================
-- Test 5: task_reminder_sent is invisible to authenticated users.
-- RLS is enabled but no policies are defined, so authenticated
-- role sees 0 rows regardless of which user is active.
-- ============================================================

select tests.set_jwt_user('aa000000-0000-0000-0000-000000000001'::uuid);

select is(
  (select count(*)::int from public.task_reminder_sent),
  0,
  'task_reminder_sent is invisible to authenticated users (RLS no-policy = deny)'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
