# Epic 04 — Followup Round 1

**Source review:** `docs/conversion-plan/_dispatch/epic-04-stage-2-review.md`
**Verdict triggered:** FOLLOWUP REQUIRED
**Date:** 2026-05-07

## Review summary

- **Stage reviewed:** Stage 2 (slices D, E, F, G), commit range `5ebb014..9dd26b4`.
- **Verdict:** FOLLOWUP REQUIRED — three surgical fixes.
- **Definition-of-done items met:** all 8 of the epic's DoD bullets are conceptually met by code, but the **board-delete-owner-only** bullet (line 514) is contradicted by the as-shipped policy.
- **Definition-of-done items NOT met:** "A board admin can update the board's title but not delete it (workspace owner only)" — current policy admits admin+, not owner-only.
- **Other issues found:**
  - `40_invitation.sql` test 8 (expired-invitation rejection) has a state-leak bug: the valid invitation `i4...001` is still admit-able when the test runs, so the insert succeeds and `throws_ok` will fail under the epic-15 pgTAP runner.
  - `40_invitation.sql` lacks an explicit assertion for the role-mismatch path (e.g., invitee with a `member` invitation trying to self-insert as `admin`). The dispatch spec § DoD coverage line 1029 calls this out.

## Followup slices (parallel-safe)

All three slices below touch disjoint files and may dispatch in parallel.

---

### Slice F1.1 — Tighten `board_delete` policy to workspace-owner-only

**Owner:** epic-executor (sonnet) · **Stage:** followup, parallel

#### Scope

- `/supabase/migrations/<YYYYMMDDHHMMSS>_board_delete_owner_only.sql` — **new**, single migration containing:
  1. `drop policy if exists "board_delete" on public.board;`
  2. New `board_delete` policy that admits only workspace owners (consults `workspace_member.role = 'owner'` directly, NOT `role_for_board` — see rationale).

#### Forbidden scope

- Any other migration file (do not edit `20260507120100_rls_policies.sql` or any deployed migration). `lib/`, `app/`, `tests/` (slice F1.2 owns the test update). `package.json`, `.github/`, `biome.json`, `supabase/seed.sql`, `supabase/config.toml`, legacy. **Hard rule.**

#### Spec

Stack defaults: pnpm only, lowercase SQL keywords, `(select auth.uid())` for plan-cache stability, file ends with newline, **never edit a deployed migration** — always a new timestamped file.

The new migration's filename timestamp must sort strictly after `20260507120200_invitations_and_creation_rpcs.sql` (the most recent migration). Use a timestamp at least 1 minute later (e.g., `20260507120300`).

```sql
-- ============================================================
-- Epic 04 — Followup F1.1: tighten board_delete to workspace-owner-only
-- Per epic doc § Definition of done: "A board admin can update the
-- board's title but not delete it (workspace owner only)."
-- The original Slice B policy used role_rank(role_for_board(...)) >= 'admin',
-- which incorrectly admits board admins and even board-only owners.
-- This migration drops that policy and recreates it with a direct
-- workspace_member lookup (role_for_board cannot be used because it
-- returns the MAX of workspace and board roles — a board_member with
-- role='owner' would pass an >= 'owner' rank check, which we don't want).
-- ============================================================

drop policy if exists "board_delete" on public.board;

create policy "board_delete" on public.board for delete using (
  exists (
    select 1 from public.workspace_member wm
     where wm.workspace_id = board.workspace_id
       and wm.user_id = (select auth.uid())
       and wm.role = 'owner'
  )
);
```

Rationale for `workspace_member` direct lookup: `role_for_board` returns `greater_role(workspace_role, board_role)`. A board with explicit `board_member(role='owner')` would yield `role_for_board = 'owner'` even if the user is only a workspace `viewer`. The epic's DoD says "workspace owner only," so we explicitly check `workspace_member.role = 'owner'`.

#### Definition of done

- New migration file exists with timestamp strictly after `20260507120200`.
- File parses syntactically (lowercase keywords, `(select auth.uid())`, ends with newline, no trailing whitespace).
- No edits to any other migration file or any non-migration file.
- Single `drop policy if exists` followed by single `create policy` for `board_delete`.
- Slice F1.2 (running in parallel) updates the corresponding pgTAP assertions; F1.1 does not touch tests.

#### Escalation triggers

- A user requests behavior other than workspace-owner-only (e.g., "let board owners delete board too"). The epic doc is explicit — escalate before deviating.
- The migration fails to apply because of an unexpected dependent object. Escalate.

#### Commits

Single commit: `schema: tighten board_delete policy to workspace-owner-only`.

---

### Slice F1.2 — Update `20_board.sql` for owner-only `board_delete`

**Owner:** epic-executor (sonnet) · **Stage:** followup, parallel

#### Scope

- `/tests/policies/20_board.sql` — **edit only**. Update the existing test 13 and add two new assertions covering the owner-only `board_delete` policy.

#### Forbidden scope

