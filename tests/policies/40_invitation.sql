-- ============================================================
-- tests/policies/40_invitation.sql
-- RLS assertions for: public.invitation, self-insert into
-- public.workspace_member and public.board_member via accepted invitation.
--
-- Assertion count: 13
--
-- Coverage targets (from epic 04 definition of done):
--   - admin can INSERT invitation
--   - member cannot INSERT invitation (42501)
--   - invitee can SELECT own non-accepted invitation row
--   - invitee cannot SELECT other invitations
--   - invitee can UPDATE only accepted_at (trigger blocks other columns)
--   - trigger rejects updating any column other than accepted_at (42501)
--   - valid workspace invitation: invitee can self-insert into workspace_member
--   - expired invitation cannot be used to self-insert into workspace_member
--   - mismatched email cannot self-insert into workspace_member
--   - board-scoped invitation cannot trigger insert into workspace_member (Q13)
--   - valid board-scoped invitation: invitee can self-insert into board_member
--   - already-accepted invitation cannot be reused
--   - valid invitation but role mismatch cannot self-insert as the wrong role
--
-- DEPENDENCY: These tests require the invitation table and the updated
-- wsm_insert / bm_insert policies from Slice D's migration.
-- They are written against Slice D's contracts.
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
  perform tests.make_user('a4000000-0000-0000-0000-000000000001'::uuid, 'ws-owner@test4.example');
  perform tests.make_user('a4000000-0000-0000-0000-000000000002'::uuid, 'ws-admin@test4.example');
  perform tests.make_user('a4000000-0000-0000-0000-000000000003'::uuid, 'ws-member@test4.example');
  perform tests.make_user('a4000000-0000-0000-0000-000000000004'::uuid, 'invitee@test4.example');
  perform tests.make_user('a4000000-0000-0000-0000-000000000005'::uuid, 'other-invitee@test4.example');
  perform tests.make_user('a4000000-0000-0000-0000-000000000006'::uuid, 'board-invitee@test4.example');

  -- Workspace
  perform tests.seed_workspace_with_roles(
    'b4000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'a4000000-0000-0000-0000-000000000001', 'owner',
      'a4000000-0000-0000-0000-000000000002', 'admin',
      'a4000000-0000-0000-0000-000000000003', 'member'
    )
  );

  -- Board (needed for board-scoped invitation tests)
  perform tests.seed_board(
    'c4000000-0000-0000-0000-000000000001'::uuid,
    'b4000000-0000-0000-0000-000000000001'::uuid,
    false
  );

  -- Workspace-scoped invitation for invitee@test4.example (valid, not yet accepted)
  perform tests.seed_invitation(
    'i4000000-0000-0000-0000-000000000001'::uuid,
    'b4000000-0000-0000-0000-000000000001'::uuid,
    null,                                            -- workspace-scoped
    'invitee@test4.example',
    'member',
    'tok_valid_workspace_invite',
    now() + interval '14 days',
    'a4000000-0000-0000-0000-000000000002'::uuid
  );

  -- Workspace-scoped invitation for invitee@test4.example (EXPIRED)
  perform tests.seed_invitation(
    'i4000000-0000-0000-0000-000000000002'::uuid,
    'b4000000-0000-0000-0000-000000000001'::uuid,
    null,
    'invitee@test4.example',
    'member',
    'tok_expired_workspace_invite',
    now() - interval '1 second',                     -- expired
    'a4000000-0000-0000-0000-000000000002'::uuid
  );

  -- Board-scoped invitation for board-invitee@test4.example (valid)
  perform tests.seed_invitation(
    'i4000000-0000-0000-0000-000000000003'::uuid,
    'b4000000-0000-0000-0000-000000000001'::uuid,
    'c4000000-0000-0000-0000-000000000001'::uuid,    -- board-scoped
    'board-invitee@test4.example',
    'member',
    'tok_valid_board_invite',
    now() + interval '14 days',
    'a4000000-0000-0000-0000-000000000002'::uuid
  );

  -- Already-accepted workspace invitation for invitee@test4.example
  perform tests.seed_invitation(
    'i4000000-0000-0000-0000-000000000004'::uuid,
    'b4000000-0000-0000-0000-000000000001'::uuid,
    null,
    'invitee@test4.example',
    'viewer',
    'tok_already_accepted',
    now() + interval '14 days',
    'a4000000-0000-0000-0000-000000000002'::uuid
  );
  -- Mark it accepted
  update public.invitation
     set accepted_at = now() - interval '1 hour'
   where id = 'i4000000-0000-0000-0000-000000000004';
