# Preview Environments

## When to use this runbook

Use this runbook to:
- Understand how Vercel preview deployments work for this project.
- Configure or troubleshoot the shared `donezo-preview` Supabase project.
- Understand the workspace-slug namespacing convention for preview environments.

## Pre-flight

- Confirm you have access to the Vercel dashboard for the `donezo` project.
- Confirm the `donezo-preview` Supabase project exists and is accessible.
- For first-time setup, you need the Vercel CLI authenticated (`vercel whoami`).

## How preview environments work

Every pull request opened against `main` receives a Vercel preview deployment
automatically. Vercel detects the push to a non-`main` branch, builds the app,
and assigns a URL of the form:

```
https://donezo-<branch-slug>-<team>.vercel.app
```

or a stable per-PR alias:

```
https://donezo-pr-<PR_NUMBER>-<team>.vercel.app
```

These deployments are isolated at the **app layer** but share a single Supabase
project — `donezo-preview` — to avoid the cost and setup time of spinning up a
fresh Supabase instance per PR.

## The `donezo-preview` Supabase project

The `donezo-preview` Supabase project is a long-lived staging database shared by
all preview deployments. It has the same schema as production (migrations are applied
here too) but contains synthetic or test data.

**Connection details are stored as Vercel environment variables scoped to `preview`:**

```
NEXT_PUBLIC_SUPABASE_URL     (preview scope)
NEXT_PUBLIC_SUPABASE_ANON_KEY (preview scope)
SUPABASE_SERVICE_ROLE_KEY    (preview scope)
```

These are distinct from the `production` env vars.

## PR-number namespacing for workspace slugs

Because all preview deploys share one database, workspaces created during testing
must be namespaced to avoid slug collisions between PRs.

**Convention:** prefix workspace slugs with `pr-<PR_NUMBER>-` during preview tests.

Example: if PR #42 creates a test workspace, its slug should be `pr-42-my-workspace`.

This convention is enforced by convention, not by code. Automated tests
(Playwright e2e) should follow this pattern when seeding data.

**Cleanup:** workspace slugs with the `pr-<N>-` prefix can be bulk-deleted from the
`donezo-preview` database after a PR is merged or closed:

```sql
-- Run in Supabase SQL editor (preview project, service-role)
DELETE FROM public.workspace WHERE slug LIKE 'pr-42-%';
```

A periodic cleanup script can sweep stale PR namespaces:

```sql
-- Delete workspaces for PRs older than 30 days (adjust the date as needed)
DELETE FROM public.workspace
WHERE slug ~ '^pr-\d+-'
  AND created_at < now() - interval '30 days';
```

## Steps

### First-time setup of `donezo-preview`

1. **Create the Supabase project** named `donezo-preview` in the same region as
   production.
2. **Apply all migrations:**
   ```bash
   supabase db push --db-url "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
   ```
3. **Seed synthetic data** (optional):
   ```bash
   psql "<connection-string>" -f supabase/seed.sql
   ```
4. **Add env vars to Vercel for the `preview` environment:**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL preview
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
   vercel env add SUPABASE_SERVICE_ROLE_KEY preview
   vercel env add INTERNAL_CRON_SECRET preview
   vercel env add SUPABASE_DB_WEBHOOK_SECRET preview
   vercel env add RESEND_API_KEY preview
   vercel env add NEXT_PUBLIC_SENTRY_DSN preview
   vercel env add SENTRY_DSN preview
   vercel env add SENTRY_AUTH_TOKEN preview
   ```

### Applying a migration to `donezo-preview`

Migrations should be applied to `donezo-preview` **before** merging to `main`
(so preview deployments don't break when the app code depends on new schema):

```bash
supabase db push --db-url "postgresql://postgres:<password>@db.<preview-ref>.supabase.co:5432/postgres"
```

### Viewing preview deploy logs

From the Vercel dashboard: `Deployments` → select a preview deployment → `Functions`
tab for runtime logs, `Build` tab for build logs.

Or via CLI:
```bash
vercel logs <deployment-url>
```

## Verification

- Open the preview deploy URL for an open PR.
- Confirm the app loads and connects to the `donezo-preview` Supabase project
  (check `/api/health` on the preview URL).
- Sign in with a test account and confirm workspace creation works with the PR-prefixed slug.

## Rollback

Preview environments are ephemeral — there is nothing to roll back. If a preview
environment is broken:
1. Fix the branch and push — Vercel automatically rebuilds.
2. If the `donezo-preview` database is corrupted, reset it:
   ```bash
   supabase db reset --db-url "<preview-connection-string>"
   supabase db push --db-url "<preview-connection-string>"
   ```

## Related runbooks

- [database-restore.md](database-restore.md) — if `donezo-preview` needs a full restore
- [incident-response.md](incident-response.md) — if a preview deploy reveals a production-bound bug
