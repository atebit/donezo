---

# Epic 15 — Observability, Testing, and CI/CD — Dispatch Plan

**Status:** draft 2026-05-13 by the planning pass. Operator standing instruction is "proceed without pausing"; each decision below states the default the orchestrator will take. The user may redirect.

**Canonical epic doc:** [`docs/conversion-plan/15-observability-testing-cicd.md`](../15-observability-testing-cicd.md)

**Branch:** `epic/15-observability-testing-cicd` (off `main`, after epic 14 merges).

**Dependency epics merged:** 01–14. All baseline state required by this epic is in place.

---

## Preconditions verified

**Test infrastructure**
- Vitest 4.1.6 is installed and the runner works. `pnpm test` currently produces `30 failed | 56 passed | 40 skipped (126)` test files; `3 failed | 673 passed | 809 skipped | 12 todo (1497)` tests. The skip/fail breakdown:
  - **28 file failures** all caused by `Cannot find package '@testing-library/react'` — `tests/unit/*.test.tsx` and several `use-*.test.ts` files import `@testing-library/react` (or `@testing-library/react/hooks`) but the package isn't installed and `vitest.config.ts` doesn't set `environment: 'jsdom'`.
  - **3 env.test.ts failures** — pre-existing real bugs in `tests/unit/env.test.ts` (NODE_ENV mutation handling, `vi.resetModules()` patterns not robust). Fixing as part of this epic.
  - **809 skipped tests / 88 files with `describe.skip` or `test.skip`** — most use the legacy "vitest wired in epic 15" comment. Vitest IS now wired; these skips are obsolete. Same for `.tsx` files once RTL+jsdom land.
- `vitest.config.ts` uses `environment: "node"`. RTL component tests require `jsdom`.
- `tests/unit/setup.ts` sets minimal env stubs but no DOM/RTL configuration.
- 17 e2e specs under `tests/e2e/` all use `test.skip(true, "... epic 15 ...")` plus `// @ts-expect-error playwright wired in epic 15`. `@playwright/test` IS installed (1.60.0). The skip is a runtime/auth-fixture gap, not a Playwright-install gap.
- 5 a11y specs at `tests/e2e/a11y/*.a11y.spec.ts` and 5 visual snapshot specs at `tests/e2e/visual/*.visual.spec.ts` — all `test.skip`-gated on "Auth fixture not wired — epic 15 owns seeding + runner config."
- `tests/policies/*.sql` — 11 pgTAP files (60+ assertions across the 5 main files plus 6 spec.sql files from later epics). No runner. No `pnpm test:policies` script. Setup helpers at `tests/policies/00_setup.sql`.
- `tests/integration/notifications-e2e.test.ts` — Vitest mock-based, already passes under `pnpm test`.
- `playwright.config.ts` exists, only Chromium project, `webServer.command = "pnpm dev"`, runs against `localhost:3000`. No auth fixture / storage state / global setup configured.
- `tests/perf/seed-board.ts` exists; manual smoke helper, not a CI test.

**Observability deps NOT installed**
- `@sentry/nextjs` — not in `package.json`. No `sentry.{client,server,edge}.config.ts`. `app/error.tsx` and `app/(app)/error.tsx` both have `// TODO epic 15: report to Sentry`. `lib/positions.ts:11` has an "epic 15" comment about the compactor.
- `@vercel/analytics` — not installed.
- `@vercel/speed-insights` — not installed.
- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` — none installed.
- `jsdom`, `happy-dom` — none installed.
- `lighthouse`, `@lhci/cli` — none installed.
- `release-please-action` config — not present.

**Observability assets that DO exist**
- `lib/logger.ts` — Pino logger, server-only guard, dev pretty-print via stdout pipe (no transport). Used widely.
- `lib/actions/with-user.ts` — Server-action wrapper. Already does start-timing + structured `logger.info`/`logger.error`. **Missing:** Sentry capture in the `"INTERNAL"` branch (the spot the epic doc explicitly calls out).
- `lib/env.ts` — Zod-validated. Already has `SENTRY_DSN` slot (optional URL). Production refines on `RESEND_API_KEY`, `INTERNAL_CRON_SECRET`, `SUPABASE_DB_WEBHOOK_SECRET`. `lib/env.ts` does NOT yet have `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- `lib/supabase/admin.ts` — service-role client, top-of-file warning. Already gated by Biome `noRestrictedImports` (level: error). One ESLint-rule-equivalent already in place.
- `next.config.ts` — already wraps with `withBundleAnalyzer({ enabled: ANALYZE === 'true' })` AND `withNextIntl()`. Sentry plugin wrapper not yet added.
- `app/layout.tsx` — wraps `NextIntlClientProvider → ThemeProvider → {children} + LiveRegion + Toaster`. **No Analytics / SpeedInsights mount.**
- `app/error.tsx` (global) and `app/(app)/error.tsx` exist. `app/not-found.tsx` exists. **No `app/global-error.tsx`** (required for Sentry to capture root-layout errors). **No `app/(app)/w/[workspaceSlug]/b/[boardId]/error.tsx`** (epic doc explicitly wants a board-segment boundary).
- `app/api/health/` — does NOT exist. Healthcheck endpoint needs to be created.

**Cron + webhooks** (already in place from epic 13)
- `app/api/cron/{notifications-mailer,digest,due-scanner,notification-cleanup}/route.ts` — all four exist with `INTERNAL_CRON_SECRET` Bearer auth (timing-safe compare), `x-vercel-cron: 1` sanity check, structured logging, try/catch with summary JSON.
- `app/api/webhooks/notifications/route.ts` — exists.
- `vercel.json` — has all 4 cron schedules: `notifications-mailer` (`*/5 * * * *`), `digest` (`*/15 * * * *`), `due-scanner` (`0 * * * *`), `notification-cleanup` (`0 3 * * *`).
- Crons listed in the epic doc task #21–#28 that DO NOT yet have routes: `cleanup-orphan-attachments` (#26), `purge-trash` (#27), `compact-positions` (#28). The doc's vercel.json snippet lists `cleanup-orphans`, `purge-trash`, `compact-positions` — none present today.

**CI**
- `.github/workflows/ci.yml` — single job `lint-typecheck-build`. Triggers on `pull_request` and `push: main`. Concurrency grouping in place. Build job injects `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` from repo secrets. **Missing jobs:** unit, policies, e2e, bundle, lighthouse, drift.
- `package.json` `test:e2e` script is `echo 'playwright wired in epic 15' && exit 0`. Must be replaced with `playwright test`.
- `package.json` has no `test:policies`, no `test:integration`, no `db:test` script.
- No branch protection rules are managed in-repo (must be set via GitHub UI / `gh` CLI as a documented step).

**Runbooks / ops**
- `docs/runbooks/` does not exist.
- No `SECURITY.md`, no rotation script, no backup-restore doc.

**Other**
- `supabase/migrations/` — 24 migrations. `supabase/config.toml` exists; project_id `donezo`; default `[db]` port 54322.
- `supabase/seed.sql` — has a deterministic seed user (`11111...`), workspace, board, columns, labels.
- `pnpm 10.33.4`, Node 22 (`.nvmrc`), Next 15.5.16, React 19, Biome 2.4.14, Supabase CLI 2.98.2.

---

## Open questions for the user

Per the operator's standing "make the reasonable call and continue" instruction, each item has a default the orchestrator will adopt. The user can redirect.

1. **Sentry tier and DSN.** Free tier covers 5k errors / 10k performance / 50 replays per month — sufficient for internal v1.
   - **Default:** install `@sentry/nextjs`, wire the three configs against env vars (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) but **DO NOT** create the Sentry org/project as part of code work — that is a Vercel-env / Sentry-dashboard step documented in the rotation/secrets runbook. Code works whether DSN is set or not (no-op when unset).
   - Architectural decision (not scope-cut).
2. **Lighthouse CI target — preview vs production.** Preview is faster, less representative.
   - **Default:** run Lighthouse CI against the **Vercel preview deployment** for the PR; record budgets but only **enforce** Accessibility = 100 in the gate. Performance / TBT / LCP get reported but **`continue-on-error: true`** for v1 (lots of preview-environment noise). Promote to enforced once we have 2 weeks of clean data.
   - Pure-MVP scope cut (perf budgets get the doc but a soft gate).
