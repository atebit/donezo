-- ============================================================
-- tests/policies/20_board.sql
-- RLS assertions for: public.board, public.board_member
-- Plus: role_for_board function correctness + security definer check.
--
-- Assertion count: 15
--
-- Coverage targets (from epic 04 definition of done):
--   - role_for_board is security definer (pg_proc.prosecdef)
--   - role_for_board returns correct role for every (board, user) combination
--     (table-driven, covers: owner, admin, member, viewer, non-member,
--      private-board-only-member, deleted board)
--   - workspace-viewer can SELECT a non-private board
--   - non-workspace-member cannot SELECT a non-private board
--   - private-board flag flips visibility (workspace member blocked)
--   - board admin can UPDATE board.name
--   - Slice F1.1 tightened the policy to workspace-owner-only; admin and member
--     are blocked, owner can delete.
--   - non-workspace-member cannot SELECT tasks on a private board
-- ============================================================

begin;

select plan(15);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
begin
  -- Users
  perform tests.make_user('a2000000-0000-0000-0000-000000000001'::uuid, 'ws-owner@test.example');
  perform tests.make_user('a2000000-0000-0000-0000-000000000002'::uuid, 'ws-admin@test.example');
  perform tests.make_user('a2000000-0000-0000-0000-000000000003'::uuid, 'ws-member@test.example');
  perform tests.make_user('a2000000-0000-0000-0000-000000000004'::uuid, 'ws-viewer@test.example');
  perform tests.make_user('a2000000-0000-0000-0000-000000000005'::uuid, 'board-only-member@test.example');
  perform tests.make_user('a2000000-0000-0000-0000-000000000006'::uuid, 'outsider@test.example');

  -- Workspace
  perform tests.seed_workspace_with_roles(
    'b2000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'a2000000-0000-0000-0000-000000000001', 'owner',
      'a2000000-0000-0000-0000-000000000002', 'admin',
      'a2000000-0000-0000-0000-000000000003', 'member',
      'a2000000-0000-0000-0000-000000000004', 'viewer'
    )
  );

  -- Public board (is_private = false)
  perform tests.seed_board(
    'c2000000-0000-0000-0000-000000000001'::uuid,
    'b2000000-0000-0000-0000-000000000001'::uuid,
    false
  );

  -- Private board (is_private = true)
  perform tests.seed_board(
    'c2000000-0000-0000-0000-000000000002'::uuid,
    'b2000000-0000-0000-0000-000000000001'::uuid,
    true
  );

  -- Give board-only-member explicit access to both boards
  -- (board-only-member is NOT in workspace_member)
  perform tests.seed_board_member(
    'c2000000-0000-0000-0000-000000000001'::uuid,
    'a2000000-0000-0000-0000-000000000005'::uuid,
    'member'
  );
  perform tests.seed_board_member(
    'c2000000-0000-0000-0000-000000000002'::uuid,
    'a2000000-0000-0000-0000-000000000005'::uuid,
    'member'
  );

  -- Also give ws-viewer an explicit board_member row on public board
  -- so we can test that board_member upgrades effective role.
  perform tests.seed_board_member(
    'c2000000-0000-0000-0000-000000000001'::uuid,
    'a2000000-0000-0000-0000-000000000004'::uuid,
    'admin'
  );
end $$;

-- ============================================================
-- Test 1: role_for_board is SECURITY DEFINER (prosecdef = true)
-- ============================================================
-- Reset to superuser context to read pg_proc.
select tests.reset_to_service_role();

select is(
  (select prosecdef from pg_proc
   where proname = 'role_for_board'
     and pronamespace = (select oid from pg_namespace where nspname = 'public')),
  true,
  'role_for_board is marked SECURITY DEFINER in pg_proc'
);

-- ============================================================
-- Tests 2-8: role_for_board table-driven correctness
-- (service-role context; function is security definer so it
--  reads workspace_member regardless of calling role)
-- ============================================================

-- Test 2: workspace owner on public board → 'owner'
select is(
  public.role_for_board(
    'c2000000-0000-0000-0000-000000000001'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid
  ),
  'owner',
  'role_for_board: workspace owner on public board → owner'
);

-- Test 3: workspace viewer with board_member admin role on public board → 'admin'
-- (greater_role picks the higher of viewer and admin)
select is(
  public.role_for_board(
    'c2000000-0000-0000-0000-000000000001'::uuid,
    'a2000000-0000-0000-0000-000000000004'::uuid
  ),
  'admin',
  'role_for_board: ws-viewer with board admin row → admin (greater_role wins)'
);

