-- ============================================================
-- tests/policies/10_workspace.sql
-- RLS assertions for: public.workspace, public.workspace_member
--
-- Assertion count: 11
--
-- Coverage targets (from epic 04 definition of done):
--   - workspace viewer cannot update workspace
--   - workspace admin can update workspace
--   - non-member cannot SELECT workspace
--   - owner can delete workspace
--   - workspace member can SELECT all workspace_member rows in their workspace
--   - non-member cannot SELECT workspace_member rows
--   - viewer cannot delete other members' workspace_member rows
--   - member can self-remove (delete own wsm row)
--   - non-member cannot insert into workspace_member without invitation
--
-- NOTE: RLS with `using` clauses silently filter rows (no exception).
-- Tests that verify block via UPDATE/DELETE use a count-of-affected-rows
-- assertion rather than throws_ok.  throws_ok is used only where a
-- `with check` violation would raise errcode 42501.
-- ============================================================

begin;

select plan(11);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
begin
  -- Users
  perform tests.make_user('a1000000-0000-0000-0000-000000000001'::uuid, 'owner@test.example');
  perform tests.make_user('a1000000-0000-0000-0000-000000000002'::uuid, 'admin@test.example');
  perform tests.make_user('a1000000-0000-0000-0000-000000000003'::uuid, 'member@test.example');
  perform tests.make_user('a1000000-0000-0000-0000-000000000004'::uuid, 'viewer@test.example');
  perform tests.make_user('a1000000-0000-0000-0000-000000000005'::uuid, 'outsider@test.example');

  -- Primary workspace
  perform tests.seed_workspace_with_roles(
    'b1000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'a1000000-0000-0000-0000-000000000001', 'owner',
      'a1000000-0000-0000-0000-000000000002', 'admin',
      'a1000000-0000-0000-0000-000000000003', 'member',
      'a1000000-0000-0000-0000-000000000004', 'viewer'
    )
  );

  -- Secondary workspace for the owner-delete test (so we don't destroy
  -- the primary workspace needed for subsequent membership tests).
  perform tests.make_user('a1000000-0000-0000-0000-000000000006'::uuid, 'owner2@test.example');
  perform tests.seed_workspace_with_roles(
    'b1000000-0000-0000-0000-000000000002'::uuid,
    jsonb_build_object('a1000000-0000-0000-0000-000000000006', 'owner')
  );
end $$;

-- ============================================================
-- Test 1: viewer can SELECT their own workspace
-- ============================================================

select tests.set_jwt_user('a1000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*)::int from public.workspace
   where id = 'b1000000-0000-0000-0000-000000000001'),
  1,
  'viewer can SELECT their own workspace'
);

-- ============================================================
-- Test 2: non-member cannot SELECT any workspace
-- ============================================================

select tests.set_jwt_user('a1000000-0000-0000-0000-000000000005'::uuid);

select is(
  (select count(*)::int from public.workspace
   where id = 'b1000000-0000-0000-0000-000000000001'),
  0,
  'non-member cannot SELECT workspace'
);

-- ============================================================
-- Test 3: viewer UPDATE is blocked by RLS (0 rows affected)
-- The `using` clause silently hides the row; no exception raised.
-- ============================================================

select tests.set_jwt_user('a1000000-0000-0000-0000-000000000004'::uuid);

with updated as (
  update public.workspace
    set name = 'Hacked'
  where id = 'b1000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from updated \gset

select is(:rcnt::int, 0, 'viewer cannot UPDATE workspace (RLS blocks; 0 rows affected)');

-- ============================================================
-- Test 4: admin can UPDATE workspace name
-- ============================================================

select tests.reset_to_service_role();
select tests.set_jwt_user('a1000000-0000-0000-0000-000000000002'::uuid);

with updated as (
  update public.workspace
    set name = 'Updated by Admin'
  where id = 'b1000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from updated \gset

select is(:rcnt::int, 1, 'admin can UPDATE workspace name');

-- ============================================================
-- Test 5: viewer DELETE returns 0 rows (policy uses `using`)
-- ============================================================

select tests.set_jwt_user('a1000000-0000-0000-0000-000000000004'::uuid);

with deleted as (
  delete from public.workspace
    where id = 'b1000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 0, 'viewer DELETE on workspace returns 0 rows (RLS blocks)');

-- ============================================================
-- Test 6: owner can DELETE workspace (secondary workspace)
-- ============================================================

select tests.reset_to_service_role();
select tests.set_jwt_user('a1000000-0000-0000-0000-000000000006'::uuid);

with deleted as (
  delete from public.workspace
    where id = 'b1000000-0000-0000-0000-000000000002'
  returning id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 1, 'owner can DELETE their own workspace');

-- ============================================================
-- Test 7: member can SELECT all workspace_member rows in workspace
-- ============================================================

select tests.reset_to_service_role();
select tests.set_jwt_user('a1000000-0000-0000-0000-000000000003'::uuid);

select is(
  (select count(*)::int from public.workspace_member
   where workspace_id = 'b1000000-0000-0000-0000-000000000001'),
  4,
  'member can SELECT all workspace_member rows in their workspace'
);

-- ============================================================
-- Test 8: non-member cannot SELECT workspace_member rows
-- ============================================================

select tests.set_jwt_user('a1000000-0000-0000-0000-000000000005'::uuid);

select is(
  (select count(*)::int from public.workspace_member
   where workspace_id = 'b1000000-0000-0000-0000-000000000001'),
  0,
  'non-member cannot SELECT workspace_member rows'
);

-- ============================================================
-- Test 9: viewer cannot DELETE another member's wsm row
-- ============================================================

select tests.set_jwt_user('a1000000-0000-0000-0000-000000000004'::uuid);

with deleted as (
  delete from public.workspace_member
    where workspace_id = 'b1000000-0000-0000-0000-000000000001'
      and user_id = 'a1000000-0000-0000-0000-000000000003'
  returning workspace_id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 0, 'viewer cannot DELETE another member row from workspace_member');

-- ============================================================
-- Test 10: member can self-remove (delete own wsm row)
-- ============================================================

select tests.set_jwt_user('a1000000-0000-0000-0000-000000000003'::uuid);

with deleted as (
  delete from public.workspace_member
    where workspace_id = 'b1000000-0000-0000-0000-000000000001'
      and user_id = 'a1000000-0000-0000-0000-000000000003'
  returning workspace_id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 1, 'member can self-remove from workspace_member');

-- ============================================================
-- Test 11: non-member cannot INSERT into workspace_member
-- wsm_insert has `with check`, so RLS raises errcode 42501.
-- ============================================================

select tests.reset_to_service_role();
select tests.set_jwt_user('a1000000-0000-0000-0000-000000000005'::uuid);

select throws_ok(
  $$insert into public.workspace_member (workspace_id, user_id, role)
    values (
      'b1000000-0000-0000-0000-000000000001',
      'a1000000-0000-0000-0000-000000000005',
      'viewer'
    )$$,
  '42501',
  'non-member cannot INSERT into workspace_member without admin role or invitation'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
