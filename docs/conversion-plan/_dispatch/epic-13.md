# Epic 13 — Notifications (in-app + email) — Dispatch Plan

**Status:** approved 2026-05-12 by the orchestrator on behalf of the user (scheduled hourly check-in, user not present). All open questions resolved per researcher recommendations — rationale captured per question.

**Canonical epic doc:** [`docs/conversion-plan/13-notifications.md`](../13-notifications.md)

**Branch:** `epic/13-notifications` (off `main` at `69a8790`, after PR #49 / epic 12 merged).

**Dependency epics merged:** 02 (schema), 03 (auth), 04 (RLS), 05 (workspaces/boards), 06 (groups/tasks/table), 07 (column system), 08 (realtime/presence), 09 (comments/activity), 10 (attachments), 11 (filtering/views), 12 (alternate views). All baseline state required by this epic is in place.

---

## Preconditions verified

**Schema / DB**
- `notification` table exists (kind constraint covers 6 legacy kinds, `payload jsonb`, `read_at`, `created_at`, partial index on unread, RLS: select+update by self, service-role inserts). Realtime publication includes `notification`.
- `notification_preference`, `task_follower`, `task_reminder_sent` tables do **not** exist — new in this epic.
- `email_sent_at` and `digested_at` columns do **not** exist on `notification`.
- `invitation` table exists (workspace + board scope). `inviteToWorkspace` has a `// TODO epic 13: send invitation email via Resend.` marker.
- `acceptInvitation` action + `/join/[token]` UI exist.
- `profile.email` denormalization + sync trigger present.
- RLS helpers `role_for_board`, `role_for_workspace`, `role_rank`, `greater_role` exist (no recursion concerns for new policies).

**App / lib**
- `lib/notifications/notify.ts` (`notifyUsers(rows)`, best-effort, swallows errors) is in place — already used in epic 09 for mention fan-out.
- `lib/supabase/admin.ts` exposes lazy `adminClient()`; `SUPABASE_SERVICE_ROLE_KEY` validated in `lib/env.ts`.
- `RESEND_API_KEY` slot exists (optional) in env. `resend` / `@react-email/*` are **not** installed; `emails/` directory does not exist.
- Topbar renders `<NotificationBellStub />` (disabled) — replace with live bell.
- `useBoardRealtime` manages per-board channels — a separate per-user channel `notifications:<userId>` will live in the app shell.
- Mutation surfaces in scope:
  - `app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts` — `setCellValue`, `bulkSetCellValue`.
  - `app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts` — comment create/update; existing mention fan-out lives here.
  - `app/(app)/w/[workspaceSlug]/actions.ts` — `inviteToWorkspace`.
  - `app/(app)/w/[workspaceSlug]/settings/members/actions.ts` — workspace role changes; invite resend/revoke.
  - `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/actions.ts` — board role changes; new `inviteToBoard` will be added here.

**Tooling**
- pnpm 10.33.4; Next 15.5.16; React 19; TS strict; Biome; Supabase CLI 2.98.2.
- Vitest unit tests in place; Playwright is stubbed and lit up in epic 15. Integration coverage in this epic uses Vitest against local Supabase, matching epics 06–12.

**Out-of-scope per epic doc:** SMS, mobile push, Slack/Teams, per-board mute, Resend webhooks (delivery/bounce/complaint), email throttling, snooze, share-link boards.

---

## Decisions on open questions (orchestrator answered)

The user was not present at planning time (autonomous scheduled run). Each decision below follows the researcher's recommendation. Rationale included so reviewers can revisit.

- **Q1 — Mailer runtime: Next.js route handler, not Edge Function.** `app/api/webhooks/notifications/route.ts` (DB-webhook handler) + `app/api/cron/notifications-mailer/route.ts` (polling fallback). Rationale: stack is already Node/Next/Vercel; React Email's first-class path is Node; single toolchain for local tests and feature code; webhook URL secret-protected via shared `SUPABASE_DB_WEBHOOK_SECRET` header.
- **Q2 — Polling fallback: every 5 minutes with a 30-minute lookback.** Auth: `Authorization: Bearer ${INTERNAL_CRON_SECRET}` + `x-vercel-cron: 1` sanity check. Documented in `vercel.json`. If we end up on Vercel Hobby (no per-minute crons), cadence is the only thing to retune; the webhook is the primary path regardless.
- **Q3 — Digest content shape: headline counts + per-board sections.** Cap each board at 10 items + "+N more" link. Matches Linear/Slack digest UX without unbounded email size.
- **Q4 — Digest cron cadence: every 15 minutes.** Each run finds users whose configured hour-in-their-TZ landed within the last 15 minutes. Tight delivery window without per-minute cron pressure.
- **Q5 — Resend identity + dev safety.**
  - `EMAIL_FROM` env, default `Donezo <noreply@donezo.app>` in prod.
  - If `RESEND_API_KEY` is unset (dev/preview), `sendEmail` returns `{ skipped: true, reason: 'no-api-key' }` and logs the would-send envelope.
  - `EMAIL_SAFE_LIST` (optional, comma-separated). When set, only deliver to matching recipients — preview-deploy guard.
- **Q6 — `notification.kind` constraint:** drop existing 6-value check, add the new 13-value union: `mention`, `assigned`, `unassigned`, `comment_reply`, `comment_on_followed`, `status_changed` (reserved/legacy), `status_changed_assigned`, `status_changed_followed`, `due_soon`, `due_overdue`, `board_invite`, `role_changed`, `task_created_in_followed` (reserved — see Q7). Source of truth mirrored at `lib/notifications/kinds.ts`.
- **Q7 — `task_created_in_followed`: defer.** No group/section follower model exists yet; per-task follower covers the primary use case. Kind stays in the constraint as **reserved**; no emitter, no cron, no UI.
- **Q8 — Default preferences: virtual.** `getPreferenceFor(userId, kind)` returns `{ ...DEFAULTS, ...rowPrefs }`. No backfill, no auth-trigger ordering concerns; rows written lazily on `updatePreferences` upsert.
- **Q9 — Cleanup TTL: 90d read, 365d unread.** Daily cron at `/api/cron/notification-cleanup`, `INTERNAL_CRON_SECRET` gated.
- **Q10 — UI surfaces:** Base UI Popover anchored to the bell **plus** a `/notifications` page that reuses the same `<NotificationList />` primitive.
- **Q11 — RLS for new tables:**
  - `notification_preference`: select/insert/update/delete on `user_id = auth.uid()`.
  - `task_follower`: select on `user_id = auth.uid() OR role_for_board(task) IS NOT NULL`; all on `user_id = auth.uid()`.
  - `task_reminder_sent`: **no policies** (service-role only, RLS enabled).
- **Q12 — Email rendering tests:** Vitest snapshot via `@react-email/render` to HTML; no mailpit. `pnpm email:preview` script (`react-email dev --dir emails`) for visual review. Defer mailpit/Playwright email coverage to epic 15.
- **Q13 — Add `inviteToBoard` action.** Mirror of `inviteToWorkspace` in `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/actions.ts`. Schema already supports `invitation.board_id`.

---

## Stages and slices

Five stages. Stage 1 must merge before Stage 2. Within Stage 2, **2A merges first** (it edits the action files that 2C also touches; resolves merge conflicts deterministically), then **2B / 2C / 2D / 2E run in parallel**.

---

### Stage 1 — Foundation (sequential, blocking)

#### Slice 1A — Schema, kinds union, prefs/follower types, helper extension

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `supabase/migrations/20260516000000_notifications_epic13.sql` (new — DDL).
- `supabase/migrations/20260516000001_notifications_epic13_rls.sql` (new — policies).
- `lib/supabase/types.ts` (regen via `pnpm db:reset && pnpm db:types`).
- `lib/notifications/kinds.ts` (new — `NotificationKind` union, `DEFAULT_PREFS`, `NotificationPayloadByKind`).
- `lib/notifications/types.ts` (new — `NotificationPreference`, `TaskFollower`, render-context types).
- `lib/notifications/notify.ts` (edit — broaden `kind` parameter to the new union).
- `lib/validations/notifications.ts` (new — Zod: `UpdatePreferencesSchema`, `SetReadStateSchema`, `FollowTaskSchema`, `UnfollowTaskSchema`).
- `tests/policies/notification_rls.spec.sql` (new — pgTAP).
- `tests/policies/task_follower_rls.spec.sql` (new — pgTAP).
- `tests/unit/notification-kinds.test.ts` (new).

**Forbidden scope:** any emitter wiring; any UI; any email code; any cron route.

**Dependencies:** none.

**Spec:**
- Migration 1 DDL:
  - `alter table public.notification drop constraint if exists notification_kind_check;`
  - Re-add `check (kind in ('mention','assigned','unassigned','comment_reply','comment_on_followed','status_changed','status_changed_assigned','status_changed_followed','due_soon','due_overdue','board_invite','role_changed','task_created_in_followed'))`.
  - `alter table public.notification add column email_sent_at timestamptz;`
  - `alter table public.notification add column digested_at timestamptz;`
  - `create index notification_pending_email_idx on public.notification (created_at) where email_sent_at is null;`
  - `create index notification_pending_digest_idx on public.notification (user_id, created_at) where digested_at is null and read_at is null;`
  - `create table public.notification_preference (user_id uuid primary key references auth.users(id) on delete cascade, prefs jsonb not null default '{}'::jsonb, digest_enabled boolean not null default false, digest_hour smallint not null default 9 check (digest_hour between 0 and 23), digest_timezone text not null default 'UTC', updated_at timestamptz not null default now())` + `set_updated_at` trigger.
  - `create table public.task_follower (task_id uuid not null references public.task(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, followed_at timestamptz not null default now(), primary key (task_id, user_id))`.
  - `create table public.task_reminder_sent (task_id uuid not null references public.task(id) on delete cascade, kind text not null, sent_at timestamptz not null default now(), primary key (task_id, kind))`.
  - `enable row level security` on all three new tables.
  - **Do not** add the new tables to `supabase_realtime` publication — none need browser subscription.
- Migration 2 RLS (per Q11):
  - `notification_preference`: select/insert/update/delete on `user_id = auth.uid()`.
  - `task_follower`: `select using (user_id = auth.uid() or exists (select 1 from public.task t where t.id = task_follower.task_id and public.role_for_board(t.board_id, auth.uid()) is not null))`; `all using (user_id = auth.uid()) with check (user_id = auth.uid())`.
  - `task_reminder_sent`: **no policies** (RLS enabled, service-role only). Comment in SQL explaining the choice.
- `lib/notifications/kinds.ts`:
  - `export type NotificationKind = ...` literal union mirroring the constraint.
  - `export const NOTIFICATION_KIND_LIST: readonly NotificationKind[] = [...]`.
  - `export const DEFAULT_PREFS: Record<NotificationKind, { inApp: boolean; email: 'instant' | 'digest' | 'off' }>` per epic doc Notifications table.
  - `export type NotificationPayloadByKind = { mention: {...}; assigned: {...}; ... }` discriminated by kind. Used by emitters and renderers (typed payloads).
- `lib/validations/notifications.ts`:
  - `UpdatePreferencesSchema` — `prefs: z.record(z.enum(NOTIFICATION_KIND_LIST), z.object({ inApp: z.boolean(), email: z.enum(['instant','digest','off']) })).partial(); digestEnabled: z.boolean(); digestHour: z.number().int().min(0).max(23); digestTimezone: z.string().min(1);`.
  - `SetReadStateSchema` — `{ notificationIds: z.array(z.string().uuid()) }` OR `{ markAll: z.literal(true) }`. Use a discriminated union.
  - `FollowTaskSchema`, `UnfollowTaskSchema` — `{ taskId: z.string().uuid() }`.
- pgTAP coverage:
  - User A cannot SELECT user B's `notification_preference`.
  - User A cannot SELECT a `task_follower` row for a task whose board they cannot see.
  - User A CAN SELECT their own `task_follower` rows.
  - `task_reminder_sent` is invisible to authed users.
  - Service-role can insert into `notification` (still the only path).
- `tests/unit/notification-kinds.test.ts`: assert every kind in the SQL constraint is present in `NOTIFICATION_KIND_LIST` and `DEFAULT_PREFS`; assert no extra TS-only kinds.

**Definition of done:**
- `pnpm db:reset` clean; types regenerate.
- `pg_prove tests/policies/notification_rls.spec.sql tests/policies/task_follower_rls.spec.sql` passes locally.
- `pnpm typecheck` green with `notifyUsers` accepting the expanded kind union.
- Memory rule honored: no RLS policy subqueries its own table without a SECURITY DEFINER helper.

**Escalation triggers:** any policy that cannot be expressed in a single direct condition; any constraint name collision with existing migrations; any unintended cascade on `auth.users`.

---

### Stage 2 — Build out (parallel after 1A + after 2A merges)

#### Slice 2A — Emitters library + auto-follow rules + integration into mutating server actions (run first in stage 2)

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `lib/notifications/emit.ts` (new — typed thin wrapper around `notifyUsers`; documents best-effort contract).
- `lib/notifications/emitters.ts` (new — per-kind emitters: `emitMentionNotifications`, `emitCommentReplyNotifications`, `emitCommentOnFollowedNotifications`, `emitAssignmentNotifications` (assigned + unassigned diff), `emitStatusChangeNotifications` (assigned + followed splits), `emitBoardInviteNotification`, `emitRoleChangedNotification`).
- `lib/notifications/followers.ts` (new — `ensureFollower(taskId, userId, supabase)`, `removeFollower`, `getFollowers(taskId)`, `autoFollowOnComment`, `autoFollowOnMention`, `autoFollowOnAssign`).
- `lib/notifications/preferences.ts` (new — `getPreferenceFor(userId, kind)` returning effective `{ inApp, email }` merging row + DEFAULTS).
- `app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts` (edit — emit assignment + status notifications, auto-follow assignees).
- `app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts` (edit — refactor existing mention fan-out to call `emitMentionNotifications`; add comment-reply + comment-on-followed emitters; auto-follow commenter + mentioned users).
- `app/(app)/w/[workspaceSlug]/actions.ts` (edit — emit `board_invite` notification when invitee already has a profile).
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/actions.ts` (edit — emit `role_changed` after `setBoardMemberRole`; add new `inviteToBoard` action per Q13).
- `app/(app)/w/[workspaceSlug]/settings/members/actions.ts` (edit — emit `role_changed` after `setWorkspaceMemberRole`).
- `lib/validations/invitation.ts` (extend with `InviteToBoardSchema` if absent).
- `tests/unit/emitters.test.ts` (new — every emitter's add/remove diffing, skip-self, preference-gating).
- `tests/unit/followers.test.ts` (new).

**Forbidden scope:** any UI (`components/notifications/**`, topbar bell, `/notifications` page); any email template; any cron route; any new migration; any change to `app/(app)/w/[workspaceSlug]/actions.ts` beyond the in-app emit (the `sendEmail` call lives in 2C).

**Dependencies:** 1A merged.

**Spec details:**
- `emitAssignmentNotifications({ supabase, boardId, taskId, columnId, prevUserIds, nextUserIds, actorId })`:
  - `added = next \ prev`, `removed = prev \ next`. Skip `actorId`.
  - For each added: emit `assigned`, auto-follow.
  - For each removed: emit `unassigned`.
  - Pre-filter via `role_for_board` rpc; matches existing mention-fan-out pattern.
- `emitStatusChangeNotifications({ supabase, boardId, taskId, columnId, fromLabelId, toLabelId, actorId })`:
  - Recipients = assignees ∪ followers, minus actor.
  - Assignees → `status_changed_assigned`; non-assignee followers → `status_changed_followed`.
  - Resolve assignees by reading the person cells on this task (any person column on the board) — bounded by `taskId`, no N+1 across the board.
- `emitCommentReplyNotifications`: heuristic — scan the new comment body for a `blockquote` whose nested mention `id` matches a user; treat that user as the reply-target. If absent, no comment_reply notification. Comment the heuristic in the file.
- `emitCommentOnFollowedNotifications`: recipients = followers of `taskId` minus actor minus mentioned (mentions take priority).
- `emitBoardInviteNotification`: emit in-app **only** when invitee already has `profile.id`. Email send (always) lives in 2C.
- `emitRoleChangedNotification`: in-app only; payload `{ workspace_id?, board_id?, from, to, actor_id }`.
- All emitters honor `getPreferenceFor(userId, kind).inApp === false` (skip in-app row). Email-channel honoring lives in the mailer (2C).
- All emitters are **best-effort**, wrapped in try/catch, logged via `lib/logger`, never propagate to the parent action. Document the contract on `emit.ts`.
- Auto-follow rules: on comment post → author follows the task; on mention → mentioned user follows; on assignment → assignee follows. Implemented in `lib/notifications/followers.ts`, called from the relevant emitters.

**Definition of done:**
- `pnpm typecheck` passes.
- Unit tests cover each emitter's add/remove diffing, skip-self, and preference-gating.
- Comments action's prior inline mention fan-out is replaced (not duplicated) — single source of truth in `emitters.ts`.
- `setCellValue` / `bulkSetCellValue` emit assignment + status notifications without breaking existing behavior.

**Escalation triggers:**
- If `emitStatusChangeNotifications` would require fetching assignees board-wide (not task-bounded), escalate.
- If a structural conflict appears around `inviteToBoard` (existing helper, naming clash), escalate.

#### Slice 2B — In-app notification UI: bell, center popover, list, per-kind renderers, /notifications page, preferences UI

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `app/(app)/notifications/actions.ts` (new — `markRead`, `markAllRead`, `followTask`, `unfollowTask`).
- `app/(app)/notifications/page.tsx` (new — full-page "All notifications").
- `app/(app)/account/notifications/page.tsx` (new — preferences UI page).
- `app/(app)/account/notifications/notification-settings.tsx` (new — client component, RHF + Zod against `UpdatePreferencesSchema`).
- `app/(app)/account/notifications/actions.ts` (new — `updatePreferences`).
- `components/notifications/NotificationBell.tsx` (new — replaces `NotificationBellStub`).
- `components/notifications/NotificationCenter.tsx` (new — Base UI Popover; tabs All/Unread/Mentions).
- `components/notifications/NotificationList.tsx` (new — date-grouped; virtualize only if N > 100).
- `components/notifications/NotificationItem.tsx` (new).
- `components/notifications/renderers/` (new directory — one renderer per kind plus `fallback.tsx`).
- `components/notifications/registry.ts` (new — `kind → renderer` map).
- `components/shared/topbar/Topbar.tsx` (edit — swap stub for live bell).
- `components/shared/topbar/NotificationBellStub.tsx` (delete).
- `stores/notification-store.ts` (new — Zustand store; selectors wrapped in `useShallow` per memory rule).
- `hooks/use-notifications-realtime.ts` (new — `notifications:<userId>` channel, INSERT filter `user_id=eq.<userId>`, idempotent by `id`).
- `components/shared/topbar/NotificationsBootstrap.tsx` (new — client-only hydration + realtime mount; reads server-supplied initial state from the (app) layout).
- `app/(app)/layout.tsx` (edit — load up to 50 most-recent notifications + unread count server-side; pass to bootstrap).
- `components/board/task/FollowToggle.tsx` (new — small toggle button mounted in the task drawer header).
- `tests/unit/notification-renderers.test.tsx` (new — render each kind with fixture payloads).
- `tests/unit/notification-store.test.ts` (new — idempotency, unread count, mark-read).

**Forbidden scope:** any server-action change in `cells/actions.ts`, `comments/actions.ts`, `settings/members/actions.ts`, `app/(app)/w/[workspaceSlug]/actions.ts`; any email template; any cron route; any new migration. The bell + center read whatever notifications exist; they must not depend on 2A's specific emitters landing.

**Dependencies:** 1A merged. Independent of 2A (and parallel with 2C/2D/2E within stage 2 once 2A has merged).

**Spec details:**
- Bell: unread-count badge (suppress when 0), Base UI Popover anchored. Match `--shadow-popover`, `--radius-md`, 8px gap; tokens from `design-system.md`.
- Tabs: All / Unread / Mentions. Mentions filter → `kind === 'mention'`.
- Date groups: Today / Yesterday / Earlier this week / Earlier. `date-fns`.
- Item click target: derive route from `payload.board_id` + `task_id` (+ `comment_id` as `?comment=<id>` hash); workspace slug pulled from the existing in-store context. If the user no longer has board access → fall back to `/notifications` with a toast.
- "Mark all read" → `markAllRead({ markAll: true })`; bell goes to 0 optimistically.
- Realtime: one Supabase channel `notifications:<userId>` mounted in the (app) layout, INSERT-only listener with filter `user_id=eq.<userId>`. Tear down on unmount. Idempotent by `id`.
- Bootstrap hydration: server reads up to 50 most-recent notifications + `select count(*) where read_at is null` and passes to bootstrap as initial state.
- Preferences UI: list each non-reserved `NotificationKind` (exclude `status_changed` legacy + `task_created_in_followed` reserved). Per row: in-app `Switch` + email `Select`. Below: digest section — `Switch` digest enabled, `Select` hour (0–23 displayed in local time), `Select` timezone (default `Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Follow toggle: shows current state from `task_follower` (loaded with the task drawer's data path), toggles via `followTask`/`unfollowTask`. Insert into the existing task-drawer header **without** restructuring the drawer.

**Definition of done:**
- Bell shows live unread count (insert a notification row via SQL → badge updates within ~1s in dev).
- Center popover renders existing `mention` notifications produced by epic 09.
- Preferences UI persists changes and reloads from DB.
- Follow toggle persists.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

**Escalation triggers:**
- If hydrating realtime requires modifying `useBoardRealtime`, escalate — these are separate channels.
- If the task-drawer header structure is ambiguous, escalate before restructuring.

#### Slice 2C — Resend integration, React Email templates, mailer route handlers, instant email path

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `package.json` (edit — add `resend`, `@react-email/components`, `@react-email/render`; devDep `react-email`).
- `package.json` scripts: `email:preview` → `react-email dev --dir emails`.
- `lib/email/send.ts` (new — `sendEmail({ to, subject, react, tag })`; honors `EMAIL_SAFE_LIST`; returns `{ skipped: true, reason }` when key absent).
- `lib/email/tokens.ts` (new — email-safe inline brand tokens sourced from `design-system.md`).
- `lib/email/render-notification.ts` (new — `renderNotificationEmail(notification, ctx) → { subject, react, tag }`, switches on kind).
- `lib/email/context.ts` (new — `loadEmailContext(notification)` service-role loader returning `{ recipient, actor, board, workspace, task, comment? }`).
- `emails/layouts/AppShell.tsx` (new — shared header/footer).
- `emails/mention/Mention.tsx`, `emails/assigned/Assigned.tsx`, `emails/comment-reply/CommentReply.tsx`, `emails/comment-on-followed/CommentOnFollowed.tsx`, `emails/status-changed/StatusChanged.tsx` (handles both `_assigned` and `_followed`), `emails/due-soon/DueSoon.tsx` (handles `due_soon` + `due_overdue`), `emails/invite/Invite.tsx` (workspace + board variants), `emails/role-changed/RoleChanged.tsx`, `emails/digest/Digest.tsx` (template only; data wiring lives in 2D — the `DigestData` contract lives in `lib/email/digest.ts`, owned by 2D).
- `app/api/webhooks/notifications/route.ts` (new — Supabase database webhook; `Authorization: Bearer ${SUPABASE_DB_WEBHOOK_SECRET}`; for each record, loads context, consults `getPreferenceFor`, instant-renders + sends, marks `email_sent_at` via the idempotent claim).
- `app/api/cron/notifications-mailer/route.ts` (new — 5-min poll, 30-min lookback, `INTERNAL_CRON_SECRET` + `x-vercel-cron: 1`).
- `vercel.json` (new — declare cron schedules for `/api/cron/notifications-mailer` (`*/5 * * * *`), placeholder entries the other cron slices will append to).
- `app/(app)/w/[workspaceSlug]/actions.ts` (edit — call `sendEmail` for `inviteToWorkspace`; remove the TODO marker).
- `app/(app)/w/[workspaceSlug]/settings/members/actions.ts` (edit — `resendInvitation` actually sends; `revokeInvitation` unchanged).
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/actions.ts` (edit — `inviteToBoard` (added in 2A) calls `sendEmail`).
- `lib/env.ts` (edit — add `EMAIL_FROM`, `EMAIL_SAFE_LIST`, `INTERNAL_CRON_SECRET`, `SUPABASE_DB_WEBHOOK_SECRET`; required in prod via refine, optional in dev).
- `tests/unit/email-render.test.tsx` (new — snapshot each template against fixture data).
- `tests/unit/notification-mailer.test.ts` (new — webhook auth rejection; render path; idempotent claim).

**Forbidden scope:** any UI under `components/notifications/**`; any emitter code (2A); any digest scheduling/aggregation (2D); any cell/comments/board-settings server-action structural change beyond inserting `sendEmail` calls in the spots 2A already touched. (If 2A has not yet merged on the executor's branch, **rebase before pushing** — see merge-conflict notes below.)

**Dependencies:** 1A merged. Recommended to start **after 2A merges** for clean rebases on the shared action files; functionally independent though (mailer can render any kind once 1A is in).

**Spec details:**
- `sendEmail` signature: `async function sendEmail({ to, subject, react, tag }: { to: string; subject: string; react: ReactElement; tag?: string }): Promise<{ id: string } | { skipped: true; reason: 'no-api-key' | 'safe-list-miss' }>`.
- Idempotent claim: `update notification set email_sent_at = now() where id = $1 and email_sent_at is null returning *`. Zero rows → skip.
- Webhook config: prefer Supabase config-as-code (`supabase/config.toml` `[db.webhooks]` block) if local CLI supports it; otherwise document dashboard config in `CONTRIBUTING.md`.
- All templates use inline styles (email-safe) + `@react-email/components`. No external CSS.
- Invitation email body: workspace-only vs board+workspace variants; CTA → `${NEXT_PUBLIC_SITE_URL}/join/<token>`; existing-account vs new-account text variants.

**Definition of done:**
- `pnpm email:preview` opens the React Email playground rendering every template without runtime errors.
- Issuing a workspace invite in dev (with `RESEND_API_KEY` unset) produces a "would-send" envelope log.
- With `RESEND_API_KEY` set, a `notification` row insert triggers an email via the webhook route (documented manual test).
- `vercel.json` has the cron entries.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

**Escalation triggers:**
- If Supabase local CLI does not support `[db.webhooks]`, document the dashboard config and treat the polling route as the primary local path. Not an escalation; just document.
- If a template needs data the `loadEmailContext` helper doesn't return, extend the helper — don't fan out N queries from inside a template.

#### Slice 2D — Digest aggregator, digest cron route, digest scheduling logic

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `lib/email/digest.ts` (new — exports the `DigestData` contract used by 2C's `Digest.tsx`; `buildDigest(userId): Promise<DigestData>`).
- `lib/email/digest-due-users.ts` (new — `findUsersDueForDigest(now: Date): Promise<string[]>` — TZ-aware query against `notification_preference`).
- `app/api/cron/digest/route.ts` (new — 15-min cron; iterates due users; renders + sends; marks `digested_at`).
- `vercel.json` (edit — append `/api/cron/digest` schedule, `*/15 * * * *`).
- `tests/unit/digest-builder.test.ts` (new — fixture-driven counts + grouping).
- `tests/unit/digest-cron.test.ts` (new — TZ-aware due-user calculation).

**Forbidden scope:** any UI; any emitter file (2A); any email template (2C); any new migration; the `emails/digest/Digest.tsx` file itself (template owned by 2C — coordinate via the `DigestData` type).

**Dependencies:** 1A merged. Lands in parallel with 2B/2C/2E after 2A merges.

**Spec details:**
- `DigestData` type:
  ```ts
  export type DigestData = {
    recipient: { displayName: string; email: string };
    counts: { mentions: number; statusChanges: number; assigned: number; commentsOnFollowed: number; total: number };
    sections: Array<{
      board: { id: string; title: string; workspaceSlug: string };
      items: Array<{ id: string; kind: NotificationKind; actor: { name: string }; task: { id: string; title: string }; createdAt: string; href: string }>;
      moreCount: number;
    }>;
    generatedAt: string;
  };
  ```
- Cap each board section at 10 items + `moreCount`.
- "Due" calc: for each preference row with `digest_enabled`, compute the next scheduled time in the user's TZ. If `now()` ∈ `[scheduled, scheduled + 15m)` AND there are pending rows (`digested_at is null and read_at is null and pref.email = 'digest'`) → include.
- Mark `digested_at = now()` only for rows whose preference is `digest` (instant rows owned by 2C).
- Cron auth: same `INTERNAL_CRON_SECRET` pattern as 2C.
- TZ math: `date-fns-tz` is acceptable; if it's not in `package.json`, add it (small surface).

**Definition of done:**
- Unit tests cover TZ edge cases (UTC, America/New_York, Asia/Tokyo) and per-board grouping.
- Running the cron route by hand in dev produces an envelope log.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

**Escalation triggers:**
- If TZ math gets thorny around DST and `date-fns-tz` proves insufficient, escalate — do not silently pull in `luxon`.

#### Slice 2E — Due-soon / due-overdue scanner cron

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `app/api/cron/due-scanner/route.ts` (new — hourly).
- `lib/notifications/due-scanner.ts` (new — service-role helper).
- `vercel.json` (edit — append `/api/cron/due-scanner` schedule, hourly).
- `tests/unit/due-scanner.test.ts` (new).

**Forbidden scope:** any UI; any emitter file (2A); any email template (2C).

**Dependencies:** 1A merged. Lands in parallel with 2B/2C/2D after 2A merges.

**Spec details:**
- Query: join `cell` (where `column.type = 'date'` and `date_value between now() and now() + interval '24 hours'`) with `task` (live), left-join `task_reminder_sent` to exclude already-sent pairs.
- Assignees: read `cell` rows with `column.type = 'person'` for each task; pull `json_value.userIds`.
- Idempotency: `task_reminder_sent (task_id, kind)` pk is the lock; insert before sending.
- `due_overdue`: `date_value < now() AND date_value > now() - interval '1 hour'` AND no `task_reminder_sent(kind='due_overdue')` row. Fires once when it crosses.
- Multiple date columns per board: scan **all** date columns; treat `(task_id, column_id, kind)` independently for the SELECT but key the reminder row by `(task_id, kind)` (so we only notify once per task per kind regardless of which date column). Document this choice in the route's header comment.
- Cron auth: `INTERNAL_CRON_SECRET`.

**Definition of done:**
- Unit tests green; route inserts notifications + reminder rows when run against seed DB.
- `vercel.json` has the schedule.

**Escalation triggers:**
- If the schema for `cell.json_value.userIds` differs from expected, escalate.

---

### Stage 3 — Integration + cleanup cron (sequential)

#### Slice 3A — Cleanup cron + cross-slice integration tests + checkpoint

**Owner:** epic-executor (Sonnet).

**Write scope:**
- `app/api/cron/notification-cleanup/route.ts` (new — daily; deletes `notification` rows where `read_at < now() - interval '90 days'` OR `created_at < now() - interval '365 days'`).
- `vercel.json` (edit — append cleanup schedule, daily 03:00 UTC).
- `tests/unit/notification-cleanup.test.ts` (new).
- `tests/integration/notifications-e2e.test.ts` (new — Vitest integration; seven scenarios listed below).
- `docs/conversion-plan/_dispatch/epic-13-checkpoint-1.md` (new — brief integration report from the executor).

**Forbidden scope:** any production behavior change beyond the cleanup cron itself; rewriting earlier slices' test files (add new ones, don't edit).

**Dependencies:** 2A, 2B, 2C, 2D, 2E all merged.

**Integration scenarios (must all pass):**
1. Post a comment with a `@mention` → recipient has an in-app row within 2s; webhook handler called with that row produces an envelope log.
2. Add a user to a person column → assigned notification fires; user auto-follows the task.
3. Change a status cell on an assigned task → `status_changed_assigned` fires for the assignee.
4. Set a date cell to tomorrow + run the due-scanner → `due_soon` fires; second scanner run does **not** duplicate.
5. Set `prefs.assigned.email = 'off'` → assigning the user produces an in-app row but no email envelope.
6. Issue a workspace invitation → `invitation` row + email envelope log; accept flow still works end-to-end.
7. Set `prefs.assigned.email = 'digest'` + run digest cron → digest envelope includes the assignment; `digested_at` is set.

**Definition of done:**
- All seven scenarios green against local Supabase.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
- `vercel.json` has all four cron entries (mailer poll, digest, due-scanner, cleanup).

**Escalation triggers:**
- If a scenario reveals an emitter bug (not a wiring bug), do not patch the emitter file — escalate with the failing test as the report.

---

## Sequential follow-ups (post-merge)

- **R1 — Opus review pass** (`/execute-epic` will dispatch automatically via the `epic-researcher`). Will audit: visual fidelity of bell + popover against `component-system.md` (no legacy equivalent — tokens still must come from `design-system.md`); accessibility (keyboard nav, focus trap, `aria-live` on arrival); real Resend test-mode delivery against a verified domain (likely deferred to ops).
- **R2 — Hosting tier check.** Vercel Cron cadence relies on Pro tier for `*/5` and `*/15` schedules. If the deploy target is Hobby, the polling and digest will fail to fire. This is a deployment-time decision; document in `CONTRIBUTING.md` as part of slice 2C's writeup.

---

## Risk notes

- **Supabase database webhook reliability.** Primary instant-email path; polling is the safety net. Documented in Q1 / Q2.
- **Skip-self filtering.** Every emitter must filter `actorId`. Easy to miss in `emitStatusChangeNotifications`. Tests must cover.
- **RLS recursion (memory rule).** New policies are simple `user_id = auth.uid()` checks; `task_follower` SELECT joins to `task` via `role_for_board` helper. No recursion risk. Confirm in pgTAP.
- **Cell-derived assignee resolution.** Bounded by `taskId`; do not fetch every assignee on the board.
- **`status_changed` legacy kind.** Reserved in the new constraint; no new code writes it.
- **Email deliverability.** Resend domain verification (DKIM + SPF + DMARC) is an ops task — flagged, not blocking code. `EMAIL_SAFE_LIST` guards preview deploys. All sends carry a `tag`.
- **React Email rendering surface.** Sync-ish render in Node is fine on Vercel; one-call-per-notification is acceptable for v1.
- **TZ math in digest cron.** `date-fns-tz`; DST causes one duplicate/skipped hour per year per TZ — acceptable for v1, documented.
- **Merge-conflict coordination in Stage 2:**
  - 2A + 2C both touch `app/(app)/w/[workspaceSlug]/actions.ts`, `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/actions.ts`, `app/(app)/w/[workspaceSlug]/settings/members/actions.ts`. Resolution: **2A merges first**; 2C rebases.
  - 2C + 2D + 2E all touch `vercel.json`. Resolution: 2C creates the file with the mailer poll entry; 2D and 2E append (one-line additions). If conflicts appear at merge time, the orchestrator resolves by combining the schedules.
- **Out-of-scope deferrals (explicit, not silent):** `task_created_in_followed` kind shelved (Q7); per-board mute, snooze, SMS, mobile push, Slack/Teams (epic doc); email throttling/coalescing (epic doc); Resend delivery/bounce/complaint webhooks (`v1.5` per epic doc); mailpit/Playwright email integration tests (epic 15).

---

## Stage execution order (for `/execute-epic`)

1. **Stage 1**: 1A (alone).
2. **Stage 2a**: 2A (alone — sequential within stage 2 to clear action-file edits before 2C rebases).
3. **Stage 2b**: 2B, 2C, 2D, 2E (parallel).
4. **Stage 3**: 3A (alone).
5. **Review pass** (`epic-researcher` over the merged diff) → followups, if any, until clean.
