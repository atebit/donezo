# tests/policies — pgTAP RLS Policy Tests

This directory contains pgTAP test files that assert the Row-Level Security
policies defined in `supabase/migrations/`.

## Files

| File | Table(s) covered | Approx. assertions |
|------|------------------|--------------------|
| `00_setup.sql` | helpers (no assertions) | — |
| `10_workspace.sql` | `workspace`, `workspace_member` | 11 |
| `20_board.sql` | `board`, `board_member`, `role_for_board()` | 15 |
| `30_task_cell.sql` | `task`, `cell`, `"column"`, `comment` | 13 |
| `40_invitation.sql` | `invitation`, `wsm_insert`/`bm_insert` accept flows | 13 |
| `50_view.sql` | `view` | 8 |

**Total: 60 assertions** across five test files.

## What each file covers

### `00_setup.sql` — Reusable helpers

Defines the `tests` schema and a set of helper functions used by all test
files:

- `tests.make_user(p_id, p_email)` — inserts into `auth.users` (requires
  superuser / service-role context).
- `tests.set_jwt_user(p_id)` — sets `request.jwt.claims` via `set_config`
  and switches to `role authenticated` so `auth.uid()` resolves to `p_id`.
- `tests.reset_to_service_role()` — undoes `set_jwt_user`; returns to
  service-role context for seeding.
- `tests.seed_workspace(p_workspace_id, p_owner_id)` — inserts a workspace row.
- `tests.seed_workspace_with_roles(p_workspace_id, p_roles)` — creates a
  workspace + populates `workspace_member` from a `{user_id: role}` JSONB.
- `tests.seed_board(p_board_id, p_workspace_id, p_is_private)` — inserts a board.
- `tests.seed_board_member(p_board_id, p_user_id, p_role)` — adds an explicit
  `board_member` row (private board / contractor path).
- `tests.seed_group(p_group_id, p_board_id)` — inserts a minimal group row.
- `tests.seed_task(p_task_id, p_group_id, p_board_id)` — inserts a minimal task.
- `tests.seed_column(p_column_id, p_board_id)` — inserts a minimal `text`-type column.
- `tests.seed_comment(p_comment_id, p_task_id, p_author_id)` — inserts a comment.
- `tests.seed_view(p_view_id, p_board_id, p_owner_id, p_is_shared)` — inserts a
  saved view (`p_owner_id = null` → system-shared).
- `tests.seed_invitation(...)` — inserts an invitation row.

All helpers are defined in the `tests` schema; they are **not** exposed to the
`authenticated` role, so they cannot interfere with RLS checks.

### `10_workspace.sql` — Workspace + members

Asserts:
- Viewers can SELECT their workspace; outsiders cannot.
- Viewers cannot UPDATE workspace (silent RLS block; 0 rows affected).
- Admins can UPDATE workspace.
- Viewers DELETE returns 0 rows; owner DELETE returns 1.
- Members see all `workspace_member` rows in their workspace; outsiders see none.
- Viewers cannot DELETE other members' rows; members can self-remove.
- Non-members cannot INSERT into `workspace_member` without a valid invitation.

### `20_board.sql` — Board + board_member + role_for_board

Asserts:
- `role_for_board` is `security definer` (via `pg_proc.prosecdef`).
- Table-driven correctness of `role_for_board` for every combination:
  workspace owner, viewer-with-board-admin-upgrade (greater_role), workspace
  member, board-only contractor on public board, outsider, workspace member on
  private board without board_member row, explicit board_member on private board.
- Workspace viewers can SELECT non-private boards; outsiders cannot.
- Workspace members cannot SELECT private boards without a `board_member` row.
- Board admins can UPDATE `board.name`; workspace members and admins cannot
  DELETE boards (F1.1 tightened policy to workspace-owner-only); workspace
  owners can DELETE boards.

### `30_task_cell.sql` — Tasks, cells, columns, comments

Asserts:
- Viewers can SELECT tasks; cannot INSERT tasks (42501).
- Members can INSERT and UPDATE tasks and cells.
- Viewers cannot INSERT cells (42501).
- Viewers cannot DELETE columns (0 rows; `using` clause filters silently).
- Outsiders cannot SELECT tasks on private boards.
- Comment authors can UPDATE and DELETE their own comments.
- Non-authors cannot DELETE others' comments (0 rows).
- Board admins can DELETE any comment.
- Members cannot INSERT a comment with a different `author_id` (42501).

### `40_invitation.sql` — Invitation create + accept flow

Asserts (aligned with Q3=(b), Q8=(a), Q13=(b) decisions):
- Admins can INSERT invitations; members cannot (42501).
- Invitees see only their own non-accepted invitation rows.
- Invitees can SET `accepted_at` on their own invitation.
- The `invitation_only_accept_update` trigger blocks updating any other column
  (42501 raised).
