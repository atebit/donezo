-- ============================================================
-- tests/policies/00_setup.sql
-- Reusable pgTAP helpers for RLS policy test suites.
--
-- Each *.sql test file \i's this file at the top of its
-- transaction block (after `begin;` and `select plan(N);`).
--
-- CONVENTIONS
-- -----------
-- 1. All helpers run under the Postgres superuser / service-role
--    context (before any set_jwt_user call). Never call a helper
--    after set_jwt_user unless the comment explicitly says it is safe.
--
-- 2. set_jwt_user() calls `set local role authenticated` so every
--    subsequent statement runs as the `authenticated` role (the
--    role Supabase uses for JWT-authenticated requests).
--    Call reset_to_service_role() to return to seeding context.
--
-- 3. All UUIDs in the helpers are hard-coded constants (version 4)
--    so tests are deterministic and human-readable.
--
-- 4. make_user inserts directly into auth.users, which requires
--    superuser / service-role.  It must be called before any
--    set_jwt_user.  Supabase local and pgTAP scratch projects
--    both satisfy this requirement.
--
-- ADDITIONAL HELPERS
-- ------------------
-- seed_group, seed_task, seed_column, seed_comment, seed_view,
-- and seed_invitation are defined here (rather than inline in
-- individual test files) because multiple test files need them
-- and inlining would make those files unmaintainably long.
-- ============================================================

-- Create a dedicated schema for helpers so they do not pollute
-- public and do not interfere with RLS (helpers are never
-- exposed to the authenticated role).
create schema if not exists tests;

-- ------------------------------------------------------------
-- make_user(p_id, p_email)
-- Insert a minimal auth.users row so RLS can resolve auth.uid().
-- The on_auth_user_created trigger fires automatically and creates
-- a matching profile row.
-- ------------------------------------------------------------
create or replace function tests.make_user(p_id uuid, p_email text)
returns void language plpgsql as $$
begin
  insert into auth.users (
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  ) values (
    p_id,
    p_email,
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', split_part(p_email, '@', 1)),
    'authenticated',
    'authenticated'
  )
  on conflict (id) do nothing;
end $$;

-- ------------------------------------------------------------
-- set_jwt_user(p_id)
-- Impersonate p_id as an authenticated Supabase user.
-- Sets request.jwt.claims so auth.uid() returns p_id.
-- Switches the current role to `authenticated`.
-- Use reset_to_service_role() to undo.
-- ------------------------------------------------------------
create or replace function tests.set_jwt_user(p_id uuid)
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text,
    true  -- is_local: scoped to the current transaction
  );
  set local role authenticated;
end $$;

-- ------------------------------------------------------------
-- reset_to_service_role()
-- Undo set_jwt_user; return to service-role / superuser context
-- so seeding helpers can write rows.
-- ------------------------------------------------------------
create or replace function tests.reset_to_service_role()
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ------------------------------------------------------------
-- Permissions: tests switch the active role to `authenticated`
-- via set_jwt_user. Subsequent calls to set_jwt_user / reset_to_service_role
-- from inside a test must therefore be callable by `authenticated`.
-- Other helpers (make_user, seed_*) stay restricted to the seeding context
-- because the test files only invoke them before the first set_jwt_user.
-- ------------------------------------------------------------
grant usage on schema tests to authenticated;
grant execute on function tests.set_jwt_user(uuid) to authenticated;
grant execute on function tests.reset_to_service_role() to authenticated;

-- ------------------------------------------------------------
-- seed_workspace(p_workspace_id, p_owner_id)
-- Insert a workspace row. Always call in service-role context.
-- ------------------------------------------------------------
create or replace function tests.seed_workspace(
  p_workspace_id uuid,
  p_owner_id     uuid
)
returns void language plpgsql as $$
begin
  -- Use the full uuid for the slug because workspace.slug has a unique
  -- constraint and seed fixtures across test files routinely share the
  -- same first hex group (e.g. b1000000-…-001 vs b1000000-…-002).
  insert into public.workspace (id, name, slug, created_by)
  values (
    p_workspace_id,
    'Test Workspace ' || left(p_workspace_id::text, 8),
    'test-ws-' || p_workspace_id::text,
    p_owner_id
  )
  on conflict (id) do nothing;
end $$;

-- ------------------------------------------------------------
-- seed_workspace_with_roles(p_workspace_id, p_roles)
-- Create a workspace and populate workspace_member from a JSONB
-- object of the form {"<user_id>": "<role>", ...}.
-- The first entry (arbitrary ordering) is used as created_by.
--
-- Example:
--   select tests.seed_workspace_with_roles(
--     'ws-uuid'::uuid,
--     '{"owner-uuid":"owner","admin-uuid":"admin","viewer-uuid":"viewer"}'::jsonb
--   );
-- ------------------------------------------------------------
create or replace function tests.seed_workspace_with_roles(
  p_workspace_id uuid,
  p_roles        jsonb
)
returns void language plpgsql as $$
declare
  v_entry  record;
  v_owner  uuid;
begin
  -- Use the first key as created_by.
  select (key)::uuid into v_owner
    from jsonb_each_text(p_roles)
   limit 1;

  perform tests.seed_workspace(p_workspace_id, v_owner);

  for v_entry in
    select (key)::uuid as user_id, value as role
      from jsonb_each_text(p_roles)
  loop
    insert into public.workspace_member (workspace_id, user_id, role)
    values (p_workspace_id, v_entry.user_id, v_entry.role)
    on conflict (workspace_id, user_id) do update set role = excluded.role;
  end loop;
