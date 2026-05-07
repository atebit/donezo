# Epic 02 — Followup Round 1

## Review summary

- **Stage reviewed:** Stage 1 (slice A) + Stage 2 (slices B, C, D), commits `a6adce0..e8f669e` on `epic/02-supabase-schema`.
- **Verdict:** FOLLOWUP REQUIRED (single surgical fix; otherwise stage is sound).

### Definition-of-done items met (epic doc + per-slice)
- 15 tables created in one migration, all with `enable row level security`, zero policies.
- `set_updated_at()` helper + per-table triggers wired correctly.
- `task_board_id_consistency` trigger (Q14), soft-delete cascade triggers board → group → task (Q18), `on_auth_user_created` profile trigger (Q21) all present and correctly conditioned.
- Realtime publication adds for `task, cell, "group", "column", comment, notification` (Q22).
- All FKs covered by an index — except for `view` (see issue I1 below).
- Q-decisions Q1–Q30: every locked decision is visible in the merged code/SQL/docs. Spot-check passed for all 30. (Notably: `column.type` enum is exactly the 17 values in Q10; status labels match Q9 colors; seed shape matches Q25 1+1+3+12+5+3.)
- Slice A clients (`client.ts`, `server.ts`, `middleware.ts` stub, `admin.ts`, `index.ts` barrel) match contracts. Admin-client guard (`typeof window !== "undefined"`) + lazy singleton + missing-key throw all present (Q27).
- Biome `noRestrictedImports` rule active blocking `@/lib/supabase/admin` project-wide (Q28; per-file-pattern fallback was sanctioned by spec).
- `lib/supabase/types.ts` stub exists; `.gitignore` no longer excludes it (Q6).
- `package.json` has all six `db:*` scripts; `db:link` correctly errors with the `<REF>` instruction (Q3, Q4).
- CONTRIBUTING.md cloud-first local-setup + "Schema migrations" subsection present (Q29).
- Seed inserts 1 auth user + 1 workspace + 1 board + 5 columns + 3 groups + 3 status labels + 12 tasks + 34 cells, all with `on conflict do nothing` (Q24, Q25, Q26).
- `tests/unit/supabase-admin.test.ts` exists with all three throw paths covered (window-defined, missing service-role key, missing URL).
- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm build` all green per orchestrator's mechanical checks.

### Definition-of-done items NOT met
- **I1: missing `view(board_id, position)` index.** The schema doc explicitly defines `create index view_board_idx on public.view(board_id, position);`. The migration creates the index on `(board_id)` only, dropping the `position` ordering. View pickers sort by `position`; without the composite this falls to a heap scan once view counts grow. Not in the executor's reconciliation list, so this is an unintentional drop, not a sanctioned simplification.

### Other issues found (non-blocking; not part of this followup)
- **N1 (polish, not followup-required):** CONTRIBUTING.md "Scripts" table does not list the new `db:*` scripts. The new "Schema migrations" subsection references `db:push` and `db:types`, but the canonical Scripts reference table is incomplete. Slice D's done report flagged this as low-priority. Recommend: leave for a future docs-polish PR; do **not** block stage 2 on this.
- **N2 (forward-looking flag, not blocking):** `view` table has both `owner_id uuid references auth.users(id)` (nullable) AND `is_shared boolean not null default false`. Either field alone is sufficient to encode personal-vs-shared semantics; carrying both is redundant. Plan-of-record per Q-decisions kept both. Flag for epic 04 RLS authoring — policy must decide which is canonical.
- **N3 (forward-looking flag, not blocking):** `Database = unknown` stub means `SupabaseClient<unknown>` gives no table-shape inference; current typecheck "passing" is loose. F1 regenerates real types and tightens. Already documented in epic-02.md risk #6; mention here for clarity.
- **N4 (housekeeping, not followup):** Stale local branches `slice-b/02-initial-schema`, `slice-c/02-seed`, `worktree-agent-a136aa920302c77bc` are fully merged into `epic/02-supabase-schema`. Orchestrator can delete in cleanup; not a code defect.
- **N5 (anticipated by spec, not a defect):** `alter publication supabase_realtime add table` calls in the migration are non-idempotent; will fail on re-apply against an already-bootstrapped publication. Per the plan's escalation list (and risk #5), this is expected — F1 (cloud bootstrap) and Supabase's migration-state tracking guard against double-apply. No fix needed at this stage; if F1 surfaces a publication-already-exists error during the very-first push, that's an F1-level fix, not a stage-2 fix.
- **N6 (anticipated by spec):** Date cells use `now() + interval`, which makes seed dates non-deterministic across re-runs. Idempotency via `on conflict do nothing` means second run is a no-op and absolute date drift never re-applies. Acceptable per spec.

---

## Followup slices

One surgical slice. No parallelism needed.

### Followup A — Add missing `view(board_id, position)` composite index

**Owner:** epic-executor (sonnet) · **Branch:** commit directly on `epic/02-supabase-schema`

#### Scope
- `/supabase/migrations/<YYYYMMDDHHMMSS>_view_board_pos_idx.sql` — **new** migration adding the missing index.

#### Forbidden scope
- `/supabase/migrations/20260506224930_initial_schema.sql` — **must not be edited.** Per CLAUDE.md and CONTRIBUTING.md "Schema migrations" subsection: never edit a deployed migration. The initial migration is treated as deployed (F1 will push it to cloud); the fix ships as a new migration.
- `/supabase/seed.sql` — out of scope.
- `/lib/**`, `/app/**`, `/components/**`, `/package.json`, `/biome.json`, `/CONTRIBUTING.md`, `/.gitignore`, `/tsconfig.json`, `/.github/`, legacy `frontend/`, `backend/`. **Hard rule** — escalate if you discover you need to touch any of these.

#### Dependencies on other slices
None. Only depends on the initial schema migration being present (it is, on this branch).

#### Spec details

1. **Generate the new migration filename** at execution time using UTC. Pattern: `YYYYMMDDHHMMSS_view_board_pos_idx.sql` (matches the existing migration's timestamp convention). Use `date -u +%Y%m%d%H%M%S` (or `supabase migration new view_board_pos_idx` if cleaner — but verify the resulting filename matches the convention; if it doesn't, rename to match before committing).

2. **Migration body** (single statement; idempotent via `if not exists`):

   ```sql
   -- Composite index: board + position for ordered view-picker rendering.
   -- Restores the index defined in 02-supabase-schema.md § Schema (line ~423)
   -- that was unintentionally dropped to (board_id) alone in the initial migration.
   create index if not exists view_board_pos_idx on public.view(board_id, position);
   ```

   Notes for the executor:
   - `if not exists` makes the migration safe even if a developer manually added the index ahead of push.
   - The existing `view_board_idx` (single-column on `board_id`) created by the initial migration is left in place — Postgres' query planner will pick the composite for `(board_id, position)` queries and the single-column for `(board_id)` membership checks. Dropping the original would require editing the initial migration, which is forbidden. Carrying both is cheap (small write amplification on a low-write table) and the correct trade-off given the never-edit-deployed-migrations rule.
   - File ends with newline. Lowercase keywords. No trailing whitespace.

#### Definition of done
- New file at `supabase/migrations/<ts>_view_board_pos_idx.sql` exists with exactly the body above (plus header comment).
- Filename timestamp is **strictly greater than** `20260506224930` so Supabase applies it after the initial migration.
- File parses syntactically (single `create index` statement; trivially valid).
- `pnpm typecheck`, `pnpm lint`, `pnpm build` remain green (no TS/JS surface affected).
- `git status` shows only the one new file.

#### Escalation triggers
- Filename collision with an existing migration timestamp.
- `supabase migration new` produces a filename pattern incompatible with the existing convention and the executor cannot determine the correct rename.
- Discovery during execution that the `view_board_idx` already covers `(board_id, position)` queries adequately (it does NOT — single-column index can't satisfy multi-column ordering). If the executor questions whether this index is needed at all, escalate rather than silently skip.
- Anything else needing architectural judgement.

#### Commits
Single commit recommended: `schema: add view(board_id, position) composite index`.

---

## Open questions for the user

None. The single fix is unambiguous and traceable to the schema doc.

## Stage gate after followup
After this followup lands and the review pass returns CLEAN, the orchestrator may proceed to **F1 (cloud bootstrap)**.
