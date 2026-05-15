# Epic 02 — Dispatch Plan (APPROVED)

Epic doc: [`docs/roadmap/02-invitation-acceptance-hardening.md`](../02-invitation-acceptance-hardening.md)
Approved: 2026-05-16. Branch: `epic/02-invite-acceptance-hardening`.

## Resolved open questions (user decisions, binding on slice specs)

- **OQ1 — migration deploy:** `pnpm` + `supabase db push`. A `pnpm db:deploy`
  script wrapping `supabase db push --linked`, run as a dedicated CI job on
  merge to `main`, prod connection as a CI secret. **Ordering contract:**
  migrations apply on merge as their own job, independent of the Vercel build
  — tolerable because the repo convention is *additive migrations only*
  (never destructive); brief old-code/new-schema window is acceptable.
- **OQ2 — self-insert RLS branch fate:** DEFERRED until Slice 3 spike
  reports. Slice 7 full spec authored then by epic-researcher.
- **OQ3 — alert channel:** Sentry, **action-local**. Capture coded
  `INVITATION`/`DB` failures inside `acceptInvitation` itself. `with-user.ts`
  must NOT be edited (no repo-wide blast radius).
- **OQ4 — expiry on re-accept:** KEEP AS-IS. `accept_invitation` continues to
  gate expiry only on first acceptance; idempotent-backfill property
  preserved. Slice 5 pgTAP must assert this exact contract.
- **OQ5 — drift-check scope:** ALL policies + functions (not the 5-object
  allowlist). Broader safety net; accepted tradeoff = more CI churn (any
  unrelated policy/function change must be reflected or CI fails red).
- **OQ6 — backfill blast radius:** dependency, not a decision. Slice 1 audit
  produces exact affected-row counts for user review before Slice 9 is
  written.

## Staging & sequencing

- **Stage 0:** Slice 1 (Audit) — alone, blocks everything.
- **Stage 1:** Slice 2 (Migration-deploy) ∥ Slice 3 (Root-cause spike) — both
  maintainer-heavy, disjoint files, gate later stages.
- **Stage 2:** Slice 4 (Auth fixture) — hard prerequisite for Slice 6.
- **Stage 3 (parallel):** Slices 5, 6, 8, 9, 10, 11. Slice 7 is *gated* —
  specced only after Slice 3 + OQ2 answer.
- **Follow-ups:** Slice 12 (prod smoke, maintainer-only, gates done);
  mandatory epic-researcher review after each stage; epic-level review last.

Maintainer-only (no executor; requires prod credentials / dashboard / real
`psql`): Slice 1 prod-introspection half, Slice 2 CI-secret + push execution,
Slice 3 entirely, Slice 9 prod application, Slice 12 entirely, all Sentry/CI
alert-destination config.

---

## Slice 1 — Audit (Stage 0; executor scaffolds, maintainer fills prod half)

**Executor scope (Sonnet, this is what gets dispatched):** create
`docs/roadmap/_dispatch/epic-02-audit.md`. New file only. Forbidden: all
migrations, all code, all tests.

Scaffold the doc with these sections and fill the **repo-derivable** half:

1. **Expected definitions (from migrations).** Verbatim DDL extracted from the
   migration files for: `bm_insert`, `wsm_insert`, `invitation_select`,
   `accept_invitation`, `current_user_email`. Cite source migration filename +
   line for each.
2. **Migration filename list** — full ordered list of `supabase/migrations/*`.
3. **`global-setup.ts` breakage** — exact line numbers + the removed selectors
   (`getByLabel("Email")`, `getByLabel("Password")`, the sign-in button),
   reference the Google-only commit `4f22605`.
4. **Sentry routing finding** — cite `lib/actions/with-user.ts`: coded-error
   branch does NOT reach Sentry (only `INTERNAL` does, only if
   `NEXT_PUBLIC_SENTRY_DSN` set).
5. **Self-insert / invitation-gated RLS write-path inventory** — grep all
   migrations for `with check` clauses containing `auth.uid()` + an
   `invitation` EXISTS subquery. List every match (at minimum `bm_insert`,
   `wsm_insert`); also check the `invitation` UPDATE trigger and whether ANY
   other table carries the same self-insert pattern.
6. **`invitation_select` allows accepted?** — cite
   `20260513230000_invitation_select_allow_accepted.sql`; state whether an
   accepted invitation is still visible to its invitee (the join page's
   post-accept re-SELECT depends on this; a regression silently sends accepted
   users to `/`).
