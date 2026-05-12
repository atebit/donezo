-- ============================================================
-- tests/policies/attachment_orphan_cleanup.spec.sql
-- pgTAP assertions for public.purge_orphan_attachments() (Epic 10 Slice A).
--
-- Assertion count: 4
--
-- Coverage targets:
--   1. purge_orphan_attachments() returns 0 when there are no orphan rows.
--   2. purge_orphan_attachments() does NOT delete rows where is_uploaded = true
--      (regardless of age).
--   3. purge_orphan_attachments() does NOT delete pending rows created within the
--      last hour (too recent to purge).
--   4. purge_orphan_attachments() DOES delete pending rows older than 1 hour
--      and returns the correct count.
--
-- UUID prefix: a03... for users, b03... for workspaces, c03... for boards,
--              d03... for groups, e03... for tasks, f03... for attachments.
-- ============================================================

begin;

select plan(4);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
begin
  -- User + workspace + board + group + task (minimal required for FK constraints)
  perform tests.make_user('a0300000-0000-0000-0000-000000000001'::uuid, 'owner10o@test.example');

  perform tests.seed_workspace_with_roles(
    'b0300000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object('a0300000-0000-0000-0000-000000000001', 'owner')
  );

  perform tests.seed_board(
    'c0300000-0000-0000-0000-000000000001'::uuid,
    'b0300000-0000-0000-0000-000000000001'::uuid,
    false
  );

  perform tests.seed_group(
    'd0300000-0000-0000-0000-000000000001'::uuid,
    'c0300000-0000-0000-0000-000000000001'::uuid
  );

  perform tests.seed_task(
    'e0300000-0000-0000-0000-000000000001'::uuid,
    'd0300000-0000-0000-0000-000000000001'::uuid,
    'c0300000-0000-0000-0000-000000000001'::uuid
  );
end $$;

-- ============================================================
-- Test 1: purge_orphan_attachments() returns 0 when no orphan rows exist.
-- ============================================================

select is(
  public.purge_orphan_attachments(),
  0,
  'purge_orphan_attachments() returns 0 when there are no pending rows'
);

-- ============================================================
-- Test 2: Uploaded rows are NOT deleted regardless of age.
-- Insert an uploaded row with a very old created_at; it must survive.
-- ============================================================

insert into public.attachment (
  id, task_id, uploader_id, storage_path, mime_type, size_bytes, filename, is_uploaded, board_id, created_at
) values (
  'f0300000-0000-0000-0000-000000000001'::uuid,
  'e0300000-0000-0000-0000-000000000001'::uuid,
  'a0300000-0000-0000-0000-000000000001'::uuid,
  'c03/e03/f03/uploaded_old.png',
  'image/png',
  256,
  'uploaded_old.png',
  true,                                          -- is_uploaded = true
  'c0300000-0000-0000-0000-000000000001'::uuid,
  now() - interval '2 hours'                    -- old, but uploaded
);

select is(
  public.purge_orphan_attachments(),
  0,
  'purge_orphan_attachments() does NOT delete is_uploaded=true rows regardless of age'
);

-- Verify the row is still there
-- (implicitly verified by the return value above being 0)

-- ============================================================
-- Test 3: Recent pending rows (< 1 hour old) are NOT deleted.
-- ============================================================

insert into public.attachment (
  id, task_id, uploader_id, storage_path, mime_type, size_bytes, filename, is_uploaded, board_id, created_at
) values (
  'f0300000-0000-0000-0000-000000000002'::uuid,
  'e0300000-0000-0000-0000-000000000001'::uuid,
  'a0300000-0000-0000-0000-000000000001'::uuid,
  'c03/e03/f03/recent_pending.png',
  'image/png',
  256,
  'recent_pending.png',
  false,                                         -- is_uploaded = false (pending)
  'c0300000-0000-0000-0000-000000000001'::uuid,
  now() - interval '30 minutes'                 -- recent; within the 1-hour window
);

select is(
  public.purge_orphan_attachments(),
  0,
  'purge_orphan_attachments() does NOT delete pending rows created within the last hour'
);

-- ============================================================
-- Test 4: Stale pending rows (> 1 hour old) ARE deleted; correct count returned.
-- Insert two old pending rows; verify purge returns 2.
-- ============================================================

insert into public.attachment (
  id, task_id, uploader_id, storage_path, mime_type, size_bytes, filename, is_uploaded, board_id, created_at
) values
(
  'f0300000-0000-0000-0000-000000000003'::uuid,
  'e0300000-0000-0000-0000-000000000001'::uuid,
  'a0300000-0000-0000-0000-000000000001'::uuid,
  'c03/e03/f03/stale_pending_1.png',
  'image/png',
  256,
  'stale_pending_1.png',
  false,                                         -- is_uploaded = false
  'c0300000-0000-0000-0000-000000000001'::uuid,
  now() - interval '2 hours'                    -- old enough to purge
),
(
  'f0300000-0000-0000-0000-000000000004'::uuid,
  'e0300000-0000-0000-0000-000000000001'::uuid,
  'a0300000-0000-0000-0000-000000000001'::uuid,
  'c03/e03/f03/stale_pending_2.png',
  'image/png',
  256,
  'stale_pending_2.png',
  false,                                         -- is_uploaded = false
  'c0300000-0000-0000-0000-000000000001'::uuid,
  now() - interval '90 minutes'                 -- old enough to purge
);

select is(
  public.purge_orphan_attachments(),
  2,
  'purge_orphan_attachments() deletes stale pending rows and returns correct count (2)'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
