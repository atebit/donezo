# Epic 02 — Invitation Acceptance Hardening & Migration-Deploy Reliability

## Goal

Epic 01 verified that an invitation email reaches a real inbox and that the
join page renders. It did **not** verify that a genuine brand-new external
user can actually *accept* a board invitation in production. They could not:
every real cold-path acceptance failed with `42501 new row violates
row-level security policy for table "board_member"`. This was invisible until
an outside user (`jaydrawsthings@gmail.com`) tried it on 2026-05-16, because
every prior "successful" smoke re-accepted an invitation whose membership row
already existed and silently hit `ON CONFLICT DO NOTHING`.

A point-fix shipped during the incident (the `accept_invitation` SECURITY
DEFINER RPC, commit `23af153`). This epic turns that hot-patch into a
properly understood, tested, observable, and *deployable* fix — and closes
the systemic gaps that let a one-line problem cost a multi-hour live
debugging session: no automated DB-migration deploy, no test that exercises
the true cold path, no alerting on invite-accept failure, and a dead E2E auth
fixture that means none of this is machine-verifiable.

## Why this is its own epic

The bug is closed for new users (RPC + manual prod backfill). But the
**reasons it happened and stayed hidden** are unaddressed and will recur:

- **DB schema and app code deploy on different rails.** `git push` ships
  code to Vercel; nothing applies migrations to the production Supabase
  project. Every migration in the incident (`20260516000003`,
  `20260516000004`) had to be hand-pasted into the SQL editor. Drift between
  "what the repo's policies say" and "what prod's policies are" is the single
  biggest reason the diagnosis took so long — half the hypotheses were
  "maybe prod isn't on this migration."
- **No test ever ran the cold path.** pgTAP RLS tests and the Playwright
  invitation spec exist, but every one either runs as a privileged role or
  re-accepts a pre-existing membership. The `WITH CHECK` of the self-insert
  branch was never actually exercised by a fresh `authenticated` identity.
- **The failure was silent.** `acceptInvitation` failures emit
  `action.failure` to the structured logger and surface a generic message to
  the user, but nothing alerts. Coded errors never reach Sentry (only the
  `INTERNAL` branch does). The first signal was a user-forwarded screenshot.
- **Nothing is browser- or E2E-verifiable.** The Google-only sign-in change
  (2026-05-15) broke `tests/e2e/global-setup.ts` (it fills a removed
  email/password form), so the entire Playwright suite is unrunnable, and
  preview has no test-login path. Every fix this session shipped on static
  checks alone.

These are not feature work; they are reliability work on an already-shipped
flow. Bundling them into a feature epic would leave the ops/test half undone
again — exactly the pattern Epic 01 was created to break.

## What we uncovered (root-cause record)

Captured here so the next person does not re-run the investigation.

### The RLS self-insert trap

`bm_insert` / `wsm_insert` each have two PERMISSIVE branches:

1. `role_rank(role_for_board(board_id, auth.uid())) >= role_rank('admin')`
   — an existing admin adds someone.
2. `user_id = auth.uid() AND EXISTS (select 1 from invitation i where
   i.board_id = board_member.board_id and lower(i.email) =
   lower(current_user_email()) and i.role = board_member.role and
   i.accepted_at is null and i.revoked_at is null and i.expires_at >= now())`
   — the invitee self-inserts.

For a genuine brand-new invitee, branch 1 is false (no role) and branch 2 is
the only hope. In production, a direct `INSERT INTO board_member …
RETURNING *` executed as `authenticated` with the invitee's JWT was
**rejected with 42501**, while every individual component of branch 2
(`auth.uid()`, `current_user_email()`, the `EXISTS` count, `user_id =
auth.uid()`) evaluated *true* when probed separately.

