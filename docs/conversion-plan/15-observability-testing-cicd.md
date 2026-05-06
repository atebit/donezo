# Epic 15 — Observability, Testing, and CI/CD

## Goal

Make the system safe to operate. Sentry catches runtime errors, structured logs are searchable, Vercel Analytics + Speed Insights track real-user performance. The test pyramid (unit → policy → E2E) runs on every PR via GitHub Actions. Preview environments mirror production. Scheduled jobs (digest, due-soon scanner, cleanup, position compaction) run reliably.

## Why this is its own epic

Observability and CI/CD usually start as the missing tasks at the bottom of every other epic; consolidating them here ensures they actually ship. Every prior epic stubbed test/CI work that ties off here.

## In scope

- Sentry: client + server + edge. Source maps. Release tracking.
- Structured logging via Pino, ingested by Vercel.
- Vercel Analytics + Speed Insights.
- Error boundaries everywhere with friendly fallbacks.
- Test framework: Vitest (unit), Playwright (E2E), pgTAP (RLS policies).
- GitHub Actions CI: lint, typecheck, build, unit tests, policy tests, E2E.
- Schema-drift check.
- Preview-deploy environments: Vercel + per-PR Supabase branch (or shared preview project).
- Scheduled jobs: digest, due-soon scanner, orphan attachment cleanup, position compaction, activity TTL, soft-delete purge.
- Healthcheck endpoint.
- Bundle analysis on PR.
- Performance budgets enforced.
- Release process: SemVer tags, changelog, deploy gates.

## Out of scope

- Paid APM beyond Sentry (Datadog, etc.).
- Long-term log retention (Vercel default suffices).
- SOC2 / compliance work.
- Status page (Statuspage / OhDear).

## Dependencies

All prior epics. Most of this work runs alongside [05](05-workspaces-boards.md)+ rather than waiting for [14](14-mobile-a11y-polish.md).

## Architecture & design choices

### Sentry

Three Sentry SDKs:

