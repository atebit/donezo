-- ============================================================
-- tests/policies/comment_reaction_rls.spec.sql
-- pgTAP assertions for the comment_reaction RLS policies (Epic 09 Slice A).
--
-- Assertion count: 6
--
-- Coverage targets:
--   1. Board viewer CAN select reactions on comments in their board.
--   2. Non-member CANNOT select reactions (0 rows returned).
--   3. Member CAN insert their own reaction.
--   4. User CANNOT insert a reaction with user_id set to someone else (42501).
--   5. User CAN delete only their own reaction.
--   6. Reactions are CASCADE-deleted when their parent comment is deleted.
--
-- UUID prefix: a9... for users, b9... for workspaces, c9... for boards, etc.
-- ============================================================

begin;

select plan(6);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
begin
  -- Users: owner, member (viewer on workspace), outsider
  perform tests.make_user('a9000000-0000-0000-0000-000000000001'::uuid, 'owner9@test.example');
  perform tests.make_user('a9000000-0000-0000-0000-000000000002'::uuid, 'member9@test.example');
  perform tests.make_user('a9000000-0000-0000-0000-000000000003'::uuid, 'outsider9@test.example');

  -- Workspace with owner (admin) and member (viewer).
  perform tests.seed_workspace_with_roles(
    'b9000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object(
      'a9000000-0000-0000-0000-000000000001', 'owner',
      'a9000000-0000-0000-0000-000000000002', 'member'
    )
  );

  -- Public board (workspace members have implicit access).
  perform tests.seed_board(
    'c9000000-0000-0000-0000-000000000001'::uuid,
    'b9000000-0000-0000-0000-000000000001'::uuid,
    false  -- not private
  );

  -- Group + task on the board.
  perform tests.seed_group(
    'd9000000-0000-0000-0000-000000000001'::uuid,
    'c9000000-0000-0000-0000-000000000001'::uuid
  );
  perform tests.seed_task(
    'e9000000-0000-0000-0000-000000000001'::uuid,
    'd9000000-0000-0000-0000-000000000001'::uuid,
    'c9000000-0000-0000-0000-000000000001'::uuid
  );

  -- Comment by the owner.
  perform tests.seed_comment(
    'f9000000-0000-0000-0000-000000000001'::uuid,
    'e9000000-0000-0000-0000-000000000001'::uuid,
    'a9000000-0000-0000-0000-000000000001'::uuid
  );

  -- Seed a reaction from member (for select + delete tests).
  insert into public.comment_reaction (comment_id, user_id, emoji, board_id)
  values (
    'f9000000-0000-0000-0000-000000000001'::uuid,
    'a9000000-0000-0000-0000-000000000002'::uuid,
    '👍',
    'c9000000-0000-0000-0000-000000000001'::uuid
  );
end $$;

-- ============================================================
-- Test 1: Board viewer (workspace member) CAN select reactions.
-- ============================================================

select tests.set_jwt_user('a9000000-0000-0000-0000-000000000002'::uuid);

select is(
  (select count(*)::int
     from public.comment_reaction
    where comment_id = 'f9000000-0000-0000-0000-000000000001'::uuid),
  1,
  'Board viewer can SELECT reactions on comments in their board'
);

-- ============================================================
-- Test 2: Non-member (outsider) CANNOT select reactions (0 rows).
-- ============================================================

select tests.set_jwt_user('a9000000-0000-0000-0000-000000000003'::uuid);

select is(
  (select count(*)::int
     from public.comment_reaction
    where comment_id = 'f9000000-0000-0000-0000-000000000001'::uuid),
  0,
  'Non-member cannot SELECT reactions (0 rows due to RLS using clause)'
);

-- ============================================================
-- Test 3: Member CAN insert their own reaction.
-- ============================================================

select tests.set_jwt_user('a9000000-0000-0000-0000-000000000002'::uuid);

insert into public.comment_reaction (comment_id, user_id, emoji, board_id)
values (
  'f9000000-0000-0000-0000-000000000001'::uuid,
  'a9000000-0000-0000-0000-000000000002'::uuid,
  '🎉',
  'c9000000-0000-0000-0000-000000000001'::uuid
);

select is(
  (select count(*)::int
     from public.comment_reaction
    where comment_id = 'f9000000-0000-0000-0000-000000000001'::uuid
      and user_id = 'a9000000-0000-0000-0000-000000000002'::uuid
      and emoji = '🎉'),
  1,
  'Member can INSERT their own reaction'
);

-- ============================================================
-- Test 4: User CANNOT insert reaction with user_id set to someone else (42501).
-- ============================================================

select throws_ok(
  $$
    insert into public.comment_reaction (comment_id, user_id, emoji, board_id)
    values (
      'f9000000-0000-0000-0000-000000000001'::uuid,
      'a9000000-0000-0000-0000-000000000001'::uuid,  -- owner's id, not the authenticated user
      '😡',
      'c9000000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  '42501',
  null,
  'User cannot INSERT a reaction with user_id set to another user (with check violation)'
);

-- ============================================================
-- Test 5: User CAN delete only their own reaction.
-- ============================================================

-- Reset to service role; set jwt as member, then delete their own reaction.
select tests.reset_to_service_role();
select tests.set_jwt_user('a9000000-0000-0000-0000-000000000002'::uuid);

delete from public.comment_reaction
 where comment_id = 'f9000000-0000-0000-0000-000000000001'::uuid
   and user_id = 'a9000000-0000-0000-0000-000000000002'::uuid
   and emoji = '👍';

select is(
  (select count(*)::int
     from public.comment_reaction
    where comment_id = 'f9000000-0000-0000-0000-000000000001'::uuid
      and user_id = 'a9000000-0000-0000-0000-000000000002'::uuid
      and emoji = '👍'),
  0,
  'User can DELETE their own reaction'
);

-- ============================================================
-- Test 6: Reactions are CASCADE-deleted when their parent comment is deleted.
-- ============================================================

select tests.reset_to_service_role();

-- Confirm the 🎉 reaction from Test 3 still exists before we delete the comment.
-- (👍 was deleted in Test 5; 🎉 was inserted in Test 3.)
delete from public.comment
 where id = 'f9000000-0000-0000-0000-000000000001'::uuid;

select is(
  (select count(*)::int
     from public.comment_reaction
    where comment_id = 'f9000000-0000-0000-0000-000000000001'::uuid),
  0,
  'Deleting a comment cascades-deletes all its reactions'
);

select tests.reset_to_service_role();

select * from finish();
rollback;
