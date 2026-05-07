# Epic 04: Authorization (RLS + Roles) — Dispatch Plan

**Status:** approved, ready for `/execute-epic`
**Drafted on:** 2026-05-07
**Source epic doc:** `docs/conversion-plan/04-authorization-rls.md`
**Branch:** `epic/04-authorization-rls` off `main` (commit `442dc72`)

## User decisions (locked)

| #  | Question | Decision | Notes |
|----|---|---|---|
| 1  | pgTAP runner strategy | **(d) Defer pgTAP runner to epic 15.** Ship `tests/policies/*.sql` files now; no `pnpm test:policies` script, no CI gate. | User: "single production db on supabase" — rules out a dedicated test project (b). Local Supabase (a) and stock-postgres container (c) also rejected. Files-without-runner is the only fit. **Carries the risk in §Risk notes.** |
| 2  | Role column type | **`text` with `check (role in ('owner','admin','member','viewer'))`.** No Postgres `enum` / `domain`. | Matches schema doc convention "prefer check over enum"; check constraint already on the existing tables. |
| 3  | `acceptInvitation` flow | **(b) RLS update policy on `invitation.accepted_at`.** No `accept_invitation` security-definer function. The server action runs under the user's session and does two statements: insert membership row(s), then `update invitation set accepted_at = now()`. | Q3=(b) **forces Q8=(a)**: the user's session must be able to insert their own membership row, gated on a matching valid invitation. |
| 4  | Workspace + board creation atomicity | **SQL functions** `create_workspace(p_name text, p_slug text)` and `create_board(p_workspace_id uuid, p_name text, p_is_private boolean)`. `security definer`, `set search_path = public`, grant execute to `authenticated`. | Inserts the row + the seed `owner` membership in the same transaction. Server actions call via `supabase.rpc(...)`. |
| 5  | `view` policy correction | **Corrected from epic doc.** Schema is `view.owner_id` + `view.is_shared` (not `view.user_id`). Policies: shared (`is_shared=true`) → SELECT for any board member with role ≥ viewer; modify requires admin+. Personal (`is_shared=false`) → SELECT/modify only by `owner_id = auth.uid()` AND has board access. `owner_id IS NULL` is treated as system-shared (read-only for non-admins). | Slice B follows this **corrected** spec, not the epic doc verbatim. |
| 6  | `attachment` deletion authority | **Uploader OR board admin+.** | Parity with `comment_delete`. |
| 7  | `label` authoring authority | **Admin+** for insert/update/delete. SELECT for any board member. | Labels are column-config adjacent — member shouldn't add a "Probably Done" label just because they can fill cells. |
| 8  | `wsm_insert` / `bm_insert` self-insert clause | **(a) Keep self-insert, gated on a matching valid `invitation` row.** The policy admits `(user_id = auth.uid()) AND exists (...invitation row matching email + workspace/board + role + not yet accepted + not expired)` OR admin+ on the parent. | **Implied by Q3=(b)**: without security-definer accept, the user's session must self-insert. Gating on the invitation prevents arbitrary self-promotion. |
| 9  | `is_private` on `board` lands in slice A | **Yes.** Single migration `<ts>_authz_helpers.sql` adds the `is_private boolean not null default false` column alongside the helper functions. No UI in this epic — epic 05 owns toggling. | Existing seed boards default to `false`. |
| 10 | CI policy job | **Defer to epic 15.** Epic 04 ships `.sql` test files; CI integration is part of epic 15's full CI matrix. | Lower coupling. |
| 11 | Email allowlist + invitations | **Document the limitation; do not co-build.** If an invitation goes to an email outside the (epic-03) allowlist, accept fails at sign-in. Admins must add the domain first. Note in `CONTRIBUTING.md` and the join-page error copy. | Epic 03's allowlist hook is scoped but not yet implemented; coordination is its problem to solve. |
| 12 | Switch `lib/auth/{current-user,profile}.ts` off `adminClient` | **Yes — sequential follow-up F2 inside epic 04.** Wraps the swap with a count-check guard so an RLS-denied update doesn't silently no-op. | Load-bearing smoke that policies actually work end-to-end. |
| 13 | Board-scoped invitation expansion | **(b) Tight.** Board-scoped invite (`invitation.board_id is not null`) inserts **only** `board_member`, **not** `workspace_member`. Matches epic doc's "private board as canonical guest/contractor path" recommendation. | Workspace-scoped invites still insert `workspace_member` only. |

## Stack defaults (restated for executors)

From `CLAUDE.md` — non-negotiable unless `04-authorization-rls.md` overrides:

