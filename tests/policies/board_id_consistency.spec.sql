-- ============================================================
-- tests/policies/board_id_consistency.spec.sql
-- pgTAP assertions for the Epic 08 S0 board_id consistency triggers.
--
-- Assertion count: 2
--
-- Coverage targets:
--   - Inserting a cell with the wrong board_id results in the row
--     landing with the task's board_id (trigger overwrites).
--   - Inserting a comment with the wrong board_id results in the
--     row landing with the task's board_id (trigger overwrites).
-- ============================================================

begin;

select plan(2);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
begin
  -- Users
  perform tests.make_user('a8000000-0000-0000-0000-000000000001'::uuid, 'owner@test8.example');

  -- Workspace + board
  perform tests.seed_workspace_with_roles(
    'b8000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object('a8000000-0000-0000-0000-000000000001', 'owner')
  );

  perform tests.seed_board(
    'c8000000-0000-0000-0000-000000000001'::uuid,
    'b8000000-0000-0000-0000-000000000001'::uuid,
    false
  );

  -- A second board (used as the "wrong" board_id in insert payloads)
  perform tests.seed_board(
    'c8000000-0000-0000-0000-000000000002'::uuid,
    'b8000000-0000-0000-0000-000000000001'::uuid,
    false
  );

  -- Group on board 1
  perform tests.seed_group(
    'd8000000-0000-0000-0000-000000000001'::uuid,
    'c8000000-0000-0000-0000-000000000001'::uuid
  );

  -- Task on board 1 (task.board_id = c8...001)
  perform tests.seed_task(
    'e8000000-0000-0000-0000-000000000001'::uuid,
    'd8000000-0000-0000-0000-000000000001'::uuid,
    'c8000000-0000-0000-0000-000000000001'::uuid
  );

  -- Column on board 1 (for the cell insert)
  perform tests.seed_column(
    'f8000000-0000-0000-0000-000000000001'::uuid,
    'c8000000-0000-0000-0000-000000000001'::uuid
  );
end $$;

-- ============================================================
-- Test 1: cell trigger overwrites wrong board_id on insert.
--
-- We insert a cell providing board_id = c8...002 (board 2),
-- but the task belongs to c8...001 (board 1). The trigger
-- cell_board_id_consistency must set board_id to c8...001.
-- ============================================================

insert into public.cell (task_id, column_id, board_id, text_value)
values (
  'e8000000-0000-0000-0000-000000000001'::uuid,
  'f8000000-0000-0000-0000-000000000001'::uuid,
  'c8000000-0000-0000-0000-000000000002'::uuid,  -- intentionally wrong
  'trigger test value'
);

select is(
  (select board_id::text
     from public.cell
    where task_id   = 'e8000000-0000-0000-0000-000000000001'
      and column_id = 'f8000000-0000-0000-0000-000000000001'),
  'c8000000-0000-0000-0000-000000000001',
  'cell_board_id_consistency trigger overwrites wrong board_id with task''s board_id on insert'
);

-- ============================================================
-- Test 2: comment trigger overwrites wrong board_id on insert.
--
-- We insert a comment providing board_id = c8...002 (board 2),
-- but the task belongs to c8...001 (board 1). The trigger
-- comment_board_id_consistency must set board_id to c8...001.
-- ============================================================

insert into public.comment (id, task_id, author_id, board_id, body, body_text)
values (
  'g8000000-0000-0000-0000-000000000001'::uuid,
  'e8000000-0000-0000-0000-000000000001'::uuid,
  'a8000000-0000-0000-0000-000000000001'::uuid,
  'c8000000-0000-0000-0000-000000000002'::uuid,  -- intentionally wrong
  '{"type":"doc","content":[]}'::jsonb,
  'trigger test comment'
);

select is(
  (select board_id::text
     from public.comment
    where id = 'g8000000-0000-0000-0000-000000000001'),
  'c8000000-0000-0000-0000-000000000001',
  'comment_board_id_consistency trigger overwrites wrong board_id with task''s board_id on insert'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
