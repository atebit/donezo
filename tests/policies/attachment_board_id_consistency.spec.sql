-- ============================================================
-- tests/policies/attachment_board_id_consistency.spec.sql
-- pgTAP assertions for the attachment_board_id_consistency trigger (Epic 10 Slice A).
--
-- Assertion count: 2
--
-- Coverage targets:
--   1. Inserting an attachment with the wrong board_id results in the trigger
--      overwriting it with the task's actual board_id.
--   2. Updating an attachment's task_id rederives the correct board_id.
--
-- UUID prefix: a02... for users, b02... for workspaces, c02... for boards,
--              d02... for groups, e02... for tasks, f02... for attachments.
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
  perform tests.make_user('a0200000-0000-0000-0000-000000000001'::uuid, 'owner10c@test.example');

  -- Workspace + owner as member
  perform tests.seed_workspace_with_roles(
    'b0200000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object('a0200000-0000-0000-0000-000000000001', 'owner')
  );

  -- Board 1 — the task's real board
  perform tests.seed_board(
    'c0200000-0000-0000-0000-000000000001'::uuid,
    'b0200000-0000-0000-0000-000000000001'::uuid,
    false
  );

  -- Board 2 — the "wrong" board_id we will supply on insert
  perform tests.seed_board(
    'c0200000-0000-0000-0000-000000000002'::uuid,
    'b0200000-0000-0000-0000-000000000001'::uuid,
    false
  );

  -- Group + task on board 1
  perform tests.seed_group(
    'd0200000-0000-0000-0000-000000000001'::uuid,
    'c0200000-0000-0000-0000-000000000001'::uuid
  );
  perform tests.seed_task(
    'e0200000-0000-0000-0000-000000000001'::uuid,
    'd0200000-0000-0000-0000-000000000001'::uuid,
    'c0200000-0000-0000-0000-000000000001'::uuid
  );

  -- A second task on board 2 (for the update test)
  perform tests.seed_group(
    'd0200000-0000-0000-0000-000000000002'::uuid,
    'c0200000-0000-0000-0000-000000000002'::uuid
  );
  perform tests.seed_task(
    'e0200000-0000-0000-0000-000000000002'::uuid,
    'd0200000-0000-0000-0000-000000000002'::uuid,
    'c0200000-0000-0000-0000-000000000002'::uuid
  );
end $$;

-- ============================================================
-- Test 1: Trigger overwrites wrong board_id on INSERT.
--
-- We insert an attachment providing board_id = c02...002 (board 2),
-- but the task belongs to c02...001 (board 1).
-- The trigger attachment_board_id_consistency must set board_id to c02...001.
-- ============================================================

insert into public.attachment (
  id, task_id, uploader_id, storage_path, mime_type, size_bytes, filename, is_uploaded, board_id
) values (
  'f0200000-0000-0000-0000-000000000001'::uuid,
  'e0200000-0000-0000-0000-000000000001'::uuid,
  'a0200000-0000-0000-0000-000000000001'::uuid,
  'c0200000-0000-0000-0000-000000000001/e02/f02/file.png',
  'image/png',
  512,
  'file.png',
  true,
  'c0200000-0000-0000-0000-000000000002'::uuid  -- intentionally wrong board_id
);

select is(
  (select board_id::text
     from public.attachment
    where id = 'f0200000-0000-0000-0000-000000000001'::uuid),
  'c0200000-0000-0000-0000-000000000001',
  'attachment_board_id_consistency trigger overwrites wrong board_id with task''s board_id on insert'
);

-- ============================================================
-- Test 2: Trigger rederives board_id when task_id is updated.
--
-- We move the attachment from task on board 1 to task on board 2.
-- After the update, board_id must reflect board 2.
-- ============================================================

update public.attachment
   set task_id = 'e0200000-0000-0000-0000-000000000002'::uuid
 where id = 'f0200000-0000-0000-0000-000000000001'::uuid;

select is(
  (select board_id::text
     from public.attachment
    where id = 'f0200000-0000-0000-0000-000000000001'::uuid),
  'c0200000-0000-0000-0000-000000000002',
  'attachment_board_id_consistency trigger rederives board_id when task_id is updated'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
