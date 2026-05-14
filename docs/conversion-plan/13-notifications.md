# Epic 13 — Notifications (In-App + Email)

## Goal

Deliver notifications to users in-app (real-time bell + center) and via email (Resend), driven by mentions, assignments, status changes on followed tasks, due-date reminders, comment replies, board invitations, and other notable events. Per-user preferences gate which kinds trigger which channels. Email digest as an opt-in for low-priority kinds.

## Why this is its own epic

Notification fan-out, preferences, delivery channels, email rendering, scheduling (due-soon, digests), and the in-app notification UI are a coherent block. Embedding any one piece in another epic produces inconsistency.

## In scope

- Notification kinds with payload shapes.
- In-app notification center: bell icon with unread count, panel listing notifications, mark-read, mark-all-read.
- Real-time delivery via Supabase Realtime on the `notification` table.
- Email delivery via Resend, using React Email templates.
- Per-user preferences: per-kind toggle for in-app, email-instant, email-digest.
- Scheduled jobs: due-soon scanner, daily digest.
- Email send pipeline: a server-side worker that listens for new notifications and sends emails (Edge Function + Realtime, or scheduled poll).
- Board invitations email (the missing piece from [04](04-authorization-rls.md)/[05](05-workspaces-boards.md)).
- Comment-reply notifications (a sub-kind of mention pipeline).
- Followers system (you can "follow" a task to get notified on changes).

## Out of scope

- Mobile push notifications.
- Slack / Teams integration.
- SMS.
- Per-board notification overrides (defer; v1 = per-user-global only).

## Dependencies

[02](02-supabase-schema.md), [03](03-auth.md), [04](04-authorization-rls.md), [07](07-column-system.md), [08](08-realtime-presence.md), [09](09-comments-activity.md), [10](10-attachments.md).

## Architecture & design choices

### Notification kinds

| Kind | Triggered by | Recipient | Default in-app | Default email |
|---|---|---|---|---|
| `mention` | Comment with @mention | Mentioned user | yes | instant |
| `assigned` | Person column → user added | Newly assigned user | yes | instant |
| `unassigned` | Person column → user removed | Removed user | yes | off |
| `comment_reply` | Reply to a comment you wrote | Original author | yes | instant |
| `comment_on_followed` | Comment on a task you follow | Follower | yes | digest |
| `status_changed_assigned` | Status cell changes on task you're assigned to | Assignees | yes | digest |
| `status_changed_followed` | Status changes on followed task | Follower | yes | off |
| `due_soon` | Date column due in 24h on assigned task | Assignees | yes | instant |
| `due_overdue` | Date passes on assigned task | Assignees | yes | instant |
| `board_invite` | Workspace/board invitation | Invitee | yes (and email) | instant (always) |
| `role_changed` | Your role on a board changed | User | yes | off |
| `task_created_in_followed` | New task in a board section you follow | Follower | yes | digest |

### Preferences shape

```sql
create table public.notification_preference (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  digest_enabled boolean not null default true,
  digest_hour int not null default 9 check (digest_hour between 0 and 23), -- in user's timezone
  digest_timezone text not null default 'UTC',
  updated_at timestamptz not null default now()
);
```

`prefs` shape:

```ts
type NotificationPrefs = Partial<Record<NotificationKind, {
  inApp: boolean;
  email: 'instant' | 'digest' | 'off';
}>>;
```

Missing kinds fall back to defaults from the table above.

### Followers

A task can be "followed" by anyone with read access. Following auto-engages on:

- Posting a comment on the task.
- Being mentioned.
- Being assigned (person column).

Plus an explicit "Follow" button in the task drawer (toggles a `task_follower` row).

```sql
create table public.task_follower (
  task_id uuid not null references public.task(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.task_follower enable row level security;

create policy "task_follower_select" on public.task_follower for select using (
  user_id = auth.uid() or
  exists (select 1 from public.task t where t.id = task_follower.task_id
    and role_for_board(t.board_id, auth.uid()) is not null)
);
create policy "task_follower_modify" on public.task_follower for all using (user_id = auth.uid());
```

A user's followed set is small enough to query on demand; no cache needed.

### Notification creation pipeline

Server actions emit notifications inline (not via DB triggers — same reasoning as activity).

A common helper:

```ts
// lib/notifications/emit.ts
import { admin } from "@/lib/supabase/admin";

export async function emitNotifications(rows: NotificationInsert[]) {
  if (rows.length === 0) return;
  await admin.from("notification").insert(rows);
}
```

Specific emitters per use case:

```ts
// lib/notifications/emitters.ts
export async function emitMentionNotifications(args: {
  boardId: string; taskId: string; commentId: string; authorId: string; mentionedUserIds: string[];
}) {
  const recipients = args.mentionedUserIds.filter(id => id !== args.authorId);
  // RLS check: only emit for users who can see the board
  const accessible = await filterByBoardAccess(args.boardId, recipients);
  await emitNotifications(accessible.map(userId => ({
    user_id: userId,
    kind: 'mention',
    payload: { board_id: args.boardId, task_id: args.taskId, comment_id: args.commentId, actor_id: args.authorId },
  })));
}

export async function emitAssignmentNotifications(args: { boardId, taskId, columnId, addedUserIds, actorId }) { ... }
export async function emitStatusChangeNotifications(args: { boardId, taskId, columnId, fromLabelId, toLabelId, actorId }) { ... }
```

The server actions in [07](07-column-system.md) and [09](09-comments-activity.md) call these inline after the primary mutation. Failures don't roll back the primary mutation — log and move on.

### Real-time delivery (in-app)

The `notification` table is in the realtime publication ([02](02-supabase-schema.md)). The authed app shell subscribes to a per-user channel `notifications:<userId>`:

```ts
const channel = supabase.channel(`notifications:${userId}`);
channel.on("postgres_changes",
  { event: "INSERT", schema: "public", table: "notification", filter: `user_id=eq.${userId}` },
  (e) => store.addNotification(e.new));
channel.subscribe();
```

The bell icon shows the unread count from the store. Clicking opens the notification panel.

### Notification panel UI

`<NotificationCenter />`:

- Tabs: All, Unread, Mentions.
- List grouped by date (Today, Yesterday, Earlier).
- Each item: actor avatar + verb + context + relative time + "Mark read" / link to source.
- Bottom: "Mark all read" + "Notification settings" link.

Items are renderable using kind-specific renderers (parallel to activity renderers). Each renderer takes the notification row and renders a click target that navigates to the source (task drawer with comment id, board, etc.).

### Email delivery — pipeline

Two paths:

1. **Instant emails**: sent within seconds of the notification.
2. **Digest emails**: batched daily at user's configured hour.

#### Instant: Edge Function + Realtime

A Supabase Edge Function `notification-mailer` subscribes to the `notification` table via Realtime and sends emails via Resend for `email: 'instant'` preferences.

But: Edge Functions don't run continuously. Three viable patterns:

- **(A) Database webhook** (Supabase feature): on `notification` insert, hit an Edge Function HTTP endpoint with the row. Send email synchronously. ✅ Simple, reliable, scales.
- **(B) Polling Edge Function** every minute via cron. Find rows with `notified_at is null and created_at > now() - 5m` and send. Robust to webhook downtime.
- **(C) Inline send from server action.** Do it in-process. Couples notification logic to mutation latency; not recommended.

**Choice: (A) primary, (B) as a fallback safety net.** Webhook handles the common path; polling covers edge cases (webhook missed, transient error). Mark `notification.email_sent_at` to avoid duplicates.

```sql
alter table public.notification add column email_sent_at timestamptz;
alter table public.notification add column digested_at timestamptz; -- for digests
```

#### Digest: scheduled cron

A pg_cron (Supabase Pro feature) or scheduled Edge Function runs every 15 minutes:

- For each user whose configured digest hour falls in the past 15 minutes (in their TZ), gather all `digest`-channel notifications since last digest, render one email, send, mark `digested_at = now()` on each.

### Email templates — React Email

`emails/` directory with one component per kind:

```
emails/
  layouts/AppShell.tsx
  digest/Digest.tsx
  mention/Mention.tsx
  assigned/Assigned.tsx
  due-soon/DueSoon.tsx
  invite/Invite.tsx
  ...
```

React Email renders to HTML via `@react-email/render`. Server-side, the mailer Edge Function imports the template, hydrates with notification + context data, sends via Resend.

Each template inherits a shared layout (header, footer, brand). Brand tokens come from `lib/email-tokens.ts`.

### Resend integration

```ts
// lib/email/send.ts (server-only)
import { Resend } from "resend";
import { env } from "@/lib/env";
import { render } from "@react-email/render";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail(args: {
  to: string;
  subject: string;
  template: ReactNode;
  tag?: string;
}) {
  const html = await render(args.template);
  await resend.emails.send({
    from: 'Donezo <noreply@donezo.app>',
    to: args.to,
    subject: args.subject,
    html,
    tags: args.tag ? [{ name: 'kind', value: args.tag }] : undefined,
  });
}
```

A Resend domain (donezo.app) with verified DKIM/SPF. Inbound replies are not supported in v1 (`noreply@`).

### Due-date scanner

A scheduled Edge Function runs hourly:

```sql
-- supabase/functions/due-soon-scanner/index.ts (pseudocode)
-- For every task with a `date` cell whose value is between now() and now() + interval '24 hours',
-- and the task hasn't been notified for 'due_soon' yet,
-- emit `due_soon` notifications to all assignees.
```

