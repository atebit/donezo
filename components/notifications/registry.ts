/**
 * components/notifications/registry.ts
 *
 * Maps each NotificationKind to its React renderer component.
 * The registry is used by NotificationItem to pick the right renderer.
 * Unknown / reserved kinds fall through to the fallback renderer.
 */

import type { ComponentType } from "react";
import type { NotificationKind } from "@/lib/notifications/kinds";
import type { AnyNotification } from "@/stores/notification-store";

export type RendererProps = { notification: AnyNotification };
export type RendererComponent = ComponentType<RendererProps>;

/**
 * Kind-to-renderer map.
 * Cast to RendererProps at call-site since each renderer accepts a narrower
 * TypedNotification<K> — the cast is safe because the registry is keyed by kind.
 */
import { AssignedRenderer, UnassignedRenderer } from "./renderers/assigned";
import { CommentOnFollowedRenderer, CommentReplyRenderer } from "./renderers/comment";
import { DueOverdueRenderer, DueSoonRenderer } from "./renderers/due";
import { BoardInviteRenderer } from "./renderers/invite";
import { MentionRenderer } from "./renderers/mention";
import { RoleChangedRenderer } from "./renderers/role";
import { StatusChangedAssignedRenderer, StatusChangedFollowedRenderer } from "./renderers/status";

export const NOTIFICATION_RENDERERS: Partial<Record<NotificationKind, RendererComponent>> = {
  mention: MentionRenderer as RendererComponent,
  assigned: AssignedRenderer as RendererComponent,
  unassigned: UnassignedRenderer as RendererComponent,
  comment_reply: CommentReplyRenderer as RendererComponent,
  comment_on_followed: CommentOnFollowedRenderer as RendererComponent,
  status_changed_assigned: StatusChangedAssignedRenderer as RendererComponent,
  status_changed_followed: StatusChangedFollowedRenderer as RendererComponent,
  due_soon: DueSoonRenderer as RendererComponent,
  due_overdue: DueOverdueRenderer as RendererComponent,
  board_invite: BoardInviteRenderer as RendererComponent,
  role_changed: RoleChangedRenderer as RendererComponent,
};
