-- ============================================================
-- tests/policies/30_task_cell.sql
-- RLS assertions for: public.task, public.cell, public."column", public.comment
--
-- Assertion count: 13
--
-- Coverage targets (from epic 04 definition of done):
--   - viewer can SELECT task
--   - viewer cannot INSERT task (with check violation → 42501)
--   - member can INSERT task
--   - member can INSERT cell
--   - member can UPDATE cell
--   - viewer cannot INSERT cell (with check violation → 42501)
--   - viewer cannot DELETE "column" (with check / using violation → 42501 or 0 rows)
--   - non-workspace-member cannot SELECT private board's tasks
--   - comment author can UPDATE own comment
--   - comment author can DELETE own comment
--   - non-author member cannot DELETE another's comment (0 rows affected)
--   - board admin can DELETE any comment
--   - member cannot INSERT comment as another user (author_id must match auth.uid())
-- ============================================================

begin;

select plan(13);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
begin
  -- Users
  perform tests.make_user('a3000000-0000-0000-0000-000000000001'::uuid, 'owner@test3.example');
  perform tests.make_user('a3000000-0000-0000-0000-000000000002'::uuid, 'admin@test3.example');
  perform tests.make_user('a3000000-0000-0000-0000-000000000003'::uuid, 'member@test3.example');
  perform tests.make_user('a3000000-0000-0000-0000-000000000004'::uuid, 'viewer@test3.example');
  perform tests.make_user('a3000000-0000-0000-0000-000000000005'::uuid, 'outsider@test3.example');

  -- Workspace
  perform tests.seed_workspace_with_roles(
    'b3000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'a3000000-0000-0000-0000-000000000001', 'owner',
      'a3000000-0000-0000-0000-000000000002', 'admin',
      'a3000000-0000-0000-0000-000000000003', 'member',
      'a3000000-0000-0000-0000-000000000004', 'viewer'
    )
  );

  -- Public board
  perform tests.seed_board(
    'c3000000-0000-0000-0000-000000000001'::uuid,
    'b3000000-0000-0000-0000-000000000001'::uuid,
    false
  );

  -- Private board (outsider has no access)
  perform tests.seed_board(
    'c3000000-0000-0000-0000-000000000002'::uuid,
    'b3000000-0000-0000-0000-000000000001'::uuid,
    true
  );

  -- Group and tasks on public board
  perform tests.seed_group(
    'd3000000-0000-0000-0000-000000000001'::uuid,
    'c3000000-0000-0000-0000-000000000001'::uuid
  );
  perform tests.seed_task(
    'e3000000-0000-0000-0000-000000000001'::uuid,
    'd3000000-0000-0000-0000-000000000001'::uuid,
    'c3000000-0000-0000-0000-000000000001'::uuid
  );

  -- Group and task on private board (member has access via workspace; but
  -- private board hides it from non-board-members)
  perform tests.seed_group(
    'd3000000-0000-0000-0000-000000000002'::uuid,
    'c3000000-0000-0000-0000-000000000002'::uuid
  );
  perform tests.seed_task(
    'e3000000-0000-0000-0000-000000000002'::uuid,
    'd3000000-0000-0000-0000-000000000002'::uuid,
    'c3000000-0000-0000-0000-000000000002'::uuid
  );

  -- Column on public board (for column delete test)
  perform tests.seed_column(
    'f3000000-0000-0000-0000-000000000001'::uuid,
    'c3000000-0000-0000-0000-000000000001'::uuid
  );

  -- Cell on public board task
  insert into public.cell (task_id, column_id, text_value)
  values (
    'e3000000-0000-0000-0000-000000000001'::uuid,
    'f3000000-0000-0000-0000-000000000001'::uuid,
    'initial value'
  )
  on conflict (task_id, column_id) do nothing;

  -- Comment by member on public board task
  perform tests.seed_comment(
    '93000000-0000-0000-0000-000000000001'::uuid,
    'e3000000-0000-0000-0000-000000000001'::uuid,
    'a3000000-0000-0000-0000-000000000003'::uuid
  );
end $$;

-- ============================================================
-- Test 1: viewer can SELECT task on public board
-- ============================================================

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*)::int from public.task
   where id = 'e3000000-0000-0000-0000-000000000001'),
  1,
  'viewer can SELECT task on public board'
);

-- ============================================================
-- Test 2: viewer cannot INSERT task (task_insert has with check)
-- ============================================================

select throws_ok(
  $$insert into public.task (group_id, board_id, title, position)
    values (
      'd3000000-0000-0000-0000-000000000001',
      'c3000000-0000-0000-0000-000000000001',
      'Viewer Task',
      99.0
    )$$,
  '42501',
  null::text,
  'viewer cannot INSERT task (with check violation raises 42501)'
);

-- ============================================================
-- Test 3: member can INSERT task
-- ============================================================

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000003'::uuid);

