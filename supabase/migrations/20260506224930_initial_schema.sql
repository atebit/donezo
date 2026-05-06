-- ============================================================
-- Epic 02 — initial schema migration
-- All decisions Q7–Q23 from docs/conversion-plan/_dispatch/epic-02.md baked in.
-- Cloud Supabase (Postgres 15+). RLS enabled on every table; zero policies —
-- full coverage lands in epic 04. Service role bypasses RLS.
-- ============================================================

-- ============================================================
-- Extensions
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- Common helpers
-- ============================================================

-- Q19: inline plpgsql helper; no moddatetime extension dep.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- Workspaces
-- ============================================================

create table public.workspace (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create trigger workspace_set_updated_at
  before update on public.workspace
  for each row execute function public.set_updated_at();

-- ============================================================
-- Workspace members
-- ============================================================

create table public.workspace_member (
  workspace_id  uuid  not null references public.workspace(id) on delete cascade,
  user_id       uuid  not null references auth.users(id) on delete cascade,
  role          text  not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- FK index on user_id for "which workspaces does this user belong to?"
create index workspace_member_user_idx on public.workspace_member(user_id);

-- ============================================================
-- Boards
-- ============================================================

create table public.board (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspace(id) on delete cascade,
  name          text        not null,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- FK index; partial on live rows for performance (board listing never shows deleted).
create index board_workspace_idx on public.board(workspace_id) where deleted_at is null;

create trigger board_set_updated_at
  before update on public.board
  for each row execute function public.set_updated_at();

-- ============================================================
-- Board members
-- ============================================================

create table public.board_member (
  board_id    uuid  not null references public.board(id) on delete cascade,
  user_id     uuid  not null references auth.users(id) on delete cascade,
  role        text  not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at  timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- FK index on user_id.
create index board_member_user_idx on public.board_member(user_id);

-- ============================================================
-- Groups  ("group" is a SQL reserved word — always double-quoted)
-- ============================================================

create table public."group" (
  id          uuid        primary key default gen_random_uuid(),
  board_id    uuid        not null references public.board(id) on delete cascade,
  name        text        not null,
  position    numeric     not null,
  color       text        not null default '#c4c4c4',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Composite index: board + position ordering, live rows only.
create index group_board_pos_idx on public."group"(board_id, position) where deleted_at is null;

create trigger group_set_updated_at
  before update on public."group"
  for each row execute function public.set_updated_at();

-- ============================================================
-- Columns  ("column" is a SQL reserved word — always double-quoted)
-- Q10: conservative enum of 17 column types.
-- ============================================================

create table public."column" (
  id          uuid        primary key default gen_random_uuid(),
  board_id    uuid        not null references public.board(id) on delete cascade,
  name        text        not null,
  type        text        not null check (type in (
                'text', 'long_text', 'status', 'priority', 'person',
                'date', 'timeline', 'number', 'currency', 'checkbox',
                'file', 'link', 'tags', 'rating',
                'created_at_col', 'updated_by', 'created_by'
              )),
  position    numeric     not null,
  settings    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Composite index: board + position for ordered column rendering.
create index column_board_pos_idx on public."column"(board_id, position);

create trigger column_set_updated_at
  before update on public."column"
  for each row execute function public.set_updated_at();

-- ============================================================
-- Labels  (status / priority / tags option sets — Q12)
-- ============================================================

create table public.label (
  id          uuid        primary key default gen_random_uuid(),
  column_id   uuid        not null references public."column"(id) on delete cascade,
  name        text        not null,
  color       text        not null,
  position    numeric     not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- FK index on column_id (with position for ordering).
create index label_column_idx on public.label(column_id, position);

create trigger label_set_updated_at
  before update on public.label
  for each row execute function public.set_updated_at();

-- ============================================================
-- Tasks
-- Q7: title text not null default ''.
-- Q13: updated_by nullable; no synthetic uuid writes until epic 03.
-- Q14: board_id denormalized; kept consistent by trigger below.
-- ============================================================

create table public.task (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        not null references public."group"(id) on delete cascade,
  board_id    uuid        not null references public.board(id) on delete cascade,
  title       text        not null default '',
  position    numeric     not null,
  created_by  uuid        references auth.users(id) on delete set null,
  updated_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Q14: FK indexes on group_id and board_id.
create index task_group_pos_idx on public.task(group_id, position) where deleted_at is null;
create index task_board_idx on public.task(board_id) where deleted_at is null;

create trigger task_set_updated_at
  before update on public.task
  for each row execute function public.set_updated_at();

-- ============================================================
-- Cells  (polymorphic value table — option B from architecture doc)
-- No separate id; primary key is (task_id, column_id).
-- Q11: person uses json_value = ["uuid", ...]; no FK from array elements.
-- Q12: tags references label rows via label_id.
-- cell_one_value_check: reconciliation note adds boolean_value for checkbox type.
-- date_end_value is auxiliary for timeline range; excluded from the constraint.
-- ============================================================

create table public.cell (
  task_id        uuid        not null references public.task(id) on delete cascade,
  column_id      uuid        not null references public."column"(id) on delete cascade,
  -- value columns; exactly one matching the column.type is non-null
  text_value     text,
  number_value   numeric,
  boolean_value  boolean,
  date_value     timestamptz,
  date_end_value timestamptz,                    -- timeline: start = date_value, end = date_end_value
  label_id       uuid        references public.label(id) on delete set null,
  json_value     jsonb,                          -- person ids array, tags multi-select, location, etc.
  -- meta
  updated_by     uuid        references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (task_id, column_id)
);

-- Q20: minimal indexes as documented.
create index cell_column_idx on public.cell(column_id);
create index cell_label_idx  on public.cell(label_id) where label_id is not null;

create trigger cell_set_updated_at
  before update on public.cell
  for each row execute function public.set_updated_at();

-- Sanity guard: at most one value column is non-null per row.
-- date_end_value is auxiliary for timeline and excluded per reconciliation note.
-- Requires Postgres 15+ (num_nonnulls with 6 args); cloud Supabase satisfies.
alter table public.cell add constraint cell_one_value_check check (
  num_nonnulls(text_value, number_value, boolean_value, date_value, label_id, json_value) <= 1
);

-- ============================================================
-- Comments
-- Q15: body_text not null default ''.
-- No parent_id (dispatch plan simplifies to flat comments; threading deferred).
-- ============================================================

create table public.comment (
  id          uuid        primary key default gen_random_uuid(),
  task_id     uuid        not null references public.task(id) on delete cascade,
  author_id   uuid        references auth.users(id) on delete set null,
  body        jsonb       not null,              -- Tiptap doc
  body_text   text        not null default '',   -- plain text for search / mention notifications
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Composite index: task + created_at for chronological fetch.
create index comment_task_idx on public.comment(task_id, created_at);

create trigger comment_set_updated_at
  before update on public.comment
  for each row execute function public.set_updated_at();

-- ============================================================
-- Activity log
-- Q16: schema only — no triggers, no automatic inserts. Epic 09 owns writes.
-- Dispatch plan shape: simpler (no group_id / column_id FKs; column named 'type').
-- ============================================================

create table public.activity (
  id          uuid        primary key default gen_random_uuid(),
  board_id    uuid        not null references public.board(id) on delete cascade,
  task_id     uuid        references public.task(id) on delete set null,
  actor_id    uuid        references auth.users(id) on delete set null,
  type        text        not null,              -- 'task.created','cell.changed','column.added', ...
  payload     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- FK indexes on board_id and task_id (with created_at for feed pagination).
create index activity_board_idx on public.activity(board_id, created_at desc);
create index activity_task_idx  on public.activity(task_id,  created_at desc);

-- ============================================================
-- Attachments
-- Q17: full table. comment_id nullable FK for comment-level attachments.
-- uploader_id per dispatch plan (not uploaded_by from schema doc).
-- ============================================================

create table public.attachment (
  id            uuid        primary key default gen_random_uuid(),
  task_id       uuid        not null references public.task(id) on delete cascade,
  comment_id    uuid        references public.comment(id) on delete set null,
  uploader_id   uuid        references auth.users(id) on delete set null,
  storage_path  text        not null,            -- bucket-relative path
  mime_type     text        not null,
  size_bytes    bigint      not null,
  created_at    timestamptz not null default now()
);

-- FK index on task_id.
create index attachment_task_idx on public.attachment(task_id);

-- ============================================================
-- Notifications
-- Q17: full table. kind enum from schema doc (reconciliation note: keep doc enum).
-- ============================================================

create table public.notification (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  kind        text        not null check (kind in (
                'mention', 'assigned', 'status_changed',
                'due_soon', 'comment_reply', 'board_invite'
              )),
  payload     jsonb       not null,              -- { board_id, task_id, comment_id, actor_id, ... }
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- FK index on user_id; partial on unread rows for badge count queries.
create index notification_user_unread_idx
  on public.notification(user_id, created_at desc)
  where read_at is null;

-- ============================================================
-- Saved views
-- owner_id (dispatch plan) replaces user_id (schema doc).
-- kind column name per reconciliation note (schema doc wins over plan's "type" label).
-- is_shared boolean per dispatch plan.
-- ============================================================

create table public.view (
  id          uuid        primary key default gen_random_uuid(),
  board_id    uuid        not null references public.board(id) on delete cascade,
  owner_id    uuid        references auth.users(id) on delete cascade,
  name        text        not null,
  kind        text        not null check (kind in (
                'table', 'kanban', 'calendar', 'timeline', 'dashboard', 'form'
              )),
  config      jsonb       not null default '{}'::jsonb,
  is_shared   boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- FK index on board_id.
create index view_board_idx on public.view(board_id);

create trigger view_set_updated_at
  before update on public.view
  for each row execute function public.set_updated_at();

-- ============================================================
-- Profile  (lightweight extension of auth.users — Q21)
-- id PK = auth.users.id per dispatch plan (not user_id as in schema doc).
-- display_name per dispatch plan (not full_name from schema doc).
-- email included per dispatch plan.
-- ============================================================

create table public.profile (
  id            uuid        primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profile_set_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a user signs up (Q21).
-- SECURITY DEFINER so the function runs with elevated privileges.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Triggers: set_updated_at (already attached above)
-- ============================================================

-- Q14: Denormalization integrity — keep task.board_id in sync with group.board_id.
create or replace function public.task_board_id_consistency()
returns trigger language plpgsql as $$
begin
  new.board_id = (select board_id from public."group" where id = new.group_id);
  return new;
end $$;

create trigger task_board_id_consistency
  before insert or update of group_id on public.task
  for each row execute function public.task_board_id_consistency();

-- Q18: Soft-delete cascade board → groups.
create or replace function public.cascade_soft_delete_to_groups()
returns trigger language plpgsql as $$
begin
  update public."group"
    set deleted_at = new.deleted_at
    where board_id = new.id
      and deleted_at is null;
  return new;
end $$;

create trigger cascade_soft_delete_to_groups
  before update on public.board
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.cascade_soft_delete_to_groups();

-- Q18: Soft-delete cascade group → tasks.
create or replace function public.cascade_soft_delete_to_tasks()
returns trigger language plpgsql as $$
begin
  update public.task
    set deleted_at = new.deleted_at
    where group_id = new.id
      and deleted_at is null;
  return new;
end $$;

create trigger cascade_soft_delete_to_tasks
  before update on public."group"
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.cascade_soft_delete_to_tasks();

-- ============================================================
-- Realtime publication  (Q22)
-- Adds tables that need live updates. Subscriptions wired in epic 08.
-- RLS gates what subscribers actually receive (once epic 04 lands).
-- ============================================================

alter publication supabase_realtime add table public.task;
alter publication supabase_realtime add table public.cell;
alter publication supabase_realtime add table public."group";
alter publication supabase_realtime add table public."column";
alter publication supabase_realtime add table public.comment;
alter publication supabase_realtime add table public.notification;

-- ============================================================
-- RLS — enable on every table; zero policies until epic 04
-- Default-deny for anon + authenticated. Service role bypasses RLS.
-- ============================================================

alter table public.workspace        enable row level security;
alter table public.workspace_member enable row level security;
alter table public.board            enable row level security;
alter table public.board_member     enable row level security;
alter table public."group"          enable row level security;
alter table public."column"         enable row level security;
alter table public.label            enable row level security;
alter table public.task             enable row level security;
alter table public.cell             enable row level security;
alter table public.comment          enable row level security;
alter table public.activity         enable row level security;
alter table public.attachment       enable row level security;
alter table public.notification     enable row level security;
alter table public.view             enable row level security;
alter table public.profile          enable row level security;
