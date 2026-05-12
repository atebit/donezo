-- ============================================================
-- tests/policies/attachment_storage_rls.spec.sql
-- pgTAP assertions for storage.objects RLS policies (Epic 10 Slice A).
--
-- Assertion count: 12
--
-- Coverage targets:
--   1.  Sanity: storage.foldername returns expected array segments.
--   2.  Viewer of board X CAN select an existing storage object for that board.
--   3.  Non-member CANNOT select a storage object for board X (0 rows).
--   4.  Member CAN insert a storage object at the board path.
--   5.  Viewer CANNOT insert a storage object (42501 — with check fails).
--   6.  Non-member CANNOT insert a storage object (42501 — with check fails).
--   7.  Uploader CAN delete their own storage object.
--   8.  Different member (not uploader, not admin) CANNOT delete uploader's object (0 rows).
--   9.  Admin CAN delete any member's storage object.
--   10. Sanity: avatar upload policy still works — user CAN insert to own avatar folder.
--   11. Sanity: avatar read policy still works — public CAN select avatar objects.
--   12. Sanity: avatar write policy still protects — user CANNOT insert to another's avatar folder.
--
-- UUID prefix: a01... for users, b01... for workspaces, c01... for boards,
--              d01... for groups, e01... for tasks, f01... for attachments.
-- ============================================================

begin;

select plan(12);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
declare
  v_board_id   text := 'c0100000-0000-0000-0000-000000000001';
  v_board2_id  text := 'c0100000-0000-0000-0000-000000000002';
  v_task_id    text := 'e0100000-0000-0000-0000-000000000001';
  v_att_id     text := 'f0100000-0000-0000-0000-000000000001';
  v_att2_id    text := 'f0100000-0000-0000-0000-000000000002';
  v_uploader   uuid := 'a0100000-0000-0000-0000-000000000003'::uuid;
begin
  -- Users: owner (admin-equiv), viewer, member, outsider, admin
  perform tests.make_user('a0100000-0000-0000-0000-000000000001'::uuid, 'owner10s@test.example');
  perform tests.make_user('a0100000-0000-0000-0000-000000000002'::uuid, 'viewer10s@test.example');
  perform tests.make_user('a0100000-0000-0000-0000-000000000003'::uuid, 'member10s@test.example');
  perform tests.make_user('a0100000-0000-0000-0000-000000000004'::uuid, 'outsider10s@test.example');
  perform tests.make_user('a0100000-0000-0000-0000-000000000005'::uuid, 'admin10s@test.example');
  -- Avatar test user
  perform tests.make_user('a0100000-0000-0000-0000-000000000006'::uuid, 'avataruser10@test.example');
  perform tests.make_user('a0100000-0000-0000-0000-000000000007'::uuid, 'avatarother10@test.example');

  -- Workspace with owner, viewer, member, admin
  perform tests.seed_workspace_with_roles(
    'b0100000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'a0100000-0000-0000-0000-000000000001', 'owner',
      'a0100000-0000-0000-0000-000000000002', 'viewer',
      'a0100000-0000-0000-0000-000000000003', 'member',
      'a0100000-0000-0000-0000-000000000005', 'admin'
    )
  );

  -- Non-private board (workspace members can access)
  perform tests.seed_board(
    v_board_id::uuid,
    'b0100000-0000-0000-0000-000000000001'::uuid,
    false
  );

  -- Group + task on board 1
  perform tests.seed_group(
    'd0100000-0000-0000-0000-000000000001'::uuid,
    v_board_id::uuid
  );
  perform tests.seed_task(
    v_task_id::uuid,
    'd0100000-0000-0000-0000-000000000001'::uuid,
    v_board_id::uuid
  );

  -- Seed an attachment record for the uploader (member)
  insert into public.attachment (id, task_id, uploader_id, storage_path, mime_type, size_bytes, filename, is_uploaded, board_id)
  values (
    v_att_id::uuid,
    v_task_id::uuid,
    v_uploader,
    v_board_id || '/' || v_task_id || '/' || v_att_id || '/testfile.png',
    'image/png',
    1024,
    'testfile.png',
    true,
    v_board_id::uuid
  );

  -- Seed a second attachment (for delete-by-admin test)
  insert into public.attachment (id, task_id, uploader_id, storage_path, mime_type, size_bytes, filename, is_uploaded, board_id)
  values (
    v_att2_id::uuid,
    v_task_id::uuid,
    v_uploader,
    v_board_id || '/' || v_task_id || '/' || v_att2_id || '/admintest.pdf',
    'application/pdf',
    2048,
    'admintest.pdf',
    true,
    v_board_id::uuid
  );

  -- Seed storage.objects rows directly (service-role; bypasses RLS)
  -- Path: <board_id>/<task_id>/<attachment_id>/<filename>
  insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
  values (
    'a0100000-0000-4000-0000-000000000010'::uuid,
    'attachments',
    v_board_id || '/' || v_task_id || '/' || v_att_id || '/testfile.png',
    v_uploader,
    now(), now(), now(),
    '{}'::jsonb
  )
  on conflict (bucket_id, name) do nothing;

  insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
  values (
    'a0100000-0000-4000-0000-000000000011'::uuid,
    'attachments',
    v_board_id || '/' || v_task_id || '/' || v_att2_id || '/admintest.pdf',
    v_uploader,
    now(), now(), now(),
    '{}'::jsonb
  )
  on conflict (bucket_id, name) do nothing;

  -- Seed avatar bucket objects for sanity checks
  insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
  values (
    'a0100000-0000-4000-0000-000000000020'::uuid,
    'avatars',
    'a0100000-0000-0000-0000-000000000006/avatar.png',
    'a0100000-0000-0000-0000-000000000006'::uuid,
    now(), now(), now(),
    '{}'::jsonb
  )
  on conflict (bucket_id, name) do nothing;
