-- ============================================================
-- tests/policies/submit_form_role.spec.sql
--
-- pgTAP assertions for the `submit_form` SECURITY DEFINER function.
-- Verifies Epic 12 Q24 decision: viewer-role board members can call
-- submit_form, creating a task+cells without member INSERT privileges.
--
-- Assertion count: 6
--
-- Coverage:
--   1. A `viewer`-role workspace member can call submit_form and get a task id.
--   2. A `member`-role user can call submit_form.
--   3. An `admin`-role user can call submit_form.
--   4. A non-member (outsider) cannot call submit_form (raises 42501).
--   5. The task created by a viewer actually exists in the task table.
--   6. Cells submitted by a viewer are persisted in the cell table.
-- ============================================================

begin;

select plan(6);

\i 00_setup.sql

-- ============================================================
-- Seed data (service-role context)
-- ============================================================

do $$
declare
  v_ws_id   uuid := 'f5000000-0000-0000-0000-000000000001'::uuid;
  v_board_id uuid := 'f5000000-0000-0000-0000-000000000002'::uuid;
  v_group_id uuid := 'f5000000-0000-0000-0000-000000000003'::uuid;
  v_view_id  uuid := 'f5000000-0000-0000-0000-000000000004'::uuid;
  v_col_id   uuid := 'f5000000-0000-0000-0000-000000000005'::uuid;

  v_owner_id   uuid := 'f5000000-0000-0000-0000-000000000010'::uuid;
  v_member_id  uuid := 'f5000000-0000-0000-0000-000000000011'::uuid;
  v_viewer_id  uuid := 'f5000000-0000-0000-0000-000000000012'::uuid;
  v_admin_id   uuid := 'f5000000-0000-0000-0000-000000000013'::uuid;
  v_outsider_id uuid := 'f5000000-0000-0000-0000-000000000014'::uuid;
begin
  -- Users
  perform tests.make_user(v_owner_id,   'submit-form-owner@test.example');
  perform tests.make_user(v_member_id,  'submit-form-member@test.example');
  perform tests.make_user(v_viewer_id,  'submit-form-viewer@test.example');
  perform tests.make_user(v_admin_id,   'submit-form-admin@test.example');
  perform tests.make_user(v_outsider_id,'submit-form-outsider@test.example');

  -- Workspace + members
  perform tests.seed_workspace_with_roles(
    v_ws_id,
    jsonb_build_object(
      v_owner_id::text,    'owner',
      v_member_id::text,   'member',
      v_viewer_id::text,   'viewer',
      v_admin_id::text,    'admin'
      -- v_outsider_id is intentionally NOT a workspace member
    )
  );

  -- Board (non-private, so workspace roles apply)
  perform tests.seed_board(v_board_id, v_ws_id, false);

  -- Group (required target for form submission)
  perform tests.seed_group(v_group_id, v_board_id);

  -- Form view
  insert into public.view (id, board_id, owner_id, name, kind, is_shared, config)
  values (v_view_id, v_board_id, null, 'Test Form View', 'form', true, '{}'::jsonb)
  on conflict (id) do nothing;

  -- A text column (so we can test cell insertion)
  perform tests.seed_column(v_col_id, v_board_id);
end $$;

-- ============================================================
-- Test 1: viewer can call submit_form and receives a UUID task id
-- ============================================================

do $$
declare
  v_viewer_id uuid := 'f5000000-0000-0000-0000-000000000012'::uuid;
begin
  perform tests.set_jwt_user(v_viewer_id);
end $$;

select is_not_null(
  public.submit_form(
    'f5000000-0000-0000-0000-000000000002'::uuid,   -- p_board_id
    'f5000000-0000-0000-0000-000000000004'::uuid,   -- p_view_id
    'f5000000-0000-0000-0000-000000000003'::uuid,   -- p_group_id
    '[{"column_id":"f5000000-0000-0000-0000-000000000005","text_value":"submitted by viewer"}]'::jsonb
  ),
  'viewer can call submit_form and gets a task id'
);

-- ============================================================
-- Test 2: member can call submit_form
-- ============================================================

do $$
declare
  v_member_id uuid := 'f5000000-0000-0000-0000-000000000011'::uuid;
begin
  perform tests.set_jwt_user(v_member_id);
end $$;

select is_not_null(
  public.submit_form(
    'f5000000-0000-0000-0000-000000000002'::uuid,
    'f5000000-0000-0000-0000-000000000004'::uuid,
    'f5000000-0000-0000-0000-000000000003'::uuid,
    '[]'::jsonb
  ),
  'member can call submit_form'
);

-- ============================================================
-- Test 3: admin can call submit_form
-- ============================================================

do $$
declare
  v_admin_id uuid := 'f5000000-0000-0000-0000-000000000013'::uuid;
begin
  perform tests.set_jwt_user(v_admin_id);
end $$;

select is_not_null(
  public.submit_form(
    'f5000000-0000-0000-0000-000000000002'::uuid,
    'f5000000-0000-0000-0000-000000000004'::uuid,
    'f5000000-0000-0000-0000-000000000003'::uuid,
    '[]'::jsonb
  ),
  'admin can call submit_form'
);

-- ============================================================
-- Test 4: outsider (non-member) cannot call submit_form
-- ============================================================

do $$
declare
  v_outsider_id uuid := 'f5000000-0000-0000-0000-000000000014'::uuid;
begin
  perform tests.set_jwt_user(v_outsider_id);
end $$;

select throws_ok(
  $$
    select public.submit_form(
      'f5000000-0000-0000-0000-000000000002'::uuid,
      'f5000000-0000-0000-0000-000000000004'::uuid,
      'f5000000-0000-0000-0000-000000000003'::uuid,
      '[]'::jsonb
    )
  $$,
  '42501',
  NULL,
  'outsider cannot call submit_form (42501 raised)'
);

-- ============================================================
-- Test 5: task created by viewer actually exists in task table
-- ============================================================

perform tests.reset_to_service_role();

select ok(
  exists(
    select 1 from public.task
     where board_id = 'f5000000-0000-0000-0000-000000000002'::uuid
       and created_by = 'f5000000-0000-0000-0000-000000000012'::uuid
       and deleted_at is null
  ),
  'task created by viewer exists in task table'
);

-- ============================================================
-- Test 6: cell submitted by viewer is persisted in the cell table
-- ============================================================

select ok(
  exists(
    select 1
      from public.cell c
      join public.task t on t.id = c.task_id
     where t.board_id = 'f5000000-0000-0000-0000-000000000002'::uuid
       and t.created_by = 'f5000000-0000-0000-0000-000000000012'::uuid
       and c.column_id = 'f5000000-0000-0000-0000-000000000005'::uuid
       and c.text_value = 'submitted by viewer'
  ),
  'cell submitted by viewer is persisted with correct text_value'
);

select * from finish();

rollback;
