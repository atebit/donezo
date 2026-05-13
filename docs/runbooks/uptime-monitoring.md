# Uptime Monitoring

## When to use this runbook

Use this runbook to:
- Set up BetterStack uptime monitoring for the production app.
- Configure `/api/health` as the monitored endpoint.
- Wire alerts to Slack and/or email.

This is a one-time setup procedure. After setup, monitoring runs automatically.

## Pre-flight

- Confirm you have the URL for the production deployment (e.g. `https://donezo.vercel.app`
  or your custom domain).
- Confirm the `/api/health` endpoint returns a JSON response with a `status` field
  (implemented in Epic 15 slice 1D).
- Have Slack webhook URL ready if you want Slack alerts
  (`https://hooks.slack.com/services/...`).
- Have the email address(es) that should receive downtime alerts.

## Steps

### 1. Sign up for BetterStack

1. Go to [betterstack.com](https://betterstack.com) and create an account (or sign in).
2. Navigate to **Uptime** in the sidebar.

### 2. Create a monitor for `/api/health`

1. Click **New Monitor**.
2. Configure:
   | Field | Value |
   |-------|-------|
   | **URL** | `https://<your-domain>/api/health` |
   | **Monitor type** | HTTPS |
   | **Check frequency** | 1 minute (or 3 minutes on free tier) |
   | **Expected HTTP status** | 200 |
   | **Expected response** | JSON containing `"status":"ok"` (use the keyword check) |
   | **Regions** | Select 2–3 regions for redundancy (e.g. US East, EU West, Asia Pacific) |
   | **Monitor name** | `Donezo Production` |
3. Click **Save**.

### 3. Configure alert channels

#### Slack alert

1. In BetterStack, go to **Alert Policies** → **New Alert Policy**.
2. Add an integration: select **Slack** → paste your incoming webhook URL.
3. Set the policy to fire on `Down`, `Recovery`, and optionally `SSL expiry warning`.
4. Assign the policy to the `Donezo Production` monitor.

#### Email alert

1. In the same Alert Policy, add an **Email** integration.
2. Enter the on-call email address(es).
3. Set escalation: if unacknowledged after 5 minutes, send to a secondary address.

### 4. Add a status page (optional)

BetterStack can host a public status page at `status.<your-domain>` or a
BetterStack subdomain:

1. Go to **Status Pages** → **New Status Page**.
2. Add the `Donezo Production` monitor to the status page.
3. Configure the domain (CNAME your `status.` subdomain to BetterStack if using a
   custom domain).

### 5. Add the status page badge to `README.md` (optional)

BetterStack provides a badge URL. Add it to the repo README for visibility.

### 6. Verify the monitor is working

1. In BetterStack, open the `Donezo Production` monitor.
2. Confirm it shows **Up** and the last check returned a 200.
3. To test alerting: temporarily point the monitor at a non-existent path
   (e.g. `/api/health-test-404`) — wait for a `Down` alert — then revert and
   confirm `Recovery` alert fires.

## Verification

- BetterStack dashboard shows the monitor in **Up** state with recent successful checks.
- A test downtime (using the method above) triggers a Slack message and email within
  2 minutes of the first failed check.
- The status page (if configured) reflects the current uptime.

## Rollback

Uptime monitoring is non-invasive — there is nothing to roll back. To disable it:
1. Pause or delete the monitor in BetterStack.

If you need to remove the `/api/health` endpoint, see the incident-response runbook
for the impact on observability.

## Related runbooks

- [incident-response.md](incident-response.md) — what to do when BetterStack fires an alert
- [rotate-secrets.md](rotate-secrets.md) — BetterStack does not use app secrets, but if you
  add a health-check secret header in the future, rotate it via this runbook