3. **E2E test-user seeding strategy.** Several options: (a) a "shared CI Supabase preview project" with deterministic seed users; (b) Supabase branching (per-PR project); (c) ephemeral local `supabase start` in CI with `seed.sql`; (d) HTTP fixtures (mocked).
   - **Default:** option (c) — run `supabase start` inside the `e2e` GitHub Actions job, apply migrations, run `seed.sql`, run `next start` against it, run Playwright. Reasons: deterministic per run, no shared state, no Supabase Pro requirement, matches what the epic doc calls "the gold standard ... practical compromise" inverted (we go gold-standard local). Cost: ~3 minutes added to e2e job (Supabase boot + migrate + seed).
   - The auth fixture: a `tests/e2e/fixtures/auth.ts` that signs in the seed user via Supabase Auth admin API (using service-role key from local supabase) and saves storage state to `tests/e2e/.auth/user.json`. Specs `use({ storageState })`.
   - Architectural decision (single biggest infra piece of this epic).
4. **Vercel feature flags.** Edge Config + Flags SDK or PostHog.
   - **Default:** **skip for v1**. No feature in the v1 product needs staged rollout. Document in runbooks as a future addition. Pure scope cut.
5. **Shared CI Supabase project vs branching.** The epic doc proposes a shared preview project as v1.
   - **Default:** **neither for CI** (we use ephemeral local — see Q3). For Vercel **preview deploys**, we point them at a single shared `donezo-preview` Supabase project, with workspace slugs namespaced by PR number per the epic doc Q3 default. This is an ops/Vercel-env decision, not a code change — documented in `docs/runbooks/preview-environments.md`. Pure ops decision.
6. **release-please / changelog automation.**
   - **Default:** **skip release-please for v1**, keep a hand-curated `CHANGELOG.md` (created in the runbooks slice) and use SemVer tags on `main`. Add `release-please` later if the manual cadence becomes friction. Pure scope cut.
7. **BetterStack / uptime monitor.**
   - **Default:** **document only**. Create `docs/runbooks/uptime-monitoring.md` describing the BetterStack signup + `/api/health` config. Do NOT block this epic on third-party signup. Pure scope cut.
8. **Schema drift target.** The epic doc proposes `supabase db diff --linked` against a `donezo-ci` project.
   - **Default:** simpler — diff the `supabase/migrations/*.sql` files against an ephemeral local Postgres reset (same `supabase start` instance used by e2e). Run `supabase db reset` then `supabase db diff --use-migra` and fail if the diff is non-empty. Equivalent guarantee, no remote project required. Architectural simplification.
9. **Supabase Pro backups + PITR.** The epic doc mentions Pro tier daily backups; PITR on higher tiers.
   - **Default:** **document only** in `docs/runbooks/database-restore.md`. Confirming the tier is an ops/billing step. Pure ops decision.
10. **Test pyramid coverage target.** The epic doc says "~500 unit tests by v1" and "~80 assertions" for pgTAP. We currently have ~673 passing + 809 skipped unit assertions; pgTAP has 60+.
    - **Default:** un-skipping the legacy `describe.skip` blocks should add several hundred runnable tests, comfortably exceeding the 500 target. Do NOT chase the headline number; the goal is "every existing skip gets resolved (un-skip + green, or delete + justified)." pgTAP target already met. Architectural decision.
11. **CI Node version + Supabase CLI version.** `.nvmrc` pins to 22. We must pin Supabase CLI in CI.
    - **Default:** pin Supabase CLI to the same version installed locally (`2.98.2`) in every CI job that uses it, via `supabase/setup-cli@v1` with `version: 2.98.2`. Architectural decision.
12. **Bundle analyzer comment.** The epic doc says "comments the diff vs main."
    - **Default:** use `andresz1/size-limit-action` or `relativeci/agent` — both require GitHub App auth. Simpler: a bash step that runs `ANALYZE=true pnpm build`, captures the report, posts a summary table to the PR via `gh pr comment`. Architectural decision.

---

## Stages and slices

Stage 1 contains 7 parallel-safe slices that do not touch each other's file scope. Stage 2 wires the CI matrix (depends on stage 1's per-feature pieces existing). Stage 3 is the integration + branch-protection + runbooks pass.

### Dependency map at a glance

- 1A (Sentry) edits `next.config.ts`, `lib/actions/with-user.ts`, `lib/env.ts`, `app/error.tsx`, `app/(app)/error.tsx`. Adds `app/global-error.tsx` + `app/(app)/w/[workspaceSlug]/b/[boardId]/error.tsx` + sentry config files.
- 1B (Logger wrapper) edits `lib/actions/with-user.ts` — **conflicts with 1A**. Resolution: **1A merges first** (Sentry capture is the larger structural change); 1B rebases and adds logger-only fields. Both edit a small surface — easy rebase. **Sequence: 1A → 1B.** OR partition: 1A only adds Sentry calls inside the existing `catch`; 1B only adds the start/end log fields. We pick partition; both can run in parallel if the spec is disciplined. **Plan:** ship 1A first, 1B second within stage 1.
- 1C (Analytics) edits `app/layout.tsx`, `lib/analytics.ts` (new), `package.json`. No conflict.
- 1D (Error boundaries + healthcheck) — pure-add files (`app/global-error.tsx`, board `error.tsx`, `app/api/health/route.ts`). **Conflicts with 1A** on `app/error.tsx` and `app/(app)/error.tsx` (both add Sentry calls there). Resolution: **1A owns the Sentry wiring in existing error.tsx files; 1D owns net-new files**. No overlap.
- 1E (RTL + jsdom + un-skip unit tests) edits `vitest.config.ts`, `tests/unit/setup.ts`, `package.json`, and un-skips ~88 test files. **No overlap with other slices** (test-only).
- 1F (Playwright runtime + seeding + un-skip e2e + a11y + visual) edits `playwright.config.ts`, `package.json`, adds `tests/e2e/fixtures/`, `tests/e2e/global-setup.ts`, un-skips 17 e2e specs. **No overlap.**
- 1G (pgTAP runner) adds `tests/policies/run.sh` and a `package.json` script. **No overlap.**

Stage 2 (CI matrix) and stage 3 (cron observability, runbooks, branch protection, drift) follow.

---

### Stage 1 — Foundation (parallel-safe with 1A → 1B sequencing)

#### Slice 1A — Sentry: install, configure, capture in error boundaries + with-user

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `package.json` — add `@sentry/nextjs` (dependency).
- `sentry.client.config.ts` (new at repo root) — client SDK init.
- `sentry.server.config.ts` (new) — server SDK init.
- `sentry.edge.config.ts` (new) — edge SDK init.
- `next.config.ts` — wrap default export with `withSentryConfig`; keep existing `withAnalyzer(withNextIntl(nextConfig))` chain. Order: `withSentryConfig(withAnalyzer(withNextIntl(nextConfig)), sentryWebpackPluginOptions)`.
- `lib/env.ts` — add optional `SENTRY_DSN` (already there), `NEXT_PUBLIC_SENTRY_DSN` (new), `SENTRY_AUTH_TOKEN` (new, optional), `SENTRY_ORG` (new, optional), `SENTRY_PROJECT` (new, optional). Add a `refine` requiring `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` together iff `NODE_ENV === 'production'`.
- `lib/actions/with-user.ts` — in the final `catch` block that produces the `INTERNAL` error, call `Sentry.captureException(err, { extras: { action, userId } })`. **Do NOT** add the logger start/end fields — that is 1B's scope.
- `lib/sentry/scrub.ts` (new) — `beforeSend` hook that strips `email`/`name` from `user` context; only `id` is sent. Import from all three `sentry.*.config.ts` files.
- `app/global-error.tsx` (new) — required by Sentry to capture root-layout errors. Uses `Sentry.captureException(error)` on mount; renders a minimal HTML shell (no app chrome) — same content as `app/error.tsx` but wrapped in `<html><body>`.
- `app/error.tsx` (edit) — replace the `console.error(error)` TODO with `Sentry.captureException(error, { tags: { boundary: 'global' } })`; remove the TODO marker.
- `app/(app)/error.tsx` (edit) — same, with `tags: { boundary: 'app' }`.
- `app/(app)/w/[workspaceSlug]/b/[boardId]/error.tsx` (new) — board-segment boundary per epic doc: "so a board crash doesn't destroy the sidebar." Use the same client-component pattern, `tags: { boundary: 'board' }`.
- `tests/unit/with-user-sentry.test.ts` (new) — mocks `@sentry/nextjs`; asserts `captureException` is called on `INTERNAL` errors and **not** called on validation / forbidden / not_found errors.
- `tests/unit/sentry-scrub.test.ts` (new) — asserts the scrub hook removes `email`, `name`; keeps `id`.

