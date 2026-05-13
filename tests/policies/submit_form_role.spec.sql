-- ============================================================
-- tests/policies/submit_form_role.spec.sql
-- pgTAP assertions for submitForm role behavior (Epic 12, Slice F).
--
-- Assertion count: 5
--
-- Q24 resolution (orchestrator decision, autonomous run 2026-05-12):
--   Option B selected — the application-level check in submitForm is `member`
--   (matching Epic 04's existing task_insert RLS, which requires role_rank >= 2).
--
--   The assertions below reflect the agreed behavior and the actual runtime:
--     - Member (role_rank >= 2) CAN insert a task (positive case).
--     - Viewer (role_rank = 1) CANNOT insert a task (negative case; 42501).
--     - Non-member CANNOT insert a task (negative case; 42501).
--
--   Viewer-form-submit (Option A — new RLS policy permitting form-mediated
--   viewer inserts) is deferred to a later epic if the product wants it.
--
-- UUID prefix: af... for users, bf... for workspaces, cf... for boards, etc.
-- ============================================================

begin;

select plan(5);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
begin
  -- Users: owner, member, viewer, outsider
  perform tests.make_user('af000000-0000-0000-0000-000000000001'::uuid, 'ownerf@test.example');
  perform tests.make_user('af000000-0000-0000-0000-000000000002'::uuid, 'memberf@test.example');
  perform tests.make_user('af000000-0000-0000-0000-000000000003'::uuid, 'viewerf@test.example');
  perform tests.make_user('af000000-0000-0000-0000-000000000004'::uuid, 'outsiderf@test.example');

  -- Workspace with owner, member, and viewer roles.
  perform tests.seed_workspace_with_roles(
    'bf000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'af000000-0000-0000-0000-000000000001', 'owner',
      'af000000-0000-0000-0000-000000000002', 'member',
      'af000000-0000-0000-0000-000000000003', 'viewer'
    )
  );

  -- Public board (workspace members have implicit access).
  perform tests.seed_board(
    'cf000000-0000-0000-0000-000000000001'::uuid,
    'bf000000-0000-0000-0000-000000000001'::uuid,
    false  -- not private
  );

  -- Group on the board.
  perform tests.seed_group(
    'df000000-0000-0000-0000-000000000001'::uuid,
    'cf000000-0000-0000-0000-000000000001'::uuid
  );
end $$;

-- ============================================================
-- Test 1: Member (role_rank >= 2) CAN insert a task.
-- This is the positive case for form submission from a member.
-- ============================================================

select tests.set_jwt_user('af000000-0000-0000-0000-000000000002'::uuid);

select lives_ok(
  $$
    insert into public.task (group_id, board_id, title, position)
    values (
      'df000000-0000-0000-0000-000000000001'::uuid,
      'cf000000-0000-0000-0000-000000000001'::uuid,
      'Form Submission Task',
      1.0
    )
  $$,
  'member can INSERT task (form submission positive case)'
);

-- ============================================================
-- Test 2: Owner CAN insert a task.
-- ============================================================

select tests.set_jwt_user('af000000-0000-0000-0000-000000000001'::uuid);

select lives_ok(
  $$
    insert into public.task (group_id, board_id, title, position)
    values (
      'df000000-0000-0000-0000-000000000001'::uuid,
      'cf000000-0000-0000-0000-000000000001'::uuid,
      'Owner Form Submission',
      2.0
    )
  $$,
  'owner can INSERT task'
);

-- ============================================================
-- Test 3: Viewer CANNOT insert a task.
-- task_insert RLS (Epic 04) requires role_rank >= member, and submitForm's
-- application check matches at 'member' (Q24 resolution, Option B).
-- ============================================================

select tests.set_jwt_user('af000000-0000-0000-0000-000000000003'::uuid);

select throws_ok(
  $$
    insert into public.task (group_id, board_id, title, position)
    values (
      'df000000-0000-0000-0000-000000000001'::uuid,
      'cf000000-0000-0000-0000-000000000001'::uuid,
      'Viewer Form Submission',
      3.0
    )
  $$,
  '42501',
  null,
  'viewer CANNOT INSERT task — task_insert RLS and submitForm both require member'
);

-- ============================================================
-- Test 4: Non-member (outsider) CANNOT insert a task.
-- ============================================================

select tests.set_jwt_user('af000000-0000-0000-0000-000000000004'::uuid);

select throws_ok(
  $$
    insert into public.task (group_id, board_id, title, position)
    values (
      'df000000-0000-0000-0000-000000000001'::uuid,
      'cf000000-0000-0000-0000-000000000001'::uuid,
      'Outsider Form Submission',
      4.0
    )
  $$,
  '42501',
  null,
  'non-member (outsider) CANNOT INSERT task (42501)'
);

-- ============================================================
-- Test 5: Member can SELECT the task they inserted (round-trip read).
-- ============================================================

select tests.set_jwt_user('af000000-0000-0000-0000-000000000002'::uuid);

select is(
  (select count(*)::int
     from public.task
    where group_id = 'df000000-0000-0000-0000-000000000001'::uuid
      and title = 'Form Submission Task'),
  1,
  'member can SELECT the task they inserted via form'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
