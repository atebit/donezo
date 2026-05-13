-- ============================================================
-- tests/policies/task_follower_rls.spec.sql
-- pgTAP assertions for task_follower RLS (Epic 13 Slice 1A).
--
-- Assertion count: 5
--
-- Coverage targets:
--   1. User A CAN SELECT their own task_follower rows.
--   2. Board member (User B) CAN SELECT task_follower rows for a task on their board.
--   3. Outsider (User C) CANNOT SELECT task_follower rows for a task on a board they
--      do not belong to (returns 0 rows).
--   4. User A CAN INSERT a task_follower row with their own user_id.
--   5. User A CANNOT INSERT a task_follower row with user_id = another user (42501).
--
-- UUID prefix: dd... for users, ee... for other entities.
-- ============================================================

begin;

select plan(5);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
declare
  v_user_a  uuid := 'dd000000-0000-0000-0000-000000000001'::uuid;
  v_user_b  uuid := 'dd000000-0000-0000-0000-000000000002'::uuid;
  v_user_c  uuid := 'dd000000-0000-0000-0000-000000000003'::uuid;
  v_ws_id   uuid := 'ee000000-0000-0000-0000-000000000001'::uuid;
  v_board   uuid := 'ee000000-0000-0000-0000-000000000002'::uuid;
  v_group   uuid := 'ee000000-0000-0000-0000-000000000003'::uuid;
  v_task    uuid := 'ee000000-0000-0000-0000-000000000004'::uuid;
begin
  -- Three users: A (owner), B (workspace member), C (outsider)
  perform tests.make_user(v_user_a, 'user-a-follower@test.example');
  perform tests.make_user(v_user_b, 'user-b-follower@test.example');
  perform tests.make_user(v_user_c, 'user-c-follower@test.example');

  -- Workspace with owner A and member B. C is not a member.
  perform tests.seed_workspace_with_roles(
    v_ws_id,
    jsonb_build_object(
      v_user_a::text, 'owner',
      v_user_b::text, 'member'
    )
  );

  -- Public board (A and B have implicit access via workspace membership).
  perform tests.seed_board(v_board, v_ws_id, false);

  -- Group + task on the board.
  perform tests.seed_group(v_group, v_board);
  perform tests.seed_task(v_task, v_group, v_board);

  -- User A follows the task (seed via service-role).
  insert into public.task_follower (task_id, user_id)
  values (v_task, v_user_a);
end $$;

-- ============================================================
-- Test 1: User A CAN SELECT their own task_follower rows.
-- ============================================================

select tests.set_jwt_user('dd000000-0000-0000-0000-000000000001'::uuid);

select is(
  (select count(*)::int
     from public.task_follower
    where user_id = 'dd000000-0000-0000-0000-000000000001'::uuid),
  1,
  'User A can SELECT their own task_follower rows'
);

-- ============================================================
-- Test 2: Board member (User B) CAN SELECT task_follower rows.
-- User B is a workspace member → role_for_board returns their role.
-- ============================================================

select tests.set_jwt_user('dd000000-0000-0000-0000-000000000002'::uuid);

select is(
  (select count(*)::int
     from public.task_follower
    where task_id = 'ee000000-0000-0000-0000-000000000004'::uuid),
  1,
  'Board member (User B) can SELECT task_follower rows for tasks on their board'
);

-- ============================================================
-- Test 3: Outsider (User C) CANNOT SELECT task_follower rows.
-- C has no workspace or board membership → role_for_board returns null.
-- The own-user_id guard also fails (no rows owned by C).
-- ============================================================

select tests.set_jwt_user('dd000000-0000-0000-0000-000000000003'::uuid);

select is(
  (select count(*)::int
     from public.task_follower
    where task_id = 'ee000000-0000-0000-0000-000000000004'::uuid),
  0,
  'Outsider (User C) cannot SELECT task_follower rows (0 rows due to RLS)'
);

-- ============================================================
-- Test 4: User A CAN INSERT a task_follower row with their own user_id.
-- (User A is not already following a second task — we just confirm INSERT works.)
-- ============================================================

select tests.reset_to_service_role();

-- Create a second task for User A to follow.
do $$
declare
  v_user_a  uuid := 'dd000000-0000-0000-0000-000000000001'::uuid;
  v_group   uuid := 'ee000000-0000-0000-0000-000000000003'::uuid;
  v_board   uuid := 'ee000000-0000-0000-0000-000000000002'::uuid;
  v_task2   uuid := 'ee000000-0000-0000-0000-000000000005'::uuid;
begin
  perform tests.seed_task(v_task2, v_group, v_board);
end $$;

select tests.set_jwt_user('dd000000-0000-0000-0000-000000000001'::uuid);

insert into public.task_follower (task_id, user_id)
values (
  'ee000000-0000-0000-0000-000000000005'::uuid,
  'dd000000-0000-0000-0000-000000000001'::uuid
);

select is(
  (select count(*)::int
     from public.task_follower
    where task_id = 'ee000000-0000-0000-0000-000000000005'::uuid
      and user_id = 'dd000000-0000-0000-0000-000000000001'::uuid),
  1,
  'User A can INSERT a task_follower row with their own user_id'
);

-- ============================================================
-- Test 5: User A CANNOT INSERT a task_follower row with another user_id.
-- The WITH CHECK (user_id = auth.uid()) on the write policy blocks this.
-- ============================================================

select throws_ok(
  $$
    insert into public.task_follower (task_id, user_id)
    values (
      'ee000000-0000-0000-0000-000000000004'::uuid,
      'dd000000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  '42501',
  null,
  'User A cannot INSERT a task_follower row with another user''s user_id (WITH CHECK violation)'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