- Any other test file in `tests/policies/` (slices F1.3 owns `40_invitation.sql`). Any migration file. `lib/`, `app/`, `package.json`, `.github/`, `biome.json`, legacy. **Hard rule.**

#### Spec

Stack defaults: lowercase SQL, file ends with newline. Tests use the existing helpers in `tests/policies/00_setup.sql` — no new helpers.

Changes:

1. **Update file header comment block.** Replace the existing block that says "NOTE: per Slice B, board_delete uses role_rank >= 'admin', so admin CAN delete. The epic doc says 'workspace owner only' for board delete, but Slice B ships role_rank >= 'admin'. Test documents Slice B's actual policy." with a clean note that the policy was tightened to workspace-owner-only per followup F1.1, matching the epic DoD.

2. **Bump `select plan(N)` from `13` to `15`.** Two new assertions added.

3. **Replace existing test 13** (currently "workspace member cannot DELETE board") with three assertions:
   - **Test 13:** member cannot DELETE board (existing assertion, unchanged in substance — keep the same SQL but confirm the message: `'workspace member cannot DELETE board (requires workspace owner)'`).
   - **Test 14 (new):** workspace admin (`a2000000-...002`) cannot DELETE the public board. Use the same `with deleted as (...)` pattern; assert `count = 0`. Message: `'workspace admin cannot DELETE board (requires workspace owner)'`.
   - **Test 15 (new):** workspace owner (`a2000000-...001`) CAN DELETE the public board. Use the same pattern; assert `count = 1`. Message: `'workspace owner can DELETE board'`.
   - Note: test 15 actually deletes the board. Order matters — place test 15 last (immediately before `select tests.reset_to_service_role();` and `select * from finish();`) so subsequent assertions don't reference the deleted board. This is fine — tests 14 and 13 already used the public board; place 13, 14, 15 in that order.

4. The existing `set_jwt_user` calls already cover member (test 13) and ws-admin (test 12). For test 14, `select tests.set_jwt_user('a2000000-0000-0000-0000-000000000002'::uuid);` (ws-admin). For test 15, `select tests.set_jwt_user('a2000000-0000-0000-0000-000000000001'::uuid);` (ws-owner).

5. Update the file's coverage-targets header bullet for "board admin cannot DELETE board" — remove the parenthetical "(requires workspace owner only)" warning text and rephrase as "Slice F1.1 tightened the policy to workspace-owner-only; admin and member are blocked, owner can delete."

#### Definition of done

- File `tests/policies/20_board.sql` parses syntactically.
- `select plan(15)` matches the assertion count.
- Three new/modified assertions cover member-blocked, admin-blocked, owner-allowed.
- Existing tests 1–12 are unchanged.
- File ends with newline.
- No edits to any other file.

#### Escalation triggers

- Existing seed users in the file don't include a workspace owner — escalate (they do: `a2000000-...001` is the owner; verified by reading the file).

#### Commits

Single commit: `test(policies): cover owner-only board_delete after F1.1`.

---

### Slice F1.3 — Fix `40_invitation.sql` test 8 + add role-mismatch assertion

**Owner:** epic-executor (sonnet) · **Stage:** followup, parallel

#### Scope

- `/tests/policies/40_invitation.sql` — **edit only**. Fix the test-8 state leak and add one new assertion for the role-mismatch path.

#### Forbidden scope

- Any other test file in `tests/policies/`. Any migration file. `lib/`, `app/`, `package.json`, `.github/`, `biome.json`, legacy. **Hard rule.**

#### Spec

The current `select plan(12)` becomes `select plan(13)` to accommodate the new role-mismatch assertion. The two changes are independent and live in the same file (file-scope is OK because the slice is the sole owner).

##### Change 1 — Fix test 8 state leak

The current test 8 (lines 244-265) deletes the workspace_member row inserted by test 7, then re-attempts the insert and expects `42501`. The expectation fails because invitation `i4...001` is still `accepted_at = null` and still admits the insert via the `wsm_insert` self-insert clause.

Fix: after the `delete from public.workspace_member` in service-role context (line 250-252), also mark `i4...001` as accepted so only the expired `i4...002` invitation remains in scope for the invitee. Insert this single line between the existing `delete from public.workspace_member ...` and `select tests.set_jwt_user(...)`:

```sql
-- Mark the valid invitation as accepted so only the expired one remains;
-- otherwise the wsm_insert policy still admits via i4...001.
update public.invitation
   set accepted_at = now()
 where id = 'i4000000-0000-0000-0000-000000000001';
```