end $$;

-- ============================================================
-- Test 1: Sanity — storage.foldername returns expected segments.
-- This validates the RLS policy's reliance on [1] = board_id.
-- ============================================================

select is(
  (storage.foldername('c0100000-0000-0000-0000-000000000001/e01/f01/file.png'))[1],
  'c0100000-0000-0000-0000-000000000001',
  'storage.foldername([1]) returns first path segment (board_id) for 4-segment path'
);

-- ============================================================
-- Test 2: Viewer of board X CAN select objects for that board.
-- ============================================================

select tests.set_jwt_user('a0100000-0000-0000-0000-000000000002'::uuid);

select is(
  (select count(*)::int
     from storage.objects
    where bucket_id = 'attachments'
      and name like 'c0100000-0000-0000-0000-000000000001/%'),
  2,
  'Board viewer can SELECT storage objects belonging to their board'
);

-- ============================================================
-- Test 3: Non-member CANNOT select objects for board X (0 rows).
-- ============================================================

select tests.set_jwt_user('a0100000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*)::int
     from storage.objects
    where bucket_id = 'attachments'
      and name like 'c0100000-0000-0000-0000-000000000001/%'),
  0,
  'Non-member cannot SELECT storage objects (0 rows due to RLS using clause)'
);

-- ============================================================
-- Test 4: Member CAN insert a storage object at the board path.
-- (member has role_rank >= member, so attachment_write policy passes)
-- ============================================================

select tests.set_jwt_user('a0100000-0000-0000-0000-000000000003'::uuid);

insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
values (
  'a0100000-0000-4000-0000-000000000030'::uuid,
  'attachments',
  'c0100000-0000-0000-0000-000000000001/e0100000-0000-0000-0000-000000000001/f0100000-0000-0000-0000-000000000099/member_upload.png',
  'a0100000-0000-0000-0000-000000000003'::uuid,
  now(), now(), now(),
  '{}'::jsonb
);

select tests.reset_to_service_role();

select is(
  (select count(*)::int
     from storage.objects
    where bucket_id = 'attachments'
      and id = 'a0100000-0000-4000-0000-000000000030'::uuid),
  1,
  'Board member can INSERT storage object at the board path'
);

-- ============================================================
-- Test 5: Viewer CANNOT insert a storage object (42501).
-- (viewer has role_rank < member)
-- ============================================================

select tests.set_jwt_user('a0100000-0000-0000-0000-000000000002'::uuid);

select throws_ok(
  $$
    insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
    values (
      'a0100000-0000-4000-0000-000000000040'::uuid,
      'attachments',
      'c0100000-0000-0000-0000-000000000001/e0100000-0000-0000-0000-000000000001/f0100000-0000-0000-0000-000000000041/viewer_upload.png',
      'a0100000-0000-0000-0000-000000000002'::uuid,
      now(), now(), now(),
      '{}'::jsonb
    )
  $$,
  '42501',
  null,
  'Board viewer CANNOT INSERT storage objects (with check violation)'
);

-- ============================================================
-- Test 6: Non-member CANNOT insert a storage object (42501).
-- ============================================================

select tests.set_jwt_user('a0100000-0000-0000-0000-000000000004'::uuid);