7. **pgTAP harness trustworthiness (ambiguity #7)** — note that
   `tests/policies/00_setup.sql:set_jwt_user` uses `set local role
   authenticated` (same family as the SQL-editor trap) and
   `tests/policies/40_invitation.sql` already `lives_ok`-asserts the
   self-insert branch. Mark "TO BE RESOLVED EMPIRICALLY BY SLICE 3" — do not
   assume either way.
8. **Maintainer checklist (executor writes the checklist; a human runs it):**
   - Connect to **production** via real `psql` — NOT the Supabase SQL editor
     (per-statement `SET ROLE` model produced false greens during the
     incident).
   - `pg_get_functiondef` / `pg_policies` dump for the 5 objects; diff against
     the repo-expected DDL recorded in §1; record the diff with a date.
   - Record applied-vs-pending status of `20260516000003` and
     `20260516000004` from prod `supabase_migrations.schema_migrations`.
   - Run backfill-count queries and record EXACT counts: (a)
     `board_member` rows whose `(workspace_id,user_id)` has no
     `workspace_member` row; (b) invitations with `accepted_at` non-null but
     no corresponding membership row.

**Definition of done:** doc exists, repo-derivable half fully populated, the
maintainer checklist is precise and copy-pasteable, ambiguity #7 explicitly
flagged for Slice 3. (Maintainer half completion is tracked separately and
gates Stages 1/3.)

**Escalation:** if grep reveals self-insert RLS patterns on tables *other
than* `board_member`/`workspace_member`, stop and report — widens scope.

---

## Slice 2 — Migration-deploy automation + prod drift check (Stage 1)

**Owner:** executor writes CI YAML + `pnpm db:deploy` script + drift-check
script; maintainer adds the prod connection CI secret and runs first deploy.

**Scope:** new file under `.github/workflows/` (a NEW workflow or additive
job — must NOT edit the existing `ci.yml` `drift` job, which is *local* schema
diff and stays as-is; name the new job distinctly, e.g. `prod-migrate` /
`prod-drift`); `package.json` (`db:deploy` script); `scripts/` (drift-check
script). Forbidden: `ci.yml`'s existing `drift` job; any migration; any app
code; the runbook (Slice 11 owns it).

**Spec:** Implement OQ1 — `pnpm db:deploy` = `supabase db push --linked`
(prod ref + DB password from CI secret; choose a clear secret name e.g.
`SUPABASE_PROD_DB_URL`, document it for the maintainer). New CI job on merge
to `main` runs it. Ordering per OQ1: standalone job, independent of Vercel
build, additive-migrations-only assumption stated in a comment.

Drift check per **OQ5 = ALL policies + functions**: dump every
`pg_policies` row + every `pg_proc` (public schema) definition from prod,
compare against the repo's declared state (derive from a local
`supabase db reset` shadow or `supabase db diff`), fail the pipeline red on
any difference. Restate explicitly: this is a DISTINCT artifact from the
existing local `drift` job; do not conflate or edit that job. Must reconcile
(not double-apply) the hand-applied `…0003`/`…0004` per Slice 1's ledger
finding. Idempotent.

**DoD:** merge to `main` applies `migrations/*` to prod via `pnpm db:deploy`
in CI; a CI step fails red if ANY prod policy/function differs from repo;
`…0003`/`…0004` reconciled (verified against Slice 1 ledger finding); the
existing local `drift` job unchanged.

**Escalation:** prod ledger shows `…0003`/`…0004` as *pending* (double-apply
risk) → stop, manual reconcile decision; needed prod credential not
provisioned → stop, maintainer task.

---

## Slice 3 — Root-cause spike (Stage 1; MAINTAINER-ONLY, no executor)

Requires controlled `psql` against a real DB with verified `SET ROLE
authenticated` + `request.jwt.claims`. No production writes (`BEGIN; …
ROLLBACK;`). Scope: append-only to
`docs/roadmap/02-invitation-acceptance-hardening.md` root-cause record (+
auto-memory if it generalizes). Forbidden: modifying `bm_insert`/`wsm_insert`
until this lands.

**Spec:** Reproduce the `42501` on a direct `insert into board_member` as a
genuine fresh `authenticated` identity (verified `SET ROLE`, NOT the SQL
editor). Isolate the exact failing predicate (nested `invitation` EXISTS
under `invitation_select` RLS / helper volatility-snapshot / search_path-grant
/ policy-within-policy WITH CHECK). Confirm or refute the epic's leading
hypothesis. Empirically answer ambiguity #7: is
`tests/policies/40_invitation.sql`'s `lives_ok` self-insert assertion a false
green under pg_prove's single-transaction model, or trustworthy?

**DoD:** exact failing predicate written into the root-cause record with
repro SQL; OQ2 recommendation (remove vs. cheap-robust-fix) stated with
evidence; #7 answered.

**Escalation:** 42501 does NOT reproduce under verified `SET ROLE` (prod-only
cause) — that is itself the finding; record it; OQ2 → "remove" becomes the
only safe option.

