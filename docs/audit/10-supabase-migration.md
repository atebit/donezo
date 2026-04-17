# Supabase Migration — Lift Assessment

Secondary audit: what would it take to move Donezo's persistence (and possibly auth + realtime + file storage) to Supabase?

**TL;DR**: moderate-to-large lift. The *database* migration alone is **M–L** (roughly 3–7 engineer days), because the current document-embedded board shape has to be normalized into Postgres tables. But Supabase simultaneously replaces four of the messier parts of today's stack — MongoDB, bcrypt/Cryptr auth, Socket.IO, and Cloudinary — and removes several of the critical bugs by construction. If you're going to take on a big refactor anyway, doing it while swapping to Supabase is a better use of effort than modernizing the MongoDB stack in place.

## What Supabase brings

| Concern | Supabase capability | What it replaces here |
|---------|---------------------|------------------------|
| Database | Managed Postgres (v15+), with PostgREST-generated REST + SQL access | MongoDB Atlas + `mongodb` driver 3.2.7 |
| Auth | Email/password, OAuth (Google native), magic links, JWTs, session management, `auth.users` table | bcrypt + Cryptr + AsyncLocalStorage cookie flow |
| Authorization | Row-Level Security (RLS) policies in Postgres | No real authorization today — board routes are commented out |
| Realtime | Postgres Changes (CDC) + Presence + Broadcast channels via `supabase-js` | Socket.IO topic broadcasts |
| File storage | Buckets with policies, public or signed URLs | Cloudinary (optional replacement) |
| Edge functions | Deno-based serverless functions for custom logic | The bits of Express that aren't pure CRUD |
| Client SDK | `@supabase/supabase-js` covers DB + auth + realtime + storage | axios + socket.io-client + bcrypt flow |

## Current stack → Supabase mapping

### Persistence — the big one

Current:
- One collection per domain, one monolithic document per board with embedded `groups[].tasks[].comments[]`, `members[]`, `labels`, `activities[]`.
- Full-document read-modify-write on every mutation.
- Task id is a 6-char `makeId()` string; client-generated.

Supabase (normalized schema sketch):

```sql
create table workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table workspace_member (
  workspace_id uuid references workspace(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  primary key (workspace_id, user_id)
);

create table board (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspace(id) on delete cascade,
  title text not null,
  description text,
  is_starred boolean default false,
  cmps_order jsonb default '[]',
  created_by uuid references auth.users(id),
  updated_at timestamptz default now()
);

create table board_member (
  board_id uuid references board(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null,
  primary key (board_id, user_id)
);

create table label (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references board(id) on delete cascade,
  kind text not null check (kind in ('status','priority')),
  title text not null,
  color text not null,
  position int not null
);

create table "group" (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references board(id) on delete cascade,
  title text not null,
  color text,
  position int not null
);

create table task (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references "group"(id) on delete cascade,
  title text not null,
  status_label_id uuid references label(id),
  priority_label_id uuid references label(id),
  due_date timestamptz,
  number numeric,
  checkbox boolean,
  position int not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now()
);

create table task_member (
  task_id uuid references task(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (task_id, user_id)
);

create table comment (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references task(id) on delete cascade,
  author_id uuid references auth.users(id),
  body text not null,
  style jsonb,
  created_at timestamptz default now()
);

create table attachment (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references task(id) on delete cascade,
  url text not null,
  kind text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references board(id) on delete cascade,
  task_id uuid references task(id) on delete set null,
  actor_id uuid references auth.users(id),
  action text not null,
  payload jsonb,
  created_at timestamptz default now()
);
```

Wins this schema gives you for free:
- Labels have stable ids; renaming a status label no longer cascades through every task (the current loose-`==` bug disappears).
- Multi-file attachments (array becomes a table).
- Board-level `updated_at` is automatic.
- Concurrency: `UPDATE task SET ... WHERE id = $1` is atomic. Two clients editing different tasks cannot overwrite each other.
- No 16 MB document ceiling.

