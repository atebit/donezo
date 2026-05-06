# Epic 02: Supabase Project & Schema — Dispatch Plan

**Status:** approved, ready to execute via `/execute-epic 02`
**Approved on:** 2026-05-06
**Source epic doc:** `docs/conversion-plan/02-supabase-schema.md`
**Branch:** `epic/02-supabase-schema` off `main`

## User decisions (locked)

| # | Question | Decision |
|---|---|---|
| 1 | When env-keys flip from optional → required in `lib/env.ts` | **End of epic** (sequential follow-up F3). Prevents a mid-epic boot break. |
| 2 | Env naming | **Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`** alongside the Vercel-Supabase integration's keys. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Stay on classic `anon` + `service_role` JWTs (NOT the new `sb_publishable_…`/`sb_secret_…` pair). |
| 3 | Migration application path | `supabase link --project-ref <REF>` once → `pnpm db:push` from a developer machine to apply migrations to the linked remote. |
| 4 | Supabase project ref | **Soft-locked: `<REF>` placeholder in `pnpm db:link` script.** User runs `supabase link --project-ref <actual>` once locally; the link is persisted in `supabase/.temp/` (already gitignored). If user paste the ref before execution, hardcode it instead. |
| 5 | Schema-drift CI | **Defer to epic 15.** Epic 02 ships scripts but no workflow file changes. |
| 6 | Type-generation cadence | **Un-gitignore `lib/supabase/types.ts` and check it in.** F1 generates and commits the real file. Drift detection deferred to epic 15. |
| 7 | `task.title` denormalized | **Yes** — keep `task.title text not null default ''`. Epic 07 implements column-0 as a read-through. |
| 8 | Default column set | **5 columns:** text title (position 1), status (2), person (3), date (4), number (5). |
| 9 | Default status labels | **Monday-style:** `Working on it` (orange), `Done` (green), `Stuck` (red). Stable uuids in seed. |
| 10 | `column.type` enum scope | **Conservative subset (~17 types):** `text, long_text, status, priority, person, date, timeline, number, currency, checkbox, file, link, tags, rating, created_at_col, updated_by, created_by`. Future types via migration. |
| 11 | `person` cell | `json_value = ["uuid", ...]` — array of `auth.users.id`. **No FK** from array elements; referential integrity is best-effort at the app layer. Documented decision. |
| 12 | `tags` cell | **References `label` rows** (same pattern as status/priority — multi-select status). |
| 13 | `updated_by` | Nullable on both `task` and `cell`. Seed sets `null`. **No DB write may set `updated_by` to the synthetic uuid `00000000-…` until epic 03 lands real auth** (would FK-fail). |
| 14 | `task.board_id` denormalization integrity | **Trigger.** `BEFORE INSERT OR UPDATE OF group_id ON public.task` copies `group.board_id` → `task.board_id`. |
| 15 | `comment.body_text` | App-layer maintained (epic 09). Schema declares `not null` with default `''`. |
| 16 | `activity` table | **Schema only.** No triggers, no automatic inserts. Epic 09 owns inserts. |
| 17 | `notification` and `attachment` tables | **Full tables** (so epics 10 and 13 don't need ALTER migrations). |
| 18 | Soft-delete cascade | **Trigger.** `BEFORE UPDATE ON public.board WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)` cascades `deleted_at` to descendant `group`s and `task`s. Same pattern for `group` → `task`. Cells/labels/comments do NOT get a `deleted_at` (they "disappear" with their parent and reappear on restore). |
| 19 | `updated_at` maintenance | **Inline `set_updated_at()` plpgsql function** (no `moddatetime` extension dep). |
| 20 | Cell value indexing | **Minimal** — only the indexes the doc lists (`cell(column_id)`, `cell(label_id) where label_id is not null`, etc.). Type-targeted partial indexes (`date_value`, `number_value`, GIN on `json_value`) deferred to epic 11 when query shapes are known. |
| 21 | `profile` row trigger | **Ship now.** `on_auth_user_created` trigger inserts into `public.profile`. Dormant until epic 03 wires real auth. |
| 22 | Realtime publication | **Ship adds** for `task, cell, group, column, comment, notification` in initial migration. Realtime payloads gated by RLS once epic 04 lands. |
| 23 | `workspace_member` + `board_member` | **Both tables** as defined in epic doc. Epic 04 defines policy interaction. |
| 24 | Seed user identity | **Soft-locked: option (a).** Seed creates `auth.users` row with stable uuid `11111111-1111-1111-1111-111111111111` and email `seed@donezo.local`. Documented as "delete this user once real users sign up." Override before execution if user prefers (b) null-everywhere. |
| 25 | Seed shape | `Donezo Demo` workspace (slug `demo`), `Welcome` board, 3 groups (`To do`, `Doing`, `Done`), 4 tasks each (12 total), 5 default columns, 3 status labels, ~20 populated cells (title cells full; status distributed across 3 labels; person/date/number partial). |
| 26 | Seed re-runnability | **Idempotent** — `on conflict (id) do nothing` for parents; `on conflict (task_id, column_id) do nothing` for cells. Cloud DB persists between runs. |
| 27 | Admin client guard | `typeof window !== "undefined"` runtime throw + missing-key check + lazy singleton. |
| 28 | Admin import restriction | **Biome `noRestrictedImports` rule** blocking `@/lib/supabase/admin` from any path under `components/**` or any file containing `"use client"`. Lint enforcement, not just convention. |
| 29 | CONTRIBUTING.md updates | **Replace any Docker/`supabase start` references with cloud-first dev loop.** New "Schema migrations" subsection covers `supabase migration new` → `pnpm db:push` → `pnpm db:types` → commit. |
| 30 | Vercel env wiring | **Manual by user** (not a slice). User adds the same env keys to Vercel preview/production envs via dashboard. |

## Preconditions verified

- On `main`, working tree clean, in sync with `origin/main`. Latest commit `5aa53ff`. Epic 01 PR `#33` merged.
- Legacy code removed from git (commit `a5d47c2`); `frontend/`/`backend/` are gitignored, present locally only.
- **No `@supabase/*` packages installed.** Epic 02 adds `@supabase/supabase-js` + `@supabase/ssr` (slice A) and `supabase` CLI as devDep (slice D).
- `lib/env.ts` declares Supabase env keys as `optional()`; flip to required deferred to F3.
- `lib/actions/with-user.ts` returns synthetic uuid `00000000-0000-0000-0000-000000000000` with TODO for epic 03. Epic 02 ships ZERO writes from app code; only migration + seed write.
- `lib/logger.ts` is server-only (throws if imported in client). `lib/supabase/client.ts` must NOT import it.
- `supabase/config.toml` exists from epic 01's `supabase init`. `project_id = "donezo"`. `db.major_version = 17`. `db.seed.sql_paths = ["./seed.sql"]`. **No `supabase/migrations/` dir yet. No `supabase/seed.sql` yet.**
- `supabase/.temp/` gitignored.
- `lib/supabase/.gitkeep` exists. `lib/supabase/types.ts` currently in `.gitignore` line 30 — **slice D removes that line per Q6**.
- `.env.local` exists locally (gitignored). Has Vercel-Supabase integration keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_*`, etc.). **User adds `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`** mirroring values per Q2 — flag for orchestrator to confirm before F1 runs.
- `.env.example` lists the `NEXT_PUBLIC_*` variants and `SUPABASE_SERVICE_ROLE_KEY` only. Stays as-is per Q2 (canonical naming for the codebase).

## Stack defaults (restated for executors)

From `CLAUDE.md` — non-negotiable unless `02-supabase-schema.md` explicitly overrides:

- **pnpm only.** No npm, no yarn.
- **Next.js 15 App Router**, RSC-first. `"use client"` only for interactivity.
- **Server Actions** for mutations. No `/api` route handlers except webhooks.
- **TypeScript strict** with `verbatimModuleSyntax: true`. Generated `Database` type imported via `import type` only.
- **Biome 2.x** (linter/formatter). Active rules: `suspicious.noConsole: error`, `style.useImportType: error`, `style.noDefaultExport: error` (with framework-file allowlist), `correctness.noUnusedImports: error`. Use `logger` from `lib/logger.ts` server-side; bootstrap-time `console.*` requires inline `// biome-ignore lint/suspicious/noConsole:` comment.
- **Zod** validates env, server-action input, structured payloads.
- **uuid v4** ids from Postgres (`gen_random_uuid()`); **`timestamptz`** for times; **soft-delete** via `deleted_at timestamptz null` on top-level entities (`workspace`, `board`, `group`, `task`).
- **Migrations:** `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Never edit a deployed migration.
- **RLS-as-source-of-truth.** Epic 02 enables RLS on every table with **zero policies** — default-deny for all clients except `service_role`. Real policies land in epic 04.
- **Cell-type ids are short strings** (`text`, `status`, `person`, …). The check constraint on `column.type` is canonical.
- **Never modify legacy `frontend/`/`backend/`** in any slice (gitignored regardless).
- **Forbidden-scope is a hard rule.** If a slice spec lists a path under "Forbidden scope" and you discover you need to edit it, **stop and return a needs-direction report** — do NOT edit first and report after. Approved retroactively is still a process violation that breaks parallel-dispatch contracts. (See `.claude/agents/epic-executor.md`.)

## Execution order

```
Stage 1: A (env keys + Supabase clients + admin guard)            [solo]
            ↓
Stage 2: B (initial schema migration)                              ┐
         C (seed.sql)                                              ├─ parallel
         D (pnpm db:* scripts + CONTRIBUTING + types.ts un-ignore) ┘
            ↓
Per-stage review pass after each stage. Followup loop until reviewer returns CLEAN.
            ↓
Sequential follow-ups:
  F1. Cloud bootstrap (link, push, gen types, seed) — orchestrator runs locally
  F2. Smoke test
  F3. Env-key required-flip
            ↓
Epic-level review pass.
            ↓
PR into main.
```

---

## Slice A — Supabase env keys + client/server/middleware/admin clients

**Owner:** epic-executor (sonnet) · **Stage:** 1 (solo) · **Branch:** commit on `epic/02-supabase-schema`

### Scope

- `/lib/env.ts` — keep all Supabase keys `.optional()` per Q1; **add no new keys** unless Q2 requires it (Q2's decision keeps the existing key shape, so likely zero edits — but verify by reading the file). If `lib/env.ts` doesn't already export an `Env` type, add the `export type Env = z.infer<typeof EnvSchema>;` line.
- `/lib/supabase/client.ts` — **new** — `createClient` using `createBrowserClient` from `@supabase/ssr`, generic-typed with `Database`.
- `/lib/supabase/server.ts` — **new** — `createServerClient` for RSC + server actions, cookies via `next/headers`, generic-typed with `Database`. Per request (not module-scope).
- `/lib/supabase/middleware.ts` — **new** — stub `updateSession(request: NextRequest): NextResponse` returning `NextResponse.next()` with a `// TODO epic 03: implement session refresh per @supabase/ssr middleware recipe.` comment. Exists so epic 03's `middleware.ts` can call into a known path.
- `/lib/supabase/admin.ts` — **new** — service-role client. Lazy singleton. Throws synchronously at module evaluation if `typeof window !== "undefined"`. `adminClient()` throws if `SUPABASE_SERVICE_ROLE_KEY` or URL is missing.
- `/lib/supabase/index.ts` — **new** — barrel re-exporting `createClient` (from `./client`), `createServerClient` (from `./server`), and types.
- `/.env.example` — verify it already lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (it does, per epic 01). No edits unless the executor finds a discrepancy.
- `/package.json` — additive only: add `@supabase/supabase-js` and `@supabase/ssr` to `dependencies`. Do NOT touch scripts, packageManager, engines, or any other field.
- `/pnpm-lock.yaml` — regenerated as a side effect.
- `/biome.json` — surgical addition: `linter.rules.style.noRestrictedImports` rule blocking `@/lib/supabase/admin` from any path under `components/**` or `app/**/_components/**` or any file containing `"use client"`. (If Biome 2.x's `noRestrictedImports` shape doesn't support per-file-pattern restrictions cleanly, fall back to project-level restriction in the rule + a comment in `lib/supabase/admin.ts`. **If even the simple rule is unavailable, escalate** — don't silently drop the rule.)
- `/tests/unit/supabase-admin.test.ts` — **new** — tests the two throw paths. Use existing `// @ts-expect-error vitest is wired in epic 15` import pattern + `vi.resetModules()` + dynamic `await import()`.

### Forbidden scope

`supabase/migrations/`, `supabase/seed.sql`, `supabase/config.toml`, `app/**`, `components/**`, `lib/actions/**`, `lib/logger.ts`, `lib/utils.ts`, `tsconfig.json`, `next.config.ts`, `.github/`, `CLAUDE.md`, `README.md`, `.claude/`, legacy. **Hard rule** — escalate if you need to touch any of these.

### Dependencies on other slices

None. Stage 1.

### Spec details

1. **Install deps:** `pnpm add @supabase/supabase-js @supabase/ssr`. Inspect lockfile diff — if anything beyond the expected adds churns, escalate.

2. **`lib/supabase/client.ts`** (~15 lines):
   ```ts
   import { createBrowserClient } from "@supabase/ssr";
   import { env } from "@/lib/env";
   import type { Database } from "./types";

   export function createClient() {
     // Optional-key shape until F3; runtime guard catches missing config.
     if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
       throw new Error("Supabase public env keys missing; set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
     }
     return createBrowserClient<Database>(
       env.NEXT_PUBLIC_SUPABASE_URL,
       env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
     );
   }
   ```
   **Do NOT** import `@/lib/logger` (server-only; would crash client bundle).
   **Do NOT** add `"use client"` directive (consumers add their own).

3. **`lib/supabase/server.ts`** — per the [`@supabase/ssr` server-side recipe](https://supabase.com/docs/guides/auth/server-side/nextjs):
   ```ts
   import { cookies } from "next/headers";
   import { createServerClient } from "@supabase/ssr";
   import { env } from "@/lib/env";
   import type { Database } from "./types";

   export async function createClient() {
     const cookieStore = await cookies();
     if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
       throw new Error("Supabase public env keys missing");
     }
     return createServerClient<Database>(
       env.NEXT_PUBLIC_SUPABASE_URL,
       env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
       {
         cookies: {
           getAll() { return cookieStore.getAll(); },
           setAll(cookiesToSet) {
             try {
               cookiesToSet.forEach(({ name, value, options }) =>
                 cookieStore.set(name, value, options)
               );
             } catch {
               // Calling setAll from a Server Component is OK (no-op);
               // middleware refreshes the session in epic 03.
             }
           },
         },
       },
     );
   }
   ```

4. **`lib/supabase/middleware.ts`** (stub):
   ```ts
   // TODO epic 03: implement session refresh per @supabase/ssr middleware recipe.
   import { NextResponse, type NextRequest } from "next/server";
   export function updateSession(_request: NextRequest): NextResponse {
     return NextResponse.next();
   }
   ```

5. **`lib/supabase/admin.ts`** (lazy singleton):
   ```ts
   // Server-only. Bypasses RLS. Only import from server actions and route handlers.
   import { createClient, type SupabaseClient } from "@supabase/supabase-js";
   import { env } from "@/lib/env";
   import type { Database } from "./types";

   if (typeof window !== "undefined") {
     throw new Error("lib/supabase/admin imported in client code; this client bypasses RLS");
   }

   let _admin: SupabaseClient<Database> | null = null;

   export function adminClient(): SupabaseClient<Database> {
     if (_admin) return _admin;
     const url = env.NEXT_PUBLIC_SUPABASE_URL;
     const key = env.SUPABASE_SERVICE_ROLE_KEY;
     if (!url || !key) {
       throw new Error("SUPABASE service-role config missing; admin client unavailable");
     }
     _admin = createClient<Database>(url, key, {
       auth: { autoRefreshToken: false, persistSession: false },
     });
     return _admin;
   }
   ```

6. **`lib/supabase/index.ts`** (barrel):
   ```ts
   export { createClient as createBrowserClient } from "./client";
   export { createClient as createServerClient } from "./server";
   export { adminClient } from "./admin";
   export type { Database } from "./types";
   ```

7. **`tests/unit/supabase-admin.test.ts`** — exercise both throw paths (missing key + window-defined). Use the same `vi.resetModules()` + dynamic-import pattern as `env.test.ts`.

8. **`biome.json`** — add `noRestrictedImports`. Likely shape (verify against installed Biome major):
   ```json
   "linter": {
     "rules": {
       "style": {
         "noRestrictedImports": {
           "level": "error",
           "options": {
             "paths": {
               "@/lib/supabase/admin": "Bypass-RLS client. Server-only — do not import from client components or `\"use client\"` files."
             }
           }
         }
       }
     }
   }
   ```
   If per-file-pattern excludes are needed (to allow imports from `app/**/actions.ts` and any RSC), use a Biome `overrides` block. **If the rule shape doesn't fit Biome 2.x cleanly, escalate.**

### Definition of done

- `pnpm install` clean, lockfile committed.
- `pnpm typecheck` green. `Database` type resolves — note `lib/supabase/types.ts` does NOT yet exist; **slice A coordinates with slice D** by importing from `./types` and accepting that build will error until D commits a stub or F1 generates the file. **Acceptable:** if slice A lands first and breaks `pnpm build` until D lands, that's documented in slice A's done report; the stage 2 review pass will only pass once D's types-stub is in place.
- `pnpm lint` green. The new `noRestrictedImports` rule is active.
- `pnpm build` may fail at slice A's commit (missing types) — that's expected; D fixes by un-gitignoring `types.ts` and committing a stub. Document the temporary breakage in the done report.
- All four `lib/supabase/*.ts` files exist with the contracts above.
- `tests/unit/supabase-admin.test.ts` exists and is valid TypeScript (would pass under vitest).
- `git status` shows only intended files.

### Escalation triggers

- `@supabase/ssr` API surface differs materially from the recipe shape.
- Biome `noRestrictedImports` not available or shape incompatible.
- `verbatimModuleSyntax: true` requires unexpected `import type` rewrites the executor can't satisfy via `lint:fix`.
- `Database` type import resolution failure persists after slice D's stub lands.
- Anything else needing architectural judgement.

---

## Slice B — Initial schema migration

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel · **Branch:** commit on `epic/02-supabase-schema`

### Scope

- `/supabase/migrations/<YYYYMMDDHHMMSS>_initial_schema.sql` — **new**. Single migration containing the full schema from `02-supabase-schema.md` § Schema (lines ~129–494) with the user decisions (Q7–Q23) baked in. Filename timestamp generated at write time (UTC).

### Forbidden scope

Everything else. Specifically NOT `supabase/seed.sql` (slice C), NOT `supabase/config.toml`, NOT `lib/`. **Hard rule** — escalate.

### Dependencies on other slices

None — fully parallel-safe with C and D. (The migration file itself is just SQL; doesn't reference TypeScript types.)

### Spec details

The migration ships in this order:

1. **Extensions:** `create extension if not exists "uuid-ossp"; create extension if not exists "pgcrypto";`

2. **`set_updated_at()` plpgsql function** (Q19) — inline, before any table that uses it.

3. **Tables** (in dependency order):
   - `public.workspace` (id, slug unique, name, created_by, created_at, updated_at, deleted_at)
   - `public.workspace_member` (workspace_id, user_id, role check, primary key composite, created_at). FK index on `user_id`.
   - `public.board` (id, workspace_id FK, name, created_by, created_at, updated_at, deleted_at). FK index on `workspace_id`.
   - `public.board_member` (board_id, user_id, role check, primary key composite, created_at). FK index on `user_id`.
   - `public."group"` (id, board_id FK, name, position numeric, color, created_at, updated_at, deleted_at). Use double-quoted `"group"` everywhere (reserved word). FK index.
   - `public."column"` (id, board_id FK, name, type check `in (text, long_text, status, priority, person, date, timeline, number, currency, checkbox, file, link, tags, rating, created_at_col, updated_by, created_by)` per Q10, position numeric, settings jsonb default '{}', created_at, updated_at). FK index. Use `"column"` (reserved word).
   - `public.label` (id, column_id FK, name, color, position numeric, created_at, updated_at). FK index. Used by `status`, `priority`, `tags` (Q12).
   - `public.task` (id, group_id FK, board_id FK denormalized, title text not null default '' per Q7, position numeric, created_by, updated_by, created_at, updated_at, deleted_at). FK indexes on `group_id` and `board_id`.
   - `public.cell` (task_id FK, column_id FK, primary key (task_id, column_id) — no separate `id`; text_value, number_value, date_value, label_id FK nullable, json_value, updated_by, created_at, updated_at). `cell_one_value_check` constraint using `num_nonnulls(text_value, number_value, date_value, label_id, json_value) <= 1` (requires Postgres 15+; cloud Supabase satisfies).
     Indexes: `cell(column_id)`, `cell(label_id) where label_id is not null`. Trigger `set_updated_at`.
   - `public.comment` (id, task_id FK, author_id, body jsonb, body_text not null default '' per Q15, created_at, updated_at). FK index on `task_id`.
   - `public.activity` (id, board_id FK, task_id FK nullable, actor_id, type, payload jsonb, created_at). FK indexes on `board_id`, `task_id`. **Schema only** per Q16 — no triggers, no inserts.
   - `public.attachment` (id, task_id FK, comment_id FK nullable, uploader_id, storage_path, mime_type, size_bytes, created_at). Full table per Q17.
   - `public.notification` (id, user_id, kind, payload jsonb, read_at, created_at). FK index on `user_id`. Full table per Q17.
   - `public.view` (id, board_id FK, owner_id, name, type check, config jsonb, is_shared boolean, created_at, updated_at). FK index.
   - `public.profile` (id PK = `auth.users.id`, email, display_name, avatar_url, created_at, updated_at). Trigger `on_auth_user_created` on `auth.users` per Q21.

4. **Triggers**:
   - `set_updated_at` BEFORE UPDATE on every table with `updated_at`.
   - `task_board_id_consistency` BEFORE INSERT OR UPDATE OF `group_id` ON `public.task` per Q14 (copies `(SELECT board_id FROM public."group" WHERE id = NEW.group_id)` → `NEW.board_id`).
   - `cascade_soft_delete_to_groups` BEFORE UPDATE ON `public.board` WHEN (`OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL`) per Q18 — `UPDATE public."group" SET deleted_at = NEW.deleted_at WHERE board_id = NEW.id AND deleted_at IS NULL;` (will recursively trigger the next).
   - `cascade_soft_delete_to_tasks` BEFORE UPDATE ON `public."group"` same pattern.
   - `handle_new_user()` SECURITY DEFINER inserts into `public.profile` after `auth.users` insert per Q21.

5. **Realtime publication** (Q22): `alter publication supabase_realtime add table public.task, public.cell, public."group", public."column", public.comment, public.notification;`

6. **RLS enable** (no policies):
   ```sql
   alter table public.workspace enable row level security;
   alter table public.workspace_member enable row level security;
   alter table public.board enable row level security;
   alter table public.board_member enable row level security;
   alter table public."group" enable row level security;
   alter table public."column" enable row level security;
   alter table public.label enable row level security;
   alter table public.task enable row level security;
   alter table public.cell enable row level security;
   alter table public.comment enable row level security;
   alter table public.activity enable row level security;
   alter table public.attachment enable row level security;
   alter table public.notification enable row level security;
   alter table public.view enable row level security;
   alter table public.profile enable row level security;
   ```

### Definition of done

- Migration file exists at `supabase/migrations/<ts>_initial_schema.sql` matching all decisions above.
- File parses syntactically. If a local Postgres is available, executor verifies via `psql -f --dry-run` or similar; else escalate for F1 to discover at apply time.
- File ends with newline. Lowercase keywords. No trailing whitespace. Reserved words (`"group"`, `"column"`) properly quoted everywhere.
- All 15 tables have `enable row level security`. Zero `create policy` statements.
- All FKs have indexes (cross-check the doc).

### Escalation triggers

- `cell_one_value_check` `num_nonnulls(...)` syntax issue (requires PG15+; cloud Supabase is 15+ — should not trigger).
- Reserved word handling fails for any column type access.
- Realtime publication add fails (likely OK; flag).
- Any of Q7–Q23 unresolved at start of slice (shouldn't be — all locked).

### Commits

Single commit recommended: `schema: add initial Supabase migration (workspaces, boards, tasks, cells, …)`. Or split if cleaner.

---

## Slice C — Seed script

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel · **Branch:** commit on `epic/02-supabase-schema`

### Scope

- `/supabase/seed.sql` — **new**. Idempotent demo data per Q24 (option (a)), Q25, Q26.

### Forbidden scope

Everything else. Especially NOT the migration file (slice B), `supabase/config.toml`, `lib/`. **Hard rule.**

### Dependencies on other slices

The seed assumes slice B's schema exists. The file itself can be authored without B merging first because it only references locked table/column names.

### Spec details

Constants used throughout (commit these as SQL comments at top for clarity):
- Seed user uuid: `11111111-1111-1111-1111-111111111111`
- Workspace uuid: `22222222-2222-2222-2222-222222222222`
- Board uuid: `33333333-3333-3333-3333-333333333333`
- Group uuids: `44444444-…-001/002/003`
- Column uuids: `55555555-…-001/002/003/004/005`
- Status label uuids: `66666666-…-001/002/003`
- Task uuids: `77777777-…-NNN` (12 tasks, NNN = 001..012)

Seed file structure:

1. **Auth user** (Q24 → (a)):
   ```sql
   insert into auth.users (id, instance_id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
   values (
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
   ```
   The `on_auth_user_created` trigger from slice B will create the matching `public.profile` row.

2. **Workspace + member**:
   ```sql
   insert into public.workspace (id, slug, name, created_by) values
     ('22222222-…', 'demo', 'Donezo Demo', '11111111-…')
   on conflict (id) do nothing;
   insert into public.workspace_member (workspace_id, user_id, role) values
     ('22222222-…', '11111111-…', 'owner')
   on conflict do nothing;
   ```

3. **Board + member**:
   ```sql
   insert into public.board (id, workspace_id, name, created_by) values
     ('33333333-…', '22222222-…', 'Welcome', '11111111-…')
   on conflict (id) do nothing;
   insert into public.board_member (board_id, user_id, role) values
     ('33333333-…', '11111111-…', 'owner')
   on conflict do nothing;
   ```

4. **5 columns** (Q8) — title (text), status, person, date, number — at positions 1–5.

5. **3 groups** (Q25) — `To do`, `Doing`, `Done` — at positions 1–3.

6. **3 status labels** (Q9) — `Working on it` (color `#fdab3d`), `Done` (color `#00c875`), `Stuck` (color `#e2445c`) — under the status column.

7. **12 tasks** — 4 per group. Title cells filled with task names like "Wire up auth", "Design board view", etc. — flavorful but not joke-text.

8. **Cells** — title cells for all 12 tasks (text_value); status cells for ~10 of 12 distributed across the 3 labels (label_id); a few person/date/number cells for demo richness.

9. **Footer**: `notify pgrst, 'reload schema';` (cheap, harmless).

All inserts use `on conflict ... do nothing` for idempotency (Q26).

### Definition of done

- `supabase/seed.sql` exists.
- File length under ~250 lines.
- All inserts have `on conflict do nothing` clauses.
- All uuids are stable (committed literals, no `gen_random_uuid()` calls in the seed).
- File is valid SQL (executor verifies syntactically; F1 verifies semantically against cloud DB).

### Escalation triggers

- Inserting into `auth.users` from SQL fails with cloud Supabase (shouldn't — service role has access).
- Q24 changes mid-slice from (a) → (b); rewrite seed to use null `created_by`.

### Commits

Single commit: `chore: add demo seed for cloud Supabase`.

---

## Slice D — `pnpm db:*` scripts + CONTRIBUTING.md cloud-first dev loop + un-gitignore types

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel · **Branch:** commit on `epic/02-supabase-schema`

### Scope

- `/package.json` — add `db:*` scripts (additive only); add `supabase` CLI as devDep.
- `/pnpm-lock.yaml` — regenerated.
- `/CONTRIBUTING.md` — replace any Docker/`supabase start` references with cloud-first loop; add "Schema migrations" subsection per Q29.
- `/.gitignore` — **remove** the `lib/supabase/types.ts` line per Q6.
- `/lib/supabase/types.ts` — **new** stub: `export type Database = unknown;` with a `// TODO F1: regenerated by \`pnpm db:types\` from the linked Supabase project.` comment. F1 overwrites with real generated types.

### Forbidden scope

Everything else. Especially NOT `supabase/migrations/`, `supabase/seed.sql`, `lib/supabase/{client,server,middleware,admin,index}.ts`, `lib/env.ts`, `app/**`, `components/**`, `tsconfig.json`, `next.config.ts`, `biome.json`, `.github/`. **Hard rule.**

### Dependencies on other slices

None. Disjoint scope from A, B, C.

### Spec details

1. **Add `supabase` CLI** as devDep:
   ```
   pnpm add -D -E supabase
   ```
   Inspect lockfile diff — if anything beyond expected adds, escalate.

2. **`package.json` scripts** (additive — preserve existing scripts; insert these alphabetically before `dev` or wherever cleanest):
   ```json
   "db:diff":   "supabase db diff --linked",
   "db:lint":   "supabase db lint --linked",
   "db:link":   "echo 'run: supabase link --project-ref <REF>' && exit 1",
   "db:push":   "supabase db push",
   "db:reset":  "supabase db reset --linked",
   "db:types":  "supabase gen types typescript --linked > lib/supabase/types.ts"
   ```
   The `db:link` script intentionally errors with instructions because the project ref is `<REF>` placeholder (Q4) — user runs `supabase link --project-ref <actual>` directly the first time.

3. **`.gitignore`** — remove the `lib/supabase/types.ts` line. Other entries unchanged.

4. **`lib/supabase/types.ts`** stub:
   ```ts
   // TODO F1: regenerated by `pnpm db:types` from the linked Supabase project.
   // This stub makes `pnpm build` succeed before F1 runs. After F1, the file
   // contains the full Database type derived from the cloud schema.
   export type Database = unknown;
   ```

5. **`CONTRIBUTING.md`** edits:
   - **Local setup** section: replace step 3 (env copy) and add Supabase steps:
     ```
     1. git clone <repo-url> && cd donezo
     2. corepack enable
     3. pnpm install
     4. cp .env.example .env.local — fill in Supabase keys from a teammate or from the Vercel-Supabase integration in the Vercel dashboard.
     5. supabase login && supabase link --project-ref <REF>
     6. pnpm db:types — regenerates lib/supabase/types.ts from the linked schema.
     7. pnpm dev
     ```
   - **New "Schema migrations" subsection** between "Scripts" and "Branch naming":
     ```
     ## Schema migrations

     Schema changes go through Supabase CLI:

     1. supabase migration new <description>  # creates supabase/migrations/<ts>_<desc>.sql
     2. Edit the generated file. Never edit a deployed migration.
     3. pnpm db:push  # applies the migration to the linked cloud project.
     4. pnpm db:types  # regenerates lib/supabase/types.ts.
     5. Commit the migration AND the regenerated types together.

     Note: there is no local Supabase / Docker workflow. Cloud is the source of truth. All developers and CI point at the same project. Coordinate migration PRs to avoid two simultaneous schema changes.
     ```
   - **Remove** any Docker / `supabase start` references in the existing legacy-section content. (There shouldn't be any; epic 01 didn't add them. Verify.)

### Definition of done

- `pnpm install` clean, lockfile committed.
- `package.json` has the listed `db:*` scripts.
- `lib/supabase/types.ts` exists with the stub.
- `.gitignore` no longer has `lib/supabase/types.ts`.
- `CONTRIBUTING.md` has the cloud-first local-setup steps and the "Schema migrations" subsection.
- `pnpm typecheck` and `pnpm lint` green. `pnpm build` green (the stub `Database = unknown` means slice A's typed clients compile loosely; F1 tightens after type regen).

### Escalation triggers

- `supabase` JS-wrapper devDep incompatibility with Node 22 / pnpm 10.
- Any unexpected lockfile churn beyond `supabase` add.

### Commits

Logical commits, e.g.:
- `chore: install supabase CLI as devDep`
- `chore: add db:* scripts and types stub`
- `docs: cloud-first dev loop in CONTRIBUTING.md`

---

## Sequential follow-ups

These run on `epic/02-supabase-schema` after all stage-2 slices and the stage-2 review pass return CLEAN.

### F1 — Cloud bootstrap (orchestrator runs locally)

Steps the orchestrator (or a single executor) runs against the user's `.env.local`-configured machine:

1. **Confirm `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.** If missing, ask user to mirror them from the existing `SUPABASE_URL` / `SUPABASE_ANON_KEY` (per Q2 decision).
2. `supabase login` — interactive; user step.
3. `supabase link --project-ref <actual-ref>` — one-time. Persists in `supabase/.temp/` (gitignored).
4. `pnpm db:push` — applies `supabase/migrations/<ts>_initial_schema.sql` to the cloud DB. Verify in Supabase dashboard that all 15 tables exist with RLS enabled.
5. **Apply seed.** Either:
   - `supabase db reset --linked` (wipes + re-runs migrations + seed; cleanest), OR
   - `psql "<POSTGRES_URL_NON_POOLING>" -f supabase/seed.sql` (preserves any existing data).
   Verify seed ran: `select count(*) from public.task` returns 12.
6. `pnpm db:types` — regenerates `lib/supabase/types.ts`. Commit the result on the epic branch.
7. **Verify slice A's typed clients tighten:** `pnpm typecheck` should now infer table shapes from `Database` instead of `unknown`.

### F2 — Smoke test

- `pnpm install --frozen-lockfile` — clean.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` — all green with real `Database` type.
- **Sanity-check default deny:** in a server action or temporary RSC, run `await (await createServerClient()).from("workspace").select("id, name").limit(1)`. Expect: empty result + no error (RLS denies anon; no real auth). Document in F2 report.
- **Sanity-check admin bypass:** in a temporary server action, run `await adminClient().from("workspace").select("id, name").limit(1)`. Expect: returns the `Donezo Demo` workspace row. Confirms service-role client + types work end-to-end.
- Remove any temporary sanity-check code before commit.

### F3 — Env-key required-flip (if Q1 → option a, which it is)

Edit `lib/env.ts`:
- Change `NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional()` → `z.string().url()` (required).
- Change `NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional()` → `z.string().min(1)` (required).
- `SUPABASE_SERVICE_ROLE_KEY` stays optional (server-only; admin client guards at runtime).

Add to `.github/workflows/ci.yml`'s job env block:
```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```
**User must add these GitHub Actions repo secrets before this slice runs**, or CI will fail. Coordinate with user via PR description.

Verify `pnpm typecheck` / `pnpm build` still green locally with `.env.local` present.

### F4 — Save approved dispatch (already done — this file)

---

## Risk notes

1. **Cloud-only = no per-developer isolation.** Single shared cloud DB. `pnpm db:push` from two laptops simultaneously is a mess. Mitigation: orchestrator gates migrations; document in CONTRIBUTING.

2. **`withUser` synthetic uuid + DB writes.** No app-code DB writes ship in epic 02. Migration writes via service role; seed writes via service role. App-side writes start in epic 03 *after* real auth replaces synthetic uuid. Codified in CONTRIBUTING + CLAUDE.md.

3. **Service-role key handling.** `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Slice A's runtime guard + Biome `noRestrictedImports` rule are the protection layer. Treat the key like a DB root password. Audit: only in `.env.local` (gitignored) + Vercel env (server-only).

4. **Default-deny RLS during the 02→03→04 window.** Schema lands; every `anon`/`authenticated` query returns empty. Health-check page unaffected (doesn't query). **Do not** wire DB reads into `(app)/` shell mid-window — diagnoses go sideways.

5. **Realtime publication on deny-by-default schema.** Subscribers receive zero events until epic 04 policies land. Correct behavior.

6. **`lib/supabase/types.ts` chicken-and-egg.** Resolved by Q6 (un-gitignore + commit). Slice D's stub keeps `pnpm build` green between slice A's commit and F1's type regen.

7. **Soft-delete cascade trigger correctness (Q18).** No tests for triggers in epic 02 (pgTAP scaffolding lands later). Acceptable risk; epic-level review pass should manually verify by setting `board.deleted_at` in seed and observing descendants.

8. **Vercel preview deploy + cloud DB.** Once Vercel preview env has Supabase keys, every preview talks to the same prod-ish DB. Until epic 04, RLS denies. After epic 04, this becomes a real foot-gun — flag for epic 04 / 15 to address (preview-only feature flags, separate seed data, etc.).

9. **`fractional position` drift.** Documented in epic doc — non-blocking; epic 06 addresses.

10. **`column.type` enum churn.** Per Q10's conservative subset, future cell-type additions need ALTER migrations. Acceptable.

11. **Slice A → Slice D temporary build break.** Slice A imports `Database` from `./types`; D commits the stub. Between A and D's merges on the epic branch, `pnpm build` may fail. Document in slice A's done report; stage-2 review pass enforces all-green only after both A and D land.

12. **F3 GitHub Actions secrets.** User must add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` as repo secrets before F3's CI run. Orchestrator surfaces this in PR description.

## Constraints carried into later epics

- **Cloud-first.** No epic adds `supabase start` / Docker dev loop without explicit re-decision. Epic 15's CI work assumes cloud-only.
- **Migration discipline.** Every schema change is a new file under `supabase/migrations/`. `pnpm db:push` is the only sanctioned application path. `pnpm db:types` runs after every push; regen committed alongside the migration.
- **`lib/supabase/admin.ts` is the ONLY RLS-bypass path.** No epic introduces a second admin client.
- **Default columns + default labels** (Q8 + Q9) are inherited by epics 05 (workspaces & boards) and 07 (column system) as the canonical "new board" template.
- **`task.title` denormalization** (Q7): epic 07 implements column-0 read-through.
- **`lib/env.ts` is still the singleton boot validator.** Future env keys (Resend, Sentry, Storage bucket names) go into the same module.
- **No app-code DB writes until epic 03 lands real auth.** Hard rule.