Track sent reminders in a small `task_reminder_sent(task_id, kind)` table to avoid duplicates.

```sql
create table public.task_reminder_sent (
  task_id uuid not null references public.task(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (task_id, kind)
);
```

Same scanner emits `due_overdue` once when a date passes.

### Notification preferences UI

Account settings → "Notifications" section:

- Per-kind: in-app toggle, email mode (instant / digest / off).
- Digest section: enable, hour, timezone (auto-detected, editable).

UI uses shadcn's Switch + Select. Server action `updatePreferences({ prefs, digestEnabled, digestHour, digestTimezone })`.

### Workspace/board invitation emails

The `inviteToWorkspace` and `inviteToBoard` server actions ([04](04-authorization-rls.md)) currently log the invitation; this epic wires the email send. Template: `emails/invite/Invite.tsx`. The recipient may not have an account yet; the email links to `/join/<token>` ([05](05-workspaces-boards.md)).

### Read state

Marking read updates `notification.read_at`. Bulk mark-all-read updates all rows for the user.

A "snooze" feature (mark-read-and-resurface-tomorrow) is out of scope.

### Performance

- Notification inserts are bulk per emit (one INSERT statement with N rows).
- Realtime fan-out is O(active sessions) — fine for an internal tool.
- Email sends are async via the mailer; won't slow user-facing actions.

## Tasks

1. **Migrations**: `notification_preference`, `task_follower`, `task_reminder_sent`, `notification.email_sent_at`, `notification.digested_at`.
2. **RLS policies** for new tables.
3. **`emitNotifications`** helper + per-kind emitters.
4. **Wire emitters** into mutating server actions:
   - `createComment` ([09](09-comments-activity.md)): mention, comment_reply, comment_on_followed.
   - `setCellValue` for person columns ([07](07-column-system.md)): assigned/unassigned.
   - `setCellValue` for status columns ([07](07-column-system.md)) on followed/assigned tasks.
   - `inviteToWorkspace/Board` ([04](04-authorization-rls.md)): board_invite.
   - `setBoardMemberRole`/`setWorkspaceMemberRole` ([05](05-workspaces-boards.md)): role_changed.
5. **`<NotificationBell />`** in the topbar with unread count.
6. **`<NotificationCenter />`** panel with tabs and grouped list.
7. **Per-kind notification renderers** parallel to activity renderers.
8. **Auto-follow rules** (commenting, mentioning, being assigned) implemented in the relevant server actions.
9. **Manual follow toggle** in task drawer.
10. **Realtime subscription** to `notification` per user; idempotent store apply.
11. **Resend account setup** (domain, DKIM/SPF, sending key).
12. **`emails/` React Email templates** for every kind + a shared layout.
13. **Mailer Edge Function** with database webhook handler.
14. **Polling Edge Function** as a safety net (every 5 minutes; sends `email_sent_at is null and created_at > 5m ago`).
15. **Digest Edge Function** scheduled every 15 minutes.
16. **Due-soon / due-overdue scanner** scheduled hourly.
17. **Notification preferences UI** in account settings.
18. **Tests**:
    - Unit: emitters insert correct rows for each scenario.
    - Integration: post a comment with @mention → recipient gets in-app + email.
    - Integration: invite a user → email sent; click link → join flow.
    - Integration: change due date to tomorrow → due_soon emitted next scanner run.
    - E2E: configure preferences → email-off kind doesn't send; kind set to digest → batched in next digest.

## Definition of done

- A user mentioned in a comment receives an in-app notification within seconds and an email shortly after.
- An assigned task triggers an `assigned` notification.
- A task with a due date triggers `due_soon` then `due_overdue`.
- The bell icon shows the unread count and updates in real-time.
- The notification panel groups by date and renders per-kind appropriately.
- Per-kind preferences and digest schedule work; emails honor settings.
- Workspace/board invitation emails actually send.
- Followed tasks notify on relevant changes.
- Tests cover the emit + delivery path for the core kinds.

## Open questions

- **Self-notifications.** The skip-self rule: never notify a user about their own action. Verify in every emitter.
- **Email throttling.** A burst of mentions across many comments could spam. Add a 5-minute coalescing window per (user, board, kind)? Defer; observe.
- **Digest content.** What's in it? "8 mentions across 3 boards, 4 status changes, 2 new tasks assigned." Spec the layout.
- **Notification cleanup.** Old read notifications grow forever. Add a TTL of 90 days for read notifications. Recommended.
- **Per-board notification toggle.** "Mute this board." Useful but defer.
- **Preferences default.** First-time defaults match the table at the top. Make sure new users don't get *every* kind by default — the table's defaults are conservative.
- **Email rendering.** React Email's testing story is via Inbucket / mailpit locally. Wire that into Playwright.
- **Resend webhooks.** Track delivery / bounce / complaint events to inform users. Defer to v1.5.
