/**
 * lib/notifications/kinds.ts
 *
 * Source of truth for notification kinds, matching the DB constraint in
 * migration 20260516000000_notifications_epic13.sql exactly.
 *
 * RESERVED kinds (no emitter writes them in v1):
 *   - status_changed      — legacy kind; kept in constraint for back-compat.
 *   - task_created_in_followed — deferred until group-follower model exists (Q7).
 *
 * DISPLAY kinds (shown in preferences UI):
 *   All kinds except the two reserved ones above.
 */

// ---------------------------------------------------------------------------
// Kind union and list
// ---------------------------------------------------------------------------

export type NotificationKind =
  | "mention"
  | "assigned"
  | "unassigned"
  | "comment_reply"
  | "comment_on_followed"
  | "status_changed"
  | "status_changed_assigned"
  | "status_changed_followed"
  | "due_soon"
  | "due_overdue"
  | "board_invite"
  | "role_changed"
  | "task_created_in_followed";

/** All 13 kinds in declaration order — mirrors the DB constraint. */
export const NOTIFICATION_KIND_LIST: readonly NotificationKind[] = [
  "mention",
  "assigned",
  "unassigned",
  "comment_reply",
  "comment_on_followed",
  "status_changed",
  "status_changed_assigned",
  "status_changed_followed",
  "due_soon",
  "due_overdue",
  "board_invite",
  "role_changed",
  "task_created_in_followed",
] as const;

/**
 * Kinds that are reserved and must not appear in the preferences UI.
 * - status_changed: legacy; existing rows use it but no new code writes it.
 * - task_created_in_followed: deferred (Q7); group-follower model not yet built.
 */
export const RESERVED_KINDS: readonly NotificationKind[] = [
  "status_changed",
  "task_created_in_followed",
] as const;

/** Active kinds that appear in the preferences UI. */
export const DISPLAY_KINDS: readonly NotificationKind[] = NOTIFICATION_KIND_LIST.filter(
  (k) => !(RESERVED_KINDS as readonly string[]).includes(k),
) as NotificationKind[];

// ---------------------------------------------------------------------------
// Default preferences
// Per-kind defaults for in-app and email delivery channels.
// Rationale for each default is drawn from the epic 13 notifications table.
// ---------------------------------------------------------------------------

export type PrefEntry = {
  inApp: boolean;
  email: "instant" | "digest" | "off";
};

export const DEFAULT_PREFS: Record<NotificationKind, PrefEntry> = {
  mention: { inApp: true, email: "instant" },
  assigned: { inApp: true, email: "instant" },
  unassigned: { inApp: true, email: "off" },
  comment_reply: { inApp: true, email: "instant" },
  comment_on_followed: { inApp: true, email: "digest" },
  // Reserved — kept at defaults but no UI shows these.
  status_changed: { inApp: true, email: "off" },
  status_changed_assigned: { inApp: true, email: "digest" },
  status_changed_followed: { inApp: true, email: "digest" },
  due_soon: { inApp: true, email: "instant" },
  due_overdue: { inApp: true, email: "instant" },
  board_invite: { inApp: true, email: "instant" },
  role_changed: { inApp: true, email: "instant" },
  // Reserved — deferred (Q7).
  task_created_in_followed: { inApp: false, email: "off" },
};

// ---------------------------------------------------------------------------
// Typed payload shapes (discriminated by kind)
// Emitters and renderers use these; the DB stores the union in payload jsonb.
// ---------------------------------------------------------------------------

/** Shared context present in nearly every payload. */
type BasePayload = {
  actor_id: string;
  board_id: string;
  task_id: string;
};

type CommentPayload = BasePayload & { comment_id: string };

export type NotificationPayloadByKind = {
  mention: CommentPayload;
  assigned: BasePayload;
  unassigned: BasePayload;
  comment_reply: CommentPayload;
  comment_on_followed: CommentPayload;
  /** Legacy kind — payload shape is the same as assigned for back-compat. */
  status_changed: BasePayload & { from_label_id: string | null; to_label_id: string | null };
  status_changed_assigned: BasePayload & {
    from_label_id: string | null;
    to_label_id: string | null;
  };
  status_changed_followed: BasePayload & {
    from_label_id: string | null;
    to_label_id: string | null;
  };
  due_soon: BasePayload & { due_date: string };
  due_overdue: BasePayload & { due_date: string };
  board_invite: {
    actor_id: string;
    board_id: string;
    workspace_id: string;
    invitation_id: string;
  };
  role_changed: {
    actor_id: string;
    workspace_id?: string;
    board_id?: string;
    from: string | null;
    to: string;
  };
  /** Reserved — payload shape TBD when group-follower model is built. */
  task_created_in_followed: BasePayload & { group_id: string };
};
