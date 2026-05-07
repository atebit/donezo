# Epic 04 Stage 2 Followup-1 Review

**Verdict:** CLEAN
**Diff:** 9dd26b4..9168cbb
**Date:** 2026-05-07

## F1.1 — PASS

`supabase/migrations/20260507120300_board_delete_owner_only.sql` matches the followup spec exactly.

- Filename timestamp `20260507120300` sorts strictly after `20260507120200_invitations_and_creation_rpcs.sql`. Correct ordering.
- Comment header is the verbatim block from the spec (epic-DoD reference + rationale for not using `role_for_board`).
- Single `drop policy if exists "board_delete" on public.board;` followed by a single `create policy "board_delete" ... for delete using (...)`.
- Predicate is a direct `workspace_member` lookup keyed on `wm.workspace_id = board.workspace_id`, `wm.user_id = (select auth.uid())`, `wm.role = 'owner'`. No use of `role_for_board` / `role_rank`. Matches spec rationale.
- Lowercase SQL keywords throughout. `(select auth.uid())` form used for plan-cache stability.
- File ends with `\n` (verified via `od`).
- No edits to `20260507120100_rls_policies.sql` or `20260507120200_invitations_and_creation_rpcs.sql` (git log on those paths in the followup range is empty). Hard rule respected.
- Commit `65f26d3` is single-purpose (`schema: tighten board_delete policy to workspace-owner-only`) and touches only the new migration file. Matches spec.

## F1.2 — PASS

`tests/policies/20_board.sql` matches the spec.

- `select plan(15)` (line 24) — correct count after adding tests 14 + 15 and updating test 13.
- Header comment block (lines 1–20): assertion count bumped to 15; old "Slice B's actual policy" drift note removed; replaced with "Slice F1.1 tightened the policy to workspace-owner-only; admin and member are blocked, owner can delete." Matches spec wording.
- Tests 1–12 are unchanged in substance (verified by reading the full file; the `role_for_board` table-driven block, public/private SELECT cases, and the board-admin UPDATE assertion are all intact).
- Test 13 (lines 242–258): `set_jwt_user('a2000000-...003')` (ws-member); `with deleted as (delete from public.board where id = 'c2000000-...001' returning id) select count(*)::int from deleted` expects 0. Message: `'workspace member cannot DELETE board (requires workspace owner)'`. Matches spec.
- Test 14 (lines 260–277): `set_jwt_user('a2000000-...002')` (ws-admin); same `with deleted` pattern; expects 0; message `'workspace admin cannot DELETE board (requires workspace owner)'`. Matches spec.
- Test 15 (lines 279–298): `set_jwt_user('a2000000-...001')` (ws-owner); same pattern; expects 1; message `'workspace owner can DELETE board'`. Placed last, immediately before `reset_to_service_role()` and `finish()` — correct because it's the only assertion that actually deletes the board.
- File ends with newline.
- Commit `c86d578` is single-purpose and touches only `tests/policies/20_board.sql`. Matches spec.

## F1.3 — PASS

`tests/policies/40_invitation.sql` matches the spec.

- `select plan(13)` (line 30) — correct after adding test 13.
- Header comment block (lines 1–26): assertion count bumped to 13; new bullet `valid invitation but role mismatch cannot self-insert as the wrong role` added at the end of the coverage list. Matches spec.
- **Test 8 state-leak fix (lines 249–272):** the new lines 257–259 — `update public.invitation set accepted_at = now() where id = 'i4000000-...001';` — sit *between* the existing `delete from public.workspace_member ...` (lines 251–253) and the `set_jwt_user('a4000000-...004')` call (line 261). This is the exact insertion point the spec required. The valid invitation is now accepted-out before the invitee re-attempts the insert, so the only matching invitation is the expired `i4...002`, and `wsm_insert` correctly raises `42501`. The two prior commits sequence cleanly (`ed14ac4` adds the fix; `2acbefa` adds test 13).
- Tests 1–12 are otherwise unchanged in substance — diff against `9dd26b4` for this file shows only the test-8 state-leak line, the role-mismatch test 13 block, the plan bump, and the header comment update.
- **Test 13 (lines 351–375):** placed immediately before the closing `select tests.reset_to_service_role();` (line 377) and `select * from finish();` (line 379). Body: resets to service role, sets `i4...001.accepted_at = null`, deletes any leftover `workspace_member` for the invitee, switches JWT to `a4000000-...004`, then `throws_ok` on an insert with `role='admin'` against an invitation whose `role='member'`. Asserts `'42501'` with the message `'invitation with role=member cannot be used to self-insert as admin (role mismatch)'`. Matches spec verbatim.
- File ends with newline.

## README.md

`tests/policies/README.md` final state matches the followup spec's anticipated convergence:

- `20_board.sql` row → 15. Correct.
- `40_invitation.sql` row → 13. Correct.
- Total → 60 (= 11 + 15 + 13 + 13 + 8). Math checks out.
- Per-file coverage descriptions updated: the `20_board.sql` section now mentions "F1.1 tightened policy to workspace-owner-only; … workspace owners can DELETE boards." Consistent with the new tests.

The README total was bumped to 60 by F1.2 (anticipating F1.3's row bump per the spec's sequencing note); F1.3 then bumped only the row, leaving the total alone. Coordination matches the spec.

## Cross-cutting / regressions

The three issues identified by the Stage 2 review are resolved:

1. **`board_delete` DoD drift** — F1.1 migration replaces the `role_rank >= 'admin'` policy with workspace-owner-only via direct `workspace_member` lookup. Epic doc § Definition of done line 514 ("workspace owner only") is now satisfied, and F1.2's tests 13/14/15 lock the behavior in (member blocked, admin blocked, owner allowed).
2. **`40_invitation.sql` test 8 state-leak** — fixed via the single-line `update invitation set accepted_at = now()` insertion between the `delete from workspace_member` and the `set_jwt_user` call. The expired-invitation path is now the only valid match, and the `throws_ok '42501'` assertion will pass under the epic-15 pgTAP runner.
3. **Role-mismatch coverage gap** — addressed by new test 13. The `wsm_insert` policy's `i.role = workspace_member.role` clause now has explicit positive proof.

No regressions:
- Only the four expected files (one new migration, two test files, one README) were touched in the followup range. No edits to deployed migrations, no edits to `lib/`, `app/`, `package.json`, `.github/`, `biome.json`, or any other unrelated path.
- Each slice's commit set is single-purpose and matches the spec's expected commit messages.
- All four files end with a newline; lowercase SQL keywords; `(select auth.uid())` plan-cache form preserved in F1.1's policy.
- Stage 2 cross-cutting concerns 1 and 2 (the `invitation_insert` strictness vs. friendly-role check, and the "already a member at higher role" UX path) were explicitly tagged as non-blockers in the prior review and are not in scope for this followup. They remain open as polish/debt items, which is correct.

## Verdict reasoning

All three followup slices land their stated fixes precisely and only those fixes. The Stage 2 definition-of-done bullet that was missed (workspace-owner-only board delete) is now satisfied by both the policy and the tests; the test-8 state-leak bug is fixed; the role-mismatch coverage gap is closed. File-scope discipline held — no slice strayed outside its owned files. README math reconciles to 60.

Stage 2 is now CLEAN. Epic 04's authorization scope is fully landed against the merged branch and the epic branch is ready for the merge into `main`.