- **pnpm only.** No npm/yarn lockfiles.
- **Next.js 15 App Router**, RSC-first. `"use client"` only for interactivity.
- **Server Actions** for mutations. No `/api` route handlers except webhooks.
- **TypeScript strict** with `verbatimModuleSyntax: true`. `import type` for type-only.
- **Biome 2.x** active. Use `logger` server-side; bootstrap-time `console.*` requires inline biome-ignore.
- **Zod** validates server-action input. Same schema validates the form (RHF) when added in epic 05.
- **uuid v4** ids from Postgres; **`timestamptz`** for times; **soft-delete** via `deleted_at`. Hard delete only via admin paths.
- **Migrations:** `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Never edit a deployed migration. Each new policy / function / table addition = a new migration file.
- **RLS-as-source-of-truth.** Server-side helpers (`requireBoardRole`, etc.) are friendly-error layers, not the gate.
- **`lib/supabase/admin.ts` is the ONLY RLS-bypass path.** Service-role usage is documented per-callsite. Biome `noRestrictedImports` rule blocks it from client code; biome-ignore comment per server-only callsite is the convention (see `lib/auth/profile.ts:1`).
- **No app-code DB writes from client components.** All writes go through server actions wrapped in `withUser`.
- **Forbidden-scope is a hard rule** for executors. Escalate before editing a path another slice owns.

## Preconditions verified

- On `main`, latest commit `442dc72`. Epics 01, 02, 03 merged.
- Schema migrations in `supabase/migrations/`:
  - `20260506224930_initial_schema.sql` — full schema, RLS enabled on all 15 tables, **zero policies** (default-deny except for service role).
  - `20260506230238_view_board_pos_idx.sql` — `view.position`.
  - `20260507003509_avatars_bucket.sql` — storage bucket + 4 storage policies.
- All 15 expected tables exist with `enable row level security`. **Default-deny is currently active** — every authed query returns empty.
- Auth (epic 03) is live: Supabase Auth via `@supabase/ssr`, `withUser` at `lib/actions/with-user.ts`, `requireUser` / `getCurrentUser` at `lib/auth/current-user.ts`, OAuth callback at `app/auth/callback/route.ts`, sign-in/up/forgot/reset/verify routes wired. The `auth-google-only` refinement is **scoped but not yet executed**; epic 04 does not depend on auth surface shape.
- `withUser` accepts a `(ctx, input) => Promise<O>` handler returning `ActionResult`. Handles `ZodError` → `VALIDATION` and `{code, message}` throws → passthrough. Epic 04's helpers throw `{code: "FORBIDDEN", ...}` and `withUser` surfaces them cleanly. **No changes to `withUser` required.**
- `lib/auth/profile.ts` and `lib/auth/current-user.ts` use the **service-role admin client** because RLS denies `profile`. After this epic's `profile_select` / `profile_update` policies land, F2 swaps both off the admin path.
- `lib/validations/auth.ts` is sign-in only. Epic 04 introduces `lib/validations/{workspace,board,invitation}.ts`.
- **No `lib/authorization/` directory yet, no `app/(auth)/join/` route, no `tests/policies/*.sql` files.** All net-new in this epic.
- `package.json` scripts: `db:diff`, `db:lint`, `db:link`, `db:push`, `db:reset`, `db:types` exist. `test` exists (vitest). **No `test:policies` will be added** (Q1=(d)).
- CI workflow `.github/workflows/ci.yml` runs lint/typecheck/build only. **No DB or pgTAP job in epic 04** (Q10).
- Soft-delete cascade triggers exist: `cascade_soft_delete_to_groups`, `cascade_soft_delete_to_tasks`. Cascade order matters for `deleted_at is null` filters in policies.
- **Schema-vs-doc reconciliation (informational):**
  - `board` uses `name` (epic doc prose says `title` in places); use `name`.
  - `board_member` / `workspace_member` PK is composite `(board_id, user_id)` / `(workspace_id, user_id)`; no surrogate `id`.
  - `view.user_id` in the doc is actually `view.owner_id`; "shared" is `is_shared boolean`. **Q5 corrects.**
  - `cell` PK is `(task_id, column_id)`; no `id`.
  - `comment` has no `parent_id` (threading deferred).
  - `attachment.uploader_id` (not `uploaded_by`).
  - `notification` insert is service-role-only — **no policy** at all.
  - `activity.type` (not `action`); insert is service-role-only — **no policy** at all.
  - `profile.id` (not `user_id`).

## Execution order

```
Stage 1 (parallel-safe — three slices, disjoint files):
  A. Migration: is_private + role helpers + role_for_board   [SQL only]
  B. Migration: full RLS policy set                          [SQL only]
  C. lib/authorization/* helpers + Zod schemas               [TS only]
            ↓ stage 1 review pass
Stage 2 (parallel-safe — four slices, disjoint files):
  D. Migration: invitation table + RLS + create_workspace / create_board RPCs
  E. Server actions: workspace + board creation; invitation create + accept
  F. Invitation accept route UI (skeleton)
  G. pgTAP test files (no runner — Q1=(d))
            ↓ stage 2 review pass
Sequential follow-ups (on epic branch, not parallel):
  F1. Apply migrations to cloud (db:push) + regen types (db:types) + tighten any RPC casts in C/E
  F2. Switch lib/auth/current-user.ts and lib/auth/profile.ts off adminClient + count-check wrapper
            ↓ epic-level review pass
PR into main.
```

A → B → C share Stage 1 because B's policies reference `role_for_board` / `role_rank` defined in A, and C calls `role_for_board` via `supabase.rpc(...)`. Files are disjoint so all three land in parallel; logical dependency is enforced at apply time, not edit time.

D introduces the invitation table + RPC functions; E/F/G consume D's contracts but don't share files. All four go in parallel in Stage 2.

---

## Slice A — Migration: `is_private` flag + role helpers

**Owner:** epic-executor (sonnet) · **Stage:** 1, parallel

### Scope

- `/supabase/migrations/<YYYYMMDDHHMMSS>_authz_helpers.sql` — **new**, single file containing:
  1. `alter table public.board add column is_private boolean not null default false;`
  2. `create or replace function public.role_rank(r text) returns int language sql immutable ...`
  3. `create or replace function public.greater_role(a text, b text) returns text language sql immutable ...`
  4. `create or replace function public.role_for_board(p_board_id uuid, p_user_id uuid) returns text language plpgsql security definer set search_path = public ...`
  5. `grant execute on function public.role_rank(text), public.greater_role(text, text), public.role_for_board(uuid, uuid) to authenticated, anon;`

### Forbidden scope

- `lib/`, `app/`, `tests/`, `package.json`, `.github/`, any other migration file (must not edit `20260506224930_initial_schema.sql` or any deployed migration), `supabase/seed.sql`, `supabase/config.toml`. **Hard rule.**

### Spec details

1. **`is_private` column** — default `false`, `not null`. Existing seed rows get `false`.

2. **`role_rank(r text) returns int`**:
   ```sql
   create or replace function public.role_rank(r text)
   returns int language sql immutable as $$
     select case r when 'owner' then 4 when 'admin' then 3 when 'member' then 2 when 'viewer' then 1 else 0 end
   $$;
   ```

3. **`greater_role(a text, b text) returns text`** — `immutable`. Returns `b` if `a is null`, `a` if `b is null`, else the higher-ranked.

4. **`role_for_board(p_board_id uuid, p_user_id uuid) returns text`** — `security definer`, `set search_path = public`. Returns `null` if user is null, board doesn't exist, or board is soft-deleted. For `is_private = true`, returns the board-member role only. Otherwise returns `greater_role(workspace_role, board_role)`.

   ```sql
   create or replace function public.role_for_board(p_board_id uuid, p_user_id uuid)
   returns text language plpgsql security definer set search_path = public
   as $$
   declare
     ws_role text;
     b_role text;
     v_is_private boolean;
     v_deleted_at timestamptz;
   begin
     if p_user_id is null then return null; end if;

     select b.is_private, b.deleted_at into v_is_private, v_deleted_at
       from public.board b where b.id = p_board_id;
     if v_is_private is null then return null; end if;        -- board not found
     if v_deleted_at is not null then return null; end if;    -- soft-deleted

     select wm.role into ws_role
       from public.board b
       join public.workspace_member wm on wm.workspace_id = b.workspace_id and wm.user_id = p_user_id
      where b.id = p_board_id;

     select role into b_role
       from public.board_member
      where board_id = p_board_id and user_id = p_user_id;

     if v_is_private then
       return b_role;
     else
       return public.greater_role(ws_role, b_role);
     end if;
   end $$;
   ```

5. **Grants** — `grant execute on function ... to authenticated, anon;`. No `revoke from public` (security-definer with no DML side effects; safe for any caller).

### Definition of done

- Migration file exists at `supabase/migrations/<ts>_authz_helpers.sql`. Filename timestamp UTC, strictly later than `20260507003509`.
- File parses syntactically.
- Lowercase keywords; reserved words quoted (`"group"`, `"column"`).
- `security definer` + `set search_path = public` on `role_for_board`; `immutable` on `role_rank` and `greater_role`.
- File ends with newline; no trailing whitespace.
- No edits to any other migration file.

### Escalation triggers

- Cloud Postgres rejects `security definer` syntax (shouldn't).
- Function name collision (none expected).

### Commits

Single commit: `schema: add is_private flag and role_for_board helpers`.

---

## Slice B — Migration: full RLS policy set

**Owner:** epic-executor (sonnet) · **Stage:** 1, parallel

### Scope

- `/supabase/migrations/<YYYYMMDDHHMMSS>_rls_policies.sql` — **new**, single migration containing every policy across the 15 tables, **adjusted** for the schema-vs-doc reconciliation and Q5–Q8 + Q13 decisions.

### Forbidden scope

- `lib/`, `app/`, `tests/`, `package.json`, `.github/`, any other migration file, `supabase/seed.sql`, `supabase/config.toml`. **Hard rule.**

### Dependencies on other slices

Logically depends on A's `role_rank` / `role_for_board` / `greater_role` (calls them in `using` / `with check`). Filename timestamp must sort after A's. File scope fully disjoint.

### Spec details

One logical block per table. Use `public."group"` and `public."column"` (reserved words). Fully qualify `public.role_rank(public.role_for_board(...))` everywhere.

1. **`workspace`** — per epic doc lines 141–167. `select` for members; `insert` admin-bypass via `create_workspace` RPC (so policy can be admin+ only — RPC runs as `security definer` and bypasses); `update` admin+; `delete` owner-only.

2. **`workspace_member`** — per epic doc 172–211, **with Q8=(a) constrained applied** to `wsm_insert`:

   ```sql
   create policy "wsm_insert" on public.workspace_member for insert with check (
     -- admin+ on the workspace can add anyone
     public.role_rank((
       select role from public.workspace_member
        where workspace_id = workspace_member.workspace_id and user_id = auth.uid()
     )) >= public.role_rank('admin')
     OR
     -- self-insert via accepted invitation: row goes in only if a matching valid
     -- workspace-scoped invitation exists and the role being inserted matches
     (
       user_id = auth.uid()
       and exists (
         select 1 from public.invitation i
          where i.workspace_id = workspace_member.workspace_id
            and i.board_id is null
            and lower(i.email) = lower((select email from auth.users where id = auth.uid()))
            and i.role = workspace_member.role
            and i.accepted_at is null
            and i.expires_at >= now()
       )
     )
   );
   ```

   `wsm_select`, `wsm_update`, `wsm_delete` per epic doc (delete keeps `user_id = auth.uid()` self-leave).

   **Note:** the invitation reference assumes the `invitation` table exists by apply-time. Slice D's migration timestamp must sort BEFORE slice B's? **No** — slice B references `invitation` only inside an `exists (...)` clause that's evaluated lazily at query time, not at policy-creation time. As long as `invitation` exists by the time any user accepts (D applies before any client traffic), Postgres accepts it. **However:** Postgres validates referenced tables at policy-creation time. **Migration apply order must therefore be A → D → B**, not A → B → D. Adjust slice timestamps accordingly: A < D < B.

   **Adjusted execution stage:** keep A/B/C parallel at the file level, but **Slice D's migration timestamp must sort before Slice B's** so cloud apply order is A → D → B → C-no-migration. The orchestrator coordinates timestamps when dispatching D in Stage 2 — F1 enforces apply order.

   **Easier alternative:** have Slice B emit `do $$ begin ... end $$;` blocks that `create policy` only after checking the table exists, OR ship the `wsm_insert` invitation-aware policy in Slice D's migration (alongside the invitation table). **Decision: ship the invitation-gated wsm_insert + bm_insert policies in Slice D's migration, not Slice B's.** Slice B ships an admin-only `wsm_insert` / `bm_insert`; Slice D's migration `drop policy "wsm_insert" on public.workspace_member;` followed by `create policy "wsm_insert" ...` with the gated form. This keeps Slice B independent of the `invitation` table.

3. **`board`** — per epic doc 216–239. Reminder: column is `name`, not `title`.

4. **`board_member`** — per epic doc 244–263, **with the same Slice D override** for `bm_insert`: Slice B ships admin-only; Slice D ships the invitation-gated form.

5. **`group`** — per epic doc 272–279. `public."group"`. `deleted_at is null` on select.

6. **`column`** — per epic doc 282–289. `public."column"`. **Admin+** for structural ops (insert/update/delete).

7. **`label`** — Q7=(b) admin+ for insert/update/delete; select for any board role. Joined through `column`:
   ```sql
   create policy "label_select" on public.label for select using (
     exists (select 1 from public."column" c
       where c.id = label.column_id and public.role_for_board(c.board_id, auth.uid()) is not null)
   );
   create policy "label_insert" on public.label for insert with check (
     exists (select 1 from public."column" c
       where c.id = label.column_id
         and public.role_rank(public.role_for_board(c.board_id, auth.uid())) >= public.role_rank('admin'))
   );
   -- update, delete: same shape, `for update using` / `for delete using`.
   ```

8. **`task`** — per epic doc 301–308. `deleted_at is null` on select.

9. **`cell`** — per epic doc 311–323. `for all using` covers insert/update/delete; PK reference is `(task_id, column_id)`.

10. **`comment`** — per epic doc 326–343. No `parent_id`. `comment.author_id`, `body_text`, `body` all present.

11. **`attachment`** — per epic doc 346–353, **with Q6 applied** (uploader OR admin+):
    ```sql
    create policy "attachment_select" on public.attachment for select using (
      exists (select 1 from public.task t where t.id = attachment.task_id
        and public.role_for_board(t.board_id, auth.uid()) is not null)
    );
    create policy "attachment_insert" on public.attachment for insert with check (
      attachment.uploader_id = auth.uid() and exists (
        select 1 from public.task t where t.id = attachment.task_id
          and public.role_rank(public.role_for_board(t.board_id, auth.uid())) >= public.role_rank('member'))
    );
    create policy "attachment_update" on public.attachment for update using (
      attachment.uploader_id = auth.uid() or exists (
        select 1 from public.task t where t.id = attachment.task_id
          and public.role_rank(public.role_for_board(t.board_id, auth.uid())) >= public.role_rank('admin'))
    );
    create policy "attachment_delete" on public.attachment for delete using (
      -- same as update
    );
    ```

12. **`activity`** — **select-only policy.** No insert/update/delete policy → only service-role writes.

13. **`view`** — Q5-corrected (`owner_id`, `is_shared`):
    ```sql
    create policy "view_select" on public.view for select using (
      public.role_for_board(view.board_id, auth.uid()) is not null
      and (view.is_shared or view.owner_id = auth.uid() or view.owner_id is null)
    );
    create policy "view_modify" on public.view for all using (
      case
        when view.is_shared or view.owner_id is null then
          public.role_rank(public.role_for_board(view.board_id, auth.uid())) >= public.role_rank('admin')
        else view.owner_id = auth.uid()
          and public.role_for_board(view.board_id, auth.uid()) is not null
      end
    );
    ```
    `owner_id IS NULL` system-shared rows are admin-only-mutable. Any board role can SELECT.

14. **`notification`** — per epic doc 376–379. `select` (own only) and `update` (own only, mark-as-read). **No insert policy** → service-role inserts.

15. **`profile`** — `select` for any authenticated; `update` `id = auth.uid()` (schema column is `id`, NOT `user_id`).

**General notes:**
- Every policy uses `using` or `with check` — never both empty.
- Each `create policy` is its own statement, terminated by `;`.
- File ends with a comment block listing the policies and a count.
- Slice B's `wsm_insert` and `bm_insert` are the **admin-only** variants. Slice D ships `drop policy ... ; create policy ...` to replace them with the invitation-gated forms.

### Definition of done

- Migration file exists at `supabase/migrations/<ts>_rls_policies.sql`.
- All 15 tables have policies. None at zero (default-deny defeated).
- `activity` and `notification` insert paths have **no** policy.
- File parses syntactically.
- `"group"` and `"column"` properly quoted.
- `public.role_rank`, `public.role_for_board`, `public.greater_role` referenced.
- Lowercase keywords; file ends with newline.
- No edits to any other migration file.

### Escalation triggers

- Schema column referenced by the doc snippet doesn't exist (e.g., `view.user_id`); pause for re-spec rather than guess.
- pgTAP-shaped concerns (slice G) bleed in — defer.

### Commits

Single commit: `schema: add RLS policies for all tables`.

---

## Slice C — `lib/authorization/*` helpers + Zod schemas

**Owner:** epic-executor (sonnet) · **Stage:** 1, parallel

### Scope

- `/lib/authorization/board.ts` — **new** — `getBoardRole`, `requireBoardRole`, `ROLE_RANK` constant, `Role` type.
- `/lib/authorization/workspace.ts` — **new** — `getWorkspaceRole`, `requireWorkspaceRole`. Reads `workspace_member` directly under user session.
- `/lib/authorization/index.ts` — **new** — barrel.
- `/lib/validations/workspace.ts` — **new** — `CreateWorkspaceSchema` (creation only; full CRUD lives in epic 05).
- `/lib/validations/board.ts` — **new** — `CreateBoardSchema` (creation only).
- `/lib/validations/invitation.ts` — **new** — `InviteToWorkspaceSchema`, `InviteToBoardSchema`, `AcceptInvitationSchema`.
- `/tests/unit/authorization-board.test.ts` — **new** — vitest, mocks supabase server client.
- `/tests/unit/authorization-workspace.test.ts` — **new** — analogous.

### Forbidden scope

- `supabase/migrations/`, `supabase/seed.sql`, `supabase/config.toml`, `app/`, `lib/auth/` (epic 03 files — F2 touches them), `lib/actions/`, `lib/supabase/`, `lib/env.ts`, `lib/logger.ts`, `lib/utils.ts`, `package.json`, `.github/`, `biome.json`, legacy. **Hard rule.**

### Spec details

1. **`lib/authorization/board.ts`**:
   ```ts
   import { createClient } from "@/lib/supabase/server";

   export const ROLE_RANK = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;
   export type Role = keyof typeof ROLE_RANK;

   export async function getBoardRole(boardId: string): Promise<Role | null> {
     const supabase = await createClient();
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) return null;
     const { data, error } = await supabase.rpc("role_for_board", {
       p_board_id: boardId,
       p_user_id: user.id,
     });
     if (error) throw { code: "DB", message: error.message };
     return (data as Role | null) ?? null;
   }

   export async function requireBoardRole(boardId: string, minRole: Role): Promise<Role> {
     const role = await getBoardRole(boardId);
     if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
       throw { code: "FORBIDDEN", message: "Insufficient permissions" };
     }
     return role;
   }
   ```

2. **`lib/authorization/workspace.ts`**:
   ```ts
   import { createClient } from "@/lib/supabase/server";
   import { ROLE_RANK, type Role } from "./board";

   export async function getWorkspaceRole(workspaceId: string): Promise<Role | null> {
     const supabase = await createClient();
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) return null;
     const { data, error } = await supabase
       .from("workspace_member")
       .select("role")
       .eq("workspace_id", workspaceId)
       .eq("user_id", user.id)
       .maybeSingle();
     if (error) throw { code: "DB", message: error.message };
     return (data?.role as Role | undefined) ?? null;
   }

   export async function requireWorkspaceRole(workspaceId: string, minRole: Role): Promise<Role> {
     const role = await getWorkspaceRole(workspaceId);
     if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
       throw { code: "FORBIDDEN", message: "Insufficient permissions" };
     }
     return role;
   }
   ```

3. **`lib/authorization/index.ts`** — barrel exports both modules.

4. **`lib/validations/workspace.ts`**:
   ```ts
   import { z } from "zod";

   export const CreateWorkspaceSchema = z.object({
     name: z.string().min(1, "Name is required.").max(80, "Name must be 80 characters or fewer."),
     slug: z.string().min(2).max(40)
       .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
   });
   export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
   ```

5. **`lib/validations/board.ts`**:
   ```ts
   import { z } from "zod";

   export const CreateBoardSchema = z.object({
     workspaceId: z.string().uuid(),
     name: z.string().min(1).max(120),
     isPrivate: z.boolean().default(false),
   });
   export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;
   ```

6. **`lib/validations/invitation.ts`**:
   ```ts
   import { z } from "zod";

   const Role = z.enum(["admin", "member", "viewer"]);

   export const InviteToWorkspaceSchema = z.object({
     workspaceId: z.string().uuid(),
     email: z.string().email(),
     role: Role,
   });
   export type InviteToWorkspaceInput = z.infer<typeof InviteToWorkspaceSchema>;

   export const InviteToBoardSchema = z.object({
     boardId: z.string().uuid(),
     email: z.string().email(),
     role: Role,
   });
   export type InviteToBoardInput = z.infer<typeof InviteToBoardSchema>;

   export const AcceptInvitationSchema = z.object({
     token: z.string().min(32).max(128),
   });
   export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;
   ```
   `Role` excludes `owner` per `invitation.role` check constraint.

7. **Tests** — same pattern as `tests/unit/with-user.test.ts` and `tests/unit/supabase-admin.test.ts`. Mock `@/lib/supabase/server` via `vi.mock`; assert:
   - `requireBoardRole` returns the role string when role ≥ minRole.
   - `requireBoardRole` throws `{code:'FORBIDDEN'}` when role is null or below minRole.
   - `getBoardRole` returns `null` when no user.
   - Same shape for `requireWorkspaceRole`.

### Definition of done

- All eight new files exist with the contracts above.
- `pnpm typecheck` green. `Database` type is consulted but not strictly required (RPC return widened to `Role | null` via cast — F1 tightens after type regen).
- `pnpm lint` green. Biome import-type rules satisfied.
- `pnpm test` green; the two new test files pass.
- No edits to `lib/auth/*`.

### Escalation triggers

- `supabase.rpc("role_for_board", ...)` typing — until F1 regenerates types, `Database['public']['Functions']['role_for_board']` doesn't exist. **Acceptable:** narrow cast (`as Role | null`) and a TODO comment; F1 tightens.
- Anything else needing architectural judgement.

### Commits

Logical commits, e.g.:
- `authz: add role-rank helpers and board/workspace requireRole`
- `validations: add workspace/board/invitation creation schemas`
- `test: cover requireBoardRole / requireWorkspaceRole`

---

## Slice D — Migration: `invitation` table + RLS + `create_workspace` / `create_board` RPCs

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel

### Scope

- `/supabase/migrations/<YYYYMMDDHHMMSS>_invitations_and_creation_rpcs.sql` — **new**, single migration containing:
  1. `invitation` table per epic doc 437–451.
  2. `invitation_email_idx` (lower(email)).
  3. RLS enable on `invitation`.
  4. `invitation` policies: `select` (invitee or admin+ on parent), `insert` (admin+ on parent), `update` (invitee can set `accepted_at` on own row when matching). **No `delete` policy** in v1.
  5. `drop policy "wsm_insert" on public.workspace_member;` followed by the **invitation-gated wsm_insert** policy.
  6. `drop policy "bm_insert" on public.board_member;` followed by the **invitation-gated bm_insert** policy.
  7. `create or replace function public.create_workspace(p_name text, p_slug text) returns public.workspace` — `security definer`.
  8. `create or replace function public.create_board(p_workspace_id uuid, p_name text, p_is_private boolean) returns public.board` — `security definer`.
  9. Grants for execute on the two functions to `authenticated`.

### Forbidden scope

- `lib/`, `app/`, `tests/`, `package.json`, `.github/`, any other migration file, `supabase/seed.sql`, `supabase/config.toml`. **Hard rule.**

### Dependencies

Logically depends on A (helpers) and B (initial admin-only `wsm_insert` / `bm_insert` policies). Filename timestamp must sort **after** B's so the `drop policy` calls find their targets. F1 enforces apply order: A → B → D.

### Spec details

1. **`invitation` table** — exact shape from epic doc 437–451:
   - `id uuid primary key default gen_random_uuid()`
   - `workspace_id uuid not null references public.workspace(id) on delete cascade`
   - `board_id uuid references public.board(id) on delete cascade` (nullable; null = workspace-scoped)
   - `email text not null` (lowercased on insert via the server action; index on `lower(email)`)
   - `role text not null check (role in ('admin','member','viewer'))`
   - `token text not null unique`
   - `invited_by uuid references auth.users(id) on delete set null`
   - `accepted_at timestamptz`
   - `expires_at timestamptz not null default (now() + interval '14 days')`
   - `created_at timestamptz not null default now()`

2. **RLS on `invitation`** — `enable row level security`. Policies:
   - `invitation_select`: invitee (`lower(email) = lower((select email from auth.users where id = auth.uid()))`) on non-accepted rows, OR admin+ on workspace, OR admin+ on board if `board_id is not null`.
   - `invitation_insert`: admin+ on workspace; if `board_id is not null` admin+ on board too. Token + email + role + workspace_id + board_id + invited_by all set by caller.
   - `invitation_update`: **own non-accepted invitation only**; restricted to setting `accepted_at`. Postgres can't gate per-column at the policy level easily, so the policy gates the row; a `before update` trigger on the table rejects updates that change any column other than `accepted_at`. Trigger:
     ```sql
     create or replace function public.invitation_only_accept_update()
     returns trigger language plpgsql as $$
     begin
       if new.id is distinct from old.id
         or new.workspace_id is distinct from old.workspace_id
         or new.board_id is distinct from old.board_id
         or new.email is distinct from old.email
         or new.role is distinct from old.role
         or new.token is distinct from old.token
         or new.invited_by is distinct from old.invited_by
         or new.expires_at is distinct from old.expires_at
         or new.created_at is distinct from old.created_at
       then
         raise exception 'invitation: only accepted_at may be updated' using errcode = '42501';
       end if;
       return new;
     end $$;
     create trigger invitation_only_accept_update
       before update on public.invitation
       for each row execute function public.invitation_only_accept_update();
     ```
     Service-role updates bypass RLS but are still subject to the trigger; if a future epic needs broader updates, drop the trigger first or extend it.
   - **No `delete` policy** in v1.

3. **`wsm_insert` replacement** (drop + recreate):
   ```sql
   drop policy if exists "wsm_insert" on public.workspace_member;
   create policy "wsm_insert" on public.workspace_member for insert with check (
     -- admin+ on the workspace
     public.role_rank((
       select role from public.workspace_member
        where workspace_id = workspace_member.workspace_id and user_id = auth.uid()
     )) >= public.role_rank('admin')
     OR
     -- self-insert via valid workspace-scoped invitation
     (
       user_id = auth.uid()
       and exists (
         select 1 from public.invitation i
          where i.workspace_id = workspace_member.workspace_id
            and i.board_id is null
            and lower(i.email) = lower((select email from auth.users where id = auth.uid()))
            and i.role = workspace_member.role
            and i.accepted_at is null
            and i.expires_at >= now()
       )
     )
   );
   ```

4. **`bm_insert` replacement** (drop + recreate):
   ```sql
   drop policy if exists "bm_insert" on public.board_member;
   create policy "bm_insert" on public.board_member for insert with check (
     -- admin+ on the board (board admin or workspace admin via role_for_board on non-private boards)
     public.role_rank(public.role_for_board(board_member.board_id, auth.uid())) >= public.role_rank('admin')
     OR
     -- self-insert via valid board-scoped invitation
     (
       user_id = auth.uid()
       and exists (
         select 1 from public.invitation i
          where i.board_id = board_member.board_id
            and lower(i.email) = lower((select email from auth.users where id = auth.uid()))
            and i.role = board_member.role
            and i.accepted_at is null
            and i.expires_at >= now()
       )
     )
   );
   ```
   Q13=(b): board-scoped invite touches **only** `board_member`; no `workspace_member` insert from accept.

5. **`create_workspace(p_name text, p_slug text) returns public.workspace`**:
   ```sql
   create or replace function public.create_workspace(p_name text, p_slug text)
   returns public.workspace
   language plpgsql security definer set search_path = public
   as $$
   declare
     v_user uuid := auth.uid();
     v_ws public.workspace;
   begin
     if v_user is null then
       raise exception 'unauthenticated' using errcode = '28000';
     end if;
     insert into public.workspace (name, slug, created_by)
       values (p_name, p_slug, v_user)
       returning * into v_ws;
     insert into public.workspace_member (workspace_id, user_id, role)
       values (v_ws.id, v_user, 'owner');
     return v_ws;
   end $$;
   grant execute on function public.create_workspace(text, text) to authenticated;
   ```

6. **`create_board(p_workspace_id uuid, p_name text, p_is_private boolean) returns public.board`**:
   ```sql
   create or replace function public.create_board(p_workspace_id uuid, p_name text, p_is_private boolean)
   returns public.board
   language plpgsql security definer set search_path = public
   as $$
   declare
     v_user uuid := auth.uid();
     v_role text;
     v_board public.board;
   begin
     if v_user is null then
       raise exception 'unauthenticated' using errcode = '28000';
     end if;
     select role into v_role from public.workspace_member
       where workspace_id = p_workspace_id and user_id = v_user;
     if v_role is null or public.role_rank(v_role) < public.role_rank('member') then
       raise exception 'forbidden' using errcode = '42501';
     end if;
     insert into public.board (workspace_id, name, created_by, is_private)
       values (p_workspace_id, p_name, v_user, coalesce(p_is_private, false))
       returning * into v_board;
     if coalesce(p_is_private, false) then
       insert into public.board_member (board_id, user_id, role)
         values (v_board.id, v_user, 'owner');
     end if;
     return v_board;
   end $$;
   grant execute on function public.create_board(uuid, text, boolean) to authenticated;
   ```

7. **Token generation** — done in slice E (server action, JS). `pgcrypto` is available if needed but the JS path is canonical here.

### Definition of done

- Migration file exists. Filename timestamp strictly later than slices A and B.
- `invitation` table exists with the exact column shape.
- RLS policies on `invitation`: select, insert, update (column-restricted via trigger). No delete policy.
- `wsm_insert` and `bm_insert` policies replaced with invitation-gated forms.
- Two security-definer functions defined with `set search_path = public`, granted to `authenticated`.
- File parses syntactically.

### Escalation triggers

- `pgcrypto` not enabled (it is, per initial migration).
- `auth.users.email` access from a `security definer` function fails (it shouldn't — epic 02's `handle_new_user` already does it).
- The `before update` trigger doesn't compose with Supabase's `realtime` replication (shouldn't — triggers don't suppress wal_logical entries).

### Commits

Single commit: `schema: add invitation table, accept-via-RLS policies, and create_workspace/create_board RPCs`.

---

## Slice E — Server actions: workspace + board creation, invitation create + accept

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel

### Scope

- `/app/(app)/actions.ts` — **new** — `createWorkspace` (calls `create_workspace` RPC).
- `/app/(app)/w/[workspaceSlug]/actions.ts` — **new** — `createBoard`, `inviteToWorkspace`.
- `/app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts` — **new** — `inviteToBoard`.
- `/app/(auth)/join/[token]/actions.ts` — **new** — `acceptInvitation`. Two-statement flow under user session.
- `/lib/utils/invitation-token.ts` — **new** — `generateInvitationToken()` using `crypto.getRandomValues` → URL-safe base64 (24 bytes / 192 bits → 32 chars).

### Forbidden scope

- `supabase/migrations/`, `supabase/seed.sql`, `lib/authorization/`, `lib/validations/`, `lib/supabase/`, `lib/auth/`, `lib/actions/with-user.ts`, `lib/env.ts`, all existing `app/(auth)/**` (sign-in, sign-up, forgot-password, reset-password, verify-email, callback, account), `app/(app)/account/`, `app/(app)/layout.tsx` (epic 05 owns the shell), `package.json`, `.github/`, `biome.json`, legacy. **Hard rule.**

### Dependencies

Imports from C (`lib/authorization/*`, `lib/validations/*`). Calls D's RPCs (`create_workspace`, `create_board`) and writes to D's `invitation` table directly.

### Spec details

Each action: `"use server"`, wrapped in `withUser`, validates input via Zod, calls `requireWorkspaceRole` / `requireBoardRole` for friendly-error gating, then performs writes under the user's session. RLS is the actual enforcement.

1. **`app/(app)/actions.ts`** — `createWorkspace`:
   ```ts
   "use server";
   import { withUser } from "@/lib/actions";
   import { CreateWorkspaceSchema } from "@/lib/validations/workspace";

   export const createWorkspace = withUser(async ({ supabase }, raw) => {
     const input = CreateWorkspaceSchema.parse(raw);
     const { data, error } = await supabase
       .rpc("create_workspace", { p_name: input.name, p_slug: input.slug })
       .single();
     if (error) {
       if (error.code === "23505") {
         throw { code: "VALIDATION", message: "That slug is taken.", field: "slug" };
       }
       throw { code: "DB", message: error.message };
     }
     return data;
   });
   ```

2. **`app/(app)/w/[workspaceSlug]/actions.ts`** — `createBoard` + `inviteToWorkspace`:
   ```ts
   "use server";
   import { withUser } from "@/lib/actions";
   import { requireWorkspaceRole } from "@/lib/authorization";
   import { CreateBoardSchema } from "@/lib/validations/board";
   import { InviteToWorkspaceSchema } from "@/lib/validations/invitation";
   import { generateInvitationToken } from "@/lib/utils/invitation-token";
   import { logger } from "@/lib/logger";

   export const createBoard = withUser(async ({ supabase }, raw) => {
     const input = CreateBoardSchema.parse(raw);
     await requireWorkspaceRole(input.workspaceId, "member");
     const { data, error } = await supabase
       .rpc("create_board", {
         p_workspace_id: input.workspaceId,
         p_name: input.name,
         p_is_private: input.isPrivate,
       })
       .single();
     if (error) throw { code: "DB", message: error.message };
     return data;
   });

   export const inviteToWorkspace = withUser(async ({ supabase, userId }, raw) => {
     const input = InviteToWorkspaceSchema.parse(raw);
     await requireWorkspaceRole(input.workspaceId, "admin");
     const token = generateInvitationToken();
     const { data, error } = await supabase
       .from("invitation")
       .insert({
         workspace_id: input.workspaceId,
         email: input.email.toLowerCase(),
         role: input.role,
         invited_by: userId,
         token,
       })
       .select()
       .single();
     if (error) throw { code: "DB", message: error.message };
     // TODO epic 13: send invitation email via Resend.
     logger.info(
       { token, email: input.email, workspaceId: input.workspaceId },
       "invitation created (email send not yet wired — epic 13)"
     );
     return data;
   });
   ```

3. **`app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts`** — `inviteToBoard`:
   - Same shape as `inviteToWorkspace` with `requireBoardRole(boardId, "admin")`.
   - Looks up `workspace_id` from the board row, sets both `workspace_id` and `board_id` on the inserted invitation. (Schema requires `workspace_id not null`.)

4. **`app/(auth)/join/[token]/actions.ts`** — `acceptInvitation` (two-statement RLS-gated flow):
   ```ts
   "use server";
   import { withUser } from "@/lib/actions";
   import { AcceptInvitationSchema } from "@/lib/validations/invitation";

   export const acceptInvitation = withUser(async ({ supabase, userId }, raw) => {
     const input = AcceptInvitationSchema.parse(raw);

     // 1. Look up the invitation under the user's session. RLS limits visibility
     //    to invitee (matching email, not yet accepted) or admin+.
     const { data: inv, error: lookupError } = await supabase
       .from("invitation")
       .select("id, workspace_id, board_id, role, accepted_at, expires_at, email")
       .eq("token", input.token)
       .maybeSingle();
     if (lookupError) throw { code: "DB", message: lookupError.message };
     if (!inv) throw { code: "INVITATION", message: "We couldn't find that invitation." };
     if (inv.accepted_at) throw { code: "INVITATION", message: "That invitation has already been used." };
     if (new Date(inv.expires_at) < new Date()) {
       throw { code: "INVITATION", message: "That invitation has expired. Ask the sender to invite you again." };
     }

     // 2. Insert membership under user session — RLS gated on invitation match.
     if (inv.board_id) {
       const { error: bmError } = await supabase
         .from("board_member")
         .insert({ board_id: inv.board_id, user_id: userId, role: inv.role });
       if (bmError) throw { code: "DB", message: bmError.message };
     } else {
       const { error: wmError } = await supabase
         .from("workspace_member")
         .insert({ workspace_id: inv.workspace_id, user_id: userId, role: inv.role });
       if (wmError) throw { code: "DB", message: wmError.message };
     }

     // 3. Stamp accepted_at — column-restricted via the invitation update trigger.
     const { error: acceptError } = await supabase
       .from("invitation")
       .update({ accepted_at: new Date().toISOString() })
       .eq("id", inv.id);
     if (acceptError) {
       // NOTE: non-atomic. The membership insert succeeded; the invitation row stays
       // open until expiry. Acceptable trade-off for the RLS-gated flow (Q3=(b)).
       throw { code: "DB", message: acceptError.message };
     }

     return { workspaceId: inv.workspace_id, boardId: inv.board_id };
   });
   ```
   Redirect happens in the page (slice F), not the action.

5. **`lib/utils/invitation-token.ts`**:
   ```ts
   export function generateInvitationToken(): string {
     const bytes = new Uint8Array(24); // 192 bits
     crypto.getRandomValues(bytes);
     return btoa(String.fromCharCode(...bytes))
       .replaceAll("+", "-")
       .replaceAll("/", "_")
       .replaceAll("=", "");
   }
   ```

### Definition of done

- Five new files exist with the contracts above.
- `pnpm typecheck` green. Until F1 regenerates types, RPC calls may need a narrow cast. Acceptable.
- `pnpm lint` green.
- `pnpm test` green; existing tests unchanged.
- All actions return through `withUser`.
- No edits to `app/(auth)/sign-in/`, `app/(app)/account/`, the shell layout, or other forbidden paths.

### Escalation triggers

- `withUser` doesn't compose with `redirect` (the wrapper try/catches; `redirect` throws a special error). Slice F's page handles redirect outside the action. Document in the action.
- Anything else needing architectural judgement.

### Commits

Logical commits, e.g.:
- `actions: add createWorkspace`
- `actions: add createBoard + inviteToWorkspace`
- `actions: add inviteToBoard`
- `actions: add acceptInvitation + token util`

---

## Slice F — Invitation accept route UI (skeleton)

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel

### Scope

- `/app/(auth)/join/[token]/page.tsx` — **new** — RSC. Reads token from params; if unauthed redirects to `/sign-in?next=/join/<token>`; if authed renders a card with "You've been invited" + a server-action form with a single "Accept and continue" button. On success redirects to `/`. On error shows the error via query string.
- `/tests/e2e/invitation-accept.spec.ts` — **new (skeletal `test.skip`)** — placeholder asserting the route exists. Real e2e in epic 15.

**No `"use client"` component for this slice** — the form is a server-action `<form action={...}>`; RHF gives nothing here.

### Forbidden scope

- All other `app/` paths, `lib/`, `supabase/`, `package.json`, `.github/`, `biome.json`, legacy. The action file `app/(auth)/join/[token]/actions.ts` is owned by slice E. **Hard rule.**

### Dependencies

Imports `acceptInvitation` server action from slice E. Imports `getCurrentUser` from `@/lib/auth/current-user` (already on `main`). The page itself doesn't depend on D's migration at edit time.

### Spec details

```tsx
// app/(auth)/join/[token]/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { acceptInvitation } from "./actions";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`);

  async function accept() {
    "use server";
    const result = await acceptInvitation({ token });
    if (!result.ok) {
      redirect(`/join/${token}?error=${encodeURIComponent(result.error.message)}`);
    }
    redirect("/");
  }

  return (
    <main className="...">
      <h1>You've been invited</h1>
      {error ? <p role="alert">{error}</p> : null}
      <p>Click below to accept and continue to Donezo.</p>
      <form action={accept}>
        <button type="submit">Accept and continue</button>
      </form>
    </main>
  );
}
```

Style minimally; epic 05 owns the auth-shell card visuals.

### Definition of done

- `app/(auth)/join/[token]/page.tsx` exists and renders.
- Unauthed users hit `/sign-in?next=/join/<token>` and return after sign-in (existing middleware honors `next` per epic 03).
- Authed users see the accept button; clicking it calls `acceptInvitation` and redirects to `/` on success or back to `/join/<token>?error=...` on failure.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` green.
- The skeleton e2e test exists with `test.skip`, syntactically valid.

### Escalation triggers

- The `(auth)` route group's layout imposes something that conflicts with this page — verify by reading `app/(auth)/layout.tsx`.
- Anything else needing architectural judgement.

### Commits

Single commit: `feat(invite): join/[token] route skeleton`.

---

## Slice G — pgTAP test files (no runner)

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel

Per Q1=(d): **ship `.sql` files only**, no `pnpm test:policies`, no CI integration. Epic 15 wires the runner.

### Scope

- `/tests/policies/00_setup.sql` — **new** — pgTAP helpers: `make_user(uuid, text)`, `set_jwt_user(uuid)`, `seed_workspace_with_roles(...)`, `seed_board(...)`. Reusable.
- `/tests/policies/10_workspace.sql` — **new** — ~10 assertions: viewer can't update workspace; admin can; non-member can't see; owner can delete.
- `/tests/policies/20_board.sql` — **new** — ~10 assertions: workspace-viewer can SELECT non-private board; non-workspace-member can't; private-board flag flips visibility; `role_for_board` returns expected role for each (board, user) combination.
- `/tests/policies/30_task_cell.sql` — **new** — ~12 assertions: viewer can SELECT but not INSERT task; member can INSERT and UPDATE cell; viewer cannot DELETE column; comment author can UPDATE/DELETE own; admin+ can delete others'.
- `/tests/policies/40_invitation.sql` — **new** — ~10 assertions: admin can INSERT invitation; member cannot; invitee can SELECT own non-accepted row; invitee can UPDATE only `accepted_at`; trigger blocks updating any other column; expired invitation cannot be used to self-insert into `workspace_member`; mismatched email cannot self-insert; tight Q13 — board-scoped invitation insert into `workspace_member` is rejected.
- `/tests/policies/50_view.sql` — **new** — ~6 assertions: personal view (`is_shared=false`) hidden from other users; shared view visible to all board members; modifying shared/system-shared requires admin.
- `/tests/policies/README.md` — **new** — documents what each file covers, the helper conventions, and that the runner lands in epic 15. Includes a short "to run locally" section that says "epic 15 wires `pnpm test:policies`; until then, paste files into a Supabase SQL editor or use `psql` against a scratch project."

### Forbidden scope

- `supabase/migrations/`, `supabase/seed.sql`, `supabase/config.toml`, `lib/`, `app/`, `.github/`, `biome.json`, `package.json` (no `test:policies` script per Q1=(d)), legacy. **Hard rule.**

### Dependencies

Tests reference all four migrations (initial + helpers + policies + invitations). Authoring doesn't require those files at edit time, but running them does — F1 must apply migrations first; epic 15 ties this together.

### Spec details

Each `tests/policies/*.sql` shape:

```sql
begin;

select plan(N);

\i 00_setup.sql

select seed_workspace_with_roles(...);

-- assertion 1
select set_jwt_user('user-viewer-id');
select throws_ok(
  $$insert into public.task (group_id, position) values ('group-id', 1)$$,
  '42501',
  'viewer cannot insert task'
);

-- ...

select * from finish();
rollback;
```

`set_jwt_user(uuid)` sets `request.jwt.claims` JSON via `set local "request.jwt.claims" = ...` so `auth.uid()` resolves correctly.

`00_setup.sql` defines:
- `make_user(p_id uuid, p_email text)` — inserts into `auth.users`.
- `set_jwt_user(p_id uuid)` — sets `request.jwt.claims` and `role authenticated`.
- `seed_workspace_with_roles(p_workspace_id uuid, p_roles jsonb)` — populate `workspace_member` from a `{user_id: role}` JSON.
- `seed_board(p_board_id uuid, p_workspace_id uuid, p_is_private boolean)`.

**Coverage targets** (from epic doc § Definition of done lines 506–515):
- Workspace viewer cannot insert task (slice 30).
- Board member cannot delete column (slice 30).
- Non-member cannot SELECT private board's tasks (slice 20 + 30).
- Board admin can update board.name but not delete it (workspace owner only) (slice 20).
- Comment author can delete own comment; regular member cannot (slice 30).
- `role_for_board` returns correct role for every (board, user) combination (slice 20 — table-driven).
- Invitation flow gates: gated self-insert with valid invitation succeeds; with expired/mismatched/wrong-role invitation fails; board-scoped invite cannot insert into `workspace_member` (slice 40, **Q13 verification**).

### Definition of done

- All test files exist with the required assertion counts (~50 across 5 files, matches epic doc).
- `tests/policies/README.md` documents the suite, helper conventions, and the deferred runner.
- **No `pnpm test:policies` script added.**
- **No `.github/workflows/` edits.**
- Test SQL parses syntactically (executor lints by reading; no execution).

### Escalation triggers

- Any assertion requires a policy that isn't in slice B or D. Pause for re-spec rather than guess.

### Commits

Logical commits, e.g.:
- `test(policies): pgTAP setup helpers`
- `test(policies): workspace + workspace_member assertions`
- `test(policies): board + board_member + role_for_board assertions`
- `test(policies): task / cell / comment assertions`
- `test(policies): invitation + accept-flow assertions`
- `test(policies): view assertions`
- `docs(policies): README explaining deferred runner`

---

## Sequential follow-ups

Run on `epic/04-authorization-rls` after the stage-2 review pass returns CLEAN.

### F1 — Apply migrations to cloud + regenerate types

1. `pnpm db:push` — applies the three new migrations (slice A, B, D) to the linked cloud project. Apply order: A → B → D (timestamps enforce). Verify in Supabase dashboard:
   - `board.is_private` column exists.
   - `role_rank`, `greater_role`, `role_for_board` functions exist.
   - 50+ policies exist across 15 tables.
   - `invitation` table + trigger + functions (`create_workspace`, `create_board`) exist.
   - `wsm_insert` / `bm_insert` policies replaced with invitation-gated forms.
2. `pnpm db:types` — regenerates `lib/supabase/types.ts`. New `Database['public']['Functions']` entries: `role_for_board`, `create_workspace`, `create_board`. New `Database['public']['Tables']['invitation']`.
3. Commit `lib/supabase/types.ts` on the epic branch.
4. Tighten any `as any` / narrow casts in slices C and E now that types resolve.
5. Smoke check: in a temporary RSC, `await supabase.from("workspace").select("*")` returns the seed `Donezo Demo` workspace **only** under that user's session; under anon, returns empty. Confirm.

### F2 — Switch `lib/auth/{current-user,profile}.ts` off `adminClient`

With slice B's `profile_select` and `profile_update` policies in place, both helpers can use the user's authed Supabase client.

- `lib/auth/current-user.ts:20-29` — replace `adminClient()` lookup with `supabase.from("profile").select(...).eq("id", user.id).maybeSingle()` using the existing `createClient()`. Remove the biome-ignore for `noRestrictedImports`. Remove the `TODO epic 04` comment.
- `lib/auth/profile.ts` — same swap. Wrap with the count-check guard so an RLS-denied update doesn't silently no-op:
  ```ts
  const { error, count } = await supabase
    .from("profile")
    .update(patch, { count: "exact" })
    .eq("id", userId);
  if (error) throw { code: "DB", message: error.message };
  if ((count ?? 0) === 0) throw { code: "FORBIDDEN", message: "Not allowed" };
  ```
- Add `tests/unit/profile-rls.test.ts` with mocks for the count-check paths.

This is small (~30 lines diff) but **load-bearing** — the smoke test that policies actually work end-to-end.

### F3 — Save approved dispatch (this file)

This document is the artifact.

---

## Risk notes

1. **pgTAP is unverified at merge.** Q1=(d) defers the runner to epic 15. RLS is notoriously easy to get subtly wrong (missing `with check`, broken `using`, forgotten `for delete`). The `.sql` test files ship in this epic but won't actually run until epic 15 wires the runner. **Implication:** epic 05 builds UI on policies that haven't executed against a real DB through pgTAP. Mitigation: F1's manual smoke (RSC SELECT under user session vs. anon) is the main confidence gate; F2's count-check on `profile` is the load-bearing exercise of the policy stack. Capture as a debt item in epic 15's doc with explicit "must wire `pnpm test:policies` before merging epic 05" language. **User accepted this risk.**

2. **Non-atomic invitation accept.** Q3=(b) means `acceptInvitation` does two writes under the user's session (membership insert, then `accepted_at` update). If the second fails after the first succeeds, the user has membership but the invitation stays "open" until expiry. Re-using the same token would attempt a duplicate membership insert (composite PK rejects it) — safe, but the action returns an error. Mitigation: log the inconsistency in F2-era observability; epic 13 surfaces it if it ever happens.

3. **Invitation-update trigger fragility.** The `before update` trigger blocks any column change other than `accepted_at`. If a future epic needs to update e.g. `expires_at` (extend invite), the trigger must be amended in a new migration. Document at the trigger site.

4. **Invitation-gated self-insert policy size.** `wsm_insert` / `bm_insert` carry a non-trivial `exists (...)` subquery against `invitation`. Hot path during accept; cheap because of the email + workspace_id index. Slice G's pgTAP must cover the bypass surface (e.g., self-insert with a *different* role than the invitation specifies must fail).

5. **Cloud-only migration application during in-flight stages.** Slice A's `is_private` change applies to cloud `board` rows. Existing seed boards default to `false`. F1 runs after stage 2 and applies all three migrations together; no executor should test against the cloud DB mid-stage.

6. **Email-allowlist + invitations** (Q11). Without coordinated work in epic 03's allowlist hook, an invitation to a non-allowed-domain email succeeds at insert but fails at sign-in. Mitigation: documented in CONTRIBUTING; epic 03's hook gets the "skip allowlist if invited" check later. Not a blocker.

7. **Service-role usage drift.** Epic 04 introduces two `security definer` functions (`create_workspace`, `create_board`). Each is a controlled bypass. Document in `CONTRIBUTING.md` under "Service-role and definer functions." Future epics adding another must pass through Opus review.

8. **`activity` and `notification` no-insert-policy.** Only service-role / definer functions can write. Epic 09 and 13 rely on this; if a future epic forgets and tries to insert from an authed action, it'll fail silently with `0 rows affected`. Flag in epic-09 and epic-13 docs.

9. **`role_for_board` performance.** Called in nearly every policy on every read of `task` / `cell` / `comment`. Up to two table lookups per row. For 10k-row table reads, this is a hot path. Optimization (epic 06 / 11 may need to materialize membership and bulk-filter), not correctness. Flag.

10. **RLS recursion / infinite loops.** `role_for_board` calls `board` / `workspace_member` / `board_member`, each with RLS. Because `role_for_board` is `security definer`, it bypasses those policies. If anyone re-defines without `security definer`, RLS becomes recursive and queries hang or error. Slice A mandates `security definer`; slice G's pgTAP includes `select prosecdef from pg_proc where proname = 'role_for_board'` assertion.

11. **`view` policy correction (Q5).** Epic doc snippet was wrong about `user_id` / `is_shared`. Slice B follows the **corrected** spec, not the doc verbatim. Called out explicitly in slice B § Spec details.

12. **Soft-delete and `deleted_at is null` filter coverage.** `role_for_board` returns `null` for soft-deleted boards, so cell/attachment policies (joined via task) inherit. Edge case: a non-deleted task on a deleted board — `task_select` returns it (task isn't deleted), `role_for_board` returns null → rest deny. Mitigation: pgTAP assertion confirms.

13. **Type generation lag.** Slice C and E reference RPCs and tables that don't exist in `lib/supabase/types.ts` until F1. Executors use temporary casts; F1 tightens. Documented per slice.

14. **Email-only invitations.** No SMS, no in-app share-link mode. Confirmed by epic doc § Open Questions. Constraint to remember.

15. **`lib/auth/profile.ts` silent-no-op risk.** Addressed in F2 with the count-check wrapper. If F2 grows beyond ~30 lines, ship as separate followup.

---

## Files referenced (absolute paths)

- `/Volumes/SSD1T/DEV WORK/donezo/CLAUDE.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/00-overview.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/02-supabase-schema.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/03-auth.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/04-authorization-rls.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/05-workspaces-boards.md` (downstream consumer)
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-02.md` (style reference)
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-03.md` (style reference)
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-refinements/auth-google-only.md`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506224930_initial_schema.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506230238_view_board_pos_idx.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260507003509_avatars_bucket.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/seed.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/actions/with-user.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/actions/index.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/auth/current-user.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/auth/profile.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/auth/public-paths.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/validations/auth.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/env.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(auth)/actions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/account/actions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/auth/callback/route.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/.github/workflows/ci.yml`
- `/Volumes/SSD1T/DEV WORK/donezo/package.json`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/config.toml`
