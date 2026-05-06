# Epic 02 — Supabase Project & Schema

## Goal

Provision a Supabase project, establish the local-dev workflow, design the canonical normalized schema for the entire product, write the migration that creates it, generate TypeScript types, and produce a seed script. RLS policies are stubbed (everything denied by default) and filled in by [04](04-authorization-rls.md).

## Why this is its own epic

The schema is a foundational decision that every later epic reads from. Getting it right once — with stable column ids, normalized cells, polymorphic value storage, and proper indexes — saves rewriting half a dozen feature epics. The schema also determines what RLS policies are even *possible*, so it must precede the authz epic.

## In scope

- Supabase cloud project (production + preview branch).
- Supabase CLI, local Supabase via Docker, migration workflow.
- The full normalized schema for workspaces, boards, groups, tasks, columns, cells, comments, activities, attachments, notifications, views, labels.
- Indexes and constraints.
- Generated TypeScript types (`lib/supabase/types.ts`, gitignored, regenerated on schema change).
- Database functions and triggers needed by the schema (e.g. `updated_at` maintenance, soft-delete cascades).
- A `seed.sql` that creates a demo workspace, a demo board, a few groups, a few tasks, and the default column set.
- Connection clients in `lib/supabase/{client,server,middleware}.ts`.

## Out of scope

- RLS policies (stubbed only; full coverage in [04](04-authorization-rls.md)).
- Auth wiring ([03](03-auth.md)).
- Realtime publication setup ([08](08-realtime-presence.md)).
- Storage bucket setup ([10](10-attachments.md)).

## Dependencies

[01](01-foundation.md) — needs the project skeleton and env validator.

## Architecture & design choices

### Why Postgres / Supabase

Audit conclusion in [`11-recommendation-migrate-now.md`](../audit/11-recommendation-migrate-now.md). Recap of the deciding factors:

- RLS gives us authorization at the database, not the middleware.
- Supabase Auth, Realtime, Storage, and Postgres are one billing item, one client SDK, one set of types.
- The schema we want — normalized with foreign keys and aggregates — is exactly what Postgres is built for.
- No 16 MB document limit; comments and activity grow forever cheaply.

### Naming conventions

- Table names: `singular_snake_case` (`board`, `task`, `cell_value`).
- Column names: `snake_case`.
- Primary keys: `id uuid default gen_random_uuid()`.
- Timestamps: `created_at`, `updated_at`, `deleted_at` — all `timestamptz`.
- Foreign keys: `<table>_id` (e.g. `board_id`).
- Booleans: `is_*` or `has_*`.
- Enum-like text columns: `check (col in (...))`. Prefer `check` constraints over Postgres ENUM types — easier to evolve.

### Soft deletes

Top-level entities (`workspace`, `board`, `group`, `task`) use `deleted_at`. Cells, comments, activities, attachments hard-delete.

A `deleted_at` index supports the "show me only live rows" query. RLS policies in [04](04-authorization-rls.md) filter `deleted_at is null` for read/write paths and expose deleted rows only via an explicit "trash" view.

### The big design call: cell storage

Three options were considered:

**Option A — JSONB on the task.** `task.cells jsonb` keyed by column id. Simple; one row per task. Loses Postgres' typed indexing. Hard to filter by "all tasks where status = Done" efficiently. Hard for RLS to gate per-cell. Loses referential integrity (deleting a column doesn't clean its cells).

**Option B — One row per (task, column) with polymorphic value columns.** A single `cell` table with `text_value`, `number_value`, `boolean_value`, `date_value`, `json_value`. Each cell uses one column based on its type. **Chosen.**

**Option C — One table per cell type.** `cell_text`, `cell_status`, `cell_date`, ... Type-perfect. Joins explode for the table view ("give me the full row for these 50 tasks across 8 columns"). Operationally painful as new column types are added.

**B wins because:**
- One table → one query for all cells of a board: `select * from cell where task_id = any($1)`.
- Indexed filtering by column type (status, date) uses a partial index on the relevant value column.
- Foreign keys: deleting a column cascade-deletes its cells. Deleting a task cascade-deletes its cells.
- RLS once on `cell` covers every value type.
- Polymorphic value columns are nullable; a constraint enforces "exactly one matches the column's type."

The tradeoff: writes have to know which value column to populate based on the column's type. A small dispatcher in the cell registry ([07](07-column-system.md)) handles this.

### Stable column ids, label ids

Critical lesson from the legacy app: `task.status = 'Done'` (the *title*) creates a cascade-rename bug ([06-data-model.md](../audit/06-data-model.md)). New schema:

