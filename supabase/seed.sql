-- =============================================================
-- Donezo demo seed — idempotent (all inserts use on conflict do nothing)
-- Delete the seed user once real users sign up.
--
-- Stable uuid constants:
--   Seed user:         11111111-1111-1111-1111-111111111111
--   Workspace:         22222222-2222-2222-2222-222222222222
--   Board:             33333333-3333-3333-3333-333333333333
--   Group To do:       44444444-4444-4444-4444-444444444401
--   Group Doing:       44444444-4444-4444-4444-444444444402
--   Group Done:        44444444-4444-4444-4444-444444444403
--   Column title:      55555555-5555-5555-5555-555555555501
--   Column status:     55555555-5555-5555-5555-555555555502
--   Column person:     55555555-5555-5555-5555-555555555503
--   Column date:       55555555-5555-5555-5555-555555555504
--   Column number:     55555555-5555-5555-5555-555555555505
--   Column priority:   55555555-5555-5555-5555-555555555506
--   Label working:     66666666-6666-6666-6666-666666666601
--   Label done:        66666666-6666-6666-6666-666666666602
--   Label stuck:       66666666-6666-6666-6666-666666666603
--   Label waiting:     66666666-6666-6666-6666-666666666604
--   Label pending:     66666666-6666-6666-6666-666666666605
--   Prio critical:     66666666-6666-6666-6666-666666666701
--   Prio high:         66666666-6666-6666-6666-666666666702
--   Prio medium:       66666666-6666-6666-6666-666666666703
--   Prio low:          66666666-6666-6666-6666-666666666704
--   Tasks 001–012:     77777777-7777-7777-7777-777777770NNN  (NNN = 001..012)
-- =============================================================

-- ------------------------------------------------------------
-- 1. Auth user (service role bypasses RLS; trigger creates profile)
-- ------------------------------------------------------------
insert into auth.users (
  id,
  instance_id,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at
) values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'seed@donezo.local',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Seed User"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now()
) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. Workspace + member
-- ------------------------------------------------------------
insert into public.workspace (id, slug, name, created_by) values (
  '22222222-2222-2222-2222-222222222222',
  'demo',
  'Donezo Demo',
  '11111111-1111-1111-1111-111111111111'
) on conflict (id) do nothing;

insert into public.workspace_member (workspace_id, user_id, role) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'owner'
) on conflict do nothing;

-- ------------------------------------------------------------
-- 3. Board + member
-- ------------------------------------------------------------
insert into public.board (id, workspace_id, name, created_by) values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'Welcome',
  '11111111-1111-1111-1111-111111111111'
) on conflict (id) do nothing;

insert into public.board_member (board_id, user_id, role) values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'owner'
) on conflict do nothing;

-- ------------------------------------------------------------
-- 4. Columns (positions 1–6: title, status, person, date, number, priority)
-- ------------------------------------------------------------
insert into public."column" (id, board_id, name, type, position) values
  ('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333333', 'Task',     'text',     1),
  ('55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333333', 'Status',   'status',   2),
  ('55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333333', 'Person',   'person',   3),
  ('55555555-5555-5555-5555-555555555504', '33333333-3333-3333-3333-333333333333', 'Due',      'date',     4),
  ('55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333333', 'Points',   'number',   5),
  ('55555555-5555-5555-5555-555555555506', '33333333-3333-3333-3333-333333333333', 'Priority', 'priority', 6)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 5. Groups (positions 1–3)
-- ------------------------------------------------------------
insert into public."group" (id, board_id, name, position) values
  ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333333', 'To do',  1),
  ('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333333', 'Doing',  2),
  ('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333333', 'Done',   3)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 6. Labels: status (5 labels) + priority (4 labels)
-- Status: Working on it, Done, Stuck, Waiting for review, Pending
-- Priority: Critical, High, Medium, Low
-- ------------------------------------------------------------
insert into public.label (id, column_id, name, color, position) values
  ('66666666-6666-6666-6666-666666666601', '55555555-5555-5555-5555-555555555502', 'Working on it',     '#fdab3d', 1),
  ('66666666-6666-6666-6666-666666666602', '55555555-5555-5555-5555-555555555502', 'Done',              '#00c875', 2),
  ('66666666-6666-6666-6666-666666666603', '55555555-5555-5555-5555-555555555502', 'Stuck',             '#e2445c', 3),
  ('66666666-6666-6666-6666-666666666604', '55555555-5555-5555-5555-555555555502', 'Waiting for review','#a25ddc', 4),
  ('66666666-6666-6666-6666-666666666605', '55555555-5555-5555-5555-555555555502', 'Pending',           '#579bfc', 5),
  ('66666666-6666-6666-6666-666666666701', '55555555-5555-5555-5555-555555555506', 'Critical',          '#333333', 1),
  ('66666666-6666-6666-6666-666666666702', '55555555-5555-5555-5555-555555555506', 'High',              '#e2445c', 2),
  ('66666666-6666-6666-6666-666666666703', '55555555-5555-5555-5555-555555555506', 'Medium',            '#fdab3d', 3),
  ('66666666-6666-6666-6666-666666666704', '55555555-5555-5555-5555-555555555506', 'Low',               '#579bfc', 4)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 7. Tasks — 4 per group (12 total); board_id set by trigger