- Valid workspace invitation allows invitee to self-insert into `workspace_member`.
- Expired invitation is blocked (42501).
- Mismatched email is blocked (42501).
- **Q13 verification:** board-scoped invitation (`board_id IS NOT NULL`) cannot
  be used to insert into `workspace_member` (42501).
- Valid board-scoped invitation allows invitee to self-insert into `board_member`.
- Already-accepted invitation cannot be reused (42501).

### `50_view.sql` — Saved views

Asserts:
- Personal views (`is_shared=false`, non-null `owner_id`) are hidden from
  other users; visible only to their owner.
- Shared views (`is_shared=true`) are visible to all board members.
- System-shared views (`owner_id IS NULL`) are visible to all board members.
- Non-owners cannot UPDATE personal views (0 rows; `view_modify` `using` clause).
- Owners can UPDATE their own personal views.
- Members cannot UPDATE shared views (requires admin+; 0 rows).
- Admins can UPDATE shared views.

## Helper conventions

1. **Always call seeding helpers in service-role context** (before any
   `set_jwt_user` call, or after `reset_to_service_role()`). Seeding functions
   directly insert into tables and are not subject to RLS, but they do require
   the calling user to have write access to the tables.

2. **`set_jwt_user` is transaction-local** (`set local`). The role resets
   automatically on `rollback` at the end of each test file.

3. **`with check` violations raise `errcode 42501`** (insufficient privilege).
   Use `throws_ok(..., '42501', ...)` for these cases.

4. **`using` clause blocks are silent** — filtered rows return 0 rows affected
   rather than raising an exception. Use `is(count(*)::int, 0, ...)` patterns
   for these assertions.

5. **Fixed UUIDs per file** — each test file uses a distinct UUID prefix
   (`a1…`, `b1…` for file 10; `a2…`, `b2…` for file 20; etc.) to ensure
   no cross-file collisions in case tests are concatenated.

## Running locally

### Prerequisites

1. **Perl** — ships with macOS and most Linux distros. Verify: `perl --version`.

2. **pg_prove** — installed via the CPAN module `TAP::Parser::SourceHandler::pgTAP`,
   which also places the `pg_prove` binary on your `PATH`.

   **macOS:**
   ```bash
   brew install cpanminus          # skip if cpanm is already installed
   cpanm TAP::Parser::SourceHandler::pgTAP
   ```

   **Linux (Debian / Ubuntu):**
   ```bash
   apt-get install libtap-parser-sourcehandler-pgtap-perl
   ```

   **Any platform via cpanm:**
   ```bash
   cpanm TAP::Parser::SourceHandler::pgTAP
   ```

   Verify: `pg_prove --version`

3. **Supabase CLI** — version `2.98.2` (pinned as a dev dependency).
   Already available after `pnpm install`.

### Quick start

```bash
# 1. Start the local Supabase stack (Docker must be running)
supabase start

# 2. Apply all migrations so RLS policies are in place
supabase db push

# 3. Run all pgTAP policy tests (uses the default local port)
pnpm test:policies:ci
```

`pnpm test:policies:ci` sets `DATABASE_URL` to
`postgresql://postgres:postgres@localhost:54322/postgres` automatically.

To use a custom URL:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres \
  pnpm test:policies
```

Or read the URL from `supabase status`:

```bash
DATABASE_URL=$(supabase status --output env | grep "^DB_URL" | cut -d= -f2-) \
  pnpm test:policies
```

### Running a single file

```bash
pg_prove -d postgresql://postgres:postgres@localhost:54322/postgres \
  tests/policies/10_workspace.sql
```

### Notes

- `00_setup.sql` is `\i`-included by each spec file; the runner skips it
  automatically.
- Tests run inside `BEGIN … ROLLBACK` and leave no state in the database.
- `40_invitation.sql` requires the invitation-gated policies migration. It
  will fail until that migration has been applied.
- The `tests` schema helpers are created inside the transaction and are
  rolled back automatically.

## Legacy run options

### Option A — Supabase SQL Editor (scratch project)

1. Open a scratch Supabase project (or Supabase local via `supabase start`).
2. Apply migrations: `supabase db push` (or paste migrations in order).
3. Enable pgTAP: `create extension if not exists pgtap;`
4. Paste the contents of each test file into the SQL Editor and run.

### Option B — psql against a local Supabase instance

```bash
# Start Supabase local
supabase start

# Enable pgTAP (one-time)
psql "$DATABASE_URL" -c "create extension if not exists pgtap;"

# Apply all migrations
supabase db push

# Run a single test file
psql "$DATABASE_URL" -f tests/policies/10_workspace.sql

# Or run all with pg_prove (requires pg_prove installed)
pg_prove -d "$DATABASE_URL" tests/policies/*.sql
```

Replace `$DATABASE_URL` with the local Supabase connection string printed by
`supabase status`.
