# Epic 13 — Followup Round 1

## Review summary

- **Stage reviewed:** All of epic 13 (commits `9fdc7fb..b4d9c4a` on `epic/13-notifications`, off `main`).
- **Verdict:** FOLLOWUP REQUIRED — one architectural bug (duplicate-send with broken accept URL for `board_invite` emails sent via the webhook path), plus one dead-code cleanup the dispatch plan explicitly required.
- **Definition-of-done items met:**
  - Mention → in-app row + email (instant) — implemented end-to-end (`emitMentionNotifications` + webhook + Mention.tsx).
  - Assignment → `assigned` notification (`emitAssignmentNotifications`).
  - Due-soon / due-overdue cron emits notifications (`lib/notifications/due-scanner.ts` + `app/api/cron/due-scanner/route.ts`); `task_reminder_sent` claim-before-emit is correct.
  - Bell shows unread count; popover renders date-grouped list (`NotificationBell` + `NotificationCenter` + `NotificationList`); realtime channel `notifications:<userId>` wired (`use-notifications-realtime.ts`).
  - Per-kind preferences UI honors instant/digest/off (`account/notifications/notification-settings.tsx`), digest section honored by webhook + cron.
  - Followed tasks notify on comments + status changes; auto-follow on comment/mention/assign in place.
  - Tests cover emitters, followers, store, renderers, mailer, digest builder, digest cron, due scanner, email rendering, cleanup; 7 cross-slice integration scenarios pass.
  - Workspace + board invitation emails send (inline path, action-side).
- **Definition-of-done items NOT met / partially met:**
  - **`board_invite` email rendering via the webhook produces a broken accept URL.** `lib/email/render-notification.ts:172-186` constructs `acceptHref: ${siteUrl}/join/` with no token. `loadEmailContext` does not fetch the invitation token, and the webhook handler does not append one from the payload. The notification `payload` only carries `invitation_id`, not the `token`. Because `inviteToWorkspace` / `inviteToBoard` also fire a `board_invite` in-app notification (best-effort) AND inline-send the invite email with the correct token, an invitee who already has a profile receives TWO emails: one good (action) and one bad (webhook, with a `/join/` URL that 404s). The webhook’s `email_sent_at` claim hides this from the polling fallback, so the only visible failure is "user gets a broken duplicate." Concretely:
    - `inviteToWorkspace` (in `app/(app)/w/[workspaceSlug]/actions.ts`) calls `emitWorkspaceInviteNotification` AND `sendEmail`.
    - The notification row insert triggers `app/api/webhooks/notifications/route.ts` → `processNotification` → `renderNotificationEmail("board_invite", ctx)` → `sendEmail` with the broken URL.
  - **`components/shared/topbar/NotificationBellStub.tsx` is still present** as dead code. The dispatch plan slice 2B write-scope explicitly says `(delete)`. The Topbar already imports `NotificationBell` instead.