-- Test 4: workspace member on public board with no board_member row → 'member'
select is(
  public.role_for_board(
    'c2000000-0000-0000-0000-000000000001'::uuid,
    'a2000000-0000-0000-0000-000000000003'::uuid
  ),
  'member',
  'role_for_board: workspace member on public board → member'
);

-- Test 5: board-only-member (not in workspace) on public board → 'member'
-- (no ws_role; b_role = member; greater_role(null, member) = member)
select is(
  public.role_for_board(
    'c2000000-0000-0000-0000-000000000001'::uuid,
    'a2000000-0000-0000-0000-000000000005'::uuid
  ),
  'member',
  'role_for_board: board-only-member on public board → member'
);

-- Test 6: outsider on public board → null
select is(
  public.role_for_board(
    'c2000000-0000-0000-0000-000000000001'::uuid,
    'a2000000-0000-0000-0000-000000000006'::uuid
  ),
  null,
  'role_for_board: outsider on public board → null'
);

-- Test 7: workspace member on PRIVATE board with no board_member row → null
-- (is_private = true means only explicit board_member rows count)
select is(
  public.role_for_board(
    'c2000000-0000-0000-0000-000000000002'::uuid,
    'a2000000-0000-0000-0000-000000000003'::uuid
  ),
  null,
  'role_for_board: workspace member on private board without board_member row → null'
);

-- Test 8: board-only-member on PRIVATE board → 'member'
select is(
  public.role_for_board(
    'c2000000-0000-0000-0000-000000000002'::uuid,
    'a2000000-0000-0000-0000-000000000005'::uuid
  ),
  'member',
  'role_for_board: explicit board_member on private board → member'
);

-- ============================================================
-- Test 9: workspace viewer can SELECT non-private board
-- ============================================================

select tests.set_jwt_user('a2000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*)::int from public.board
   where id = 'c2000000-0000-0000-0000-000000000001'),
  1,
  'workspace viewer can SELECT non-private board'
);

-- ============================================================
-- Test 10: non-workspace-member cannot SELECT non-private board
-- ============================================================

select tests.set_jwt_user('a2000000-0000-0000-0000-000000000006'::uuid);

select is(
  (select count(*)::int from public.board
   where id = 'c2000000-0000-0000-0000-000000000001'),
  0,
  'non-workspace-member cannot SELECT non-private board'
);

-- ============================================================
-- Test 11: workspace member cannot SELECT private board
-- (is_private=true; no board_member row for ws-member)
-- ============================================================

select tests.set_jwt_user('a2000000-0000-0000-0000-000000000003'::uuid);

select is(
  (select count(*)::int from public.board
   where id = 'c2000000-0000-0000-0000-000000000002'),
  0,
  'workspace member cannot SELECT private board without explicit board_member row'
);

-- ============================================================
-- Test 12: board admin (ws-viewer with board_member admin) can UPDATE board.name
-- The board_update policy requires role_rank >= member; admin satisfies.
-- ============================================================

select tests.set_jwt_user('a2000000-0000-0000-0000-000000000004'::uuid);

with updated as (
  update public.board
    set name = 'Renamed by Board Admin'
  where id = 'c2000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from updated \gset

select is(:rcnt::int, 1, 'board admin (ws-viewer + board_member admin) can UPDATE board.name');

-- ============================================================
-- Test 13: workspace member cannot DELETE public board
-- F1.1 policy: workspace_member.role = 'owner' only.
-- ws-member has role 'member' → blocked (0 rows affected).
-- ============================================================

select tests.set_jwt_user('a2000000-0000-0000-0000-000000000003'::uuid);

with deleted as (
  delete from public.board
    where id = 'c2000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 0, 'workspace member cannot DELETE board (requires workspace owner)');

-- ============================================================
-- Test 14: workspace admin cannot DELETE public board
-- F1.1 policy: workspace_member.role = 'owner' only.
-- ws-admin has role 'admin' → blocked (0 rows affected).
-- ============================================================

select tests.set_jwt_user('a2000000-0000-0000-0000-000000000002'::uuid);

with deleted as (
  delete from public.board
    where id = 'c2000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 0, 'workspace admin cannot DELETE board (requires workspace owner)');

-- ============================================================
-- Test 15: workspace owner CAN DELETE public board
-- F1.1 policy: workspace_member.role = 'owner' only.
-- ws-owner has role 'owner' → allowed (1 row affected).
-- Note: this test actually deletes the board; place last so tests 13/14
-- can still reference it.
-- ============================================================

select tests.set_jwt_user('a2000000-0000-0000-0000-000000000001'::uuid);

with deleted as (
  delete from public.board
    where id = 'c2000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from deleted \gset

select is(:rcnt::int, 1, 'workspace owner can DELETE board');

select tests.reset_to_service_role();

select * from finish();
rollback;