**Forbidden scope:** logger start/end fields (1B); analytics provider mounts (1C); error/loading boundaries except the two existing `error.tsx` and the two new ones in this slice; healthcheck (1D); any test infra change (1E/1F/1G); any CI workflow change.

**Dependencies:** none.

**Spec:**
- `sentry.client.config.ts`:
  ```ts
  import * as Sentry from "@sentry/nextjs";
  import { scrubUserPII } from "@/lib/sentry/scrub";

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.NEXT_PUBLIC_BUILD_SHA,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    beforeSend: scrubUserPII,
    ignoreErrors: [
      // Realtime auto-reconnect noise
      "supabase: WebSocket closed",
      // Server-action expected refusals
      /^FORBIDDEN/,
      /^NOT_FOUND/,
    ],
  });
  ```
- `sentry.server.config.ts` and `sentry.edge.config.ts` — same shape minus `replays*`, plus `dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN`.
- `withSentryConfig` options: `{ silent: true, org: env.SENTRY_ORG, project: env.SENTRY_PROJECT, authToken: env.SENTRY_AUTH_TOKEN, widenClientFileUpload: true, hideSourceMaps: true }`. Source-map upload is auto-enabled when `SENTRY_AUTH_TOKEN` is present.
- `Sentry.captureException` is conditional inside `with-user.ts` — wrap with `if (process.env.NEXT_PUBLIC_SENTRY_DSN)` so unit tests don't crash on missing init.
- All three `sentry.*.config.ts` files use the `process.env` directly (not `@/lib/env`) to keep the bootstrap chain short. Document that in a header comment.

**Definition of done:**
- Sentry SDKs installed; three config files present.
- `next.config.ts` wraps with `withSentryConfig`.
- `app/global-error.tsx` exists; existing `error.tsx` files capture to Sentry; new board `error.tsx` exists.
- `with-user.ts` captures the `INTERNAL` branch only.
- Tests pass; `pnpm typecheck` green; `pnpm build` succeeds with no Sentry DSN (Sentry init no-ops).
- Manually verifiable: with `NEXT_PUBLIC_SENTRY_DSN` set, throwing inside a Server Action shows the event in Sentry within 30s.

**Escalation triggers:**
- If `withSentryConfig` and `withBundleAnalyzer` order produces a build failure (some versions object to specific wrap orders).
- If `app/global-error.tsx` must opt out of the next-intl provider — escalate before restructuring `app/layout.tsx`.
- If the Sentry plugin's source-map upload demands network access at build time and breaks the unauthenticated `pnpm build` in CI.

---

#### Slice 1B — Action wrapper start/success/failure structured logs

**Owner:** epic-executor (Sonnet). Dispatch after 1A merges.

**Write scope:**
- `lib/actions/with-user.ts` — extend the existing wrapper to log structured `{ event: 'action.start', name, userId }` at start, `{ event: 'action.success', name, durationMs, userId }` on success, `{ event: 'action.failure', name, err, durationMs, userId, code }` on failure (covering all branches: UNAUTHENTICATED, VALIDATION, known coded errors, INTERNAL). The current implementation logs only on the INTERNAL throw; the spec wants explicit start/success/failure events as the epic doc shows.
- `lib/logger.ts` — no edits; existing pino logger is correct.
- `tests/unit/with-user.test.ts` (edit) — assert the three event names are emitted with the listed fields. Use `vi.spyOn(logger, 'info' | 'error')`.
- `tests/unit/with-user-logging.test.ts` (new, if separating concerns from the existing file is cleaner — owner decides).

**Forbidden scope:** anything Sentry-related (1A); changes to action handlers themselves; changes to the `logger.ts` module.

**Dependencies:** 1A merged (to avoid the merge conflict on `with-user.ts`).

**Spec:**
- Event-name canon: `action.start`, `action.success`, `action.failure`. Document in a file header comment.
- `name` field: keep current `handler.name || "anonymous"`. Pin a TODO note that callers should use named functions / `.bind({ name: ... })` for legibility — do NOT change call sites in this slice.
- `durationMs` rounded to integer (`Math.round(performance.now() - start)`).
- `err` serialization: use pino's default error serializer — no custom transform, no PII risk because errors are server-thrown.

**Definition of done:**
- `with-user.test.ts` asserts all three events with correct fields.
- A manual smoke (`pnpm dev`, click any action) shows three log lines per call in the terminal.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

**Escalation triggers:**
- If 1A's Sentry capture was placed in a way that conflicts with the structured-log placement (the catch block becomes hard to read with both), escalate for a refactor of the catch block.

---

#### Slice 1C — Vercel Analytics + Speed Insights + custom events helper

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `package.json` — add `@vercel/analytics`, `@vercel/speed-insights` (dependencies).
- `app/layout.tsx` — mount `<Analytics />` and `<SpeedInsights />` inside `<body>` (before `</body>`). Place AFTER `<Toaster />`. Both are client components per Vercel SDK; they render no UI in dev.
- `lib/analytics.ts` (new) — small helper:
  ```ts
  import { track } from "@vercel/analytics";
  export type AnalyticsEvent =
    | { name: "board.created"; props: { workspaceId: string; boardId: string } }
    | { name: "task.added"; props: { boardId: string } }
    | { name: "comment.posted"; props: { boardId: string; taskId: string } };
  export function trackEvent<E extends AnalyticsEvent>(event: E): void {
    track(event.name, event.props as Record<string, string>);
  }
  ```
- Wire `trackEvent` at exactly **three** call sites (the top-funnel events the epic doc lists):
  - `app/(app)/w/[workspaceSlug]/actions.ts` — after a board is created in `createBoard`.
  - `app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions.ts` — after a task is added in `createTask`.
  - `app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts` — after a comment is posted in `createComment` (locate exact action name; if different, document).
  - These three action files are not touched by any other slice in stage 1.
- `tests/unit/analytics.test.ts` (new) — mock `@vercel/analytics`; assert `trackEvent` calls `track` with the right name + props.

**Forbidden scope:** any error boundary, any Sentry wiring, any logger change, any test infra change.

**Dependencies:** none. May run fully in parallel with 1A/1B/1D/1E/1F/1G.

**Spec:**
- Stack-default compliance: Vercel Analytics is the chosen analytics tool per `00-overview.md` Target stack table.
- The three call sites are server actions; `track` from `@vercel/analytics` is server-safe (it issues an internal fetch).
- Document in the analytics module header: "Custom events: lightweight, for product insight only. Do not use for engineering observability — that is Sentry + Pino."

**Definition of done:**
- `<Analytics />` and `<SpeedInsights />` mount in `app/layout.tsx`.
- `lib/analytics.ts` exports the typed `trackEvent`.
- Three call sites wired; `pnpm typecheck` green.
- In `pnpm dev`, the Vercel Analytics SDK logs `[Vercel Web Analytics] Debug mode is enabled by default in development` to console — sanity confirmation.

**Escalation triggers:**
- If the comment-create action name has changed since the epic doc was written, document and escalate.

---

#### Slice 1D — Error boundaries (audit + segment additions) + healthcheck endpoint

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `app/api/health/route.ts` (new) — exact spec from epic doc:
  ```ts
  import { NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";

  export const dynamic = "force-dynamic";

  export async function GET() {
    const supabase = await createClient();
    const { error } = await supabase.from("workspace").select("id").limit(1);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    return NextResponse.json({
      ok: true,
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown",
      ts: Date.now(),
    });
  }
  ```
- `app/(app)/w/[workspaceSlug]/error.tsx` (new) — workspace-segment error boundary (parallel to the board one 1A adds). Pattern matches existing `app/(app)/error.tsx`.
- `app/(app)/notifications/error.tsx` (new) — notifications-segment boundary.
- **AUDIT step (slice deliverable):** the executor must verify every top-level segment under `app/(app)/` either has an `error.tsx` OR is documented as not needing one. Output the audit as a markdown deliverable at `docs/conversion-plan/_dispatch/epic-15-error-boundary-audit.md` listing each app segment + its boundary status. This is a one-page report.
- `tests/unit/health-route.test.ts` (new) — mocks `createClient`; asserts `200 { ok: true }` on success, `503 { ok: false }` on error.