---

## Slice 4 — Resurrect E2E auth fixture (Stage 2; prerequisite for Slice 6)

**Scope:** `tests/e2e/global-setup.ts`, `supabase/seed.sql` (E2E section
only), optionally a new `tests/e2e/.auth/` helper, optionally a dev-only
login affordance as a NEW route/component gated `NODE_ENV !== 'production'`.
Forbidden: `app/(auth)/sign-in/sign-in-form.tsx`, any production auth action,
any migration outside `seed.sql`, all spec files except global-setup wiring.

**Spec:** Replace the removed-form-fill flow with test-only Supabase
admin-API session minting (service-role `auth.admin.createUser` + set the
`@supabase/ssr` cookie jar directly), gated to test/preview only,
unreachable in production. Must NOT depend on email/password sign-in being
re-enabled. Use the existing `lib/supabase/admin.ts` client; no new deps if
avoidable. The old `seed.sql` E2E user assumed email/password — replace with
an admin-API-created or claims-mintable user.

**DoD:** `pnpm test:e2e` reaches and runs specs (global-setup no longer times
out); existing 24 specs unblocked (need not all pass — only global-setup
succeeds + storage state minted); dev-only affordance (if added) provably
unreachable in `NODE_ENV=production`.

**Escalation:** admin-API minting can't produce a cookie jar `@supabase/ssr`
middleware accepts → stop, architectural question.

---

## Slice 5 — pgTAP cold-path tests (Stage 3)

**Scope:** NEW file `tests/policies/41_accept_invitation.spec.sql`. Do NOT
edit `40_invitation.sql` (Slice 7 may own edits there). If Slice 3 proves
`set_jwt_user` unsound, add a NEW helper function name (do not edit the
existing one) — escalate if that's needed.

**Spec:** Genuine cold-path: fresh `authenticated` identity, NO pre-existing
membership row, calls `accept_invitation(p_token)` for (a) board-scoped and
(b) workspace-scoped invitation; assert membership rows now exist (board-scoped
also seeds `workspace_member` at `viewer`) and `accepted_at` stamped.
Negatives: wrong-email caller rejected; revoked rejected; expired-on-first-
accept rejected. **Per OQ4 (keep as-is): assert that re-accept of an
already-accepted invite SUCCEEDS idempotently and does NOT enforce expiry** —
this is the load-bearing contract for Slice 9. Use the Slice-3-validated
role-setting mechanism.

**DoD:** new pgTAP file passes under `pnpm test:policies:ci`; both scopes
positive + all negatives + the OQ4 idempotent-reaccept assertion.

**Escalation:** cannot get a trustworthy fresh-identity context in pgTAP even
with Slice 3's mechanism → stop; do not weaken the test to pass.

---

## Slice 6 — Playwright new-user accept E2E (Stage 3; depends on Slice 4)

**Scope:** `tests/e2e/invitation-accept.spec.ts` (replace the `test.fixme`
stub), fixtures under `tests/e2e/fixtures/` if needed. Forbidden:
`global-setup.ts` (Slice 4), all app code, other specs.

**Spec:** Brand-new-user invitation accept: sign-up with `next` → verify →
callback → join → accept → lands on `/w/<slug>/b/<id>`. Use Slice 4's
test-only auth mechanism; admin-API confirm or seeded confirmed user (no real
email). Assert the landing URL is the invited board (the `597a871` bug).

**DoD:** spec no longer `fixme`, runs in CI, asserts the invited-board
landing URL.

**Escalation:** new-user flow needs real Supabase email confirmation that
can't be stubbed in CI → stop, escalate.

---

## Slice 7 — Self-insert branch decision applied (Stage 3; GATED)

**Do not dispatch until Slice 3 reports + user answers OQ2.** Full spec
authored by epic-researcher post-spike. Scope (provisional): new migration
`supabase/migrations/<ts>_<remove_or_fix>_invite_self_insert.sql`,
`tests/policies/40_invitation.sql` (update self-insert assertions),
`docs/roadmap/02-invitation-acceptance-hardening.md` (note `…0003`
supersession). Forbidden: `41_accept_invitation.spec.sql` (Slice 5), the
`accept_invitation` RPC migration, app code.

---

## Slice 8 — Observability (Stage 3)

**Scope:** `app/(auth)/join/[token]/actions.ts` ONLY. Per **OQ3 = action-
local Sentry**: do NOT edit `lib/actions/with-user.ts`. Forbidden: any
migration, the RPC SQL, other actions.

