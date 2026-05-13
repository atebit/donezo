-- ============================================================
-- Epic 13 — Notifications: DDL additions
-- Migration: 20260516000000_notifications_epic13.sql
--
-- Changes:
--   1. Expand the notification.kind check constraint to all 13 kinds.
--   2. Add email_sent_at and digested_at columns to notification.
--   3. Add performance indexes for mailer polling and digest batching.
--   4. Create notification_preference table (per-user JSON prefs + digest config).
--   5. Create task_follower table (task subscription).
--   6. Create task_reminder_sent table (idempotency guard for due-soon/overdue crons).
--   7. Enable RLS on all three new tables.
-- ============================================================

-- ============================================================
-- 1. Expand notification.kind check constraint
-- ============================================================

alter table public.notification
  drop constraint if exists notification_kind_check;

alter table public.notification
  add constraint notification_kind_check
    check (kind in (
      'mention',
      'assigned',
      'unassigned',
      'comment_reply',
      'comment_on_followed',
      -- 'status_changed' is kept as a reserved/legacy kind; no new emitter writes it.
      'status_changed',
      'status_changed_assigned',
      'status_changed_followed',
      'due_soon',
      'due_overdue',
      'board_invite',
      'role_changed',
      -- 'task_created_in_followed' is reserved; deferred until group-follower model exists (Q7).
      'task_created_in_followed'
    ));

-- ============================================================
-- 2. Add email tracking columns to notification
-- ============================================================

alter table public.notification
  add column if not exists email_sent_at timestamptz;

alter table public.notification
  add column if not exists digested_at timestamptz;

-- ============================================================
-- 3. Performance indexes for mailer and digest cron
-- ============================================================

-- Mailer polling: find notifications where instant email has not been sent.
create index if not exists notification_pending_email_idx
  on public.notification (created_at)
  where email_sent_at is null;

-- Digest batching: find unread, undigested notifications per user.
create index if not exists notification_pending_digest_idx
  on public.notification (user_id, created_at)
  where digested_at is null and read_at is null;

-- ============================================================
-- 4. notification_preference
-- One row per user; stores per-kind prefs as JSON + digest config.
-- ============================================================

create table if not exists public.notification_preference (
  user_id         uuid      primary key references auth.users(id) on delete cascade,
  -- Sparse map: only kinds the user has changed from DEFAULTS are stored.
  -- { "mention": { "inApp": true, "email": "instant" }, ... }
  prefs           jsonb     not null default '{}'::jsonb,
  digest_enabled  boolean   not null default false,
  -- Hour of day (0–23) in digest_timezone when the daily digest fires.
  digest_hour     smallint  not null default 9
                            check (digest_hour between 0 and 23),
  digest_timezone text      not null default 'UTC',
  updated_at      timestamptz not null default now()
);

create trigger notification_preference_set_updated_at
  before update on public.notification_preference
  for each row execute function public.set_updated_at();

alter table public.notification_preference enable row level security;

-- ============================================================
-- 5. task_follower
-- Records a user's subscription to a task's notification stream.
-- ============================================================

create table if not exists public.task_follower (
  task_id     uuid        not null references public.task(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.task_follower enable row level security;

-- ============================================================
-- 6. task_reminder_sent
-- Idempotency guard: prevents the due-scanner cron from sending
-- duplicate due_soon / due_overdue notifications.
-- Primary key (task_id, kind) acts as a distributed lock —
-- one reminder per task per kind, regardless of how many date
-- columns the board has (see due-scanner spec, epic 13 slice 2E).
-- ============================================================

create table if not exists public.task_reminder_sent (
  task_id  uuid        not null references public.task(id) on delete cascade,
  kind     text        not null,
  sent_at  timestamptz not null default now(),
  primary key (task_id, kind)
);

alter table public.task_reminder_sent enable row level security;
-- No RLS policies are added — service-role only (see migration 20260516000001).