After this update, the only invitations matching the invitee's email are:
- `i4...001`: now accepted (gate rejects `accepted_at is null`).
- `i4...002`: expired (gate rejects `expires_at >= now()`).
- `i4...004`: already-accepted with `role='viewer'` (gate rejects on both `accepted_at` and role mismatch with the test's `'member'` insert).

The `wsm_insert` self-insert clause therefore admits no row → `with check` violation → `42501`. Test 8 then passes.

##### Change 2 — Add role-mismatch assertion (new test 13)

Insert before the final `select tests.reset_to_service_role();` and `select * from finish();` lines. The existing test 12 already cleaned up the workspace_member row for the invitee, and `i4...001` is now accepted. To test the role-mismatch path cleanly, reset to service-role context, reopen `i4...001` (`accepted_at = null`), then have the invitee try to insert with role='admin' (does not match `i4...001`'s `role='member'`):

```sql
-- ============================================================
-- Test 13 (added by F1.3): valid invitation but role mismatch fails
-- The wsm_insert self-insert clause requires i.role = workspace_member.role.
-- ============================================================

select tests.reset_to_service_role();
update public.invitation
   set accepted_at = null
 where id = 'i4000000-0000-0000-0000-000000000001';
delete from public.workspace_member
  where workspace_id = 'b4000000-0000-0000-0000-000000000001'
    and user_id = 'a4000000-0000-0000-0000-000000000004';

select tests.set_jwt_user('a4000000-0000-0000-0000-000000000004'::uuid);

select throws_ok(
  $$insert into public.workspace_member (workspace_id, user_id, role)
    values (
      'b4000000-0000-0000-0000-000000000001',
      'a4000000-0000-0000-0000-000000000004',
      'admin'
    )$$,
  '42501',
  'invitation with role=member cannot be used to self-insert as admin (role mismatch)'
);
```

Bump `select plan(12)` → `select plan(13)`.

##### Header comment update

Update the assertion-count header comment block (lines 6–25) to reflect 13 assertions and add the new line: `-- valid invitation but role mismatch cannot self-insert as the wrong role`.

#### Definition of done

- File `tests/policies/40_invitation.sql` parses syntactically.
- `select plan(13)` matches the new assertion count.
- The single-line `update public.invitation set accepted_at = now()` is added between the existing `delete from public.workspace_member` and `select tests.set_jwt_user(...)` of test 8 (around current line 252).
- Test 13 (role mismatch) is added immediately before the closing `select tests.reset_to_service_role();` / `select * from finish();`.
- File header comment block updated to 13 assertions + the new coverage bullet.
- Existing tests 1–12 (other than the test-8 state leak fix) are unchanged in substance.
- File ends with newline.
- No edits to any other file.

#### Escalation triggers

- The README's per-file assertion table needs updating (it shows 12 for `40_invitation.sql`). **In scope:** also update `tests/policies/README.md`'s table row for `40_invitation.sql` from "12" → "13" and the total from "57" → "58" in the same commit. (This is a single-line edit and stays inside slice F1.3's owned files.)

Note: the README edit is a small carve-out from "no edits to any other file" — F1.3 owns `40_invitation.sql` and the corresponding `README.md` row. F1.2 does NOT need to update the README because `20_board.sql`'s row already says 13 (the new tests change the substance of test 13 + add 14/15, but the table row's "Approx. assertions" column should bump to 15; **F1.2 should also update the README's `20_board.sql` row to 15 and the total appropriately**).

To avoid a write conflict on `README.md` between F1.2 and F1.3, **sequence the README update**: F1.2 updates its own row only; F1.3 updates its own row only; the **total** is updated last by whichever slice merges second (let the orchestrator pick — both numbers should converge to 60 (11 + 15 + 13 + 13 + 8)). Recommendation: F1.2 owns the per-row update for `20_board.sql` (11→same, 15) and the total. F1.3 owns the per-row update for `40_invitation.sql` (12→13). Coordinate via the orchestrator: dispatch F1.2 and F1.3 sequentially within this followup round, OR have F1.2 pre-write the total to 60 (anticipating F1.3's bump) and F1.3 only edits its own row. **Decision: dispatch F1.2 first, then F1.3.** F1.2 sets total to 60. F1.3 then bumps `40_invitation.sql` row to 13 and leaves the total alone (already correct).

#### Commits

Logical commits, e.g.:
- `test(policies): fix test-8 state leak in 40_invitation.sql`
- `test(policies): add role-mismatch assertion to 40_invitation.sql`

---

## Open questions for the user

None. All three followup fixes are spec-driven and unambiguous:
- F1.1: the policy correction is mandated by the epic's explicit DoD line.
- F1.2: the test must mirror F1.1's policy.
- F1.3: the test-8 bug is a state-leak; the role-mismatch assertion was already called out in the dispatch spec § DoD line 1029 but not implemented by the executor.

## Sequencing note

F1.1 and F1.2 are **logically coupled** (test follows policy), but file-disjoint at edit time. F1.3 is independent of both. Executors may run F1.1 + F1.3 fully in parallel; F1.2 should not be dispatched until F1.1's migration file is committed (timestamp coordination). Practically: dispatch F1.1 and F1.3 together, then F1.2 immediately after F1.1 commits.

The README update inside F1.3 depends on F1.2's prior update of the totals row. Dispatch order: F1.1 + F1.3 in parallel → F1.2 → F1.3 finalizes README. Alternatively, the orchestrator may dispatch all three in parallel and resolve the README conflict at merge time (the conflict is a single line — trivial).