end $$;

-- ============================================================
-- Test 1: admin can INSERT invitation
-- ============================================================

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000002'::uuid);

select lives_ok(
  $$insert into public.invitation (
      workspace_id, board_id, email, role, token, expires_at, invited_by
    ) values (
      'b4000000-0000-0000-0000-000000000001',
      null,
      'new-person@test4.example',
      'viewer',
      'tok_admin_inserted',
      now() + interval '14 days',
      'a4000000-0000-0000-0000-000000000002'
    )$$,
  'admin can INSERT invitation'
);

-- ============================================================
-- Test 2: member cannot INSERT invitation (requires admin+)
-- ============================================================

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000003'::uuid);

select throws_ok(
  $$insert into public.invitation (
      workspace_id, board_id, email, role, token, expires_at, invited_by
    ) values (
      'b4000000-0000-0000-0000-000000000001',
      null,
      'sneaky@test4.example',
      'member',
      'tok_member_sneaky',
      now() + interval '14 days',
      'a4000000-0000-0000-0000-000000000003'
    )$$,
  '42501',
  'member cannot INSERT invitation (requires admin+; 42501 raised)'
);

-- ============================================================
-- Test 3: invitee can SELECT own non-accepted invitation
-- ============================================================

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000004'::uuid);

select is(
  (select count(*)::int from public.invitation
   where id = 'i4000000-0000-0000-0000-000000000001'),
  1,
  'invitee can SELECT their own non-accepted invitation'
);

-- ============================================================
-- Test 4: invitee cannot SELECT another invitee's invitation
-- ============================================================

select is(
  (select count(*)::int from public.invitation
   where id = 'i4000000-0000-0000-0000-000000000003'),  -- belongs to board-invitee
  0,
  'invitee cannot SELECT another invitee invitation'
);

-- ============================================================
-- Test 5: invitee can UPDATE accepted_at on own invitation
-- ============================================================

with updated as (
  update public.invitation
    set accepted_at = now()
  where id = 'i4000000-0000-0000-0000-000000000001'
  returning id
)
select count(*)::int as rcnt from updated \gset

select is(:rcnt::int, 1, 'invitee can set accepted_at on own invitation');

-- ============================================================
-- Test 6: trigger blocks updating any column other than accepted_at
-- The invitation_only_accept_update trigger raises errcode 42501.
-- ============================================================

-- First reset the accepted_at so the row is still accessible.
select tests.reset_to_service_role();
update public.invitation
   set accepted_at = null
 where id = 'i4000000-0000-0000-0000-000000000001';

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000004'::uuid);

select throws_ok(
  $$update public.invitation
      set email = 'hacked@evil.example'
    where id = 'i4000000-0000-0000-0000-000000000001'$$,
  '42501',
  'invitation trigger blocks updating email column (only accepted_at allowed)'
);

-- ============================================================
-- Test 7: valid workspace invitation allows invitee to self-insert
-- into workspace_member (Slice D wsm_insert policy)
-- ============================================================

-- Mark the valid invitation as not-yet-accepted so the gate passes.
select tests.reset_to_service_role();
update public.invitation
   set accepted_at = null
 where id = 'i4000000-0000-0000-0000-000000000001';

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000004'::uuid);