**Spec:** In `acceptInvitation`'s coded-error branch, `Sentry.captureException`
with errcode + board/workspace id + user id — **no PII beyond user id** (no
email, no token). Guard on `NEXT_PUBLIC_SENTRY_DSN` like `with-user.ts` does.
Verify `handler.name` resolution is irrelevant here since capture is
action-local (note in spec). The invite-funnel alert is a Sentry/monitoring
dashboard config = maintainer task; executor only ensures the structured log
events exist for each funnel step (create → email → open → accept) — add a
named event only if a step lacks one.

**DoD:** a deliberately-triggered invite-accept failure in preview raises a
Sentry event (maintainer verifies the alert rule); payload carries no PII
beyond user id; `with-user.ts` untouched.

**Escalation:** none expected (action-local avoids the `handler.name` risk).

---

## Slice 9 — Backfill migration (Stage 3; written after Slice 1 count reviewed)

**Scope:** NEW migration
`supabase/migrations/<ts>_backfill_incomplete_invite_memberships.sql`.
Forbidden: all policy/function migrations, app code, tests.

**Spec:** Idempotent `insert … select … on conflict do nothing` healing (a)
`board_member`-without-`workspace_member` (seed `viewer`) and (b)
`accepted_at`-non-null-but-no-membership invitees. Comment must record the
Slice 1 affected-row count + the heal query. CLAUDE.md conventions
(timestamptz/uuid/soft-delete). Per OQ4 the RPC re-accept also heals — this
migration is belt-and-suspenders for silent victims who won't click again;
must not assume count is zero.

**DoD:** migration exists, idempotent, comment records count + query;
re-running is a no-op. **Application to prod happens via the Slice 2
mechanism after Slice 1's count is reviewed by the user.**

**Escalation:** Slice 1 count unexpectedly large or the two heal sets overlap
ambiguously → stop, review before write.

---

## Slice 10 — Error-leak audit (Stage 3)

**Scope:** read-only across the join/accept path + a written finding in a
clearly-delimited section of `epic-02-audit.md`. Code change ONLY if a leak
is found, in the offending file. Forbidden: speculative refactors; any file
not on the join-page error path.

**Spec:** Prove no raw Supabase/Postgres `error.message` reaches the join
page `?error=` from ANY path: trace `page.tsx` `result.error.message →
redirect(?error=)`, the RPC mapping in `actions.ts`, the page's own
pre-accept SELECT and post-accept re-SELECT. Fix surgically if a leak exists.

**DoD:** written conclusion stating every path is covered; if a leak found,
fixed + cited.

**Escalation:** leak requires more than a local message-mapping change →
escalate.

---

## Slice 11 — Runbook (Stage 3; after Slice 2)

**Scope:** NEW `docs/runbooks/db-migration-deploy.md`; cross-link edits to
`docs/runbooks/incident-response.md` (+ `rotate-secrets.md` /
`database-restore.md`; epic-01 board-invitations runbook only if it exists by
then — else add a TODO link). Forbidden: `.github/workflows/` (Slice 2), any
code/migration.

**Spec:** Document the OQ1 `pnpm db:deploy` mechanism, the OQ5 all-objects
drift check, how to reconcile a hand-applied migration, and the "verify prod
matches repo via real `psql` (NOT the SQL editor)" procedure (capture the
trap). Date-stamp it.

**DoD:** runbook exists, dated, sufficient to set up migration deploy on a
fresh environment; cross-linked.

---

## Slice 12 — Production smoke (follow-up; MAINTAINER-ONLY, gates DoNE)

A fresh external email never seen by prod completes the full cold-path
accept on production, lands on the board, drift check green. Evidence →
`docs/roadmap/_dispatch/epic-02-smoke.md`. Runs only after Slices 2–11
merged to the epic branch and deployed. Failure → back through `/plan-epic`
as a followup, not a hot-patch.

---

## Risk notes (carried from planning)

- Prod is unverifiable from the repo — all prod-touching work is maintainer-
  only; never let an executor infer prod state from migration files.
- The SQL-editor `SET ROLE` false-positive trap is load-bearing — Slice 3
  MUST use real `psql`.
- The existing pgTAP harness may itself be unsound (ambiguity #7); Slice 3
  resolves before Slice 5 is trusted; do not weaken assertions to pass.
- Backfill must produce a reviewed count before prod application (OQ6).
- Drift-check: distinct from the existing local `ci.yml` `drift` job; OQ5 =
  all objects (more churn, accepted).
- RLS scope creep beyond the invitation path is OUT — adjacent traps
  (soft-delete-SELECT, `workspace_select`) are NOT epic 02; surface as new
  epic candidates if found.
- `with-user.ts` is repo-wide blast radius — Slice 8 is action-local only
  (OQ3); `with-user.ts` must not be edited.
- Epic-01 runbook may not exist yet — Slice 11 falls back + TODOs the link.