- **Other issues found (non-blocking, called out for visibility — do not gate the merge but should be tracked):**
  - **`getPreferenceFor` is one DB call per recipient** in every emitter and in `digest/route.ts:resolveDigestKinds` (loops 13 kinds × N due users). Bounded by recipient count per emit, not by board size, so not a hot-path N+1 — acceptable for v1. Track for v1.5: cache per (userId) within a single emit/cron run.
  - **Digest `markDigested` race.** Between `buildDigest`'s SELECT and `markDigested`'s UPDATE, new digest-eligible rows for the same user can land and be silently marked `digested_at` without being included in the email. Window is small (single function), but those notifications are then lost from the digest stream. The intuitive fix (capture row IDs at build time and mark only those) is small but out of surgical scope for this followup. Track as a v1.5 hardening item.
  - **`isExistingUser: false` is hardcoded** in `inviteToWorkspace`, `inviteToBoard`, and `resendInvitation` even when the invitee already has a profile. Causes the "create your free account" copy to render for existing users. Cosmetic; not a DoD blocker. Track as a v1.5 polish item.
  - **`bulkSetCellValue` passes `prevUserIds: []`** for person columns and `fromLabelId: null` for status columns. Documented inline. Bulk emit therefore over-notifies (all next assignees treated as added). Acceptable for v1.
  - **Due-scanner uses `actor_id: userId` (recipient-as-actor placeholder)** because system events have no actor. Renderers and email templates for `due_soon`/`due_overdue` ignore actor data, so this is invisible in the UI. Note for future renderers.
  - **Ops prerequisites to flag before merging the epic PR into `main`:**
    - `lib/supabase/types.ts` was hand-patched. Regen via `pnpm db:types` against a live Supabase that has the two new migrations applied. Confirm zero diff before merge.
    - pgTAP specs `tests/policies/notification_rls.spec.sql` and `tests/policies/task_follower_rls.spec.sql` are unrun locally (no Docker). Run via `pg_prove` against a Supabase with both new migrations applied as a pre-merge gate.
    - Resend domain + DKIM/SPF/DMARC verification is an ops task (CONTRIBUTING.md already documents the env vars).
    - Vercel cron cadence (`*/5`, `*/15`) requires Pro tier — already documented in CONTRIBUTING.md.
    - Supabase database webhook setup is a manual dashboard step (Supabase CLI 2.98.2 lacks `[db.webhooks]`) — already documented in CONTRIBUTING.md.
  - **Playwright e2e for the notification flows** is not in this epic. The epic doc lists "E2E: configure preferences → email-off kind doesn't send; kind set to digest → batched in next digest" as part of `Tests`. The Vitest integration suite (`tests/integration/notifications-e2e.test.ts`) is mock-based and covers the seven scenarios. Acceptable v1 substitute given epic 15 hasn't wired Playwright; epic 15's brief expects to author these specs against the same flows.

---

## Followup slices

### Slice F1 — Fix `board_invite` email path: skip the webhook’s render of `board_invite`, OR fetch+inject the token

**Owner:** epic-executor (Sonnet).

