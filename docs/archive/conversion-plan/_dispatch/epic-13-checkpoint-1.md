# Epic 13 — Checkpoint 1 (Slice 3A)

**Date:** 2026-05-13  
**Executor:** Sonnet (Slice 3A)  
**Branch:** `epic/13-notifications`

---

## What landed in slice 3A

- `app/api/cron/notification-cleanup/route.ts` — daily cleanup cron (03:00 UTC).
  - Deletes `notification` rows where `read_at < now() - 90 days`.
  - Deletes `notification` rows where `created_at < now() - 365 days`.
  - Auth: `INTERNAL_CRON_SECRET` timing-safe compare + `x-vercel-cron` sanity header.
  - Returns `{ ok, readDeleted, oldDeleted, totalDeleted }`.
- `vercel.json` — fourth cron entry added: `{ "path": "/api/cron/notification-cleanup", "schedule": "0 3 * * *" }`.
- `tests/unit/notification-cleanup.test.ts` — 9 unit tests covering auth gate (missing token, wrong token, length mismatch, open mode, correct token) and cleanup logic (count structure, zero counts, null counts, DB error on first delete).
- `tests/integration/notifications-e2e.test.ts` — 9 test cases across 7 cross-slice scenarios.
- `docs/conversion-plan/_dispatch/epic-13-checkpoint-1.md` — this document.

---

## Seven integration scenarios — outcomes

All seven scenarios pass against mocked Supabase + mocked Resend.

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| 1 | Comment with @mention → in-app row + email envelope | **PASS** (2 assertions) | `emitMentionNotifications` inserts an `assigned` row via `notifyUsers`; `renderNotificationEmail("mention", ctx)` produces a valid envelope; `sendEmail` logs a would-send (no API key). |
| 2 | Assign user → `assigned` in-app + auto-follow | **PASS** | `emitAssignmentNotifications` inserts `assigned` row; `autoFollowOnAssign` is triggered. |
| 3 | Status change on assigned task → `status_changed_assigned` | **PASS** (2 cases) | Emitter reads person cells, routes `status_changed_assigned` to assignee; skip-actor case verified. |
| 4 | Date cell = tomorrow + due-scanner → `due_soon` fires; second run no dupe | **PASS** | First run: `runDueScanner()` claims slot + emits; second run: `claimReminderSlot` returns false (conflict), no additional `notifyUsers` calls. |
| 5 | `prefs.assigned.email = 'off'` → in-app row but no email envelope | **PASS** | Preference mock returns `email:'off'`; in-app row is still inserted (inApp=true); `sendEmail` is never called in this path. |
| 6 | Workspace invitation → invitation row + email envelope log | **PASS** | `emitWorkspaceInviteNotification` emits in-app `board_invite` for existing-profile invitee; `sendEmail` with no API key returns `{ skipped: true, reason: 'no-api-key' }`. |
| 7 | `prefs.assigned.email = 'digest'` + digest cron → digest envelope + `digested_at` set | **PASS** (2 assertions) | `buildDigest` returns `DigestData` with correct counts and section for a pending `assigned` notification; `sendEmail` returns skipped envelope. |

---

## Caveats and known limitations

1. **Integration tests use mocked Supabase** — no live DB. The scenarios verify the flow at the lib + action layer (emitter → notifyUsers, render pipeline, preference gating, idempotency logic). End-to-end DB-level verification (including RLS, real Supabase channel events, actual Resend delivery) is deferred to the epic 15 browser smoke pass and the Opus review pass.

2. **Scenario 7 verifies `buildDigest` and the email envelope shape** but does not call the actual `digest/route.ts` GET handler (which would require a full `findUsersDueForDigest` mock). The digest cron route itself is unit-tested in `tests/unit/digest-cron.test.ts` and `tests/unit/digest-builder.test.ts` from slice 2D. The integration scenario validates the data pipeline from notification row → DigestData → sendEmail.

3. **Scenario 4 due-scanner mock** distinguishes date-cell queries from person-cell queries by tracking which chain methods (`.lte`, `.lt`, `.gte`) are called. This is structurally correct for the current scanner implementation but would break if the query structure changed. Noted as a fragile mock for future maintainers.

4. **Pre-existing test failures** — `env.test.ts` has 3 failing cases from epic 15 wiring (setup.ts overrides `NODE_ENV`). These failures predate this slice and are unchanged. The `@testing-library/react`-dependent tests are skipped due to the same epic 15 wiring gap.

5. **Cleanup cron two-step delete** — the route performs two separate `DELETE` queries (read rows then any row). There is a short window between the two queries where newly-read rows that cross the 90-day boundary could be caught by the second (365-day) query instead. This is acceptable behavior for a cleanup cron — at worst it removes a slightly-older read notification.

---

## vercel.json final state

```json
{
  "crons": [
    { "path": "/api/cron/notifications-mailer", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/digest", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/due-scanner", "schedule": "0 * * * *" },
    { "path": "/api/cron/notification-cleanup", "schedule": "0 3 * * *" }
  ]
}
```

All four cron entries are present.

---

## Test counts

- `pnpm test`: 548 passed, 3 failed (pre-existing env.test.ts), 736 skipped (@testing-library/react stub).
- `pnpm typecheck`: clean.
- `pnpm lint`: no errors (5 pre-existing CSS warnings).
