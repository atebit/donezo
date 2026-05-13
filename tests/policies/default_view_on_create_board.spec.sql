-- pgTAP spec: create_board inserts a default shared "Main table" view.
--
-- Test plan:
--   1. Call create_board as a workspace member.
--   2. Assert exactly one view row exists for the new board.
--   3. Assert that view has is_shared=true, name='Main table', kind='table', position=0.

begin;

select plan(5);

-- -----------------------------------------------------------------------
-- Setup
-- -----------------------------------------------------------------------
insert into auth.users (id, email)
  values ('11111111-0000-4000-8000-000000000001'::uuid, 'board-creator@test.example');

insert into public.profile (id, email)
  values ('11111111-0000-4000-8000-000000000001'::uuid, 'board-creator@test.example')
  on conflict (id) do nothing;

insert into public.workspace (id, name, slug, created_by)
  values ('22222222-0000-4000-8000-000000000001'::uuid, 'View Test WS', 'view-test-ws', '11111111-0000-4000-8000-000000000001'::uuid);

insert into public.workspace_member (workspace_id, user_id, role)
  values ('22222222-0000-4000-8000-000000000001'::uuid, '11111111-0000-4000-8000-000000000001'::uuid, 'member');

-- -----------------------------------------------------------------------
-- Call create_board as user 11111111.
-- -----------------------------------------------------------------------
set local "request.jwt.claims" to json_build_object('sub', '11111111-0000-4000-8000-000000000001')::text;

-- create_board is SECURITY DEFINER, so auth.uid() reads from request.jwt.claims.
select lives_ok(
  $$ select public.create_board('22222222-0000-4000-8000-000000000001'::uuid, 'My New Board', false) $$,
  'create_board executes without error'
);

-- Get the id of the board that was just created.
do $$
declare
  v_board_id uuid;
begin
  select id into v_board_id from public.board
    where workspace_id = '22222222-0000-4000-8000-000000000001'::uuid
      and name = 'My New Board'
    limit 1;

  -- Store for later tests.
  perform set_config('test.board_id', v_board_id::text, true);
end $$;

-- -----------------------------------------------------------------------
-- Test 2: Exactly 1 view row for the new board.
-- -----------------------------------------------------------------------
select is(
  (select count(*)::int from public.view
    where board_id = current_setting('test.board_id')::uuid),
  1,
  'exactly one view row created for the new board'
);

-- -----------------------------------------------------------------------
-- Test 3: View is shared.
-- -----------------------------------------------------------------------
select is(
  (select is_shared from public.view
    where board_id = current_setting('test.board_id')::uuid limit 1),
  true,
  'the default view is is_shared = true'
);

-- -----------------------------------------------------------------------
-- Test 4: View name is "Main table".
-- -----------------------------------------------------------------------
select is(
  (select name from public.view
    where board_id = current_setting('test.board_id')::uuid limit 1),
  'Main table',
  'the default view name is ''Main table'''
);

-- -----------------------------------------------------------------------
-- Test 5: View kind='table', position=0, owner_id=null.
-- -----------------------------------------------------------------------
select is(
  (select row(kind, position, owner_id)::text from public.view
    where board_id = current_setting('test.board_id')::uuid limit 1),
  row('table', 0, null)::text,
  'default view has kind=table, position=0, owner_id=null'
);

select * from finish();
rollback;