-- ------------------------------------------------------------

-- Group: To do (001–004)
insert into public.task (id, group_id, board_id, title, position, created_by) values
  ('77777777-7777-7777-7777-777777770001', '44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333333', 'Wire up authentication',          1, '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777770002', '44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333333', 'Design board view layout',        2, '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777770003', '44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333333', 'Set up CI pipeline',              3, '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777770004', '44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333333', 'Write onboarding copy',           4, '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

-- Group: Doing (005–008)
insert into public.task (id, group_id, board_id, title, position, created_by) values
  ('77777777-7777-7777-7777-777777770005', '44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333333', 'Implement drag-and-drop for tasks', 1, '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777770006', '44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333333', 'Build column settings panel',       2, '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777770007', '44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333333', 'Set up RLS policies',               3, '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777770008', '44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333333', 'Integrate Resend for email',        4, '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

-- Group: Done (009–012)
insert into public.task (id, group_id, board_id, title, position, created_by) values
  ('77777777-7777-7777-7777-777777770009', '44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333333', 'Scaffold Next.js app',              1, '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777770010', '44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333333', 'Provision Supabase project',        2, '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777770011', '44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333333', 'Define initial database schema',    3, '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777770012', '44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333333', 'Configure Vercel deployment',       4, '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 8. Cells
-- ------------------------------------------------------------

-- Title cells (text_value) — all 12 tasks
insert into public.cell (task_id, column_id, text_value) values
  ('77777777-7777-7777-7777-777777770001', '55555555-5555-5555-5555-555555555501', 'Wire up authentication'),
  ('77777777-7777-7777-7777-777777770002', '55555555-5555-5555-5555-555555555501', 'Design board view layout'),
  ('77777777-7777-7777-7777-777777770003', '55555555-5555-5555-5555-555555555501', 'Set up CI pipeline'),
  ('77777777-7777-7777-7777-777777770004', '55555555-5555-5555-5555-555555555501', 'Write onboarding copy'),
  ('77777777-7777-7777-7777-777777770005', '55555555-5555-5555-5555-555555555501', 'Implement drag-and-drop for tasks'),
  ('77777777-7777-7777-7777-777777770006', '55555555-5555-5555-5555-555555555501', 'Build column settings panel'),
  ('77777777-7777-7777-7777-777777770007', '55555555-5555-5555-5555-555555555501', 'Set up RLS policies'),
  ('77777777-7777-7777-7777-777777770008', '55555555-5555-5555-5555-555555555501', 'Integrate Resend for email'),
  ('77777777-7777-7777-7777-777777770009', '55555555-5555-5555-5555-555555555501', 'Scaffold Next.js app'),
  ('77777777-7777-7777-7777-777777770010', '55555555-5555-5555-5555-555555555501', 'Provision Supabase project'),
  ('77777777-7777-7777-7777-777777770011', '55555555-5555-5555-5555-555555555501', 'Define initial database schema'),
  ('77777777-7777-7777-7777-777777770012', '55555555-5555-5555-5555-555555555501', 'Configure Vercel deployment')
on conflict (task_id, column_id) do nothing;

-- Status cells (label_id) — 10 of 12 tasks across 3 labels
insert into public.cell (task_id, column_id, label_id) values
  -- To do group: mix of Working on it and Stuck
  ('77777777-7777-7777-7777-777777770001', '55555555-5555-5555-5555-555555555502', '66666666-6666-6666-6666-666666666601'), -- Working on it
  ('77777777-7777-7777-7777-777777770002', '55555555-5555-5555-5555-555555555502', '66666666-6666-6666-6666-666666666603'), -- Stuck
  ('77777777-7777-7777-7777-777777770003', '55555555-5555-5555-5555-555555555502', '66666666-6666-6666-6666-666666666601'), -- Working on it
  -- Doing group: mostly Working on it
  ('77777777-7777-7777-7777-777777770005', '55555555-5555-5555-5555-555555555502', '66666666-6666-6666-6666-666666666601'), -- Working on it
  ('77777777-7777-7777-7777-777777770006', '55555555-5555-5555-5555-555555555502', '66666666-6666-6666-6666-666666666601'), -- Working on it
  ('77777777-7777-7777-7777-777777770007', '55555555-5555-5555-5555-555555555502', '66666666-6666-6666-6666-666666666603'), -- Stuck
  ('77777777-7777-7777-7777-777777770008', '55555555-5555-5555-5555-555555555502', '66666666-6666-6666-6666-666666666601'), -- Working on it
  -- Done group: all Done
  ('77777777-7777-7777-7777-777777770009', '55555555-5555-5555-5555-555555555502', '66666666-6666-6666-6666-666666666602'), -- Done
  ('77777777-7777-7777-7777-777777770010', '55555555-5555-5555-5555-555555555502', '66666666-6666-6666-6666-666666666602'), -- Done
  ('77777777-7777-7777-7777-777777770011', '55555555-5555-5555-5555-555555555502', '66666666-6666-6666-6666-666666666602')  -- Done
on conflict (task_id, column_id) do nothing;

-- Person cells (json_value — array of user uuids) — 4 tasks
insert into public.cell (task_id, column_id, json_value) values
  ('77777777-7777-7777-7777-777777770001', '55555555-5555-5555-5555-555555555503', '["11111111-1111-1111-1111-111111111111"]'::jsonb),
  ('77777777-7777-7777-7777-777777770005', '55555555-5555-5555-5555-555555555503', '["11111111-1111-1111-1111-111111111111"]'::jsonb),
  ('77777777-7777-7777-7777-777777770007', '55555555-5555-5555-5555-555555555503', '["11111111-1111-1111-1111-111111111111"]'::jsonb),
  ('77777777-7777-7777-7777-777777770011', '55555555-5555-5555-5555-555555555503', '["11111111-1111-1111-1111-111111111111"]'::jsonb)
on conflict (task_id, column_id) do nothing;

-- Date cells (date_value) — 4 tasks
insert into public.cell (task_id, column_id, date_value) values
  ('77777777-7777-7777-7777-777777770002', '55555555-5555-5555-5555-555555555504', now() + interval '14 days'),
  ('77777777-7777-7777-7777-777777770003', '55555555-5555-5555-5555-555555555504', now() + interval '7 days'),
  ('77777777-7777-7777-7777-777777770006', '55555555-5555-5555-5555-555555555504', now() + interval '5 days'),
  ('77777777-7777-7777-7777-777777770008', '55555555-5555-5555-5555-555555555504', now() + interval '3 days')
on conflict (task_id, column_id) do nothing;

-- Number cells (number_value — story points) — 4 tasks
insert into public.cell (task_id, column_id, number_value) values
  ('77777777-7777-7777-7777-777777770001', '55555555-5555-5555-5555-555555555505', 5),
  ('77777777-7777-7777-7777-777777770005', '55555555-5555-5555-5555-555555555505', 8),
  ('77777777-7777-7777-7777-777777770007', '55555555-5555-5555-5555-555555555505', 3),
  ('77777777-7777-7777-7777-777777770011', '55555555-5555-5555-5555-555555555505', 2)
on conflict (task_id, column_id) do nothing;

-- =============================================================
-- E2E TEST SEED — deterministic IDs for Playwright specs
--
-- Stable uuid constants (e2e section):
--   E2E user:          eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee
--   E2E workspace:     eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01
--   E2E board:         eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02
--   E2E group:         eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03
--   E2E column title:  eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04
--   E2E task 1:        eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10
--   E2E task 2:        eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11
--   E2E task 3:        eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12
--
-- All inserts use ON CONFLICT DO NOTHING so existing demo seed rows are
-- preserved. This section is safe to apply multiple times (idempotent).
-- =============================================================

-- ------------------------------------------------------------
-- E2E-1. Auth user (service role bypasses RLS; trigger creates profile)
-- ------------------------------------------------------------
insert into auth.users (
  id,
  instance_id,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  encrypted_password
) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '00000000-0000-0000-0000-000000000000',
  'e2e-user@donezo.test',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"E2E Test User"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  -- bcrypt hash of 'e2e-test-password-12345'; generated with Supabase local stack
  crypt('e2e-test-password-12345', gen_salt('bf'))
) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- E2E-2. Workspace + member
-- ------------------------------------------------------------
insert into public.workspace (id, slug, name, created_by) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
  'e2e-workspace',
  'E2E Workspace',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
) on conflict (id) do nothing;

insert into public.workspace_member (workspace_id, user_id, role) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'owner'
) on conflict do nothing;

