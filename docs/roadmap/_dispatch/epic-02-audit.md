# Epic 02 — Invitation Acceptance Hardening: Audit

**Scope:** Repo-derivable findings. The Maintainer Checklist (§8) requires production
`psql` access — a human must run it and record results here before Stages 1 and 3 are
dispatched.

Epic doc: [`docs/roadmap/02-invitation-acceptance-hardening.md`](../02-invitation-acceptance-hardening.md)
Dispatch plan: [`docs/roadmap/_dispatch/epic-02.md`](epic-02.md)
Audit produced: 2026-05-16

---

## §1 — Expected Definitions (from Migrations)

The five security-critical objects in their **final / active form** as of the latest
migration that touches each. Only this definition should be in prod.

---

### `current_user_email`

**Final active definition:**
Source: `supabase/migrations/20260516000003_reassert_invite_email_helper_policies.sql`
lines 29–44 (identical to `20260513210000_fix_current_user_email_helper.sql` lines 23–40;
`0003` re-asserts the same body to force prod convergence).

```sql
create or replace function public.current_user_email()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email::text into v_email
    from public.profile
    where id = (select auth.uid());
  return v_email;
end
$$;

grant execute on function public.current_user_email() to authenticated, anon;
```

**Migration history** (all three touch this object; only the last is active):

| Migration | Timestamp | What changed |
|-----------|-----------|-------------|
| `20260513200000_current_user_email_helper.sql` lines 22–27 | First create | `language sql security definer set search_path = public stable` — `stable` parsed as part of search_path literal; function left VOLATILE and inlinable; reads `auth.users` directly |
| `20260513210000_fix_current_user_email_helper.sql` lines 23–40 | Rewrite | Switched to `language plpgsql`, explicit `stable` keyword, reads `public.profile` instead of `auth.users` |
| `20260516000003_reassert_invite_email_helper_policies.sql` lines 29–44 | **Re-assert (FINAL)** | Identical body to `...0210000`; re-applied to guarantee prod convergence after suspected migration lag |

---

### `bm_insert`

**Final active definition:**
Source: `supabase/migrations/20260516000003_reassert_invite_email_helper_policies.sql`
lines 68–85.

```sql
create policy "bm_insert" on public.board_member for insert with check (
  public.role_rank(public.role_for_board(board_member.board_id, (select auth.uid())))
    >= public.role_rank('admin')
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation i
       where i.board_id = board_member.board_id
         and lower(i.email) = lower(public.current_user_email())
         and i.role = board_member.role
         and i.accepted_at is null
         and i.revoked_at is null
         and i.expires_at >= now()
    )
  )
);
```

**Migration history** (all five supersede each other; only the last is active):

