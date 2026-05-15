# Epic 04 Stage 1 Review

**Verdict:** CLEAN
**Diff:** f263d48..102d5ec on `epic/04-authorization-rls`
**Date:** 2026-05-07

## Slice A — CLEAN

`supabase/migrations/20260507120000_authz_helpers.sql` (71 lines).

- File scope: only the migration was added; no edits to forbidden paths. Timestamp `20260507120000` sorts strictly after the last main-line migration (`20260507003509`). Filename matches `<ts>_authz_helpers.sql`.
- `is_private boolean not null default false` added to `public.board` (line 5). Existing seed rows take the default.
- `role_rank(text) returns int` is `language sql immutable` and uses the exact rank table from the spec. Unknown strings return `0` (correct fallthrough; means downstream comparisons against `role_rank('viewer')=1` correctly fail for null/unknown roles).
- `greater_role(a, b)` is `language sql immutable`, qualifies its inner calls as `public.role_rank(...)` (matches executor note). Null-safe — returns the non-null operand when one side is null.
- `role_for_board(p_board_id uuid, p_user_id uuid) returns text` is `language plpgsql security definer set search_path = public`. Matches dispatch §risk note 10 exactly. Spot-check confirms:
  - **`is_private=true` branch** returns the bare `b_role` from `board_member` only — no workspace fallback, no `greater_role` call. Correct per Q-decision and dispatch plan lines 156–161.
  - **Soft-deleted board** returns `null` early (`v_deleted_at is not null` → `return null`). Correct.
  - **Board not found** returns `null` (`v_is_private is null` after the select).
  - **`p_user_id is null`** returns `null` early (line 41).
- Grants: all three functions granted `execute` to `authenticated, anon` (lines 69–71). No `revoke from public` — acceptable per spec (no DML side effects).
- Lowercase keywords; `"group"` / `"column"` not referenced (no need here); file ends with newline.

Definition of done met fully.

## Slice B — CLEAN

`supabase/migrations/20260507120100_rls_policies.sql` (472 lines, 49 policies across 15 tables).

- File scope: only the new migration; no edits to forbidden paths. Timestamp sorts after Slice A.
- Reserved words `"group"` and `"column"` consistently double-quoted everywhere they appear (table refs and qualified column refs like `"group".board_id`).
- All policies use `(select auth.uid())` wrapped form (PostgREST/Supabase plan-cache best practice). Verified by grep — no bare `auth.uid()` in the file.
- All `public.role_*` calls fully qualified (`public.role_rank(public.role_for_board(...))`).
- Per-table audit:
  1. **workspace** — 4 policies. `workspace_insert` is `created_by = (select auth.uid())` per epic doc verbatim; the bootstrap deadlock is intentional and resolved by Slice D's `create_workspace` security-definer RPC. Executor's deviation note is correct, expected, and matches the dispatch plan.
  2. **workspace_member** — 4 policies. `wsm_insert` ships the **admin-only** variant per Slice B § Spec details paragraph 2 ("Decision: ship the invitation-gated wsm_insert + bm_insert policies in Slice D's migration"). Slice D will `drop policy ... ; create policy ...` to swap.
  3. **board** — 4 policies. Uses `name`, not `title`. `board_select` includes `deleted_at is null`. `board_update` ≥ member, `board_delete` ≥ admin (correct delegation to workspace owner via the workspace policy chain).
  4. **board_member** — 4 policies. Same admin-only `bm_insert` decision as wsm; Slice D swaps. `bm_delete` permits self-leave — matches doc.
  5. **`"group"`** — 4 policies. Member+ for all writes; `deleted_at is null` on select.
  6. **`"column"`** — 4 policies. Admin+ for structural changes (insert/update/delete) per doc.
  7. **label** — 4 policies. Q7=(b) admin+ for writes joined through `"column"` → board; select for any board role. Correct.
  8. **task** — 4 policies. Member+ for writes; `deleted_at is null` on select.
  9. **cell** — 2 policies (`cell_select` + `cell_modify for all`). PK is `(task_id, column_id)`; references go through `cell.task_id`. The `for all using` form is canonical Postgres — `using` doubles as `with check` for INSERT/UPDATE.
  10. **comment** — 4 policies. **`comment_select` correctly omits `deleted_at is null`** — schema-vs-doc reconciliation honored (verified `public.comment` has no `deleted_at` column at line 243–251 of `20260506224930_initial_schema.sql`). Executor's deviation note 2 is correct. `comment_insert` requires `author_id = auth.uid()` AND member+. `comment_update` is author-only. `comment_delete` allows author OR board admin+ — matches doc.
  11. **attachment** — 4 policies. **Q6 honored**: `attachment_update` and `attachment_delete` are uploader OR board-admin+; `attachment_insert` requires `uploader_id = auth.uid()` + member+. Uses `attachment.uploader_id` (matches schema; not `uploaded_by`).
  12. **activity** — 1 policy (`activity_select` only). **No insert/update/delete policies** → service-role-only writes. Matches dispatch §risk note 8.
  13. **view** — 2 policies, **Q5-corrected** (uses `owner_id`, `is_shared` — verified against schema lines 329–341). `view_select` exposes shared rows, own rows, and system-shared (`owner_id is null`) rows. `view_modify for all using` uses `case` to require admin+ for shared/system-shared, and ownership for personal.
  14. **notification** — 2 policies (select + update; **no insert** → service-role only). Matches dispatch §risk note 8.
  15. **profile** — 2 policies. Uses `id` (not `user_id`) — correct (schema line 358 PK is `id` referencing `auth.users(id)`). `profile_select` allows self OR same-workspace peer via `wm1`/`wm2` self-join. `profile_update` is self only. **No insert policy** → `handle_new_user` trigger handles it (already `security definer`).

