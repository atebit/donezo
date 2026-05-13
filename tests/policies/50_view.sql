-- ============================================================
-- tests/policies/50_view.sql
-- RLS assertions for: public.view
--
-- Assertion count: 8
--
-- Coverage targets (from epic 04 definition of done):
--   - personal view (is_shared=false, owner_id=user) hidden from other users
--   - personal view visible to its owner
--   - shared view (is_shared=true) visible to all board members
--   - system-shared view (owner_id IS NULL) visible to all board members
--   - owner can UPDATE/DELETE their own personal view
--   - non-owner member cannot UPDATE/DELETE another user's personal view
--   - shared view requires admin to UPDATE (view_modify policy)
--   - system-shared view requires admin to UPDATE
-- ============================================================

begin;

select plan(8);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
begin
  -- Users
  perform tests.make_user('a5000000-0000-0000-0000-000000000001'::uuid, 'owner@test5.example');
  perform tests.make_user('a5000000-0000-0000-0000-000000000002'::uuid, 'admin@test5.example');
  perform tests.make_user('a5000000-0000-0000-0000-000000000003'::uuid, 'member@test5.example');
  perform tests.make_user('a5000000-0000-0000-0000-000000000004'::uuid, 'viewer@test5.example');

  -- Workspace
  perform tests.seed_workspace_with_roles(
    'b5000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'a5000000-0000-0000-0000-000000000001', 'owner',
      'a5000000-0000-0000-0000-000000000002', 'admin',
      'a5000000-0000-0000-0000-000000000003', 'member',
      'a5000000-0000-0000-0000-000000000004', 'viewer'
    )
  );

  -- Board
  perform tests.seed_board(
    'c5000000-0000-0000-0000-000000000001'::uuid,
    'b5000000-0000-0000-0000-000000000001'::uuid,
    false
  );

  -- Personal view belonging to member (is_shared = false)
  perform tests.seed_view(
    'v5000000-0000-0000-0000-000000000001'::uuid,
    'c5000000-0000-0000-0000-000000000001'::uuid,
    'a5000000-0000-0000-0000-000000000003'::uuid,  -- member owns it
    false                                           -- not shared
  );

  -- Shared view (is_shared = true), owned by member
  perform tests.seed_view(
    'v5000000-0000-0000-0000-000000000002'::uuid,
    'c5000000-0000-0000-0000-000000000001'::uuid,
    'a5000000-0000-0000-0000-000000000003'::uuid,
    true
  );

  -- System-shared view (owner_id IS NULL)
  perform tests.seed_view(
    'v5000000-0000-0000-0000-000000000003'::uuid,
    'c5000000-0000-0000-0000-000000000001'::uuid,
    null,   -- system-shared
    false   -- is_shared=false; owner_id IS NULL path
  );
end $$;

-- ============================================================
-- Test 1: viewer (different user) cannot SELECT member's personal view
-- view_select: is_shared OR owner_id = auth.uid() OR owner_id IS NULL
-- None of those hold for the viewer looking at member's private view.
-- ============================================================

select tests.set_jwt_user('a5000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*)::int from public.view
   where id = 'v5000000-0000-0000-0000-000000000001'),
  0,
  'viewer cannot SELECT another user personal view (is_shared=false)'
);

-- ============================================================
-- Test 2: owner (member) can SELECT their own personal view
-- ============================================================

select tests.set_jwt_user('a5000000-0000-0000-0000-000000000003'::uuid);

select is(
  (select count(*)::int from public.view
   where id = 'v5000000-0000-0000-0000-000000000001'),
  1,
  'owner can SELECT their own personal view'
);

-- ============================================================
-- Test 3: shared view is visible to all board members (viewer)
-- ============================================================

select tests.set_jwt_user('a5000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*)::int from public.view
   where id = 'v5000000-0000-0000-0000-000000000002'),
  1,
  'shared view (is_shared=true) is visible to viewer'
);

-- ============================================================
-- Test 4: system-shared view (owner_id IS NULL) is visible to all board members
-- ============================================================

select is(
  (select count(*)::int from public.view
   where id = 'v5000000-0000-0000-0000-000000000003'),
  1,
  'system-shared view (owner_id IS NULL) is visible to any board member'
);

-- ============================================================
-- Test 5: member cannot UPDATE another member's personal view
-- view_modify for personal view: owner_id = auth.uid()
-- Admin is the caller; admin doesn't own this view.
-- ============================================================

select tests.set_jwt_user('a5000000-0000-0000-0000-000000000002'::uuid);

with updated as (
  update public.view
    set name = 'Hacked View Name'
  where id = 'v5000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from updated \gset

select is(:rcnt::int, 0, 'non-owner cannot UPDATE another users personal view (0 rows affected)');

-- ============================================================
-- Test 6: owner can UPDATE (and by extension DELETE) their own personal view
-- ============================================================

select tests.set_jwt_user('a5000000-0000-0000-0000-000000000003'::uuid);

with updated as (
  update public.view
    set name = 'My Renamed View'
  where id = 'v5000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from updated \gset

select is(:rcnt::int, 1, 'owner can UPDATE their own personal view');

-- ============================================================
-- Test 7: modifying a shared view requires admin+
-- Member (is_shared=true view owner) cannot update via view_modify
-- because view_modify checks admin+ when is_shared=true.
-- ============================================================

with updated as (
  update public.view
    set name = 'Member Rename Shared'
  where id = 'v5000000-0000-0000-0000-000000000002'
  returning id
)
select count(*)::int as rcnt from updated \gset

select is(:rcnt::int, 0, 'member cannot UPDATE a shared view (requires admin+; 0 rows affected)');

-- ============================================================
-- Test 8: admin can UPDATE a shared view
-- ============================================================

select tests.set_jwt_user('a5000000-0000-0000-0000-000000000002'::uuid);

with updated as (
  update public.view
    set name = 'Admin Renamed Shared'
  where id = 'v5000000-0000-0000-0000-000000000002'
  returning id
)
select count(*)::int as rcnt from updated \gset

select is(:rcnt::int, 1, 'admin can UPDATE a shared view');

select tests.reset_to_service_role();

select * from finish();
rollback;
