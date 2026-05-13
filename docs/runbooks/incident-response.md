# Incident Response

## When to use this runbook

Use this runbook when production is degraded or down: users reporting 5xx errors,
elevated Sentry error rates, a failed health check, or any observable customer-facing
breakage.

## Pre-flight

- Confirm you have access to:
  - [Sentry dashboard](https://sentry.io) — project `donezo`
  - [Vercel dashboard](https://vercel.com) — project `donezo`
  - [Supabase dashboard](https://supabase.com) — project `donezo`
- Notify the team that an incident is in progress (Slack `#incidents` or equivalent).
- Open a fresh terminal with the Vercel CLI authenticated (`vercel whoami`).

## Severity matrix

| Level | Description | Response time | Example |
|-------|-------------|---------------|---------|
| **P0** | Total production outage — no user can log in or load any page | Immediate, all hands | Database unreachable; Vercel deployment crashed |
| **P1** | Core feature broken for all users | < 30 min | Task mutations returning 500; auth callback loop |
| **P2** | Feature broken for a subset of users, workaround exists | < 2 h | Attachment uploads failing for one browser; notification emails not sending |
| **P3** | Cosmetic or minor degradation | Next business day | Wrong date format displayed; minor visual regression |

## Steps

### 1. Triage

1. **Sentry dashboard** — navigate to `Issues`, filter by `is:unresolved` and sort by
   `Last Seen`. Look for a spike in the error count in the last 15 minutes. Note the
   first occurrence timestamp, the affected transaction/route, and the stack trace.
2. **Vercel logs** — open the `donezo` project → `Deployments` → the most recent
   deployment → `Functions` tab. Filter for `error` or HTTP 5xx responses. Note the
   function name and invocation ID.
3. **Supabase logs** — open the Supabase dashboard → `Logs` → `Postgres` and
   `Edge Functions` tabs. Check for `FATAL`, `ERROR`, or high latency entries around
   the incident start time.
4. **Health check** — `curl -s https://<your-domain>/api/health | jq .` confirms
   whether the app server and DB connection are up.
5. Correlate timestamps across all three sources to identify the root cause.

### 2. Classify severity

Use the severity matrix above. Assign a P-level and communicate it.

### 3. On-call rotation

_Placeholder — update this section once the team and schedule are defined._

| Week | Primary | Secondary |
|------|---------|-----------|
| TBD  | TBD     | TBD       |

### 4. Rollback procedure

**Option A — Vercel instant rollback (preferred for deployment-introduced regressions)**

```bash
# List recent deployments (install Vercel CLI: pnpm add -g vercel)
vercel ls donezo

# Roll back to the previous deployment (interactive — it picks the last one)
vercel rollback
```

Or from the Vercel dashboard: `Deployments` → find the last known-good deployment
by its SHA → click `...` → `Promote to Production`.

**Option B — Redeploy a specific git SHA**

```bash
git checkout <known-good-sha>
git push vercel <known-good-sha>:main --force-with-lease
```

Or: push a revert commit to `main` and let CI redeploy.

**Option C — Database emergency**

- If the Supabase project is unreachable, follow the
  [database-restore runbook](database-restore.md).
- If a bad migration was applied, revert it manually via `supabase db reset` on a
  local clone first, verify, then apply the reverse migration in production.

### 5. Communicate

Post a status update to affected stakeholders with:
- What broke
- When it broke
- What was done
- Current status (resolved / monitoring / investigating)

### 6. Post-incident

- Write a brief post-mortem in the incident Slack thread or a shared doc.
- File a GitHub issue for the root cause with label `incident`.
- Add any new alerting or monitoring gaps to the backlog.

## Verification

After rollback or fix:
1. `curl -s https://<your-domain>/api/health | jq .` returns `{ "status": "ok" }`.
2. Sentry error rate returns to baseline (check the `Issues` sparkline).
3. Do a manual smoke test: sign in, load a board, edit a cell, post a comment.

## Rollback

This runbook describes rollback procedures in **Steps, section 4** above. There is no
separate rollback for the runbook itself.

## Related runbooks

- [database-restore.md](database-restore.md) — restore from Supabase backup
- [rotate-secrets.md](rotate-secrets.md) — if the incident involves a leaked secret
- [uptime-monitoring.md](uptime-monitoring.md) — configure proactive alerts