select throws_ok(
  $$
    insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
    values (
      'a0100000-0000-4000-0000-000000000050'::uuid,
      'attachments',
      'c0100000-0000-0000-0000-000000000001/e0100000-0000-0000-0000-000000000001/f0100000-0000-0000-0000-000000000051/outsider_upload.png',
      'a0100000-0000-0000-0000-000000000004'::uuid,
      now(), now(), now(),
      '{}'::jsonb
    )
  $$,
  '42501',
  null,
  'Non-member CANNOT INSERT storage objects (with check violation)'
);

-- ============================================================
-- Test 7: Uploader CAN delete their own storage object.
-- ============================================================

select tests.set_jwt_user('a0100000-0000-0000-0000-000000000003'::uuid);

delete from storage.objects
 where bucket_id = 'attachments'
   and id = 'a0100000-0000-4000-0000-000000000010'::uuid;

select tests.reset_to_service_role();

select is(
  (select count(*)::int
     from storage.objects
    where bucket_id = 'attachments'
      and id = 'a0100000-0000-4000-0000-000000000010'::uuid),
  0,
  'Uploader CAN delete their own storage object'
);

-- ============================================================
-- Test 8: Different member (not uploader, not admin) CANNOT delete
-- uploader's object. The attachment_delete policy's exists() check
-- requires uploader_id = auth.uid() OR admin role. Viewer is neither.
-- Using-clause block: 0 rows affected, no error.
-- ============================================================

select tests.set_jwt_user('a0100000-0000-0000-0000-000000000002'::uuid);

delete from storage.objects
 where bucket_id = 'attachments'
   and id = 'a0100000-0000-4000-0000-000000000011'::uuid;

select tests.reset_to_service_role();

select is(
  (select count(*)::int
     from storage.objects
    where bucket_id = 'attachments'
      and id = 'a0100000-0000-4000-0000-000000000011'::uuid),
  1,
  'Non-uploader viewer CANNOT delete another uploader''s storage object (using clause — 0 rows)'
);

-- ============================================================
-- Test 9: Admin CAN delete any member's storage object.
-- ============================================================

select tests.set_jwt_user('a0100000-0000-0000-0000-000000000005'::uuid);

delete from storage.objects
 where bucket_id = 'attachments'
   and id = 'a0100000-0000-4000-0000-000000000011'::uuid;

select tests.reset_to_service_role();

select is(
  (select count(*)::int
     from storage.objects
    where bucket_id = 'attachments'
      and id = 'a0100000-0000-4000-0000-000000000011'::uuid),
  0,
  'Board admin CAN delete any member''s storage object'
);

-- ============================================================
-- Test 10: Avatar sanity — user CAN insert to their own avatar folder.
-- Regression check: attachment_read policy must not have broken avatar_write.
-- ============================================================

select tests.set_jwt_user('a0100000-0000-0000-0000-000000000006'::uuid);

insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
values (
  'a0100000-0000-4000-0000-000000000060'::uuid,
  'avatars',
  'a0100000-0000-0000-0000-000000000006/new_avatar.png',
  'a0100000-0000-0000-0000-000000000006'::uuid,
  now(), now(), now(),
  '{}'::jsonb
);

select tests.reset_to_service_role();

select is(
  (select count(*)::int
     from storage.objects
    where bucket_id = 'avatars'
      and name = 'a0100000-0000-0000-0000-000000000006/new_avatar.png'),
  1,
  'Avatar sanity: user can INSERT to their own avatar folder (avatar_write policy intact)'
);

-- ============================================================
-- Test 11: Avatar sanity — public CAN select avatar objects.
-- ============================================================

-- Reset to a non-member context to verify the "public" policy works
select tests.set_jwt_user('a0100000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*)::int
     from storage.objects
    where bucket_id = 'avatars'
      and name = 'a0100000-0000-0000-0000-000000000006/avatar.png'),
  1,
  'Avatar sanity: any user can SELECT avatar objects (avatars are publicly readable)'
);

-- ============================================================
-- Test 12: Avatar sanity — user CANNOT insert to another user's avatar folder.
-- ============================================================

select tests.set_jwt_user('a0100000-0000-0000-0000-000000000006'::uuid);

select throws_ok(
  $$
    insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
    values (
      'a0100000-0000-4000-0000-000000000070'::uuid,
      'avatars',
      'a0100000-0000-0000-0000-000000000007/stolen_avatar.png',
      'a0100000-0000-0000-0000-000000000006'::uuid,
      now(), now(), now(),
      '{}'::jsonb
    )
  $$,
  '42501',
  null,
  'Avatar sanity: user CANNOT INSERT to another user''s avatar folder (avatar_write with check intact)'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