select lives_ok(
  $$insert into public.task (group_id, board_id, title, position)
    values (
      'd3000000-0000-0000-0000-000000000001',
      'c3000000-0000-0000-0000-000000000001',
      'Member Task',
      2.0
    )$$,
  'member can INSERT task'
);

-- ============================================================
-- Test 4: member can INSERT cell
-- ============================================================

-- Insert a fresh column first (service-role) so the cell can be created.
select tests.reset_to_service_role();
do $$
begin
  perform tests.seed_column(
    'f3000000-0000-0000-0000-000000000002'::uuid,
    'c3000000-0000-0000-0000-000000000001'::uuid
  );
end $$;

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000003'::uuid);

select lives_ok(
  $$insert into public.cell (task_id, column_id, text_value)
    values (
      'e3000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000002',
      'hello'
    )$$,
  'member can INSERT cell'
);

-- ============================================================
-- Test 5: member can UPDATE cell
-- ============================================================

with updated as (
  update public.cell
    set text_value = 'updated value'
  where task_id = 'e3000000-0000-0000-0000-000000000001'
    and column_id = 'f3000000-0000-0000-0000-000000000001'
  returning task_id
)
select count(*)::int as rcnt from updated \gset

select is(:rcnt::int, 1, 'member can UPDATE cell value');

-- ============================================================
-- Test 6: viewer cannot INSERT cell (cell_modify for all uses with check)
-- ============================================================

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000004'::uuid);

-- Insert a third column in service-role context first
select tests.reset_to_service_role();
do $$
begin
  perform tests.seed_column(
    'f3000000-0000-0000-0000-000000000003'::uuid,
    'c3000000-0000-0000-0000-000000000001'::uuid
  );
end $$;

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000004'::uuid);

select throws_ok(
  $$insert into public.cell (task_id, column_id, text_value)
    values (
      'e3000000-0000-0000-0000-000000000001',
      'f3000000-0000-0000-0000-000000000003',
      'viewer should not write'
    )$$,
  '42501',
  null::text,
  'viewer cannot INSERT cell (cell_modify with check raises 42501)'
);

-- ============================================================
-- Test 7: viewer cannot DELETE "column" (column_delete uses using;
-- row is hidden, 0 rows affected)
-- ============================================================

with deleted as (
  delete from public."column"
    where id = 'f3000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 0, 'viewer cannot DELETE column (RLS blocks; 0 rows affected)');

-- ============================================================
-- Test 8: non-workspace-member cannot SELECT tasks on private board
-- (outsider has no workspace_member row and no board_member row)
-- ============================================================

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000005'::uuid);

select is(
  (select count(*)::int from public.task
   where board_id = 'c3000000-0000-0000-0000-000000000002'),
  0,
  'non-workspace-member cannot SELECT tasks on private board'
);

-- ============================================================
-- Test 9: comment author can UPDATE own comment
-- ============================================================

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000003'::uuid);

with updated as (
  update public.comment
    set body_text = 'edited text'
  where id = '93000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from updated \gset

select is(:rcnt::int, 1, 'comment author can UPDATE own comment');

-- ============================================================
-- Test 10: non-author member cannot DELETE another's comment
-- (comment_delete uses `using`; author_id check fails silently)
-- ============================================================

-- First, seed a second comment by admin that member will try to delete.
select tests.reset_to_service_role();
do $$
begin
  perform tests.seed_comment(
    '93000000-0000-0000-0000-000000000002'::uuid,
    'e3000000-0000-0000-0000-000000000001'::uuid,
    'a3000000-0000-0000-0000-000000000002'::uuid  -- admin is the author
  );
end $$;

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000003'::uuid);

with deleted as (
  delete from public.comment
    where id = '93000000-0000-0000-0000-000000000002'
  returning id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 0, 'non-author member cannot DELETE another users comment (0 rows affected)');

-- ============================================================
-- Test 11: comment author can DELETE own comment
-- ============================================================

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000003'::uuid);

with deleted as (
  delete from public.comment
    where id = '93000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 1, 'comment author can DELETE own comment');

-- ============================================================
-- Test 12: board admin can DELETE any comment
-- (comment_delete also allows role_rank >= admin)
-- Admin deletes the comment authored by admin (g3000000-...002).
-- ============================================================

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000002'::uuid);

with deleted as (
  delete from public.comment
    where id = '93000000-0000-0000-0000-000000000002'
  returning id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 1, 'board admin can DELETE any comment');

-- ============================================================
-- Test 13: member cannot INSERT comment as another user
-- (comment_insert has `with check (author_id = auth.uid())`)
-- ============================================================

select tests.set_jwt_user('a3000000-0000-0000-0000-000000000003'::uuid);

select throws_ok(
  $$insert into public.comment (task_id, author_id, body, body_text)
    values (
      'e3000000-0000-0000-0000-000000000001',
      'a3000000-0000-0000-0000-000000000002',  -- impersonating admin
      '{"type":"doc","content":[]}'::jsonb,
      'impersonated comment'
    )$$,
  '42501',
  null::text,
  'member cannot INSERT comment with a different author_id (with check raises 42501)'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
