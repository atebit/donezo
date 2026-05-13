/**
 * lib/notifications/types.ts
 *
 * TypeScript types for notification-related DB rows and the render context
 * used by email templates and in-app renderers.
 *
 * These types are manually curated for editor ergonomics. The generated
 * lib/supabase/types.ts remains the authoritative DB shape (update it via
 * `pnpm db:types` after migrations land).
 */

import type { NotificationKind, NotificationPayloadByKind, PrefEntry } from "./kinds";

// ---------------------------------------------------------------------------
// DB row types (richer than the generated types, typed payload)
// ---------------------------------------------------------------------------

/** A notification row with a typed payload (discriminated by kind). */
export type TypedNotification<K extends NotificationKind = NotificationKind> = {
  id: string;
  user_id: string;
  kind: K;
  payload: NotificationPayloadByKind[K];
  read_at: string | null;
  created_at: string;
  email_sent_at: string | null;
  digested_at: string | null;
};

/** notification_preference row. */
export type NotificationPreference = {
  user_id: string;
  /** Sparse map — only overridden kinds are stored; merge with DEFAULT_PREFS. */
  prefs: Partial<Record<NotificationKind, PrefEntry>>;
  digest_enabled: boolean;
  /** Hour of day 0–23 in digest_timezone. */
  digest_hour: number;
  digest_timezone: string;
  updated_at: string;
};

/** task_follower row. */
export type TaskFollower = {
  task_id: string;
  user_id: string;
  followed_at: string;
};

/** task_reminder_sent row. */
export type TaskReminderSent = {
  task_id: string;
  kind: string;
  sent_at: string;
};

// ---------------------------------------------------------------------------
// Render context types
// Used by email template loaders and in-app renderer components.
// ---------------------------------------------------------------------------

/** Minimal profile data needed to render a notification. */
export type NotifProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

/** Minimal board data needed to render a notification. */
export type NotifBoard = {
  id: string;
  title: string;
  workspace_id: string;
};

/** Minimal workspace data needed to render a notification. */
export type NotifWorkspace = {
  id: string;
  name: string;
  slug: string;
};

/** Minimal task data needed to render a notification. */
export type NotifTask = {
  id: string;
  title: string;
  board_id: string;
};

/** Minimal comment data needed to render a notification. */
export type NotifComment = {
  id: string;
  body_text: string;
};

/**
 * Full render context loaded by the email context loader.
 * comment is optional — only present for comment-derived kinds.
 */
export type NotificationRenderContext = {
  recipient: NotifProfile;
  actor: NotifProfile;
  board: NotifBoard;
  workspace: NotifWorkspace;
  task: NotifTask;
  comment?: NotifComment;
};