The leading explanation: the Supabase SQL editor's `set local role
authenticated` does **not** reliably apply to subsequent statements in its
per-statement execution model, so the component probes silently ran as
`postgres` (RLS bypassed) and returned false-positive greens. The trustworthy
signal is the `INSERT` erroring — which only happens under enforced RLS. The
self-insert branch's inner `EXISTS (… from invitation …)` is itself subject
to `invitation_select` RLS *and* calls SECURITY DEFINER helpers
(`current_user_email`, `role_for_*`); under genuine `authenticated`
evaluation, nested inside an `INSERT`'s `WITH CHECK`, that subquery resolves
to zero rows and branch 2 is false. The exact mechanism (helper volatility /
snapshot, policy-within-policy evaluation, or a search_path/grant interaction)
was **not** definitively isolated during the incident — a controlled `psql`
repro with a verified `SET ROLE` is required and is a task in this epic.

### Why every prior smoke missed it

Per the 2026-05-15 diary: the "successful" board-invite smokes
(`sleepofmirrors@gmail.com`) were *re-accepts* of an invitation whose
`board_member` row already existed from a prior partial attempt, so the
`upsert(..., { ignoreDuplicates: true })` resolved to `ON CONFLICT DO
NOTHING` and never evaluated the `WITH CHECK` against a row that would
actually be inserted. No genuine cold-path acceptance had ever succeeded in
production.

### The fix that shipped

`accept_invitation(p_token)` — SECURITY DEFINER, re-validates authorization
explicitly (caller's `current_user_email()` matches a live, unrevoked
invitation for the token), then writes `board_member` + `workspace_member` +
stamps `accepted_at` with definer privileges. Same pattern as
`create_board` / `clone_board` / `soft_delete_task`. The action
([`app/(auth)/join/[token]/actions.ts`](../../app/(auth)/join/[token]/actions.ts))
now calls the RPC and maps RAISE errcodes to user-safe copy. Migrations
`20260516000003` (re-assert helper-based policies — now largely moot) and
`20260516000004` (the RPC) carry it.

## In scope

### Migration-deploy reliability (highest priority)

- Wire an automated, auditable path that applies `supabase/migrations/*` to
  the production (and preview) Supabase project on merge to `main` — Supabase
  GitHub integration **or** a `supabase db push` CI step with the project ref
  + DB password in CI secrets. Decide which in planning (open question 1).
- A CI/post-deploy **drift check**: compare the repo's expected policy/
  function definitions against the live DB for a small allowlist of
  security-critical objects (`bm_insert`, `wsm_insert`, `invitation_select`,
  `accept_invitation`, `current_user_email`) and fail loudly if they differ.
  This is the single highest-leverage guard — it would have collapsed this
  entire investigation to one red CI line.
- Confirm `20260516000003` and `20260516000004` are applied to prod and
  recorded in the migration history table (they were hand-applied during the
  incident; the automated path must reconcile, not double-apply).

### Make the cold path tested

- **pgTAP**: a test that, as a freshly created `authenticated` user with no
  workspace/board role and **no pre-existing membership row**, accepts a
  board-scoped and a workspace-scoped invitation via `accept_invitation` and
  asserts the `board_member` / `workspace_member` rows now exist and
  `accepted_at` is stamped. Must use a verified `SET ROLE` / `SET request.jwt.claims`
  harness, not the pattern that produced false positives. Add a negative
  test: wrong-email caller is rejected; revoked/expired rejected.
- **pgTAP regression for the trap**: assert the *direct* self-insert into
  `board_member` as a cold invitee either works or is explicitly known-dead
  (see "Decide the fate of the self-insert RLS branches").
- **Playwright**: a brand-new-user invitation-accept E2E (sign-up with `next`
  → verify → callback → join → accept → lands on `/w/<slug>/b/<id>`),
  extending [`tests/e2e/invitation-accept.spec.ts`](../../tests/e2e/invitation-accept.spec.ts).
  Blocked on the auth-fixture fix below.

### Resurrect the test/verify harness

- Fix [`tests/e2e/global-setup.ts`](../../tests/e2e/global-setup.ts): it
  authenticates by filling the now-removed email/password form (broken since
  the Google-only sign-in change), so the whole Playwright suite is
  unrunnable. Replace with a test-only auth path — Supabase admin-API session
  minting (service-role `auth.admin.generateLink` / `createUser` + set
  cookie), gated to test/preview only.
- Provide a dev-only login affordance (or seeded session cookie) so
  auth-adjacent UI changes can be browser-verified in preview, closing the
  recurring "couldn't browser-verify" gap noted repeatedly in the diary.

### Decide the fate of the self-insert RLS branches

- With `accept_invitation` canonical, the branch-2 self-insert in
  `bm_insert`/`wsm_insert` is dead code that *also* doesn't work. Two-paths
  duplication is the exact tripwire the 2026-05-15 diary calls out. Decide
  (open question 2): **remove** the self-insert branches (smaller RLS
  surface, single audited write path) or **fix + keep** them as
  defense-in-depth. If removed, the policies reduce to the admin-only branch;
  migration `20260516000003`'s re-assert is superseded — note it, don't
  silently leave three layers of the same policy in history.
- Audit the repo for any *other* invitation-gated or self-insert RLS write
  paths carrying the same latent trap; list them in the audit doc.

### Observability

- Invite-accept failures must alert, not just log. Route the coded-error
  branch of `acceptInvitation` (and the `accept_invitation` RPC RAISE paths)
  to Sentry with enough context (errcode, board/workspace id, no PII beyond
  user id), or add a logger-based alert on `action.failure` where
  `name = "acceptInvitation"`. Decide the channel in planning.
- A lightweight "invite funnel" counter (invitation created → email sent →
  link opened → accepted) so a drop-off at "accepted" is visible without a
  user report. Minimal: structured log events already exist for most steps;
  the gap is a dashboard/alert, not new instrumentation.

### Backfill & error-leak cleanup

- One-off backfill migration: anyone with a `board_member` row but no
  `workspace_member` row for that workspace (accepted a board invite before
  the workspace-seed fix), **and** anyone whose invitation is `accepted_at`
  non-null but has no membership row at all (errored mid-flow before the
  RPC). `insert … select … on conflict do nothing`. The RPC is idempotent so
  re-accept also heals these, but a one-shot migration fixes silent victims
  who will never click again.
- Audit that **no** Supabase `error.message` can still reach the join page's
  `?error=` query string from any path (the RPC mapping covers
  `acceptInvitation`; confirm there is no other leak). Diary followup from
  2026-05-15, still open.

## Out of scope

- Re-architecting the broader RLS model. Only the invitation-acceptance write
  path and its directly-implicated policies are in scope.
- Rate-limiting / abuse prevention on invite creation (carried from Epic 01
  out-of-scope; still its own thing).
- Workspace-invitation *feature* work. The RPC already covers workspace-scoped
  acceptance; feature-level workspace-invite work is not reopened.
- Decline / leave-board UX (still placeholder; separate piece).
- Switching auth providers or re-enabling email/password sign-in. The
  test-only auth path must not depend on that decision.
- The Epic 01 runbook content (DNS/Resend/Vercel). This epic adds a *DB
  migration deploy* runbook section, not the email-infra one.

## Approach

1. **Audit first.** Produce `docs/roadmap/_dispatch/epic-02-audit.md`:
   confirmed prod state of the five security-critical objects vs. repo;
   migration-history reconciliation status for `…0003`/`…0004`; inventory of
   all self-insert / invitation-gated RLS write paths; current Sentry routing
   for coded errors; exact breakage in `global-setup.ts`. Source of truth for
   slice specs; protects executors from guessing about live infra.
2. **Migration-deploy slice lands first and alone.** Everything else is
   lower-risk once the repo and prod cannot silently diverge. This slice is
   part maintainer task (CI secrets, Supabase integration toggle) — mark the
   human portion explicitly, like Epic 01's ops slice.
3. **Root-cause spike before touching policies.** A controlled `psql` repro
   (verified `SET ROLE authenticated` + `request.jwt.claims`, not the SQL
   editor) that reproduces the 42501 and isolates the exact failing predicate.
   The "remove vs. fix the self-insert branch" decision is downstream of this
   spike's finding. Do not modify `bm_insert`/`wsm_insert` until it lands.
4. **Parallel-safe code/test slices** once the harness is alive: pgTAP cold
   path; Playwright new-user accept; observability; backfill migration;
   error-leak audit. These do not overlap files.
5. **Smoke gates done.** A *fresh* external email (never seen by prod) accepts
   a board invite end-to-end on production, lands on the board, and the
   automated drift check is green. Failure → back through `/plan-epic` as a
   followup, not a hot-patch.

## Tasks

1. **Audit current state** → `_dispatch/epic-02-audit.md`. Resolve open
   questions (migration-deploy mechanism, self-insert branch fate, alert
   channel).
2. **Migration-deploy + drift check** (maintainer + code) — automated
   `migrations/*` apply on merge; CI drift check on the five critical
   objects; reconcile hand-applied `…0003`/`…0004` with migration history.
3. **Root-cause spike** — controlled `psql` repro isolating the 42501;
   written finding appended to this doc's root-cause record and to
   auto-memory if it generalizes.
4. **Resurrect E2E auth fixture** — test-only Supabase admin-API session
   minting in `global-setup.ts`; dev-only login affordance for preview.
5. **pgTAP cold-path tests** — fresh-user `accept_invitation` (board +
   workspace scoped) positive + negative (wrong email / revoked / expired);
   regression assertion for the self-insert branch per the spike decision.
6. **Playwright new-user accept E2E** — extends `invitation-accept.spec.ts`;
   depends on task 4.
7. **Self-insert branch decision applied** — remove or fix
   `bm_insert`/`wsm_insert` branch 2 per the spike; migration + pgTAP updated;
   note the supersession of `20260516000003`.
8. **Observability** — Sentry/alert routing for invite-accept failures; invite
   funnel alert.
9. **Backfill migration** — heal pre-fix incomplete memberships; idempotent.
10. **Error-leak audit** — prove no raw PG `error.message` reaches the join
    page from any path.
11. **Runbook** — add a "DB migration deploy + drift check" section to the
    runbooks; cross-link from the Epic 01 board-invitations runbook.
12. **Production smoke** — fresh external email, full cold-path accept;
    evidence in `_dispatch/epic-02-smoke.md`.

## Definition of done

- Merging to `main` automatically applies `supabase/migrations/*` to the
  production Supabase project; the mechanism is documented in a runbook with a
  date. App and schema can no longer silently drift.
- A CI/post-deploy drift check fails the pipeline if any of `bm_insert`,
  `wsm_insert`, `invitation_select`, `accept_invitation`,
  `current_user_email` in prod differs from the repo's expected definition.
- `20260516000003` and `20260516000004` are reconciled in the prod migration
  history (applied, not pending, not double-applied).
- A pgTAP test exercises a **genuine cold-path** invitation acceptance (fresh
  `authenticated` identity, no pre-existing membership) for both board- and
  workspace-scoped invites, plus the negative cases, and passes in CI.
- The root cause of the 42501 self-insert failure is isolated and written
  down; the self-insert RLS branches are either removed (and the policy
  history note added) or fixed-with-a-test — decided, not left ambiguous.
- The Playwright suite runs again (auth fixture fixed) and includes a
  brand-new-user invitation-accept spec that passes.
- Invite-accept failures raise an alert (Sentry or equivalent) within the
  monitoring the team actually watches — verified by deliberately triggering
  one in preview.
- A backfill migration has healed any pre-fix invitee left without correct
  membership rows; the query and affected-row count are recorded.
- No code path can surface a raw Supabase/Postgres `error.message` to the
  join page UI; verified by audit.
- A fresh external email (never previously seen by prod) has completed the
  full cold-path accept on production and landed on the invited board;
  evidence in `_dispatch/epic-02-smoke.md`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, pgTAP, and Playwright all pass
  on the epic branch.

## Open questions

1. **Migration-deploy mechanism — Supabase GitHub integration or
   `supabase db push` in CI?** Integration is lower-maintenance but couples
   deploy to Supabase's app; CI `db push` is explicit and lives with our
   pipeline but needs the prod DB password as a CI secret and careful
   ordering vs. the Vercel deploy. Resolve in planning; this choice gates
   task 2.
2. **Self-insert RLS branches — remove or fix-and-keep?** Removing shrinks
   the RLS surface to one audited write path (the RPC) and kills dead/broken
   code; keeping them as defense-in-depth means actually fixing the trap
   (pending the spike's root cause) and maintaining two write paths. Lean
   remove unless the spike shows a cheap, robust fix. Decide after task 3.
3. **Alert channel for invite-accept failure.** Sentry is wired but only the
   `INTERNAL` branch reaches it today. Options: extend Sentry capture to
   coded `INVITATION`/`DB` failures for this action; or a log-based alert on
   `action.failure name="acceptInvitation"`. Pick the one the team will
   actually see.
4. **Should `accept_invitation` enforce expiry on re-accept?** Current RPC
   only gates expiry on first acceptance (`accepted_at is null and
   expires_at < now()`), deliberately so it can backfill already-accepted
   invitees. Confirm this is the desired contract or tighten it.
5. **Drift-check scope.** Five objects is the minimum security-critical set.
   Do we want the check to cover *all* policies/functions (heavier, catches
   everything) or stay a curated allowlist (cheap, intentional)? Recommend
   allowlist now, expand later; confirm in planning.
6. **Backfill blast radius.** How many invitees are actually stranded
   pre-fix? The audit (task 1) must produce the count before the backfill
   migration is written, so it can be reviewed rather than run blind on
   production.