| Migration | Timestamp | What changed |
|-----------|-----------|-------------|
| `20260507120100_rls_policies.sql` lines 132–135 | First create | Admin-only; comment says "Slice D will replace" |
| `20260507120200_invitations_and_creation_rpcs.sql` lines 139–157 | Replace | Adds self-insert branch; reads `auth.users` directly (no `revoked_at` — column didn't exist yet) |
| `20260508000000_workspaces_polish.sql` lines 121–137 | Replace | Adds `revoked_at is null`; still reads `auth.users` directly |
| `20260513200000_current_user_email_helper.sql` lines 57–73 | Replace | Routes email match through `current_user_email()` helper (VOLATILE/inlinable version) |
| `20260516000003_reassert_invite_email_helper_policies.sql` lines 68–85 | **Re-assert (FINAL)** | Routes through stable plpgsql `current_user_email()`; same body as `...0200000` but with the fixed helper |

Note: `20260512100000_fix_wsm_select_recursion.sql` lines 62–79 recreated `bm_insert` *without* the self-insert branch (the comment says it kept the invitation-gated form only for `wsm_insert`; `bm_insert` was not mentioned and the file does not touch it). That migration is therefore superseded on the `bm_insert` lineage by `20260513200000`.

---

### `wsm_insert`

**Final active definition:**
Source: `supabase/migrations/20260516000003_reassert_invite_email_helper_policies.sql`
lines 49–66.

```sql
create policy "wsm_insert" on public.workspace_member for insert with check (
  public.role_rank(public.role_for_workspace(workspace_member.workspace_id, (select auth.uid())))
    >= public.role_rank('admin')
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation i
       where i.workspace_id = workspace_member.workspace_id
         and i.board_id is null
         and lower(i.email) = lower(public.current_user_email())
         and i.role = workspace_member.role
         and i.accepted_at is null
         and i.revoked_at is null
         and i.expires_at >= now()
    )
  )
);
```

**Migration history** (all six supersede each other; only the last is active):

| Migration | Timestamp | What changed |
|-----------|-----------|-------------|
| `20260507120100_rls_policies.sql` lines 64–71 | First create | Admin-only; comment says "Slice D will replace" |
| `20260507120200_invitations_and_creation_rpcs.sql` lines 110–133 | Replace | Adds self-insert branch; reads `auth.users` directly; admin check uses inline `select role from workspace_member` (recursion risk); no `revoked_at` |
| `20260508000000_workspaces_polish.sql` lines 100–119 | Replace | Adds `revoked_at is null`; still reads `auth.users` directly; admin check still inlines workspace_member |
| `20260512100000_fix_wsm_select_recursion.sql` lines 62–79 | Replace | Routes admin check through `role_for_workspace()` helper; still reads `auth.users` directly |
| `20260513200000_current_user_email_helper.sql` lines 33–50 | Replace | Routes email match through `current_user_email()` helper (VOLATILE/inlinable version) |
| `20260516000003_reassert_invite_email_helper_policies.sql` lines 49–66 | **Re-assert (FINAL)** | Same body as `...0200000`; forces prod convergence with the fixed stable plpgsql helper |

---

### `invitation_select`

**Final active definition:**
Source: `supabase/migrations/20260513230000_invitation_select_allow_accepted.sql`
lines 32–44.

```sql
create policy "invitation_select" on public.invitation for select using (
  lower(email) = lower(public.current_user_email())
  or
  public.role_rank(public.role_for_workspace(invitation.workspace_id, (select auth.uid())))
    >= public.role_rank('admin')
  or
  (
    board_id is not null
    and public.role_rank(public.role_for_board(board_id, (select auth.uid())))
      >= public.role_rank('admin')
  )
);
```

**Migration history** (all four supersede each other; only the last is active):

| Migration | Timestamp | What changed |
|-----------|-----------|-------------|
| `20260507120200_invitations_and_creation_rpcs.sql` lines 41–56 | First create | Email branch guarded by `and accepted_at is null`; reads `auth.users` directly |
| `20260513100000_fix_remaining_rls_recursion.sql` lines 48–63 | Replace | Routes admin checks through `role_for_workspace()` / `role_for_board()`; still reads `auth.users` directly; retains `accepted_at is null` guard |
| `20260513200000_current_user_email_helper.sql` lines 79–94 | Replace | Routes email match through `current_user_email()`; retains `accepted_at is null` guard |
| `20260513230000_invitation_select_allow_accepted.sql` lines 32–44 | **Final (FINAL)** | Drops `accepted_at is null` from email-match branch so invitees can SELECT their own invitations after acceptance |

---

### `accept_invitation`

**Final active definition (first and only create):**
Source: `supabase/migrations/20260516000004_accept_invitation_rpc.sql`
lines 24–92.

```sql
create or replace function public.accept_invitation(p_token text)
returns table (workspace_id uuid, board_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := (select auth.uid());
  v_email text;
  v_inv   public.invitation;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  v_email := public.current_user_email();
  if v_email is null then
    raise exception 'no email on profile' using errcode = '42501';
  end if;

  -- Definer privileges bypass invitation RLS; we re-validate by hand.
  select * into v_inv
    from public.invitation
   where token = p_token;

  if v_inv.id is null then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if lower(v_inv.email) <> lower(v_email) then
    raise exception 'invitation addressed to a different email'
      using errcode = '42501';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'invitation revoked' using errcode = '42501';
  end if;
  -- Expiry only gates first acceptance; an already-accepted invite still
  -- backfills membership idempotently below.
  if v_inv.accepted_at is null and v_inv.expires_at < now() then
    raise exception 'invitation expired' using errcode = '42501';
  end if;

  if v_inv.board_id is not null then
    insert into public.board_member (board_id, user_id, role)
      values (v_inv.board_id, v_user, v_inv.role)
      on conflict (board_id, user_id) do nothing;

    -- Board-only members still need a workspace_member row or workspace_select
    -- hides the workspace and navigation degrades. Seed the lowest role;
    -- ON CONFLICT preserves any existing higher role.
    insert into public.workspace_member (workspace_id, user_id, role)
      values (v_inv.workspace_id, v_user, 'viewer')
      on conflict (workspace_id, user_id) do nothing;
  else
    insert into public.workspace_member (workspace_id, user_id, role)
      values (v_inv.workspace_id, v_user, v_inv.role)
      on conflict (workspace_id, user_id) do nothing;
  end if;

  update public.invitation
     set accepted_at = now()
   where id = v_inv.id
     and accepted_at is null;

  workspace_id := v_inv.workspace_id;
  board_id     := v_inv.board_id;
  return next;
end $$;

grant execute on function public.accept_invitation(text) to authenticated;
```

**Migration history:** single migration — `20260516000004_accept_invitation_rpc.sql`
(shipped during the 2026-05-16 production incident). No prior version.

---

## §2 — Migration Filename List

Full ordered list of `supabase/migrations/` as of 2026-05-16:

```
20260506224930_initial_schema.sql
20260506230238_view_board_pos_idx.sql
20260507003509_avatars_bucket.sql
20260507120000_authz_helpers.sql
20260507120100_rls_policies.sql
20260507120200_invitations_and_creation_rpcs.sql
20260507120300_board_delete_owner_only.sql
20260508000000_workspaces_polish.sql
20260508000001_restore_board_rpc.sql
20260511075330_extend_column_type_check.sql
20260512000000_realtime_denormalization.sql
20260512100000_fix_wsm_select_recursion.sql
20260513000000_comment_reactions_and_activity_publication.sql
20260513000001_comment_reaction_rls.sql
20260513100000_fix_remaining_rls_recursion.sql
20260513200000_current_user_email_helper.sql
20260513210000_fix_current_user_email_helper.sql
20260513220000_invitation_update_with_check_relax.sql
20260513230000_invitation_select_allow_accepted.sql
20260514000000_attachments_polish.sql
20260514000001_attachments_bucket.sql
20260514000002_attachments_storage_rls.sql
20260514000003_attachments_realtime_publication.sql
20260514000004_attachment_orphan_cleanup_fn.sql
20260515000000_profile_last_view_per_board.sql
20260515000001_default_view_on_create_board.sql
20260515000002_global_search_fn.sql
20260516000000_notifications_epic13.sql
20260516000001_notifications_epic13_rls.sql
20260516000002_soft_delete_task_rpc.sql
20260516000003_reassert_invite_email_helper_policies.sql
20260516000004_accept_invitation_rpc.sql
```

32 migration files total. The two incident-day migrations are:

- `20260516000003_reassert_invite_email_helper_policies.sql` — re-asserts
  `current_user_email`, `bm_insert`, `wsm_insert` in their canonical helper-based form.
- `20260516000004_accept_invitation_rpc.sql` — adds the `accept_invitation` SECURITY
  DEFINER RPC and the `grant execute`.

Both were **hand-applied** to prod during the incident via the Supabase SQL editor.
The migration history table in prod must be verified (see §8) — they may or may not be
recorded there, creating a drift-or-double-apply risk for any automated deploy.

---

## §3 — `global-setup.ts` Breakage

File: [`tests/e2e/global-setup.ts`](../../../tests/e2e/global-setup.ts)

**Exact broken lines** (as of current repo state):

```
Line 77:  await page.getByLabel("Email").fill(E2E_USER_EMAIL);
Line 78:  await page.getByLabel("Password", { exact: true }).fill(E2E_USER_PASSWORD);
Lines 82–87: page.getByRole("button", { name: "Sign in" }).click()
             combined with waitForURL to leave /sign-in
```

**What broke:** The sign-in page switched to Google-only authentication in commit
`4f22605` (2026-05-15). The email input (`getByLabel("Email")`), the password input
(`getByLabel("Password", { exact: true })`), and the email/password submit button
(`getByRole("button", { name: "Sign in" })`) were all removed from
`app/(auth)/sign-in/sign-in-form.tsx` at that commit.

**Effect:** `global-setup.ts` navigates to `/sign-in`, then immediately fails at
line 77 because `getByLabel("Email")` finds no element — the page now renders only a
"Continue with Google" button. The timeout causes the entire Playwright suite to abort
before any spec runs. No E2E spec has been runnable since `4f22605`.

**Variables still live (lines 41–42):**
```
const E2E_USER_EMAIL = "e2e-user@donezo.test";
const E2E_USER_PASSWORD = "e2e-test-password-12345";
```
These are dead — no path fills them since the form is gone.

**Fix owner:** Slice 4. Replacement strategy: test-only Supabase admin-API session
minting (`auth.admin.createUser` + set `@supabase/ssr` cookie jar directly), gated to
test/preview only, with no dependency on email/password sign-in being re-enabled.

---

## §4 — Sentry Routing Finding

File: [`lib/actions/with-user.ts`](../../../lib/actions/with-user.ts)

**Finding:** `Sentry.captureException` fires **only** on the `INTERNAL` error branch,
and **only** when `NEXT_PUBLIC_SENTRY_DSN` is set. The coded-error branches
(`INVITATION`, `DB`, `VALIDATION`, `UNAUTHENTICATED`) do not reach Sentry.

**Citations:**

- Lines 99–105: the `INTERNAL` branch — the only place `Sentry.captureException` is called:

  ```typescript
  // lib/actions/with-user.ts lines 99–105
  logger.error(
    { event: "action.failure", name, durationMs, userId: user.id, code: "INTERNAL", err },
    "action threw",
  );
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(err, { extra: { action: name, userId: user.id } });
  }
  ```

- Lines 73–80: `VALIDATION` branch — logs only, no Sentry.
- Lines 90–96: coded-error branch (catches `{ code, message }` shaped errors from the
  Supabase RPC, e.g. `INVITATION`, `DB`) — logs only, no Sentry:

  ```typescript
  // lib/actions/with-user.ts lines 90–96
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const code = (err as { code: string }).code;
    logger.error(
      { event: "action.failure", name, durationMs, userId: user.id, code, err },
      "action coded failure",
    );
    return { ok: false, error: err as { code: string; message: string; field?: string } };
  }
  ```

**Implication:** During the incident, `acceptInvitation` was failing with coded errors
(`INVITATION` / `DB` branches, mapped from the RPC's RAISE errcode). Those failures
logged via `action.failure` but produced no Sentry event. The first external signal was
a user-forwarded screenshot. This is open question OQ3 (resolved in dispatch plan as:
action-local Sentry capture in `app/(auth)/join/[token]/actions.ts`; `with-user.ts`
must NOT be edited — Slice 8 owns this).

---

## §5 — Self-Insert / Invitation-Gated RLS Write-Path Inventory

### Tables with `WITH CHECK` + `auth.uid()` + `EXISTS (... from invitation ...)` subquery

A full grep of all `supabase/migrations/*.sql` for `EXISTS (... from public.invitation
...)` inside `WITH CHECK` clauses yields **exactly two tables**:

| Table | Policy name | Migration that defines the final active form |
|-------|-------------|----------------------------------------------|
| `public.board_member` | `bm_insert` | `20260516000003` lines 68–85 |
| `public.workspace_member` | `wsm_insert` | `20260516000003` lines 49–66 |

No other table in the migration history carries a self-insert or invitation-gated RLS
`WITH CHECK` pattern. Scope is **not** wider than `board_member` / `workspace_member`.

### `invitation` UPDATE trigger / policy

The `invitation` table UPDATE path has two separate mechanisms:

**`invitation_update` policy (USING only; WITH CHECK = `true`):**
Source: `supabase/migrations/20260513220000_invitation_update_with_check_relax.sql`
lines 25–29.

```sql
create policy "invitation_update" on public.invitation for update using (
  lower(email) = lower(public.current_user_email())
  and accepted_at is null
) with check (true);
```

The `WITH CHECK (true)` is intentional — the USING clause gates which rows the invitee
can touch (own email + not yet accepted); the trigger then enforces column immutability.
This policy does NOT carry the `auth.uid()` + invitation subquery pattern.

**`invitation_admin_update` policy:**
Source: `supabase/migrations/20260513100000_fix_remaining_rls_recursion.sql`
lines 80–90.

```sql
create policy "invitation_admin_update" on public.invitation for update using (
  public.role_rank(public.role_for_workspace(invitation.workspace_id, (select auth.uid())))
    >= public.role_rank('admin')
  or (
    board_id is not null
    and public.role_rank(public.role_for_board(board_id, (select auth.uid())))
      >= public.role_rank('admin')
  )
);
```

No invitation subquery. No self-insert pattern. Admin-only.

**`invitation_only_accept_update` trigger:**
Source: `supabase/migrations/20260508000000_workspaces_polish.sql` lines 45–84.
A BEFORE UPDATE trigger that enforces column immutability — rejects changes to
`id`, `workspace_id`, `board_id`, `email`, `role`, `token`, `invited_by`, `created_at`
with errcode `42501`. Changes to `revoked_at` / `expires_at` require admin+.
Not a policy and not subject to the self-insert trap.

### Summary

The self-insert invitation-gated pattern exists on exactly `board_member` (`bm_insert`)
and `workspace_member` (`wsm_insert`). No scope escalation required.

---

## §6 — `invitation_select` Allows Accepted?

**File:** `supabase/migrations/20260513230000_invitation_select_allow_accepted.sql`

**Finding: YES, an accepted invitation IS visible to its invitee.**

The final active `invitation_select` policy (from `20260513230000`, lines 32–44) reads:

```sql
create policy "invitation_select" on public.invitation for select using (
  lower(email) = lower(public.current_user_email())
  or
  public.role_rank(public.role_for_workspace(invitation.workspace_id, (select auth.uid())))
    >= public.role_rank('admin')
  or
  (
    board_id is not null
    and public.role_rank(public.role_for_board(board_id, (select auth.uid())))
      >= public.role_rank('admin')
  )
);
```

The email-match branch (`lower(email) = lower(public.current_user_email())`) has **no**
`accepted_at is null` guard. An invitee can SELECT their own invitation row regardless
of whether it has been accepted.

**Why this matters:** The join page
([`app/(auth)/join/[token]/page.tsx`](../../../app/%28auth%29/join/%5Btoken%5D/page.tsx))
performs a post-accept re-SELECT on the invitation to determine where to redirect. If
`invitation_select` were to re-add the `accepted_at is null` guard, that re-SELECT
would return zero rows and the page would silently send the user to `/` instead of the
invited board (the `597a871` redirect bug pattern). The migration comment in
`20260513230000` explicitly documents this risk.

**Regression risk:** Any future migration that re-introduces `accepted_at is null` into
the email-match branch of `invitation_select` is a silent regression. The drift check
(Slice 2) will catch this if the prod definition differs from repo; Slice 5 pgTAP tests
should assert the post-accept re-SELECT behavior.

---

## §7 — pgTAP Harness Trustworthiness (Ambiguity #7)

> **TO BE RESOLVED EMPIRICALLY BY SLICE 3 (root-cause spike) — do not assume either way.**

**What the repo shows:**

**`tests/policies/00_setup.sql` lines 80–89** — `set_jwt_user` uses `set local role authenticated`:

```sql
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
```

This is the **same family** as the Supabase SQL editor's per-statement `SET ROLE`
mechanism that produced false-positive greens during the incident. However, `set local
role authenticated` inside a single transaction (as used in pgTAP's `BEGIN; ... ROLLBACK;`
model) is different from the SQL editor's per-statement model: in a transaction, `SET
LOCAL` is transaction-scoped and each subsequent statement in the same transaction
inherits the role. The SQL editor executes each statement as a separate transaction,
so `SET ROLE` in statement N does not carry over to statement N+1.

Whether pgTAP's single-transaction model makes `set_jwt_user` trustworthy is therefore
empirically uncertain — it hinges on whether Postgres RLS policy evaluation inside a
transaction with `SET LOCAL ROLE authenticated` faithfully mirrors what the application's
JWT-authenticated role sees. The incident showed that components of the failing
expression evaluated true when probed separately; the exact interaction of policy
evaluation, helper SECURITY DEFINER context, and `SET LOCAL ROLE` is unresolved.

**`tests/policies/40_invitation.sql` lines 318–327** — Test 11 asserts the
self-insert branch of `bm_insert` succeeds (via `lives_ok`):

```sql
-- Test 11 (line 318): valid board-scoped invitation allows invitee to
-- self-insert into board_member
select lives_ok(
  $$insert into public.board_member (board_id, user_id, role)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'a4000000-0000-0000-0000-000000000006',
      'member'
    )$$,
  'valid board-scoped invitation allows invitee to self-insert into board_member'
);
```

If the pgTAP harness's `set local role authenticated` is NOT equivalent to the
application's JWT-authenticated evaluation (i.e., if it also produces false positives),
then test 11 is a false green — it passes in pgTAP but the same INSERT would 42501 in
production under a genuine JWT. This is exactly the scenario the incident suggests.

**Disposition:** Slice 3 (maintainer-only, real `psql`, verified `SET ROLE`) must:
1. Reproduce the 42501 under a verified `authenticated` role with a real JWT.
2. Empirically determine whether pgTAP's `set local role` also masks the failure.
3. If test 11 is a false green, document the exact mechanism and flag Slice 5 to use
   a corrected harness.

**Do not weaken any assertion to make this pass. Do not trust the current test 11 as
proof the self-insert works.**

---

## §8 — Maintainer Checklist

> Connect to production via **real `psql`** — NOT the Supabase SQL editor.
> The SQL editor uses a per-statement execution model where `SET ROLE` applies only
> to that statement; subsequent statements revert to `postgres`. This produced
> false-positive greens during the 2026-05-16 incident. Use only `psql` with an
> explicit `SET ROLE authenticated;` inside a transaction block.
>
> Obtain the production `psql` connection string from the Supabase dashboard:
> Project Settings → Database → Connection string (direct connection, not pooler).

Run each step below in order. Record results inline. Date every entry.

---

### Step 1 — Dump and diff the 5 critical objects

Connect to prod and run:

```sql
-- 1a. current_user_email function definition
SELECT pg_get_functiondef(oid)
  FROM pg_proc
 WHERE proname = 'current_user_email'
   AND pronamespace = 'public'::regnamespace;

-- 1b. accept_invitation function definition
SELECT pg_get_functiondef(oid)
  FROM pg_proc
 WHERE proname = 'accept_invitation'
   AND pronamespace = 'public'::regnamespace;

-- 1c. Policies on board_member (bm_insert) and workspace_member (wsm_insert)
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
  FROM pg_policies
 WHERE tablename IN ('board_member', 'workspace_member')
   AND polname IN ('bm_insert', 'wsm_insert');

-- 1d. invitation_select policy
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
  FROM pg_policies
 WHERE tablename = 'invitation'
   AND polname = 'invitation_select';
```

Diff each output against the DDL in §1 of this document. Record the date, any
differences, and whether prod matches repo. If there is any difference, stop and resolve
before dispatching any further slices.

**Result (maintainer fills):**
```
Date checked: _______________
bm_insert matches repo: YES / NO — diff: _______________
wsm_insert matches repo: YES / NO — diff: _______________
invitation_select matches repo: YES / NO — diff: _______________
current_user_email matches repo: YES / NO — diff: _______________
accept_invitation matches repo: YES / NO — diff: _______________
```

---

### Step 2 — Migration history reconciliation for `20260516000003` and `20260516000004`

Both migrations were hand-applied during the incident via the Supabase SQL editor.
They may or may not be recorded in the migration history table.

```sql
SELECT version, inserted_at
  FROM supabase_migrations.schema_migrations
 WHERE version IN ('20260516000003', '20260516000004')
 ORDER BY version;
```

**Expected result:** both rows present (the automated deploy path will skip already-applied migrations). If either is absent, the automated `supabase db push` will attempt to apply it again — the DDL is idempotent (`create or replace function`, `drop policy if exists` + `create policy`) so double-apply should be safe, but verify.

**Result (maintainer fills):**
```
Date checked: _______________
20260516000003 in schema_migrations: YES / NO
  inserted_at if present: _______________
20260516000004 in schema_migrations: YES / NO
  inserted_at if present: _______________
Action required: _______________
```

If either is absent, insert the missing row manually before enabling automated deploy:

```sql
-- Insert the missing migration record (run as service-role / postgres superuser):
INSERT INTO supabase_migrations.schema_migrations (version, inserted_at)
VALUES ('20260516000003', now())   -- adjust to the row(s) that are missing
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, inserted_at)
VALUES ('20260516000004', now())
ON CONFLICT (version) DO NOTHING;
```

---

### Step 3 — Backfill count queries

Run both queries and record the exact counts before Slice 9 (backfill migration) is
written. Do NOT apply any fix yet — these counts gate review.

**Query (a): `board_member` rows without a matching `workspace_member` row**

These are users who have a board membership but no workspace membership for that board's
workspace (accepted a board invite before the workspace-seed fix in
`accept_invitation`'s workspace viewer seeding).

```sql
SELECT count(*) AS board_member_without_workspace_member
  FROM public.board_member bm
 WHERE NOT EXISTS (
   SELECT 1 FROM public.workspace_member wm
    WHERE wm.workspace_id = bm.workspace_id
      AND wm.user_id = bm.user_id
 );