**Forbidden scope:** `app/error.tsx`, `app/(app)/error.tsx`, `app/global-error.tsx`, `app/(app)/w/[workspaceSlug]/b/[boardId]/error.tsx` (1A owns these). Any Sentry call (1A owns). Any Analytics mount (1C owns).

**Dependencies:** none. Parallel-safe with 1A/1B/1C/1E/1F/1G.

**Spec:**
- The new segment boundaries do NOT call `Sentry.captureException` themselves; the segment hierarchy in Next.js bubbles uncaught errors from `error.tsx` down to the next parent boundary, which 1A wired. The role of these new segment boundaries is to provide friendly fallback UIs at narrower scopes — sidebar still renders if `/w/[slug]/page` errors, etc.
- Healthcheck route: `dynamic = "force-dynamic"`; no caching. The query against `workspace` table will exercise RLS — but RLS only matters with `authenticated` role; this hits unauthenticated by default and the SELECT returns `error: null, data: []` (empty, no permission). That's fine — we get a 200 with empty data, which is what BetterStack wants (round-trip to Postgres confirmed).
- Healthcheck must work without auth and without crashing on Supabase rate-limit; if `createClient` itself throws, return 503 with `error.message` in JSON.

**Definition of done:**
- `/api/health` returns 200 on success in dev.
- All app segments have either an `error.tsx` or a justification in the audit doc.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
- Audit doc landed.

**Escalation triggers:**
- If the healthcheck must NOT exercise Supabase (operator preference to avoid quota draws), escalate before changing the query.

---

#### Slice 1E — RTL + jsdom: install, configure, un-skip unit tests

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `package.json` — add devDeps: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
- `vitest.config.ts` — change `environment: "node"` to per-file env via `environmentMatchGlobs`. Specifically:
  ```ts
  test: {
    environmentMatchGlobs: [
      ["tests/unit/**/*.test.tsx", "jsdom"],
      ["tests/unit/**/*.test.ts", "node"],
    ],
    // ...
  }
  ```
  Some `.test.ts` files import `@testing-library/react-hooks` patterns — the executor must inspect each and **move** any `.test.ts` hook-test to `.test.tsx` OR adjust the glob. Final glob must result in jsdom for files that need it, node for files that don't.
- `tests/unit/setup.ts` — add `import "@testing-library/jest-dom/vitest"` AND a guarded mock of `window.matchMedia` (returning a non-throwing stub) at the top of the file. Keep the existing env stubs.
- **Un-skip pass — pure-logic `.test.ts` files** (no RTL needed): change `describe.skip` → `describe` and remove `// @ts-expect-error vitest is wired in epic 15` comments. Files in scope:
  - `tests/unit/positions.test.ts`
  - `tests/unit/cell-codecs.test.ts`
  - `tests/unit/cell-conversions.test.ts`
  - `tests/unit/cell-aggregations.test.ts`
  - `tests/unit/cell-to-search-string.test.ts` (verify exists)
  - `tests/unit/board-store.test.ts`
  - `tests/unit/board-store-comments.test.ts`
  - `tests/unit/board-store-attachments.test.ts`
  - `tests/unit/board-store-views.test.ts`
  - `tests/unit/outbox.test.ts`
  - `tests/unit/board-actions.test.ts`
  - `tests/unit/board-page-active-view.test.ts`
  - `tests/unit/workspace-actions.test.ts`
  - `tests/unit/task-actions.test.ts`
  - `tests/unit/cell-actions.test.ts`
  - `tests/unit/comment-actions.test.ts`
  - `tests/unit/attachment-actions.test.ts`
  - `tests/unit/attachment-validations.test.ts`
  - `tests/unit/attachment-path.test.ts`
  - `tests/unit/column-actions.test.ts`
  - `tests/unit/label-actions.test.ts`
  - `tests/unit/group-actions.test.ts`
  - `tests/unit/view-actions.test.ts`
  - `tests/unit/view-validations.test.ts`
  - `tests/unit/view-config-schema.test.ts`
  - `tests/unit/view-config-per-kind-schema.test.ts`
  - `tests/unit/view-url-codec.test.ts`
  - `tests/unit/use-board-view.test.ts` (note: this uses RTL hook patterns — verify; may need RTL/jsdom)
  - `tests/unit/use-board-view-cross-kind.test.ts` (same — verify)
  - `tests/unit/list-board-activity.test.ts`
  - `tests/unit/activity.test.ts`
  - `tests/unit/realtime-throttle.test.ts`
  - `tests/unit/cursor-color.test.ts`
  - `tests/unit/apply-filter-tree.test.ts`
  - `tests/unit/apply-search.test.ts`
  - `tests/unit/apply-sort.test.ts`
  - `tests/unit/apply-group-by.test.ts`
  - `tests/unit/lane-bucketing.test.ts`
  - `tests/unit/calendar-event-mapping.test.ts`
  - `tests/unit/timeline-math.test.ts`
  - `tests/unit/widget-data.test.ts`
  - `tests/unit/form-schema.test.ts`
  - `tests/unit/extract-mentions.test.ts`
  - `tests/unit/profile-rls.test.ts`
  - `tests/unit/comment-image-upload.test.ts`
  - Any other `describe.skip` in `tests/unit/**/*.test.ts` not requiring RTL/jsdom.
- **Un-skip pass — `.test.tsx` files** (need RTL + jsdom, now installed):
  - All 28 currently-failing `.tsx` files plus the hook `.test.ts` files that import RTL.
  - Files to un-skip: `ActivityItem.test.tsx`, `AttachmentImage.test.tsx`, `AttachmentImageNode.test.tsx`, `BoardActivityFilters.test.tsx`, `BoardTable-realtime-mount.test.tsx`, `CommentItem.test.tsx`, `CommentReactions.test.tsx`, `ConnectionStatus.test.tsx`, `EditableTitle.test.tsx`, `FileCellEditor.test.tsx`, `FileDropzone.test.tsx`, `FilesTab.test.tsx`, `MentionPopover.test.tsx`, `OutboxBanner.test.tsx`, `PresencePile.test.tsx`, `RichTextEditor.test.tsx`, `TaskDrawer.test.tsx`, `activity-renderers.test.tsx`, `activity-renderers-attachment.test.tsx`, `use-attachment-uploader.test.ts`, `use-board-realtime-attachments.test.ts`, `use-board-realtime-comments.test.ts`, `use-board-realtime.test.ts`, `use-cursor-broadcast.test.ts`, `use-signed-display-url.test.ts`, `use-table-keyboard-nav.test.ts`, `use-typing-broadcast.test.ts`, `use-typing-indicator.test.ts`, `workspace-sidebar.test.tsx`, plus any other `.tsx` with `describe.skip`.
- **Fix `tests/unit/env.test.ts`** — 3 failing tests today. Use the pattern from `epic-01-followup-1.md` issue 8 (`vi.resetModules()` in `beforeEach`, fully restore `process.env`). This file is in scope because its failures block the unit job from going green.
- `tests/unit/setup.ts` — IF the env-tests still mutate `process.env` per-test, document the contract in setup.ts.
- **Triage rule for stubbornly-failing tests:** if un-skipping a test reveals a genuine code bug, the executor's job is **to delete the broken assertion OR mark `it.todo("epic 15 followup: fix N", () => ...)` with a single-line reason and add to a deliverable `docs/conversion-plan/_dispatch/epic-15-test-debt.md`** — not to fix production code. Production fixes are followup slices, not scope expansion.

**Forbidden scope:** anything outside `tests/`, `vitest.config.ts`, `tests/unit/setup.ts`, `package.json`, and the one allowed deliverable doc. NO production-code changes. NO playwright work (1F owns).

**Dependencies:** none. Parallel-safe with 1A/1B/1C/1D/1F/1G.

**Spec:**
- The pre-existing `// @ts-expect-error vitest is wired in epic 15` comments above `import { describe, ... } from "vitest"` are now stale — remove them. They cause `noUnusedTsExpectError` lint failures once vitest types are properly resolved (vitest IS installed; the comment was wrong even when written).
- Expected end state: `pnpm test` reports zero failures, near-zero skipped (excluding deliberate `it.todo` placeholders the executor adds for genuinely-busted tests).
- Tests that exercise React 19 + RTL: ensure the RTL version installed is ≥16 (React 19 support). The executor must use the latest released version.

