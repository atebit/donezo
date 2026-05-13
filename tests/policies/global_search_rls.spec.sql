-- pgTAP spec: global_search RLS enforcement.
--
-- The function uses SECURITY INVOKER, so RLS on the underlying tables
-- (board, task) still applies to the calling user's session.
--
-- Test plan:
--   1. User A creates a workspace and a board with a task.
--   2. User B (non-member) calls global_search → expects 0 rows.
--   3. User B is added to workspace as member → expects the task to appear.

begin;

select plan(4);

-- -----------------------------------------------------------------------
-- Setup
-- -----------------------------------------------------------------------
-- Create users by inserting into auth.users directly (test env convention).
insert into auth.users (id, email)
  values
    ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'user-a@test.example'),
    ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'user-b@test.example');

-- Profiles are auto-created via trigger, but in test env we may need manual insert.
insert into public.profile (id, email)
  values
    ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'user-a@test.example'),
    ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'user-b@test.example')
  on conflict (id) do nothing;

-- User A creates a workspace.
insert into public.workspace (id, name, slug, created_by)
  values ('cccccccc-0000-4000-8000-000000000001'::uuid, 'Test WS', 'test-ws-rls', 'aaaaaaaa-0000-4000-8000-000000000001'::uuid);

insert into public.workspace_member (workspace_id, user_id, role)
  values ('cccccccc-0000-4000-8000-000000000001'::uuid, 'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'owner');

-- User A creates a board and a group.
insert into public.board (id, workspace_id, name, created_by)
  values ('dddddddd-0000-4000-8000-000000000001'::uuid, 'cccccccc-0000-4000-8000-000000000001'::uuid, 'Alpha Board', 'aaaaaaaa-0000-4000-8000-000000000001'::uuid);

insert into public."group" (id, board_id, name, position)
  values ('eeeeeeee-0000-4000-8000-000000000001'::uuid, 'dddddddd-0000-4000-8000-000000000001'::uuid, 'To Do', 0);

-- User A creates a task titled "searchable task".
insert into public.task (id, board_id, group_id, title, position, created_by)
  values ('ffffffff-0000-4000-8000-000000000001'::uuid, 'dddddddd-0000-4000-8000-000000000001'::uuid, 'eeeeeeee-0000-4000-8000-000000000001'::uuid, 'searchable task', 0, 'aaaaaaaa-0000-4000-8000-000000000001'::uuid);

-- -----------------------------------------------------------------------
-- Test 1: User B (non-member) sees 0 rows from global_search.
-- -----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000001')::text, true);

select is(
  (select count(*)::int from public.global_search('cccccccc-0000-4000-8000-000000000001'::uuid, 'searchable')),
  0,
  'non-member user B sees 0 results from global_search'
);

-- -----------------------------------------------------------------------
-- Test 2: User B sees 0 board rows too.
-- -----------------------------------------------------------------------
select is(
  (select count(*)::int from public.global_search('cccccccc-0000-4000-8000-000000000001'::uuid, 'Alpha')),
  0,
  'non-member user B sees 0 boards from global_search'
);

-- -----------------------------------------------------------------------
-- Add User B to the workspace as a member.
-- -----------------------------------------------------------------------
reset role;
insert into public.workspace_member (workspace_id, user_id, role)
  values ('cccccccc-0000-4000-8000-000000000001'::uuid, 'bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'member');

-- -----------------------------------------------------------------------
-- Test 3: User B (now member) can see the task.
-- -----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000001')::text, true);

select ok(
  (select count(*)::int from public.global_search('cccccccc-0000-4000-8000-000000000001'::uuid, 'searchable')) >= 1,
  'workspace member user B can see the task via global_search'
);

-- -----------------------------------------------------------------------
-- Test 4: The result kind is 'task' and title is correct.
-- -----------------------------------------------------------------------
select is(
  (select title from public.global_search('cccccccc-0000-4000-8000-000000000001'::uuid, 'searchable') where kind = 'task' limit 1),
  'searchable task',
  'global_search returns the correct task title'
);

select * from finish();
rollback;