- A `label` row has a stable id and editable title/color.
- A `cell` row stores `label_id`, never the label title.
- Renaming a label updates *one row*; nothing cascades.

Same pattern for column ids: `cell.column_id` references `column.id`. The column's `title` and `position` change freely.

### Concurrency: `updated_at` as version

Every mutable table has `updated_at timestamptz not null default now()`. A trigger updates it on UPDATE. Server actions can use it as an optimistic-concurrency token where needed (the table view's per-cell edits are last-write-wins per cell, so no token required; structural edits like reordering groups use it).

### Activity log: triggers vs explicit writes

We write activities **explicitly** from server actions, not via triggers. Reasons:

- Triggers can't easily access the actor's identity (`auth.uid()` works, but we want richer payloads — what changed from/to).
- Activity payloads are domain-specific; triggers would either be huge or too generic.
- Explicit writes are testable and traceable in code.

Trigger-based audit logs are an anti-pattern when the audit is user-facing (vs compliance-only).

### Indexes

For every foreign key, an index on the FK column. For sort/filter hot paths:

- `task(group_id, position)` — table view ordering.
- `group(board_id, position)` — board ordering.
- `column(board_id, position)` — column ordering.
- `cell(task_id)` — fetch a task's cells.
- `cell(column_id)` — for column-type queries (e.g. "all tasks where this status column = X").
- `comment(task_id, created_at)`.
- `activity(board_id, created_at desc)` — feed pagination.
- `notification(user_id, created_at desc) where read_at is null` — unread badge.
- `board(workspace_id) where deleted_at is null`.

### Realtime publication

Supabase Realtime needs `alter publication supabase_realtime add table ...`. Add publications for tables that need live updates: `task`, `cell`, `group`, `column`, `comment`, `presence`. Configured here; subscriptions wired in [08](08-realtime-presence.md).

### Schema versioning

Every change is a new migration in `supabase/migrations/`. Never edit a deployed migration. The CI job verifies `supabase db diff` is empty (no schema drift between code and the linked DB) on PR.

## Schema (initial migration)

`supabase/migrations/00000000000001_initial_schema.sql`.

```sql
-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- Common helpers
-- ============================================================

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
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger workspace_set_updated_at
  before update on public.workspace
  for each row execute function public.set_updated_at();

create table public.workspace_member (
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_member_user_idx on public.workspace_member(user_id);

-- ============================================================
-- Boards
-- ============================================================

create table public.board (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  title text not null,
  description text,
  is_starred boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index board_workspace_idx on public.board(workspace_id) where deleted_at is null;

create trigger board_set_updated_at
  before update on public.board
  for each row execute function public.set_updated_at();

create table public.board_member (
  board_id uuid not null references public.board(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index board_member_user_idx on public.board_member(user_id);

-- ============================================================
-- Groups
-- ============================================================

create table public.group (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.board(id) on delete cascade,
  title text not null,
  color text not null default '#c4c4c4',
  position numeric not null,                  -- fractional indexing for cheap reorders
  is_collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index group_board_pos_idx on public.group(board_id, position) where deleted_at is null;

create trigger group_set_updated_at
  before update on public.group
  for each row execute function public.set_updated_at();

-- ============================================================
-- Columns
-- ============================================================

create table public.column (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.board(id) on delete cascade,
  title text not null,
  type text not null check (type in (
    'text','long_text','status','priority','person','date','timeline',
    'number','currency','checkbox','file','link','tags','rating',
    'email','phone','country','vote','week','location',
    'updated_by','created_by','created_at_col'
  )),
  position numeric not null,
  config jsonb not null default '{}'::jsonb,  -- per-type config (currency code, number format, etc.)
  is_pinned boolean not null default false,    -- sticky on table scroll
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index column_board_pos_idx on public.column(board_id, position);

create trigger column_set_updated_at
  before update on public.column
  for each row execute function public.set_updated_at();

-- The first column on every board is always 'text' acting as the task title.
-- Enforced at app layer; not in DB so admins can change ordering.

-- ============================================================
-- Labels (status / priority option sets)
-- ============================================================

create table public.label (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.column(id) on delete cascade,
  title text not null,
  color text not null,
  position numeric not null
);

create index label_column_idx on public.label(column_id, position);

-- ============================================================
-- Tasks
-- ============================================================

create table public.task (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group(id) on delete cascade,
  board_id uuid not null references public.board(id) on delete cascade, -- denormalized for RLS / cell joins
  title text not null default '',
  position numeric not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index task_group_pos_idx on public.task(group_id, position) where deleted_at is null;
create index task_board_idx on public.task(board_id) where deleted_at is null;

create trigger task_set_updated_at
  before update on public.task
  for each row execute function public.set_updated_at();

-- ============================================================
-- Cells (the polymorphic value table)
-- ============================================================

create table public.cell (
  task_id uuid not null references public.task(id) on delete cascade,
  column_id uuid not null references public.column(id) on delete cascade,
  -- value columns; exactly the one matching the column.type is non-null
  text_value text,
  number_value numeric,
  boolean_value boolean,
  date_value timestamptz,
  date_end_value timestamptz,                -- timeline: start = date_value, end = date_end_value
  json_value jsonb,                          -- tags, person ids array, location, etc.
  label_id uuid references public.label(id) on delete set null,
  -- meta
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (task_id, column_id)
);

create index cell_column_idx on public.cell(column_id);
create index cell_label_idx on public.cell(label_id) where label_id is not null;

create trigger cell_set_updated_at
  before update on public.cell
  for each row execute function public.set_updated_at();

-- Constraint: at most one of the value columns is non-null.
-- (Per-type validation is enforced by the app layer; this is a sanity guard.)
alter table public.cell add constraint cell_one_value_check check (
  num_nonnulls(text_value, number_value, boolean_value, date_value, json_value, label_id) <= 1
  -- date_end_value is auxiliary for timeline; doesn't count toward the "one value" rule
);

-- ============================================================
-- Comments
-- ============================================================

create table public.comment (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task(id) on delete cascade,
  parent_id uuid references public.comment(id) on delete cascade, -- threaded
  author_id uuid references auth.users(id) on delete set null,
  body jsonb not null,                       -- Tiptap doc
  body_text text not null,                   -- plain text for search / mention notifications
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index comment_task_idx on public.comment(task_id, created_at);

create trigger comment_set_updated_at
  before update on public.comment
  for each row execute function public.set_updated_at();

-- ============================================================
-- Activity log
-- ============================================================

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.board(id) on delete cascade,
  task_id uuid references public.task(id) on delete set null,
  group_id uuid references public.group(id) on delete set null,
  column_id uuid references public.column(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,                      -- 'task.created','cell.changed','column.added',...
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_board_idx on public.activity(board_id, created_at desc);
create index activity_task_idx on public.activity(task_id, created_at desc);

-- ============================================================
-- Attachments
-- ============================================================

create table public.attachment (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.task(id) on delete cascade,
  storage_path text not null,                -- bucket-relative path
  filename text not null,
  size_bytes bigint not null,
  mime_type text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index attachment_task_idx on public.attachment(task_id);

-- ============================================================
-- Notifications
-- ============================================================

create table public.notification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'mention','assigned','status_changed','due_soon','comment_reply','board_invite'
  )),
  payload jsonb not null,                    -- { board_id, task_id, comment_id, actor_id, ... }
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notification_user_unread_idx
  on public.notification(user_id, created_at desc)
  where read_at is null;

-- ============================================================
-- Saved views
-- ============================================================

create table public.view (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.board(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- null = shared view
  name text not null,
  kind text not null check (kind in ('table','kanban','calendar','timeline','dashboard','form')),
  config jsonb not null default '{}'::jsonb, -- filter, sort, group_by, columns_visible
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index view_board_idx on public.view(board_id, position);

create trigger view_set_updated_at
  before update on public.view
  for each row execute function public.set_updated_at();

-- ============================================================
-- Profile (lightweight extension of auth.users)
-- ============================================================

create table public.profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profile_set_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (user_id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Realtime publication
-- ============================================================

alter publication supabase_realtime add table public.task;
alter publication supabase_realtime add table public.cell;
alter publication supabase_realtime add table public.group;
alter publication supabase_realtime add table public.column;
alter publication supabase_realtime add table public.comment;
alter publication supabase_realtime add table public.notification;

-- ============================================================
-- RLS — enable on every table; policies live in epic 04
-- ============================================================

alter table public.workspace enable row level security;
alter table public.workspace_member enable row level security;
alter table public.board enable row level security;
alter table public.board_member enable row level security;
alter table public.group enable row level security;
alter table public.column enable row level security;
alter table public.label enable row level security;
alter table public.task enable row level security;
alter table public.cell enable row level security;
alter table public.comment enable row level security;
alter table public.activity enable row level security;
alter table public.attachment enable row level security;
alter table public.notification enable row level security;
alter table public.view enable row level security;
alter table public.profile enable row level security;

-- Default deny — no policies until epic 04. Service role bypasses RLS.
```

### Position values: fractional indexing

Groups, tasks, columns, labels, views all use `numeric` `position` columns. To insert between two positions `a` and `b`, use `(a + b) / 2`. This avoids the "shift everything else by 1" pattern. After many drags, positions drift toward needing precision; periodic re-indexing (a maintenance job) compacts them. See [06](06-groups-tasks-table.md) for the implementation.

### Why a `board_id` denormalization on `task`

Strictly, `task.group_id → group.board_id`. We carry `board_id` directly on `task` so:
- Cell RLS can check `task.board_id` without joining `group`.
- Board-wide queries (e.g., "all tasks on this board") avoid a join.

A check constraint or trigger keeps it consistent: when a task moves between groups (rare, cross-group DnD), the move sets both columns. The legacy app's "move task across groups" is the only mutation that touches `group_id`.

## Local dev workflow

```
supabase init        # only first time per repo
supabase start       # boots local Postgres + Studio + Realtime in Docker
supabase db reset    # drops and re-runs all migrations + seed
supabase gen types typescript --local > lib/supabase/types.ts
```

`pnpm db:reset` and `pnpm db:types` scripts wrap these.

A `supabase/seed.sql` populates a demo workspace, board, columns, groups, tasks. Re-runs idempotently.

## Tasks

1. **Create Supabase cloud project.** Two: `donezo-prod`, `donezo-preview`. Configure auth providers later in [03](03-auth.md). Note the project refs.
2. **Install Supabase CLI** in the repo as a dev dep, or use `pnpm dlx`. Pin version.
3. **Initialize Supabase locally.** `supabase init`. Commit `supabase/config.toml`.
4. **Write the initial migration.** Paste the schema SQL above into `supabase/migrations/<ts>_initial_schema.sql`. Refine if anything looks off when running.
5. **Run `supabase db reset`** locally. Confirm everything creates without error.
6. **Generate types.** `supabase gen types typescript --local > lib/supabase/types.ts`. Add to `.gitignore`. Add a `pnpm db:types` script.
7. **Write `lib/supabase/client.ts`** — `createBrowserClient` from `@supabase/ssr`.
8. **Write `lib/supabase/server.ts`** — `createServerClient` for RSC and server actions, reading cookies via `next/headers`.
9. **Write `lib/supabase/middleware.ts`** — refresh-session middleware to be wired in [03](03-auth.md). Stub for now.
10. **Write `lib/supabase/admin.ts`** — service-role client for trusted server-side ops (rare; e.g., creating notifications on behalf of the system). Throws if `NODE_ENV` is `client`.
11. **Write `supabase/seed.sql`.** A demo user (created via `auth.users` insert in dev only) → workspace → board → 3 groups → 5 tasks → default columns (text title, status, person, date, number).
12. **Add `pnpm` scripts:** `db:start`, `db:stop`, `db:reset`, `db:types`, `db:lint` (uses `supabase db lint`).
13. **CI: schema-drift check.** A GitHub Action runs `supabase db diff --linked` against a CI Supabase project and fails if migrations don't match the live DB. Stub this; full wiring lands in [15](15-observability-testing-cicd.md).
14. **Document the dev loop** in `CONTRIBUTING.md`: install Docker → `supabase start` → `pnpm db:reset` → `pnpm dev`.
15. **Connect the deployed Supabase preview project to Vercel preview env.** Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel's preview environment. Production gets the prod project.

## Definition of done

- A new contributor runs `supabase start && pnpm db:reset && pnpm dev` and lands on a functional dev environment with seed data in the database (visible in Supabase Studio at `localhost:54323`).
- `pnpm db:types` regenerates `lib/supabase/types.ts` from the live schema.
- Importing `Database` from `lib/supabase/types.ts` in a server component compiles.
- The schema is in one initial migration; no manual changes outside of migrations.
- Running `supabase db diff` against the local DB returns no drift.
- Vercel preview env has Supabase keys; production env has prod keys.

## Open questions

- **Should `task.title` be a column-typed cell instead of a dedicated field?** The legacy app stored title separately, which is simpler but breaks the "everything is a column" mental model. Recommend keeping `task.title` denormalized for performance (it's read on every row render) and treating column 0 as a read-through to `task.title` rather than a real cell. Document the convention in [07](07-column-system.md).
- **Are we OK with `numeric` positions?** Some teams use `position int` + periodic compaction. `numeric` is simpler and matches Notion / Linear's approach.
- **Branching strategy for Supabase migrations?** Supabase has a "branching" beta that creates per-PR DB instances. Worth piloting. Defer the decision to [15](15-observability-testing-cicd.md).
- **Encrypted columns?** The legacy app stores no PII beyond email + name. If the internal user later wants encrypted notes (e.g., HR boards), `pgcrypto` is here. Not blocking initial release.
- **`activity` retention?** Activity grows forever. Add a partition or a TTL job at [15](15-observability-testing-cicd.md). Not blocking initial release.
