# Database Restore

## When to use this runbook

> **Requirement:** This procedure assumes the Supabase project is on the **Pro plan**
> (or higher), which includes automated daily point-in-time backups. Free-tier
> projects do NOT have automatic backups. Verify your plan before an incident occurs.

Use this runbook when:
- The production Supabase project is corrupted, deleted, or otherwise unrecoverable.
- You need to spin up a new Supabase project from a backup and redirect the app to it.
- You are performing a disaster-recovery drill.

## Pre-flight

- Confirm you have Owner access to the Supabase organisation.
- Confirm you have Owner/Admin access to the Vercel project.
- Identify the target restore point (date + time in UTC).
- Notify the team that a database restore is in progress. Production will be read-only
  or unavailable during the cutover window.
- Have the Vercel CLI installed and authenticated (`vercel whoami`).

## Steps

### 1. Restore a backup in Supabase

**Option A — Point-in-time restore within the same project (Pro plan)**

1. Open the Supabase dashboard → your project → `Database` → `Backups`.
2. Select `Point in Time Recovery` and choose the restore timestamp.
3. Confirm. Supabase replays WAL logs up to the selected point.
4. The project URL and keys do NOT change. Skip to **Step 3**.

**Option B — Restore to a new Supabase project**

Use this option if the original project is deleted or you need a parallel environment.

1. **Create a new Supabase project** in the same organisation and region. Name it
   `donezo-restored-YYYYMMDD` or similar.
2. Download the backup from the original project's `Backups` tab (`.dump` file).
   If the original project is gone, contact Supabase support with your project ref
   and the target restore point — they can provide the dump.
3. Restore the dump into the new project:
   ```bash
   # Get the DB connection string from the new project's Settings > Database
   # Example: postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
   psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
     -f path/to/backup.dump
   ```
4. Re-apply any migrations that were applied after the backup point (they live in
   `supabase/migrations/` in git):
   ```bash
   supabase db push --db-url "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
   ```

### 2. Collect the new project's connection details

From the new project's dashboard → `Settings` → `API`:

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role key |
| DB connection string | Settings → Database → Connection string |

From `Settings` → `Database` → `Webhooks` (if used):
- Regenerate `SUPABASE_DB_WEBHOOK_SECRET` if it changed.

### 3. Update Vercel environment variables

For each of the three environments (`production`, `preview`, `development`) that need
updating:

```bash
# Remove old value
vercel env rm NEXT_PUBLIC_SUPABASE_URL production
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env rm SUPABASE_SERVICE_ROLE_KEY production

# Add new value (Vercel CLI will prompt for the value)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

Alternatively, use the Vercel dashboard: `Settings` → `Environment Variables`.

Also update in GitHub Actions repo secrets if they are referenced there
(`Settings` → `Secrets and variables` → `Actions`).

### 4. Redeploy the app

```bash
vercel --prod
```

Or trigger a redeploy from the Vercel dashboard: `Deployments` → `Redeploy`.

### 5. Re-enable Supabase Realtime (if using a new project)

In the new project's dashboard, enable the Realtime extension and re-add any
publication tables that Realtime was subscribed to.

### 6. Verify DNS / custom domain

If the new project was assigned a new subdomain, update any custom domain or CNAME
records that pointed at the old Supabase project.

## Verification

1. `curl -s https://<your-domain>/api/health | jq .` returns `{ "status": "ok" }`.
2. Sign in with a known account — confirm data is present up to the restore point.
3. Create a test task, edit a cell — confirm writes succeed.
4. Check Sentry for any new errors introduced by the cutover.

## Rollback

If the new project introduces unexpected issues and the original project is still
accessible:
1. Revert the Vercel environment variables to point at the original project.
2. Redeploy.
3. Investigate the new project separately before retrying the cutover.

## Related runbooks

- [incident-response.md](incident-response.md) — overall incident triage
- [rotate-secrets.md](rotate-secrets.md) — update keys after restore