select lives_ok(
  $$insert into public.workspace_member (workspace_id, user_id, role)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'a4000000-0000-0000-0000-000000000004',
      'member'
    )$$,
  'valid workspace invitation allows invitee to self-insert into workspace_member'
);

-- ============================================================
-- Test 8: expired invitation cannot be used to self-insert
-- ============================================================

-- Remove the newly inserted membership so we can test the expired path cleanly.
select tests.reset_to_service_role();
delete from public.workspace_member
  where workspace_id = 'b4000000-0000-0000-0000-000000000001'
    and user_id = 'a4000000-0000-0000-0000-000000000004';

-- Mark the valid invitation as accepted so only the expired one remains;
-- otherwise the wsm_insert policy still admits via i4...001.
update public.invitation
   set accepted_at = now()
 where id = 'i4000000-0000-0000-0000-000000000001';

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000004'::uuid);

select throws_ok(
  $$insert into public.workspace_member (workspace_id, user_id, role)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'a4000000-0000-0000-0000-000000000004',
      'member'
    )$$,
  '42501',
  'expired invitation cannot be used to self-insert into workspace_member'
);

-- ============================================================
-- Test 9: mismatched email cannot self-insert
-- (a3000000 / ws-member has no invitation row matching their email)
-- ============================================================

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000005'::uuid);

select throws_ok(
  $$insert into public.workspace_member (workspace_id, user_id, role)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'a4000000-0000-0000-0000-000000000005',
      'member'
    )$$,
  '42501',
  'user with mismatched email cannot self-insert into workspace_member'
);

-- ============================================================
-- Test 10: board-scoped invitation cannot be used to insert into
-- workspace_member (Q13 tight restriction)
-- The wsm_insert policy requires board_id IS NULL on the invitation.
-- ============================================================

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000006'::uuid);

select throws_ok(
  $$insert into public.workspace_member (workspace_id, user_id, role)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'a4000000-0000-0000-0000-000000000006',
      'member'
    )$$,
  '42501',
  'board-scoped invitation cannot be used to self-insert into workspace_member (Q13)'
);

-- ============================================================
-- Test 11: valid board-scoped invitation allows invitee to
-- self-insert into board_member
-- ============================================================

select lives_ok(
  $$insert into public.board_member (board_id, user_id, role)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'a4000000-0000-0000-0000-000000000006',
      'member'
    )$$,
  'valid board-scoped invitation allows invitee to self-insert into board_member'
);

-- ============================================================
-- Test 12: already-accepted invitation cannot be reused
-- (wsm_insert policy checks accepted_at is null)
-- ============================================================

-- invitee has valid invitation tok_already_accepted with accepted_at set;
-- remove any existing membership first.
select tests.reset_to_service_role();
delete from public.workspace_member
  where workspace_id = 'b4000000-0000-0000-0000-000000000001'
    and user_id = 'a4000000-0000-0000-0000-000000000004';

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000004'::uuid);

select throws_ok(
  $$insert into public.workspace_member (workspace_id, user_id, role)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'a4000000-0000-0000-0000-000000000004',
      'viewer'
    )$$,
  '42501',
  'already-accepted invitation cannot be reused for self-insert'
);

-- ============================================================
-- Test 13 (added by F1.3): valid invitation but role mismatch fails
-- The wsm_insert self-insert clause requires i.role = workspace_member.role.
-- ============================================================

select tests.reset_to_service_role();
update public.invitation
   set accepted_at = null
 where id = 'i4000000-0000-0000-0000-000000000001';
delete from public.workspace_member
  where workspace_id = 'b4000000-0000-0000-0000-000000000001'
    and user_id = 'a4000000-0000-0000-0000-000000000004';

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000004'::uuid);

select throws_ok(
  $$insert into public.workspace_member (workspace_id, user_id, role)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'a4000000-0000-0000-0000-000000000004',
      'admin'
    )$$,
  '42501',
  'invitation with role=member cannot be used to self-insert as admin (role mismatch)'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