**Write scope (option A — recommended: skip webhook render for `board_invite`):**
- `lib/email/render-notification.ts` (edit — make `board_invite` return `null` from `renderNotificationEmail`; the action paths in `inviteToWorkspace` / `inviteToBoard` / `resendInvitation` already send the invitation email inline with the correct token).
- `tests/unit/email-render.test.tsx` (edit — drop the `InviteEmail` snapshot's reliance on `renderNotificationEmail` IF such reliance exists, OR add an explicit assertion that `renderNotificationEmail("board_invite", ctx)` returns `null`).
- `tests/unit/notification-mailer.test.ts` (edit — add a test asserting that for `board_invite` notifications the webhook does NOT call `sendEmail` and does NOT mark `email_sent_at` (since there's nothing to send), AND that the polling route behaves identically).
- `app/api/webhooks/notifications/route.ts` (no edit if `renderNotificationEmail` returning null is handled — verify the existing `if (!envelope) return;` branch leaves `email_sent_at` claim alone; current code marks `email_sent_at` BEFORE the render check, so this slice also needs to reorder: render first, then claim, then send, OR keep the claim and accept that null-envelope kinds get their email_sent_at marked as a soft suppression. **Sub-decision:** keep the claim BUT only call it once we know we want to suppress — i.e. for `board_invite` specifically, treat it like `pref.email === 'off'` and claim+exit. Document in a comment).
- `app/api/cron/notifications-mailer/route.ts` (mirror the same change — return `"skipped"` for board_invite without sending).

**Forbidden scope:** edits to invitation server actions, `inviteToBoard`, `inviteToWorkspace`, `resendInvitation`. The action-side email path is already correct and must not change. Do not edit `loadEmailContext` to fetch the token (option B below) unless option A is rejected by orchestrator/user.

**Dependencies:** none beyond the merged epic-13 work.

**Spec (option A — preferred):**
- In `renderNotificationEmail`, change `case "board_invite":` to return `null` (same as `unassigned`, `status_changed`, `task_created_in_followed`). Add a comment: `"board_invite emails are sent inline by the inviteToWorkspace / inviteToBoard / resendInvitation actions, which have access to the invitation token. The webhook/mailer skip this kind to avoid duplicate sends with a broken accept URL."`.
- Update `processNotification` (webhook) and `processRow` (mailer) so that when `pref.email === 'instant'` AND `renderNotificationEmail` returns `null`, they treat the row like `pref.email === 'off'`: claim `email_sent_at` (idempotent suppression of future polling), do not send. The current code happens to do this already — `if (!envelope) return;` runs after the claim — verify and add a test.

**Spec (option B — alternative, only if user decides webhook-driven invite emails are important):**
- Extend `loadEmailContext` to fetch `invitation.token` when `notification.kind === 'board_invite'` and `payload.invitation_id` is present.
- Add `invitation: { id, token } | null` to `EmailContext`.
- In `renderNotificationEmail`, build `acceptHref = ${siteUrl}/join/${ctx.invitation.token}` for `board_invite`.
- Accept that the invitee receives TWO invite emails (one from action, one from webhook). Add coalescing later. (This is why option A is preferred.)

**Definition of done:**
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
- New test in `tests/unit/notification-mailer.test.ts` proves webhook + polling routes do NOT call `sendEmail` for `board_invite` rows.
- Existing tests still pass; `tests/integration/notifications-e2e.test.ts` scenario 6 (workspace invitation) still passes with the same shape (in-app row + one inline email envelope; webhook path now suppressed).
- A pseudo-manual check (or unit assertion) confirms that for a `board_invite` notification row, `email_sent_at` is set to suppress polling.

**Escalation triggers:**
- If the orchestrator/user prefers option B (full token wiring), escalate before implementing — this changes `EmailContext` shape and several downstream tests.
- If a test discovers that the webhook ALSO short-circuits earlier than the claim, document and skip the reorder.

### Slice F2 — Delete unused `NotificationBellStub.tsx`

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `components/shared/topbar/NotificationBellStub.tsx` (delete).
- `components/notifications/NotificationBell.tsx` (edit — drop the "Replaces NotificationBellStub in the topbar." comment OR leave it; the historical reference is fine but the file no longer exists).

**Forbidden scope:** any other file. Do not touch the live `NotificationBell` implementation.

**Dependencies:** none (independent of F1; parallel-safe).

**Spec:**
- Verify no remaining import of `NotificationBellStub` (`grep -rn NotificationBellStub`). `Topbar.tsx` already imports `NotificationBell` from `@/components/notifications/NotificationBell` — confirmed in the merged diff.
- Delete `components/shared/topbar/NotificationBellStub.tsx`.

**Definition of done:**
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
- `grep -rn NotificationBellStub` finds zero references in code (the historical commit reference in `NotificationBell.tsx`'s file-level JSDoc is OK to leave but optional to remove).

**Escalation triggers:** none expected.

---

## Open questions for the user

1. **Slice F1 — option A vs option B?** Recommend option A (suppress webhook-driven `board_invite` emails entirely; the inline action-side send is already correct and uses the token). Option B keeps the webhook path live but requires extending `EmailContext` to load the invitation token and risks duplicate sends. Default to A unless told otherwise; the dispatch plan called out duplicate-send risk as a known consideration but did not address this specific path.

2. **Pre-merge ops gates — do you want CI to enforce them, or are they done manually before merging to `main`?** Specifically:
   - Regenerate `lib/supabase/types.ts` against a live Supabase that has the two new migrations applied and confirm zero diff.
   - Run `pg_prove tests/policies/notification_rls.spec.sql tests/policies/task_follower_rls.spec.sql` against the same DB.
   - Verify Resend domain DKIM/SPF/DMARC and set `RESEND_API_KEY`, `EMAIL_FROM`, `INTERNAL_CRON_SECRET` (≥32 chars), `SUPABASE_DB_WEBHOOK_SECRET` (≥32 chars), and optionally `EMAIL_SAFE_LIST` on Vercel before the production deploy.
   - Confirm the Vercel project is on **Pro** (or adjust `vercel.json` schedules for Hobby).
   - Configure the Supabase DB webhook in the dashboard (CONTRIBUTING.md documents the exact form to fill).
   None of these gate the *merge* of the epic branch into `main` per se — they gate the **production deploy** working end-to-end. Recommend treating them as a deploy-time checklist appended to the epic 13 PR description, not a CI gate.