-- ------------------------------------------------------------
-- E2E-3. Board + member
-- ------------------------------------------------------------
insert into public.board (id, workspace_id, name, created_by) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
  'E2E Board',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
) on conflict (id) do nothing;

insert into public.board_member (board_id, user_id, role) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'owner'
) on conflict do nothing;

-- ------------------------------------------------------------
-- E2E-4. Column (title/text)
-- ------------------------------------------------------------
insert into public."column" (id, board_id, name, type, position) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02',
  'Task',
  'text',
  1
) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- E2E-5. Group
-- ------------------------------------------------------------
insert into public."group" (id, board_id, name, position) values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02',
  'E2E Group',
  1
) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- E2E-6. Tasks (3 tasks in E2E group)
-- ------------------------------------------------------------
insert into public.task (id, group_id, board_id, title, position, created_by) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'E2E Task One',   1, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'E2E Task Two',   2, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'E2E Task Three', 3, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- E2E-7. Title cells for E2E tasks
-- ------------------------------------------------------------
insert into public.cell (task_id, column_id, text_value) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', 'E2E Task One'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', 'E2E Task Two'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', 'E2E Task Three')
on conflict (task_id, column_id) do nothing;

-- ------------------------------------------------------------
-- 9. Reload PostgREST schema cache
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