end $$;

-- ------------------------------------------------------------
-- seed_board(p_board_id, p_workspace_id, p_is_private)
-- Insert a board row. Caller must seed the workspace first.
-- ------------------------------------------------------------
create or replace function tests.seed_board(
  p_board_id     uuid,
  p_workspace_id uuid,
  p_is_private   boolean
)
returns void language plpgsql as $$
begin
  insert into public.board (id, workspace_id, name, created_by, is_private)
  values (
    p_board_id,
    p_workspace_id,
    'Test Board ' || left(p_board_id::text, 8),
    (select created_by from public.workspace where id = p_workspace_id),
    p_is_private
  )
  on conflict (id) do nothing;
end $$;

-- ------------------------------------------------------------
-- seed_board_member(p_board_id, p_user_id, p_role)
-- Add an explicit board_member row (private boards, contractor path).
-- ------------------------------------------------------------
create or replace function tests.seed_board_member(
  p_board_id uuid,
  p_user_id  uuid,
  p_role     text
)
returns void language plpgsql as $$
begin
  insert into public.board_member (board_id, user_id, role)
  values (p_board_id, p_user_id, p_role)
  on conflict (board_id, user_id) do update set role = excluded.role;
end $$;

-- ------------------------------------------------------------
-- seed_group(p_group_id, p_board_id)
-- Insert a minimal group row.
-- ------------------------------------------------------------
create or replace function tests.seed_group(
  p_group_id uuid,
  p_board_id uuid
)
returns void language plpgsql as $$
begin
  insert into public."group" (id, board_id, name, position)
  values (p_group_id, p_board_id, 'Test Group', 1.0)
  on conflict (id) do nothing;
end $$;

-- ------------------------------------------------------------
-- seed_task(p_task_id, p_group_id, p_board_id)
-- Insert a minimal task row.
-- NOTE: board_id is set via the task_board_id_consistency trigger
--       (before insert), but passing it explicitly is required
--       for the NOT NULL constraint before the trigger fires.
-- ------------------------------------------------------------
create or replace function tests.seed_task(
  p_task_id  uuid,
  p_group_id uuid,
  p_board_id uuid
)
returns void language plpgsql as $$
begin
  insert into public.task (id, group_id, board_id, title, position)
  values (p_task_id, p_group_id, p_board_id, 'Test Task', 1.0)
  on conflict (id) do nothing;
end $$;

-- ------------------------------------------------------------
-- seed_column(p_column_id, p_board_id)
-- Insert a minimal text column row.
-- ------------------------------------------------------------
create or replace function tests.seed_column(
  p_column_id uuid,
  p_board_id  uuid
)
returns void language plpgsql as $$
begin
  insert into public."column" (id, board_id, name, type, position)
  values (p_column_id, p_board_id, 'Test Column', 'text', 1.0)
  on conflict (id) do nothing;
end $$;

-- ------------------------------------------------------------
-- seed_comment(p_comment_id, p_task_id, p_author_id)
-- Insert a minimal comment row.
-- ------------------------------------------------------------
create or replace function tests.seed_comment(
  p_comment_id uuid,
  p_task_id    uuid,
  p_author_id  uuid
)
returns void language plpgsql as $$
begin
  insert into public.comment (id, task_id, author_id, body, body_text)
  values (
    p_comment_id,
    p_task_id,
    p_author_id,
    '{"type":"doc","content":[]}'::jsonb,
    'Test comment'
  )
  on conflict (id) do nothing;
end $$;

-- ------------------------------------------------------------
-- seed_view(p_view_id, p_board_id, p_owner_id, p_is_shared)
-- Insert a saved view row.
-- p_owner_id = null produces a system-shared (owner_id is null) view.
-- ------------------------------------------------------------
create or replace function tests.seed_view(
  p_view_id    uuid,
  p_board_id   uuid,
  p_owner_id   uuid,     -- null = system-shared
  p_is_shared  boolean
)
returns void language plpgsql as $$
begin
  insert into public.view (id, board_id, owner_id, name, kind, is_shared)
  values (p_view_id, p_board_id, p_owner_id, 'Test View', 'table', p_is_shared)
  on conflict (id) do nothing;
end $$;

-- ------------------------------------------------------------
-- seed_invitation(p_inv_id, p_workspace_id, p_board_id,
--                 p_email, p_role, p_token, p_expires_at, p_invited_by)
-- Insert an invitation row.
-- p_board_id = null → workspace-scoped invitation.
-- p_expires_at = null → defaults to now() + 14 days.
-- ------------------------------------------------------------
create or replace function tests.seed_invitation(
  p_inv_id       uuid,
  p_workspace_id uuid,
  p_board_id     uuid,         -- null for workspace-scoped
  p_email        text,
  p_role         text,
  p_token        text,
  p_expires_at   timestamptz,  -- null = now() + 14 days
  p_invited_by   uuid
)
returns void language plpgsql as $$
begin
  insert into public.invitation (
    id, workspace_id, board_id, email, role, token, expires_at, invited_by
  ) values (
    p_inv_id,
    p_workspace_id,
    p_board_id,
    p_email,
    p_role,
    p_token,
    coalesce(p_expires_at, now() + interval '14 days'),
    p_invited_by
  )
  on conflict (id) do nothing;
end $$;