```

**Query (b): invitations with `accepted_at` non-null but no corresponding membership row**

These are users who partially completed acceptance (invitation stamped, but membership
insert failed before the RPC fix), or were somehow left in an inconsistent state.

For board-scoped invitations without a `board_member` row:
```sql
SELECT count(*) AS accepted_invite_no_board_member
  FROM public.invitation i
 WHERE i.accepted_at IS NOT NULL
   AND i.board_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.board_member bm
      WHERE bm.board_id = i.board_id
        AND bm.user_id = (
          SELECT id FROM public.profile p
           WHERE lower(p.email) = lower(i.email)
          LIMIT 1
        )
   );
```

For workspace-scoped invitations without a `workspace_member` row:
```sql
SELECT count(*) AS accepted_invite_no_workspace_member
  FROM public.invitation i
 WHERE i.accepted_at IS NOT NULL
   AND i.board_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.workspace_member wm
      WHERE wm.workspace_id = i.workspace_id
        AND wm.user_id = (
          SELECT id FROM public.profile p
           WHERE lower(p.email) = lower(i.email)
          LIMIT 1
        )
   );
```

**Result (maintainer fills):**
```
Date checked: _______________
(a) board_member rows without workspace_member: _______________
(b) accepted board-scoped invites without board_member: _______________
(b) accepted workspace-scoped invites without workspace_member: _______________

Notes (if counts are non-zero or unexpectedly large): _______________
```

These counts feed directly into Slice 9 (backfill migration). Slice 9 must NOT be
dispatched until this section is filled and the user has reviewed the counts.

---

### Step 4 — Verify no raw error leaks to prod at time of check

Confirm the join page's `?error=` parameter cannot carry a raw Postgres message by
manually opening the join URL with a bad token in prod and verifying the error string
shown to the user is mapped (e.g. "Invitation not found" not "invitation not found
(errcode P0002)"). This is a smoke check only — Slice 10 owns the code audit.

```
Date checked: _______________
Error display on bad token: _______________
Raw Postgres string visible: YES / NO
```

---

*This checklist is complete when all four Result blocks are filled and the date is recorded. Gate Stage 1 (Slices 2 and 3) on Step 2 being resolved. Gate Slice 9 on Step 3 counts being reviewed.*
