# Rotate Secrets

## When to use this runbook

Run this procedure **quarterly** (every 3 months) or immediately if:
- A secret is suspected to be leaked or exposed in logs/git history.
- An employee with access to secrets leaves the organization.
- A vendor signals a breach or key compromise.

The interactive helper script `scripts/rotate-secret.sh` automates the Vercel
portion of the rotation. The per-service steps (generating a new key) must be done
manually in each dashboard as documented below.

## Pre-flight

- Confirm you have Owner/Admin access to: Vercel, Supabase, Resend, Sentry, GitHub.
- Schedule a low-traffic maintenance window if rotating `SUPABASE_SERVICE_ROLE_KEY`
  or `SUPABASE_DB_WEBHOOK_SECRET` (brief downtime possible during redeploy).
- Have the Vercel CLI installed and authenticated (`vercel whoami`).
- Tell the team before starting — parallel deploys or cron jobs running during
  rotation may fail with auth errors.

## Steps

Rotate each secret in order. Each section follows the same pattern:
1. Generate a new secret in the relevant dashboard.
2. Update Vercel environment variables.
3. Update GitHub Actions repo secrets.
4. Trigger a redeploy.

---

### SUPABASE_SERVICE_ROLE_KEY

**What it is:** The Supabase service-role JWT that bypasses RLS. Used in server-only
code paths (cron jobs, admin actions, webhooks).

**Generate new key:**
1. Supabase dashboard → `Settings` → `API`.
2. Click `Reset service_role key`. Copy the new value.
   (Note: this also immediately invalidates the old key.)

**Update Vercel:**
```bash
vercel env rm SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Repeat for preview and development environments as needed
```

**Update GitHub Actions:**
`GitHub repo` → `Settings` → `Secrets and variables` → `Actions` →
edit `SUPABASE_SERVICE_ROLE_KEY`.

**Redeploy:** `vercel --prod` or Vercel dashboard → `Redeploy`.

---

### RESEND_API_KEY

**What it is:** API key for the Resend email service. Used by `lib/email/` and
notification-mailer cron routes.

**Generate new key:**
1. [Resend dashboard](https://resend.com) → `API Keys` → `Create API Key`.
2. Give it the same name/permission scope as the old key. Copy the new value.
3. Delete the old key from the Resend dashboard.

**Update Vercel:**
```bash
vercel env rm RESEND_API_KEY production
vercel env add RESEND_API_KEY production
```

**Update GitHub Actions:**
Edit `RESEND_API_KEY` in repo secrets if it appears there.

**Redeploy:** `vercel --prod`.

---

### INTERNAL_CRON_SECRET

**What it is:** A shared secret (min 32 characters) that Vercel sends as
`Authorization: Bearer <secret>` when invoking cron routes. Prevents public
invocation of cron endpoints.

**Generate new secret:**
```bash
openssl rand -hex 32
```
Copy the output.

**Update Vercel:**
```bash
vercel env rm INTERNAL_CRON_SECRET production
vercel env add INTERNAL_CRON_SECRET production
```

**Update Vercel cron invocation header** (if you have configured a custom header in
`vercel.json`'s `crons` config, update it there too and redeploy).

**Update GitHub Actions:** edit `INTERNAL_CRON_SECRET` in repo secrets if used in CI.

**Redeploy:** `vercel --prod`.

---

### SUPABASE_DB_WEBHOOK_SECRET

**What it is:** HMAC secret used to verify that incoming database webhook payloads
originated from Supabase.

**Generate new secret:**
```bash
openssl rand -hex 32
```

**Update in Supabase:**
1. Supabase dashboard → `Database` → `Webhooks`.
2. For each webhook that uses this secret, edit it and replace the signing secret
   with the new value.

**Update Vercel:**
```bash
vercel env rm SUPABASE_DB_WEBHOOK_SECRET production
vercel env add SUPABASE_DB_WEBHOOK_SECRET production
```

**Update GitHub Actions:** edit `SUPABASE_DB_WEBHOOK_SECRET` in repo secrets if used.

**Redeploy:** `vercel --prod`.

---

### SENTRY_AUTH_TOKEN

**What it is:** Sentry API token used during `next build` to upload source maps to
Sentry. Required for readable stack traces in production.

**Generate new token:**
1. [Sentry dashboard](https://sentry.io) → `Settings` → `Auth Tokens`.
2. Click `Create New Token`. Select the same scopes as the old token
   (`project:releases`, `org:read`, `project:read`). Copy the token.
3. Revoke the old token.

**Update Vercel:**
```bash
vercel env rm SENTRY_AUTH_TOKEN production
vercel env add SENTRY_AUTH_TOKEN production
```

**Update GitHub Actions:**
Edit `SENTRY_AUTH_TOKEN` in repo secrets — this is used by the CI build step
that uploads source maps.

**Redeploy:** `vercel --prod` (triggers a new build that uploads source maps with the
new token).

---

### NEXT_PUBLIC_SENTRY_DSN

**What it is:** The public client-side Sentry DSN. Embedded in the browser bundle;
it is not a secret in the traditional sense, but rotation may be needed if the DSN
is abused (e.g. someone spamming your Sentry project with fake events).

**Generate new DSN:**
1. Sentry dashboard → `Settings` → your project → `Client Keys (DSN)`.
2. Click `Add DSN`. Copy the new DSN.
3. Disable or delete the old DSN.

**Update Vercel:**
```bash
vercel env rm NEXT_PUBLIC_SENTRY_DSN production
vercel env add NEXT_PUBLIC_SENTRY_DSN production
```

**Update GitHub Actions:** edit `NEXT_PUBLIC_SENTRY_DSN` if it appears in CI workflows.

**Redeploy:** `vercel --prod` (the new DSN is baked into the client bundle at build
time).

---

### SENTRY_DSN

**What it is:** The server-side Sentry DSN used by the Node.js / Edge runtime.
Often the same value as `NEXT_PUBLIC_SENTRY_DSN`; kept separate so the server DSN
can be rotated independently.

Follow the same steps as `NEXT_PUBLIC_SENTRY_DSN` above, generating from
`Settings` → your project → `Client Keys (DSN)`.

```bash
vercel env rm SENTRY_DSN production
vercel env add SENTRY_DSN production
```

**Redeploy:** `vercel --prod`.

---

## Using the helper script

`scripts/rotate-secret.sh` can be used to automate the Vercel env-var portion of
any rotation above:

```bash
./scripts/rotate-secret.sh --help
./scripts/rotate-secret.sh
```

The script does NOT generate new secrets or touch Supabase/Resend/Sentry dashboards.
Those steps remain manual as documented above.

## Verification

After each rotation + redeploy:
1. `curl -s https://<your-domain>/api/health | jq .` → `{ "status": "ok" }`.
2. Check Sentry for unexpected errors in the 15 minutes after redeploy.
3. If rotating `RESEND_API_KEY`: trigger a test notification and verify delivery.
4. If rotating `INTERNAL_CRON_SECRET`: wait for the next scheduled cron invocation
   and verify it succeeds in Vercel function logs.

## Rollback

If a rotation causes a production issue:
1. Re-add the old secret value to Vercel (if you still have it — this is why you
   should note the old value before deleting it).
2. Redeploy.
3. Investigate before re-attempting the rotation.

## Related runbooks

- [incident-response.md](incident-response.md) — if a leaked secret caused an incident
- [database-restore.md](database-restore.md) — if SUPABASE_SERVICE_ROLE_KEY reset required a restore