- `@sentry/nextjs` covers RSC, Server Actions, route handlers, and client.
- Configured via `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
- DSNs and auth token in Vercel envs; source maps uploaded automatically by the Sentry Next.js plugin.
- Release tagged with the Vercel commit SHA.

Capture:

- All thrown exceptions in Server Actions (the `withUser` wrapper sends "internal" errors to Sentry with full context).
- Client error boundaries.
- React Server Component errors.
- Failed `supabase` calls — wrap critical paths with explicit `Sentry.captureException(error, { extra: ... })`.

Suppress:

- Expected `forbidden`, `not_found` errors from Server Actions (these are user-facing, not bugs).
- Realtime disconnects with auto-reconnect.

User context: set on every request via the auth middleware. Scrub PII (email) — use `user.id` only.

### Structured logs

`lib/logger.ts` exports a Pino logger. In dev, pretty-printed; in production, JSON to stdout (Vercel ingests).

Pattern:

```ts
logger.info({ event: 'task.created', boardId, taskId, userId }, 'Task created');
logger.error({ err, boardId }, 'Failed to load board');
```

Don't log PII (email, names) — log ids and let the operator look up.

Server actions log start + end + duration:

```ts
const start = Date.now();
logger.info({ event: 'action.start', name: 'createBoard', userId }, 'Action start');
try {
  const result = await fn();
  logger.info({ event: 'action.success', name: 'createBoard', durationMs: Date.now() - start }, 'Action success');
  return result;
} catch (err) {
  logger.error({ event: 'action.failure', name: 'createBoard', err, durationMs: Date.now() - start }, 'Action failure');
  throw err;
}
```

A higher-order wrapper does this once.

### Analytics

- **Vercel Web Analytics**: privacy-friendly, no cookie banner, page views + custom events.
- **Vercel Speed Insights**: Core Web Vitals (LCP, FID, CLS) per route.

Custom events: `board.created`, `task.added`, `comment.posted`. Lightweight; for product insight, not engineering.

### Error boundaries

`app/error.tsx` — global. Renders a friendly "Something went wrong" page with a "Try again" button (resets the error boundary) and a Sentry Report button.

Per-segment `error.tsx` in `app/(app)/error.tsx` and `app/(app)/w/[slug]/b/[boardId]/error.tsx` so a board crash doesn't destroy the sidebar.

### Healthcheck

`app/api/health/route.ts`:

```ts
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from('workspace').select('id').limit(1);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 503 });
  return Response.json({ ok: true, sha: process.env.VERCEL_GIT_COMMIT_SHA, ts: Date.now() });
}
```

Used by uptime monitors (e.g., BetterStack).

### Test pyramid

**Unit (Vitest)** — fast, run on every PR.

- `lib/positions.ts` — fractional indexing math.
- `lib/cells/*/def.ts` — codecs, comparators, filter matchers, conversions.
- `stores/board-store.ts` — idempotent applies.
- `lib/notifications/emitters.ts` — emit decisions.
- `lib/auth/`, `lib/authorization/` — role math.

Target: ~500 unit tests by v1, mostly cell-type definitions.

**Policy (pgTAP)** — RLS coverage; runs against an ephemeral Postgres in CI.

- One file per domain (`workspace.sql`, `board.sql`, `cell.sql`, `comment.sql`, ...).
- Each role × each operation = an assertion.
- Verify the negative cases as much as the positive.
- Run via `pg_prove` against `psql`.

Target: ~80 assertions.

**E2E (Playwright)** — slowest, run on every PR with parallelism.

- Critical paths: sign in (Google + email), create board, add tasks, edit cells, post comment with mention, drag-reorder, switch view kind, set notification preferences, accept invitation.
- Two-client tests for Realtime: client A edits; client B sees within 1s.
- Mocked email via Inbucket / mailpit.
- Visual snapshots at three viewports for key pages.

Target: ~30 E2E tests, all under 5 minutes total.

### Test data

Seed scripts (in `tests/fixtures/`) create deterministic users, workspaces, boards. Each test cleans up via `supabase db reset` or transactional rollback (where pgTAP runs).

For E2E, a per-worker isolated Supabase project (or schema) is the gold standard. Practical compromise: shared CI Supabase preview project, each test uses unique ids and cleans up.

### CI workflows (GitHub Actions)

Single `.github/workflows/ci.yml`:

```yaml
name: CI
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
  unit:
    runs-on: ubuntu-latest
    steps:
      # ... same setup
      - run: pnpm test
  policies:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      # ... checkout, install
      - run: supabase db reset --linked-db postgresql://postgres:postgres@localhost:5432/postgres
      - run: pg_prove tests/policies/*.sql
  e2e:
    runs-on: ubuntu-latest
    steps:
      # ... checkout, install, start supabase locally, build, start app
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
  build:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm build
```

All four jobs run in parallel; PR merges only when all pass.

### Schema drift check

A `drift` job runs `supabase db diff --linked` against a `donezo-ci` Supabase project. Fails if migrations don't match. This catches "someone edited the schema in the dashboard" mistakes.

### Preview environments

Vercel auto-deploys preview per PR.

For Supabase, two options:

- **Shared preview project**: all PRs target one Supabase. Fast; risk of test interference. Use unique workspace per PR (slug includes PR number).
- **Supabase branching** (in beta): per-PR Supabase project. Cleaner; pricey at scale.

**Choice: shared preview project for v1.** Revisit branching when team size grows.

### Scheduled jobs

Supabase Edge Functions on a schedule via `pg_cron` (Pro tier) or external scheduler (GitHub Actions cron, Vercel cron):

| Job | Schedule | Source |
|---|---|---|
| Mailer (instant emails) | event-driven (DB webhook) | [13](13-notifications.md) |
| Mailer fallback poller | every 5 min | [13](13-notifications.md) |
| Daily digest | every 15 min | [13](13-notifications.md) |
| Due-soon scanner | hourly | [13](13-notifications.md) |
| Orphan attachment cleanup | hourly | [10](10-attachments.md) |
| Soft-delete purge (boards >30d) | daily | [05](05-workspaces-boards.md) |
| Soft-delete purge (comments >30d) | daily | [09](09-comments-activity.md) |
| Position compaction (active boards) | weekly | [06](06-groups-tasks-table.md) |
| Activity TTL (none for v1; placeholder) | — | [09](09-comments-activity.md) |

Use **Vercel Cron** for HTTP-pingable Edge Functions (we deploy them as Next.js route handlers under `app/api/cron/`). Vercel Cron has a per-route auth header; reject pings without it. This avoids Supabase pg_cron Pro requirement and keeps scheduled work in one repo.

```ts
// app/api/cron/due-soon/route.ts
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  await runDueSoonScanner();
  return Response.json({ ok: true });
}
```

`vercel.json` declares cron schedules:

```json
{
  "crons": [
    { "path": "/api/cron/due-soon", "schedule": "0 * * * *" },
    { "path": "/api/cron/digest", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/cleanup-orphans", "schedule": "0 * * * *" },
    { "path": "/api/cron/purge-trash", "schedule": "0 4 * * *" },
    { "path": "/api/cron/compact-positions", "schedule": "0 5 * * 0" }
  ]
}
```

### Bundle analysis

`@next/bundle-analyzer` enabled when `ANALYZE=true`. A GitHub Action job runs the analyzer on PR and comments the diff vs main.

Budget: each route ≤ 300KB gzip initial JS. CI fails if a route exceeds.

### Performance budgets

A `perf` job runs Lighthouse CI against the Vercel preview deployment. Budgets:

- Performance ≥ 85
- Accessibility = 100
- Best Practices ≥ 95
- LCP < 2.5s
- CLS < 0.1
- TBT < 200ms

Fail the PR if any budget regresses.

### Release process

- Trunk-based. `main` always deployable.
- Semver tags on releases (`v0.1.0` etc.).
- Auto-generated changelog via `release-please` or manual.
- Vercel auto-deploys `main` to production.
- "Roll back" = redeploy a previous Vercel deployment.

### Database backups

Supabase Pro includes daily backups + 7-day retention. PITR (Point-in-Time Recovery) available on higher tiers. For internal release, daily is enough; revisit when criticality grows.

Document the restore procedure in a runbook. Include: how to spin up a new project from a backup, how to swap connection strings.

### Runbooks

`docs/runbooks/`:

- `incident-response.md` — what to do when production breaks.
- `database-restore.md` — how to restore from backup.
- `rotate-secrets.md` — Supabase keys, Resend keys, etc.
- `add-locale.md` — i18n addition steps.
- `add-cell-type.md` — extending the cell registry.
- `purge-user-data.md` — for ad-hoc data deletion (GDPR-style requests, even if internal-only initially).

### Secrets

All secrets live in Vercel envs (production, preview, development). Never in code. `lib/env.ts` validates at boot.

Rotation procedure documented; rotate on suspicion or quarterly.

Service-role Supabase key is the most sensitive — limit imports of `lib/supabase/admin.ts` via ESLint rule.

## Tasks

### Sentry & logging

1. **Install `@sentry/nextjs`**, configure client/server/edge.
2. **Wire Sentry into the `withUser` action wrapper** for "internal" errors.
3. **Configure source-map upload** via Sentry's Next.js plugin.
4. **Pino logger** with dev pretty + production JSON.
5. **Action logging wrapper** logs start/success/failure with duration.

### Analytics

6. **Enable Vercel Analytics + Speed Insights** in the layout.
7. **Custom events** for top-funnel actions.

### Error boundaries

8. **Global, segment-scoped error boundaries** (audit existing from [01](01-foundation.md)).

### Tests

9. **Vitest config** (already in [01](01-foundation.md); flesh out).
10. **Cell type test suite** — codecs, conversions, comparators, matchers per type.
11. **Store test suite** — idempotent applies, position math.
12. **Server-action tests** — mock Supabase; verify auth/authz behavior.
13. **pgTAP test suite** ([04](04-authorization-rls.md) drafted; expand here).
14. **Playwright suite** — critical paths + Realtime two-client + visual snapshots.

### CI/CD

15. **GitHub Actions `ci.yml`** with lint/typecheck/unit/policies/e2e/build/perf jobs.
16. **Schema drift job**.
17. **Bundle analyzer job** with PR comment.
18. **Lighthouse CI job** with budgets.
19. **Branch protection on `main`**: all jobs required.
20. **Vercel preview deploys** verified; preview Supabase env wired.

### Scheduled jobs

21. **Cron route handlers** under `app/api/cron/` with auth-header check.
22. **`vercel.json` crons**.
23. **`due-soon-scanner`** ([13](13-notifications.md)).
24. **`digest`** ([13](13-notifications.md)).
25. **`mailer-fallback-poller`** ([13](13-notifications.md)).
26. **`cleanup-orphan-attachments`** ([10](10-attachments.md)).
27. **`purge-trash`** ([05](05-workspaces-boards.md), [09](09-comments-activity.md)).
28. **`compact-positions`** ([06](06-groups-tasks-table.md)).
29. **Cron observability**: log every run; Sentry on failure.

### Operations

30. **Healthcheck endpoint**.
31. **Set up uptime monitor** (BetterStack free tier; pings `/api/health`).
32. **Runbooks** in `docs/runbooks/`.
33. **Backup verification**: confirm Supabase Pro daily backups; test restore once.
34. **Rotate-secrets procedure** documented.

## Definition of done

- Sentry catches a forced exception in dev and shows it in the dashboard.
- Vercel logs show structured JSON for server actions.
- Real-user CWV reported in Vercel Speed Insights.
- All test types pass on PR; merge blocked when any fail.
- Schema drift check fails when a migration is missing.
- Preview deploys spin up per PR with seeded data.
- Scheduled crons all run on schedule and log success.
- Bundle analyzer comments size diff on every PR.
- Lighthouse budgets enforced; budget regression fails PR.
- A practiced backup-restore drill works.
- Runbooks exist for the core operational scenarios.

## Open questions

- **Sentry tier**. Free tier should suffice for internal v1; revisit at scale.
- **Lighthouse CI**: against preview vs production. Preview is fine; production is more representative but adds latency.
- **Synthetic tests**: continuous Playwright against production every hour? Useful but defer.
- **Logs ingestion**: Vercel logs vs ship to Datadog/Logtail. Vercel default for v1.
- **PITR (Point-in-Time-Recovery)**: Supabase higher tier. Internal release OK with daily; flag the upgrade for production-y use cases.
- **Performance budgets per page**: enforced today (LCP, CLS), but should we also gate on Time to Interactive? TBT is a reasonable proxy.
- **Feature flags**: useful for staged rollout; Vercel Edge Config or PostHog. Not blocking; revisit.
- **Localized error messages** in Sentry vs en-US. Standardize on en-US for engineering surfaces; UI error messages localize via i18n in [14](14-mobile-a11y-polish.md).