**Definition of done:**
- `pnpm test` green. Test count up from current `673 passing / 809 skipped` to roughly `1400+ passing / <50 skipped` (the only skips left should be `it.todo` debt entries with reasons).
- The skip-debt doc lists every remaining `it.todo` with a one-line reason and the slice/file that should fix it.
- `pnpm typecheck` green.
- `pnpm lint` green (no orphan `@ts-expect-error` comments).
- The Vitest `.config.ts` glob correctly routes `.tsx` files to jsdom.

**Escalation triggers:**
- If any un-skipped test exposes a real production-code bug that requires more than a one-line fix.
- If RTL + React 19 has a peer-dep conflict requiring a downgrade or override.
- If more than ~30 tests need to be marked `it.todo` — that indicates this slice scope is wrong and a larger triage pass is needed.

---

#### Slice 1F — Playwright runtime: config, auth fixture, supabase-in-CI helpers, un-skip e2e + a11y + visual specs

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `package.json`:
  - Replace `"test:e2e": "echo 'playwright wired in epic 15' && exit 0"` with `"test:e2e": "playwright test"`.
  - Add: `"test:e2e:install": "playwright install --with-deps"`, `"test:e2e:auth-setup": "playwright test tests/e2e/global-setup"` (or whatever the global setup script invocation is), `"test:e2e:a11y": "playwright test tests/e2e/a11y"`, `"test:e2e:visual": "playwright test tests/e2e/visual"`.
- `playwright.config.ts` (edit):
  - Add `globalSetup: "./tests/e2e/global-setup.ts"`.
  - Add a `projects` matrix: `{ name: "chromium", use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/user.json" } }`. (Firefox + WebKit deferred — see Risk notes.)
  - Add `reporter: process.env.CI ? "github" : "html"`.
  - Add an `expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } }` setting for visual specs.
  - Webserver: change `command` to `pnpm build && pnpm start` (deterministic prod build for CI), reuse-existing for local dev.
- `tests/e2e/global-setup.ts` (new):
  - Reads `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from env (CI provides via the `e2e` GH Actions job; local provides from `.env.local`).
  - Uses the Supabase Admin API (`@supabase/supabase-js` with service-role key) to upsert a test user (`e2e-user@donezo.test`) with a deterministic password. Uses `auth.admin.createUser({ email, password, email_confirm: true })`.
  - Signs in via `supabase.auth.signInWithPassword` and writes the access-token cookies to `tests/e2e/.auth/user.json` via `@playwright/test`'s `storageState` capture.
  - Returns a teardown function (no-op for shared-CI-DB; full cleanup for ephemeral).
- `tests/e2e/.auth/.gitignore` (new) — ignore `user.json`.
- `tests/e2e/fixtures/seed.ts` (new) — exports deterministic IDs (workspace slug = `e2e`, board id = a fixed uuid v4, etc.) that match `supabase/seed.sql`. Specs import these instead of hard-coded "replace-with-..." constants.
- `supabase/seed.sql` (edit) — append an `e2e-user@donezo.test` profile + an `e2e` workspace + a board with deterministic IDs. Use `on conflict do nothing` so existing seeds aren't broken. Document the additions in a header comment.
- **Un-skip every e2e spec** under `tests/e2e/`:
  - `05-workspaces-boards.spec.ts`, `06-board-table.spec.ts`, `07-column-system.spec.ts`, `08-realtime.spec.ts`, `09-comments-activity.spec.ts`, `10-attachments.spec.ts`, `11-filtering-views.spec.ts`, `12-*.spec.ts` (8 files), `auth.spec.ts`, `invitation-accept.spec.ts`.
  - Remove the `test.skip(true, "...")` line; remove `// @ts-expect-error playwright wired in epic 15` comments.
  - Replace `WORKSPACE_SLUG = "e2e-workspace"; BOARD_ID = "replace-with-..."` constants with imports from `tests/e2e/fixtures/seed.ts`.
- **Un-skip every a11y spec** at `tests/e2e/a11y/{auth,board,task-drawer,notifications,account}.a11y.spec.ts` — same treatment.
- **Un-skip every visual spec** at `tests/e2e/visual/{workspace-home,board-table,board-kanban,notifications,account-settings}.visual.spec.ts` — same treatment. Accept first-run snapshots as the baseline (`pnpm test:e2e:visual --update-snapshots` locally; commit to `tests/e2e/visual/__snapshots__/`).
- **Triage rule:** when un-skipping a spec reveals a real product bug, the executor logs an entry in `docs/conversion-plan/_dispatch/epic-15-test-debt.md` (same doc as 1E) with `test.fixme(...)` for the failing assertion. Do NOT fix production code.

**Forbidden scope:** Vitest (1E). Sentry / analytics / boundaries (1A-1D). CI workflow file (Stage 2). Cron route handlers (Stage 3).

**Dependencies:** none on other 1A-1G slices. Parallel-safe.

**Spec:**
- The auth fixture pattern follows the Playwright "Authentication" docs: a global setup runs once, signs in once, saves storage state; per-test fixtures reuse it via `use: { storageState }`.
- Local run: `supabase start && pnpm db:reset --linked-db postgresql://postgres:postgres@localhost:54322/postgres && pnpm dlx playwright test`. Add to `tests/e2e/README.md` (new).
- CI run: the `e2e` job in stage 2 boots `supabase start`, then runs `pnpm test:e2e:install && pnpm test:e2e`.
- Visual specs use `page.emulateMedia({ colorScheme: 'light' | 'dark' })` and `page.setViewportSize({ width, height })` per the existing spec scaffolds.