Inventory comment at the end correctly counts to 49. Spec Definition-of-done items met.

## Slice C — CLEAN

`lib/authorization/{board,workspace,index}.ts` + `lib/validations/{workspace,board,invitation}.ts` + two unit tests.

- File scope: net-new files only; no edits to forbidden paths (`lib/auth/`, `lib/actions/`, `lib/supabase/`, etc., all untouched).
- **`lib/authorization/board.ts`** — `ROLE_RANK` const, `Role` type, `getBoardRole`, `requireBoardRole`. Uses `await createClient()`, `auth.getUser()`, `rpc("role_for_board", ...)`. Returns `null` early when no user. Throws `{code: "DB"}` on rpc error and `{code: "FORBIDDEN"}` on insufficient role — matches `withUser`'s error contract from epic 03.
  - **`as any` cast**: line 14 uses `(supabase as any).rpc(...)` with a `biome-ignore` comment and a `TODO(F1)` marker. This is acceptable per the dispatch spec ("RPC return widened to `Role | null` via cast — F1 tightens after type regen"). The cast is the smallest possible — only the `rpc` call site, not the whole client.
- **`lib/authorization/workspace.ts`** — `getWorkspaceRole`, `requireWorkspaceRole`. Reads `workspace_member` directly with `.maybeSingle()` (correct for "may not exist"). Imports `ROLE_RANK` and `type Role` (uses `import type` syntax inline) — Biome `useImportType` rule satisfied.
- **`lib/authorization/index.ts`** — barrel re-exports `Role` type, `getBoardRole`, `ROLE_RANK`, `requireBoardRole` from `./board`, and `getWorkspaceRole`, `requireWorkspaceRole` from `./workspace`. Correct surface; `useImportType` satisfied (`export type { Role }`).
- **`lib/validations/workspace.ts`** — `CreateWorkspaceSchema` with name (1–80) + slug (regex `^[a-z0-9-]+$`, 2–40). Matches spec verbatim.
- **`lib/validations/board.ts`** — `CreateBoardSchema` with `workspaceId` uuid, name 1–120, `isPrivate.default(false)`. Matches spec.
- **`lib/validations/invitation.ts`** — three schemas, role enum excludes `owner` (matches `invitation.role` check constraint per dispatch). Token min 32 / max 128. Matches spec.
- **Tests** — both files mock `@/lib/supabase/server` via `vi.mock` (matches the existing `tests/unit/with-user.test.ts` pattern). Both lead with `// @ts-expect-error vitest is wired in epic 15`, consistent with all eight other test files. Mock chain for `getWorkspaceRole` (`.from().select().eq().eq().maybeSingle()`) is correctly stubbed and reset in `beforeEach`.
  - Coverage: returns-role-on-match (member, exact-and-exceeds), throws-FORBIDDEN-when-below-min, throws-FORBIDDEN-when-null-user, owner-satisfies-any. All four shapes from the spec are present in both test files, plus `getXxxRole` direct paths (returns null no user, throws DB error). 9 assertions in board, 10 in workspace.
  - `vitest: command not found` failure is a pre-existing repo-wide condition (vitest is not in `package.json` devDeps; runner lands in epic 15). Identical to the eight prior test files.
- **`pnpm typecheck`** and **`pnpm lint`** reported green by executor — consistent with code shape (no unused imports, no missing types beyond the documented RPC cast).

Definition of done met fully.

## Cross-cutting concerns

- **`lib/authorization/.gitkeep` still present.** Cosmetic; harmless. The directory now contains real files. Standard practice is to delete the `.gitkeep` once siblings exist, but it has no functional effect — git tracks the real files unaffected. **Not worth a followup slice.** Can be swept in F1 or any future authorization-touching commit.
- **Migration apply order at F1 time** is A → B → D (timestamps `20260507120000` < `20260507120100` < whatever D ships in Stage 2). D will need to ship a timestamp strictly later than `20260507120100`. Flag for the Stage 2 dispatch.
- **Risk note 10 verification deferred to Slice G** — `select prosecdef from pg_proc where proname = 'role_for_board'` will be the pgTAP assertion. Slice A's source is `security definer`, so this should pass once the runner exists.
- **No bypass-surface drift detected.** `wsm_insert` and `bm_insert` are admin-only as designed for Stage 1; the bootstrap path for the very first workspace flows through Slice D's `create_workspace` security-definer RPC (which inserts both the workspace and the seed `owner` membership atomically). Until D lands, the only way to create the first workspace would be via service-role admin client — which is fine, since no app surface yet calls `createWorkspace`.
- **No edits to `frontend/` or `backend/`** (legacy paths are gitignored).
- **Stack defaults respected** — pnpm only, server-side TS, Zod, Biome import-type, no Redux, no MUI, no `/api` route handlers.

## Verdict reasoning

All three slices delivered exactly what their specs promised. The two executor-reported deviations (Slice B's `comment_select` filter omission and `workspace_insert` shape) are both schema-vs-doc reconciliations that were pre-authorized in the dispatch plan — neither is drift. The branch-naming deviation (`slice-b/04-rls-policies` vs the requested nested form) is cosmetic and has no merge-tree implications. The `as any` RPC cast in `lib/authorization/board.ts` is explicitly permitted by Slice C's spec and tagged with a `TODO(F1)` for tightening after `db:types` regen.

Stage 1 review verdict is **CLEAN**. Proceed to Stage 2 dispatch (slices D, E, F, G) without followups.