Trade-off:
- Every write that used to be "save the board" becomes one or more specific queries. The action-creators in `store/board.actions.js` need a rewrite (you'd probably rename them: `renameTask`, `moveTask`, `addTask`, etc., and drop the "save whole board" convenience).

### Auth

Today:
- Frontend: `@react-oauth/google` for Google, `sessionStorage` for user state.
- Backend: `bcrypt` + `Cryptr` + cookie + AsyncLocalStorage middleware.
- Password login is broken; guest mode is hardcoded on; cookies have no `HttpOnly`.

Supabase replaces all of it:
- Configure Google as an OAuth provider in the Supabase dashboard.
- Frontend: `supabase.auth.signInWithOAuth({ provider: 'google' })` and `supabase.auth.signInWithPassword({ email, password })`. Session is managed by the SDK; user state is a Redux-less observable.
- Backend: no custom auth code. RLS policies reference `auth.uid()` and the user is authenticated by the JWT Supabase issues.
- Password resets, email verification, magic links — all in the dashboard.

What disappears from this repo: `backend/api/auth/*`, `backend/middlewares/requireAuth.middleware.js`, `backend/middlewares/setupAls.middleware.js`, `backend/services/als.service.js`, `bcrypt` + `cryptr` + `google-auth-library` deps, the sessionStorage-based user hydration on the frontend.

### Authorization (RLS)

Today: unprotected routes.

Supabase RLS example:

```sql
alter table board enable row level security;

create policy "members can read their boards"
on board for select
using (
  exists (
    select 1 from board_member bm
    where bm.board_id = board.id and bm.user_id = auth.uid()
  )
);

create policy "editors can update their boards"
on board for update
using (
  exists (
    select 1 from board_member bm
    where bm.board_id = board.id and bm.user_id = auth.uid()
    and bm.role in ('owner','admin','member')
  )
);
```

RLS policies are the authorization layer. Wire them once at schema setup; the frontend can then talk directly to the DB with the user's JWT and Postgres will enforce access.

### Realtime

Today: Socket.IO rooms per board. Clients broadcast full board snapshots. No auth, no authorization, `origin: '*'`.

Supabase has three realtime primitives — you'd mix them:
- **Postgres Changes** — subscribe to inserts/updates/deletes on `task`, `group`, `board`, etc. With RLS enabled, users only receive events for rows they can see. This replaces 95% of what Socket.IO does today.
- **Broadcast** — ephemeral messages that aren't persisted (typing indicators, cursor positions).
- **Presence** — who's currently viewing a board.

Example (frontend):

```js
supabase
  .channel('board:' + boardId)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'task', filter: `group_id=in.(...)`},
      payload => dispatch(applyTaskChange(payload)))
  .subscribe()
```

What disappears: `backend/services/socket.service.js`, `socket.io` + `socket.io-client` deps, the homegrown topic-based room logic, every `SOCKET_EMIT_SEND_UPDATE_BOARD` in the action creators.

### File storage

Today: Cloudinary with an unsigned preset exposed in the frontend.

Supabase Storage:
- Create a bucket (e.g., `task-attachments`).
- Set access rules (public, authenticated, or per-row via RLS over the `storage.objects` table).
- Frontend: `supabase.storage.from('task-attachments').upload(...)`.
- Returns a path; store it on `attachment.url`.

This one is optional — Cloudinary keeps working if you prefer. But migrating consolidates accounts and lets you sign uploads via the user's Supabase JWT.

## Two migration strategies

### A. Supabase as a pure backend (recommended)

Drop Express entirely. Frontend talks directly to Supabase via `@supabase/supabase-js`. Any server-side business logic that can't live in RLS goes in Edge Functions.

Pros:
- Simplest long-term shape: no Express, no Socket.IO server, no auth middleware.
- Fewer deploy targets — just the frontend and a Supabase project.
- RLS enforces authorization at the DB, which is the hardest place for a bug to hide.

Cons:
- Requires rewriting thunks (`store/board.actions.js`) to use `supabase-js` instead of `http.service`.
- Any cross-table write that needs atomicity has to use Postgres functions (RPC) or Edge Functions.
- Bulk exports / reports are harder without a custom backend.

### B. Supabase as the DB behind a keep-Express facade

Keep `backend/` Express layer; swap the `db.service.js` for a `@supabase/supabase-js` service-role client. Frontend still talks to `/api/*`.

Pros:
- Minimal frontend churn.
- Keeps Express for any custom logic you already had planned.
- Auth still custom if you want.

Cons:
- You're paying Supabase for a managed Postgres and still running a Node backend.
- RLS is bypassed by service-role keys — you lose the biggest security win.
- Realtime and auth advantages are harder to use from the server side.

Strategy A is the better fit for this project given:
- The Express layer is thin (just CRUD + socket).
- The current auth layer is already broken and needs replacing anyway.
- RLS is strictly better than uncommenting-a-middleware-and-hoping.

## Effort estimate (strategy A)

| Task | Effort | Notes |
|------|--------|-------|
| Supabase project setup + env vars | S | Create project, configure Google OAuth, provision buckets. |
| Schema migration (`supabase/migrations/*.sql`) | M | Design tables, RLS policies, indexes. |
| Data migration script (Mongo → Postgres) | M | One-shot Node script reading each board doc and inserting normalized rows. Preserve ids as UUIDs (or remap). |
| Frontend: install `@supabase/supabase-js` + auth refactor | M | Rewrite `userModule` to derive from `supabase.auth` session. Remove sessionStorage user save. |
| Frontend: rewrite `board.actions.js` | L | Every thunk now hits `supabase.from(...).insert/update/delete`. Add realtime subscriptions. |
| Frontend: rewrite `board.service.js` helpers | S | `getFilteredBoard` becomes a PostgREST query. |
| Remove Socket.IO | S–M | Strip emits/listeners; replace with Realtime. |
| Replace Cloudinary (optional) | S | Swap `upload.service.js` to `supabase.storage`. |
| Delete Express backend | S | Archive `backend/` or keep only a thin `/api/webhook`-style footprint if needed. |
| Auth UI (signup + reset) | M | You need a real signup form anyway; Supabase's hosted widgets or rolling your own `supabase.auth.signUp` form. |
| Tests | M | RLS policies need testing; realtime flows need at least smoke tests. |
| CI + deploy recipe | S | Frontend on Vercel/Netlify; Supabase manages the rest. |

**Total: 3–7 engineer days for a single engineer** depending on scope (e.g., optional Cloudinary swap, how much of Phase 6 kanban/calendar you want). Add buffer for RLS debugging — it's straightforward but unfamiliar territory. Double the estimate if you haven't shipped RLS policies before.

## Risks & unknowns

1. **Realtime at scale**. Supabase Realtime is great up to moderate concurrent connections; monday.com-scale boards with many editors would need measuring. For a private/small-team product this is a non-issue.
2. **RLS authoring burden**. Policies are SQL and test harnesses are primitive. Plan to write a small test script that impersonates different users via service-role JWTs.
3. **Referential integrity vs. flexibility**. The embedded doc made arbitrary shape changes trivial. In Postgres, adding a new column type or per-task field means a migration. `jsonb` columns soften this — e.g., `task.cells jsonb` for dynamic column values — but you lose some RLS/indexing affordances.
4. **Auth migration for existing users**. If there are real users in MongoDB, their bcrypt hashes can't be reused directly by Supabase auth. Either force password reset or use Supabase's SAML-style pre-migration flow (Supabase can import bcrypt hashes with a specific format).
5. **Dev-loop friction**. Supabase CLI + local dev stack (`supabase start`) is good but adds a dependency. Plan on Docker being available.
6. **Cost**. Supabase free tier handles hobby-scale fine; past that, Pro is $25/mo. Atlas free tier is similar. Realistic comparison only matters past ~50k DAU.

## What stays the same

- The entire SCSS design system.
- The component tree under `src/cmps/*`.
- The pages under `src/pages/*`.
- Redux can stay (you'd move from "sync state by socket broadcast" to "sync state by Realtime subscription" — same mental model).
- The feature gaps in [04-feature-matrix.md](04-feature-matrix.md) are unchanged by this migration — they're UI/product work.

## What gets better by default

- The login password bug can't exist (Supabase handles password verification).
- The "board routes unauthenticated" bug can't exist (RLS).
- The "hardcoded Mongo URI" bug turns into a single `SUPABASE_URL` + anon key pair; the anon key is designed to be public.
- The "cookie missing HttpOnly" bug is Supabase's problem (they handle it correctly).
- The concurrency/lost-update problem disappears.
- The label-rename cascade disappears (labels have ids).
- The 16 MB document ceiling disappears.
- The socket authz/impersonation bug disappears (Realtime enforces RLS on subscriptions).

Several of the **critical** items in [05-security.md](05-security.md) evaporate as a side effect.

## Recommended sequencing

If the team chooses Supabase:

1. **First**, do Phase 0 of [09-roadmap-to-full-featured.md](09-roadmap-to-full-featured.md) anyway — rotate credentials, fix login, add `httpOnly`. Don't leave production exposed while you plan a migration.
2. **Then**, spike the schema + RLS on a Supabase project against a small test board. 1 day to validate the shape.
3. **Then**, write the data migration script and do a dry run with real board data. Verify counts and shapes.
4. **Then**, branch-cut: build the frontend refactor on a feature branch, ship to a preview URL pointed at a staging Supabase project. Keep the Express stack running on main.
5. **Cutover**: final export, final import, flip DNS / env. Old backend is archived but not deleted.

## Recommended sequencing if the team chooses to stay on MongoDB

Do Phase 0–3 of [09-roadmap-to-full-featured.md](09-roadmap-to-full-featured.md). The security fixes are the same; the data model work ends up being Mongoose schemas + array operators instead of RLS policies. Most of the effort estimate above stays roughly the same size — it just lands as "modernize the existing stack" rather than "swap stacks". **If you're going to spend the effort either way, Supabase gives more per engineer-day.**