**Definition of done:**
- `pnpm dlx playwright test` runs locally against a freshly-reset Supabase + seeded DB and produces a non-empty pass list. (Some specs may legitimately fail against the seed data and get demoted to `test.fixme(...)` — that's logged in the debt doc, not silently skipped.)
- Auth fixture writes `tests/e2e/.auth/user.json`.
- Visual snapshots committed.
- `tests/e2e/README.md` documents the local run procedure.
- The 17 prior `test.skip(true, "...")` lines are gone.

**Escalation triggers:**
- If `supabase start` is too slow or otherwise unavailable in the executor's local environment (escalate; orchestrator decides between Supabase branching and shared CI project).
- If the visual snapshot baselines diff massively between local-WebKit and CI-Linux (escalate; standard mitigation is to run snapshots only on Linux).
- If un-skipping reveals that >5 specs need `test.fixme(...)` (escalate; signals product bugs that should be tracked separately).

---

#### Slice 1G — pgTAP runner: local script + npm script + minimal docs

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `tests/policies/run.sh` (new, executable):
  ```sh
  #!/usr/bin/env bash
  set -euo pipefail
  : "${DATABASE_URL:?DATABASE_URL must be set, e.g. postgresql://postgres:postgres@localhost:54322/postgres}"
  cd "$(dirname "$0")"
  for f in *.sql *.spec.sql; do
    case "$f" in 00_setup.sql) continue;; esac
    echo "==> $f"
    pg_prove --ext .sql --runtests "$f" "$DATABASE_URL" || exit 1
  done
  ```
  (Adjust pg_prove invocation per the actual local toolchain — pg_prove on macOS is typically `brew install perl pg_prove`. Document.)
- `package.json` — add scripts: `"test:policies": "tests/policies/run.sh"`, `"test:policies:ci": "DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres tests/policies/run.sh"`.
- `tests/policies/README.md` (edit) — add a "Running locally" section: prerequisites (Perl, pg_prove via `cpan TAP::Parser::SourceHandler::pgTAP` or `brew install pg_prove`), how to `supabase start`, how to invoke the runner.

**Forbidden scope:** GitHub Actions workflow (stage 2). Any new pgTAP test file (other slices/epics own). Production code.

**Dependencies:** none.

**Spec:**
- The script must invoke each `.sql` and `.spec.sql` file under `tests/policies/` except `00_setup.sql` (which is `\i`-included by each spec). pg_prove returns non-zero on assertion failure.
- The script accepts `DATABASE_URL` env. If unset, prints a helpful message and exits 1.

**Definition of done:**
- `pnpm test:policies` runs the existing 11 pgTAP files against `supabase start`'s DB and reports a pass/fail summary.
- README documents prerequisites and the run command.
- `pnpm typecheck`, `pnpm lint` green (this slice doesn't add TS).

**Escalation triggers:**
- If macOS / Linux differ in pg_prove flag syntax such that one script can't work in both contexts, escalate before doubling up.

---

### Stage 2 — CI matrix (depends on Stage 1)

#### Slice 2A — Expand `.github/workflows/ci.yml` to the full job matrix

**Owner:** epic-executor (Sonnet). Dispatch after **all stage 1 slices have merged into the epic branch**.

**Write scope:**
- `.github/workflows/ci.yml` (edit) — split the single `lint-typecheck-build` job into:
  - `lint` — `pnpm lint`.
  - `typecheck` — `pnpm typecheck`.
  - `build` — `pnpm build` (same as today; preserves `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` secret injection).
  - `unit` — `pnpm test`. Depends on stage 1E. Sets up env via `tests/unit/setup.ts` defaults; no Supabase needed.
  - `policies` — Postgres service container OR `supabase start`. Recommended: `supabase start` to match local dev. Steps: setup-node 22, install pnpm, install Supabase CLI 2.98.2 via `supabase/setup-cli@v1`, `supabase start`, run `pnpm test:policies`. Depends on stage 1G.
  - `e2e` — boot Supabase, apply migrations + seed, install Playwright browsers, run `pnpm test:e2e`. Depends on stage 1F. Upload Playwright HTML report + trace + visual diffs as a workflow artifact on failure.
  - `drift` — boot Supabase, run `supabase db reset --use-migra`, then `supabase db diff --use-migra` and fail if the diff is non-empty. Depends on stage 1G/2A schema-drift slice if separated; in practice goes in this same workflow file as a separate job.
  - `bundle` — checkout, install, run `ANALYZE=true pnpm build`, parse the analyzer output (`.next/analyze/client.json` etc.), and `gh pr comment` the size table. Soft-fail on regression vs `main` baseline (no enforced budget in v1; report only).
  - `lighthouse` — wait on Vercel preview URL (via `amondnet/vercel-action` or by polling the GH PR's deployment events), run `@lhci/cli` against the listed routes (`/`, `/sign-in`, the workspace home, a board), assert Accessibility = 100 (hard), report Performance/LCP/TBT (soft via `continue-on-error: true`). Depends on stage 1 only logically.
- `.github/workflows/lighthouserc.json` (new) — Lighthouse CI config: list of URLs (parameterized by `${PREVIEW_URL}`), budgets, accessibility = 100, performance ≥ 85 (soft), TBT < 200ms (soft).
- All jobs that need Supabase use the same composite setup. Extract `.github/actions/setup-supabase/action.yml` (new local composite action) to keep duplication down. Each job that needs the DB just does `uses: ./.github/actions/setup-supabase`.
- All jobs share a common "setup pnpm + node + install" preamble. Extract `.github/actions/setup-node/action.yml` (new local composite action).

**Forbidden scope:** any non-`ci.yml` workflow file (release / deploy / scheduled jobs); any production-code change; runbooks; branch protection (stage 3).

**Dependencies:** all of stage 1 merged.

**Spec:**
- Triggers: `on: { pull_request: {}, push: { branches: [main] } }` (unchanged).
- Concurrency: per-ref, cancel-in-progress (unchanged).
- The `policies`, `e2e`, `drift` jobs all run `supabase start`; CI runtime cost is ~2-3min each plus Playwright. Total wall-time target: <15 min for the full matrix.
- Job dependency graph: `lint`, `typecheck`, `build`, `unit`, `policies`, `e2e`, `drift`, `bundle`, `lighthouse` are all top-level (parallel). `e2e` depends on `build` only if we reuse build artifacts; for v1, `e2e` rebuilds and that's OK.
- All jobs that need Supabase secrets read from `${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}` etc. — already in place; reuse.
- For the lighthouse job, the Vercel preview URL discovery: use `nwtgck/actions-netlify`-style waiter, or the official `amondnet/vercel-action@v25`. Document. Acceptable fallback: skip lighthouse if no preview URL is found after 5 minutes and emit a warning (`continue-on-error: true`).

**Definition of done:**
- All 9 jobs declared in `ci.yml`.
- A test PR triggers all jobs; lint/typecheck/build/unit/policies/e2e/drift/bundle return success on a clean diff. Lighthouse may report soft warnings.
- Workflow artifacts are uploaded on failure (Playwright HTML report, bundle analyzer report).
- `gh pr comment` correctly posts the bundle size table.

**Escalation triggers:**
- If Vercel preview URL discovery is brittle and adds >30s of waiting per run.
- If `supabase start` consistently times out in GitHub Actions runners (escalate; fallback is the Postgres service container path per the epic doc).
- If Lighthouse a11y = 100 fails on the first PR — that's a real bug; escalate to identify whether it's a content fix or a structural one.

---

### Stage 3 — Cron observability + runbooks + remaining crons + branch protection (sequential after Stage 2)

#### Slice 3A — Missing cron routes: cleanup-orphan-attachments, purge-trash, compact-positions

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `app/api/cron/cleanup-orphans/route.ts` (new) — hourly. Body delegates to a helper. Uses the same `INTERNAL_CRON_SECRET` Bearer auth + `x-vercel-cron: 1` check + structured logging pattern as the four existing cron routes.
- `app/api/cron/purge-trash/route.ts` (new) — daily at 04:00 UTC. Hard-deletes `board` and `comment` rows soft-deleted >30d ago. Helper: `lib/jobs/purge-trash.ts`.
- `app/api/cron/compact-positions/route.ts` (new) — weekly Sunday 05:00 UTC. Compacts task/group positions on "active" boards (boards modified in the last week). Helper: `lib/jobs/compact-positions.ts`.
- `vercel.json` (edit) — append the three new schedules per the epic doc's spec:
  - `{ "path": "/api/cron/cleanup-orphans", "schedule": "0 * * * *" }`
  - `{ "path": "/api/cron/purge-trash", "schedule": "0 4 * * *" }`
  - `{ "path": "/api/cron/compact-positions", "schedule": "0 5 * * 0" }`
- `lib/jobs/cleanup-orphans.ts`, `lib/jobs/purge-trash.ts`, `lib/jobs/compact-positions.ts` (new) — service-role helpers; structured logging; `Sentry.captureException` on failure (1A is merged by now).
- `tests/unit/jobs/cleanup-orphans.test.ts`, `tests/unit/jobs/purge-trash.test.ts`, `tests/unit/jobs/compact-positions.test.ts` (new).

**Forbidden scope:** any change to the four existing cron routes (they are already correct); any new pgTAP test; any UI work.

**Dependencies:** 1A (Sentry wiring), 1B (logger wrapper) merged.

**Spec:**
- All three handlers are the **same shape** as `app/api/cron/digest/route.ts` from epic 13. Copy the auth + log scaffolding pattern.
- `compact-positions` requires a clear definition of "active board" — use `updated_at > now() - interval '7 days'` on `board` (verify the column exists; if not, use `last_activity_at` or similar — escalate if absent).
- `cleanup-orphans` builds on the orphan-cleanup design that epic 10's design specified; the helper deletes `storage.objects` rows for paths that have no `attachment` row. Lookup the existing detection logic in `lib/attachments/server.ts` and centralize.
- `purge-trash` — uses `adminClient()`; hard-deletes `board` rows where `deleted_at < now() - interval '30 days'` AND `comment` rows likewise.

**Definition of done:**
- All three routes return 200 with a summary JSON in dev (`curl -H "Authorization: Bearer ${INTERNAL_CRON_SECRET}" http://localhost:3000/api/cron/cleanup-orphans`).
- `vercel.json` lists all 7 cron schedules.
- Unit tests pass.
- `pnpm typecheck`, `pnpm lint` green.

**Escalation triggers:**
- If `board.updated_at` does not exist (must be added by a migration — that's an epic-05 backfill, escalate before adding a migration in this epic).
- If `cleanup-orphans` reuses helpers that are tightly coupled to user-context paths (escalate if the helper needs significant refactoring).

---

#### Slice 3B — Runbooks + secrets-rotation script + CHANGELOG

**Owner:** epic-executor (Sonnet). Pure docs + one script. Parallel-safe with 3A.

**Write scope:**
- `docs/runbooks/incident-response.md` (new) — what to do when production breaks: triage (Sentry dashboard, Vercel logs, Supabase logs), severity matrix, on-call rotation placeholder, rollback procedure (Vercel redeploy of a prior deployment by SHA).
- `docs/runbooks/database-restore.md` (new) — how to spin up a new Supabase project from a backup; how to swap connection strings; what to update in Vercel envs. Assumes Supabase Pro daily backups (flag this in the doc).
- `docs/runbooks/rotate-secrets.md` (new) — quarterly rotation procedure for each secret: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `INTERNAL_CRON_SECRET`, `SUPABASE_DB_WEBHOOK_SECRET`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`. List the dashboard/CLI commands; list Vercel env vars to update; list services to re-deploy.
- `docs/runbooks/add-locale.md` (new) — i18n addition steps; references epic 14's i18n-workflow doc.
- `docs/runbooks/add-cell-type.md` (new) — how to extend the cell registry (`lib/cells/`, migrations, server actions, RLS).
- `docs/runbooks/purge-user-data.md` (new) — ad-hoc data-deletion procedure for GDPR-style requests; uses the service-role admin client; documents which tables hold user-keyed rows.
- `docs/runbooks/preview-environments.md` (new) — documents Vercel preview deploys + shared `donezo-preview` Supabase project; explains PR-number namespacing.
- `docs/runbooks/uptime-monitoring.md` (new) — BetterStack signup procedure; how to configure `/api/health` as the check; how to wire alerts.
- `scripts/rotate-secret.sh` (new, executable) — interactive helper:
  - Prompts for which secret to rotate.
  - Calls `vercel env rm <KEY> <ENV>` and `vercel env add <KEY> <ENV>` via the Vercel CLI.
  - Echoes a reminder to also update GitHub Actions repo secrets.
  - Does NOT call into Supabase / Resend / Sentry dashboards (those are manual; documented in the runbook).
- `CHANGELOG.md` (new at repo root) — initial entry. Format: Keep a Changelog (https://keepachangelog.com). Entry: "0.1.0 — 2026-MM-DD — Initial internal release. Epics 01–15. See docs/conversion-plan/ for scope."
- `SECURITY.md` (new at repo root) — brief security contact + secret-rotation cadence statement.

**Forbidden scope:** code changes (other than the rotate-secret script); CI workflow changes (2A owns); cron routes (3A owns).

**Dependencies:** none structurally. Can land in parallel with 3A.

**Spec:**
- Every runbook follows a fixed template: **When to use it**, **Pre-flight**, **Steps** (numbered), **Verification**, **Rollback**, **Related runbooks**.
- The CHANGELOG should not enumerate every commit — keep it summary-level per epic.
- The rotate-secret script is **not** the source of truth for which secrets exist; it reads a list from `lib/env.ts` indirectly (by way of the runbook listing them). The script can be a thin wrapper — the runbook IS the procedure.

**Definition of done:**
- 8 runbook files exist, each following the template.
- `scripts/rotate-secret.sh` is executable and prints help when called with `--help`.
- `CHANGELOG.md` and `SECURITY.md` exist.
- `pnpm lint` doesn't choke (these are .md and .sh, mostly out of scope).

**Escalation triggers:**
- None expected for pure docs.

---

#### Slice 3C — Cron observability wrapper + Sentry on failure

**Owner:** epic-executor (Sonnet). Parallel-safe with 3A/3B; depends on 1A + 3A files existing.

**Write scope:**
- `lib/jobs/wrap-cron.ts` (new) — higher-order wrapper for cron routes:
  ```ts
  export function withCronAuth(handler: (req: NextRequest) => Promise<NextResponse>, opts: { name: string }) {
    return async (req: NextRequest) => {
      // auth check via INTERNAL_CRON_SECRET (factor out the timing-safe compare)
      // log "cron.start" with name + timestamp
      // try { result = await handler(req); log "cron.success" with name + durationMs }
      // catch (err) { log "cron.failure"; Sentry.captureException(err, { tags: { cron: name } }); return 500 }
    };
  }
  ```
- Refactor the seven existing cron route handlers (`notifications-mailer`, `digest`, `due-scanner`, `notification-cleanup`, `cleanup-orphans`, `purge-trash`, `compact-positions`) to use `withCronAuth`. The four pre-existing routes (epic 13) already do this work inline; this slice's refactor is mechanical — extract the duplicated pattern.
- `tests/unit/jobs/wrap-cron.test.ts` (new) — asserts auth rejection, start/success/failure logging, Sentry capture on throw.

**Forbidden scope:** any change to the cron route bodies themselves; any new functionality.

**Dependencies:** 1A merged (Sentry types available); 3A merged (so all 7 routes exist before refactor).

**Spec:**
- The wrapper must be a strict refactor — no behavior changes to the existing handlers. Tests on the existing routes (epic 13's integration scenarios) must continue to pass.
- Auth path: `Authorization: Bearer ${INTERNAL_CRON_SECRET}` via timing-safe compare. Fall back to open-mode in dev with a warning log (matches existing behavior).
- The event names: `cron.start`, `cron.success`, `cron.failure` — match the action log canon from 1B.

**Definition of done:**
- All 7 cron routes use `withCronAuth`.
- The refactor produces no behavior diff (integration tests still pass).
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

**Escalation triggers:**
- If any cron handler has logic in its body that the wrapper would need to fork around (e.g. a route that returns 401 on a different header), escalate before forcing it through the wrapper.

---

#### Slice 3D — Branch protection documentation + verification

**Owner:** epic-executor (Sonnet). Pure-docs + a `gh` script. Strictly sequential — last in stage 3 because the protection rule should be `required: true` for the new CI jobs, which means the jobs must exist (stage 2) and be passing (verified by the prior slices).

**Write scope:**
- `docs/runbooks/branch-protection.md` (new) — documents the desired branch-protection rules for `main`:
  - Require PRs (no direct push).
  - Require status checks to pass before merging: `lint`, `typecheck`, `build`, `unit`, `policies`, `e2e`, `drift`. (`bundle` and `lighthouse` left as soft / `continue-on-error: true` for v1 per Q2 default.)
  - Require branches up-to-date with `main` before merging.
  - Require linear history (squash merges only).
  - Restrict who can push to `main` (admins + the owner).
  - The runbook documents the desired state AND the `gh api` invocation to set it. Does not run the invocation automatically — running it is an explicit ops step.
- `scripts/set-branch-protection.sh` (new, executable) — `gh api -X PUT /repos/{owner}/{repo}/branches/main/protection --input scripts/branch-protection.json`. Sample JSON in `scripts/branch-protection.json`.

**Forbidden scope:** running the script as part of CI (that would lock the operator out of their own repo). The script is for the operator to run once after this epic merges.

**Dependencies:** all of stage 2 merged (so the named CI jobs exist and have stable names).

**Spec:**
- The rule names must EXACTLY match the GitHub Actions job names from `.github/workflows/ci.yml` (stage 2A produced these — `lint`, `typecheck`, etc.). The runbook references them by name.
- Include a note: "Until this script is run, branch protection is NOT in force; the operator must run it. Confirmation: `gh api /repos/{owner}/{repo}/branches/main/protection`."

**Definition of done:**
- The runbook and script exist.
- The operator can copy-paste the run command and have branch protection set in one step.

**Escalation triggers:**
- None.

---

#### Slice 3E — Cross-epic test debt sweep + final review checkpoint

**Owner:** epic-executor (Sonnet). Sequential — runs **after 3A/3B/3C/3D merge**.

**Write scope:**
- `docs/conversion-plan/_dispatch/epic-15-checkpoint-1.md` (new) — final integration report covering:
  - Verify `pnpm test`, `pnpm test:e2e`, `pnpm test:policies` are all green on the merged epic branch.
  - Run a full CI matrix on a dummy PR and confirm every job goes green.
  - Boot `pnpm dev`, throw an error in a Server Action, confirm Sentry receives it (operator step — document the procedure).
  - Confirm `/api/health` returns 200 in dev.
  - Confirm Vercel Analytics fires in production (operator step; document).
  - Confirm Vercel Speed Insights reports for at least one route (operator step; document).
- Resolve any remaining items in `docs/conversion-plan/_dispatch/epic-15-test-debt.md` (1E/1F's output). For each entry:
  - If trivially fixable in this slice, fix it.
  - If non-trivial, file a "needs followup" entry and escalate the bug back to the relevant epic owner via a comment in the checkpoint doc.

**Forbidden scope:** any structural code change. Only fixes to genuinely-trivial test-debt items.

**Dependencies:** all of stage 1, 2, 3A-3D merged.

**Spec:**
- This slice is the "epic done" gate. It produces a single source of truth (the checkpoint doc) the reviewer will read.

**Definition of done:**
- Checkpoint doc lists every DoD item from epic 15 with a verification line.
- Any test debt is documented as resolved or explicitly deferred with a justification.

**Escalation triggers:**
- If >3 DoD items remain unverified (escalate; the epic isn't done yet).

---

## Sequential follow-ups (post-merge)

- **R1 — Opus review pass.** `/execute-epic` dispatches the `epic-researcher` to audit the merged diff against the 11-item Definition of done in `docs/conversion-plan/15-observability-testing-cicd.md`. Followups, if any, ship as `docs/conversion-plan/_dispatch/epic-15-followup-N.md` per the standard loop. Loop until clean.
- **R2 — Operator ops actions (not blocking the merge, listed for the checkpoint doc):**
  - Create a Sentry org + project; populate `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in Vercel envs.
  - Sign up for BetterStack free tier; point uptime check at `/api/health`.
  - Run `scripts/set-branch-protection.sh` to lock down `main`.
  - Verify Supabase Pro tier is active; confirm daily backups visible in the dashboard.
  - Practice the database-restore runbook once on a staging project.
- **R3 — Deferred items explicitly scoped out:** Lighthouse perf budget enforcement (soft for v1 per Q2); `release-please` (skipped per Q6); Vercel feature flags (skipped per Q4); Datadog/Logtail (skipped per epic doc); PITR upgrade (Q9).

---

## Risk notes

- **Supabase-in-CI is the single biggest new piece of infra.** `supabase start` in GH Actions runs Docker; runs are typically reliable but add ~90s per job. If runs become flaky, the fallback is the epic-doc-proposed Postgres-service-container approach (no Supabase CLI), which gets pgTAP but not the auth fixture trivially. Plan in 1F + 2A keeps the Supabase-CLI path; document the fallback in `tests/e2e/README.md`.
- **Visual snapshot brittleness.** First-run snapshots will be platform-specific (macOS-local vs Linux-CI fonts will differ). Strategy: snapshot under Linux only via `docker run --rm -v $PWD:/work -w /work mcr.microsoft.com/playwright:v1.60.0-jammy pnpm test:e2e:visual --update-snapshots` for the initial baseline, OR set `playwright.config.ts` to skip visual specs locally on macOS and only run them in CI. 1F's executor must pick one approach and document.
- **Sentry cost.** Free tier ceiling is 5k errors/month — once we have real users, a noisy bug could exhaust it in a day. Document the upgrade path in `docs/runbooks/rotate-secrets.md` or a new doc. Not blocking v1.
- **CI minutes.** GitHub Actions free tier on a private repo: 2,000 min/month. Full matrix (~15 min wall-time, ~50 min CPU-time) per PR fits well. If the team grows to several PRs/day, may need to bump tiers.
- **`with-user.ts` is touched by 1A and 1B.** Sequenced: 1A first, then 1B rebases. The edits are non-overlapping in practice (1A adds a Sentry call, 1B adds three logger calls), but the diff context lines collide. Orchestrator must enforce the order.
- **`app/(app)/error.tsx` and `app/error.tsx` are only touched by 1A.** 1D adds **new** segment boundaries (workspace, board, notifications) — no overlap. Reviewer should still spot-check that 1D's new files don't replicate Sentry wiring (1A owns that).
- **Un-skipping unit + e2e tests will reveal real bugs.** This is the point — the skips have been hiding them. The triage rule (un-skip; if broken, document in `epic-15-test-debt.md`, don't fix in this epic) keeps scope bounded. Reviewer should ensure the debt doc is honest, not a hiding place.
- **The CI matrix in 2A spans 9 jobs across many composite actions and secrets.** A common failure mode: composite actions reference missing inputs. Test the workflow on a draft PR before declaring 2A done.
- **`@sentry/nextjs` source-map upload at build time** requires `SENTRY_AUTH_TOKEN`; if absent, the plugin warns and continues. Confirm `pnpm build` works without the token (it does, per Sentry docs). 1A's executor must verify.
- **Vercel preview environments + shared Supabase preview project** means PR1 and PR2 might collide on slugs / workspace names. Q5 default mitigates via PR-number namespacing, but this is a real risk for multi-PR development. Acceptable for v1.
- **The 88 files with `describe.skip` / `test.skip`** include some that were genuinely speculative (test bodies for functions that don't yet exist). The executor must distinguish "skip because vitest wasn't wired" (un-skip now) from "skip because the implementation isn't here yet" (delete the file or convert to `it.todo`). This judgment is part of the slice work, not a separate decision.
- **`global-error.tsx` opts out of the root `<html>` / `<body>` chain** — it MUST render its own `<html>` and `<body>`. 1A's executor should consult Next.js 15 docs before assuming it inherits from `app/layout.tsx` (it does not, by design).
- **The 1F seed-DB additions in `supabase/seed.sql`** must not break any existing dev workflow. Use `on conflict do nothing` and avoid touching the existing seed user. Reviewer to verify.

---

## Stage execution order (for `/execute-epic`)

1. **Stage 1a** — dispatch 1A, 1C, 1D, 1E, 1F, 1G in parallel.
2. **Stage 1b** — once 1A merges into the epic branch, dispatch 1B (small rebase).
3. **Stage 2** — once ALL of 1A–1G have merged, dispatch 2A.
4. **Stage 3a** — once 2A has merged, dispatch 3A and 3B in parallel.
5. **Stage 3b** — once 3A merges, dispatch 3C.
6. **Stage 3c** — once 3C, 3A, 3B have merged, dispatch 3D and 3E in parallel.
7. **Review pass** (`epic-researcher` over the merged diff) → followups, if any, until clean.
8. **Operator ops actions** per R2.
9. **Epic 15 PRs into `main`.** Donezo conversion complete.

---

## Files of interest (absolute paths)

Core repo state already verified:
- `/Volumes/SSD1T/DEV WORK/donezo/CLAUDE.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/00-overview.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/15-observability-testing-cicd.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-13.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-14.md`
- `/Volumes/SSD1T/DEV WORK/donezo/package.json`
- `/Volumes/SSD1T/DEV WORK/donezo/.github/workflows/ci.yml`
- `/Volumes/SSD1T/DEV WORK/donezo/vercel.json`
- `/Volumes/SSD1T/DEV WORK/donezo/next.config.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/playwright.config.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/vitest.config.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/biome.json`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/logger.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/actions/with-user.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/env.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/admin.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/layout.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/error.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/error.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/not-found.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/api/cron/digest/route.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/api/cron/due-scanner/route.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/api/cron/notification-cleanup/route.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/api/cron/notifications-mailer/route.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/README.md`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/00_setup.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/integration/notifications-e2e.test.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/a11y/board.a11y.spec.ts` (representative un-skip target)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/setup.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/seed.sql`

Files this plan instructs slices to create (write-scope summary):
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` (1A)
- `app/global-error.tsx`, `app/(app)/w/[workspaceSlug]/b/[boardId]/error.tsx`, `app/(app)/w/[workspaceSlug]/error.tsx`, `app/(app)/notifications/error.tsx` (1A + 1D)
- `app/api/health/route.ts` (1D)
- `lib/sentry/scrub.ts` (1A); `lib/analytics.ts` (1C); `lib/jobs/wrap-cron.ts`, `lib/jobs/{cleanup-orphans,purge-trash,compact-positions}.ts` (3A + 3C)
- `app/api/cron/{cleanup-orphans,purge-trash,compact-positions}/route.ts` (3A)
- `tests/e2e/global-setup.ts`, `tests/e2e/fixtures/seed.ts`, `tests/e2e/.auth/.gitignore`, `tests/e2e/README.md` (1F)
- `tests/policies/run.sh` (1G)
- `.github/actions/setup-supabase/action.yml`, `.github/actions/setup-node/action.yml`, `.github/workflows/lighthouserc.json` (2A)
- `docs/runbooks/{incident-response,database-restore,rotate-secrets,add-locale,add-cell-type,purge-user-data,preview-environments,uptime-monitoring,branch-protection}.md` (3B + 3D); `CHANGELOG.md`, `SECURITY.md`, `scripts/{rotate-secret,set-branch-protection}.sh`, `scripts/branch-protection.json` (3B + 3D)
- `docs/conversion-plan/_dispatch/epic-15-error-boundary-audit.md` (1D), `docs/conversion-plan/_dispatch/epic-15-test-debt.md` (1E/1F), `docs/conversion-plan/_dispatch/epic-15-checkpoint-1.md` (3E)
