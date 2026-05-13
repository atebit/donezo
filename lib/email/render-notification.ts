/**
 * lib/email/render-notification.ts
 *
 * Maps a notification kind + context to a { subject, react, tag } envelope
 * ready for sendEmail().
 *
 * Templates are pure React components; all data comes from the EmailContext
 * produced by loadEmailContext().
 */

import type { ReactElement } from "react";
import { AssignedEmail } from "@/emails/assigned/Assigned";
import { CommentOnFollowedEmail } from "@/emails/comment-on-followed/CommentOnFollowed";
import { CommentReplyEmail } from "@/emails/comment-reply/CommentReply";
import { DueSoonEmail } from "@/emails/due-soon/DueSoon";
import { InviteEmail } from "@/emails/invite/Invite";
import { MentionEmail } from "@/emails/mention/Mention";
import { RoleChangedEmail } from "@/emails/role-changed/RoleChanged";
import { StatusChangedEmail } from "@/emails/status-changed/StatusChanged";
import type { EmailContext } from "@/lib/email/context";
import type { NotificationKind } from "@/lib/notifications/kinds";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.donezo.app";

function taskHref(ctx: EmailContext): string {
  if (!ctx.board || !ctx.workspace || !ctx.task) return siteUrl();
  return `${siteUrl()}/w/${ctx.workspace.slug}/b/${ctx.board.id}/task/${ctx.task.id}`;
}

function taskHrefWithComment(ctx: EmailContext): string {
  const base = taskHref(ctx);
  if (!ctx.comment) return base;
  return `${base}?comment=${ctx.comment.id}`;
}

export interface NotificationEmailEnvelope {
  subject: string;
  react: ReactElement;
  tag: string;
}

/**
 * Returns a { subject, react, tag } envelope for the given kind and context,
 * or null if the kind is not email-renderable (reserved kinds, etc.).
 */
export function renderNotificationEmail(
  kind: NotificationKind,
  ctx: EmailContext,
): NotificationEmailEnvelope | null {
  const actorName = ctx.actor.displayName;
  const taskTitle = ctx.task?.title ?? "a task";
  const boardTitle = ctx.board?.title ?? "a board";
  const workspaceName = ctx.workspace?.name ?? "your workspace";
  const commentPreview = ctx.comment?.preview ?? "";

  switch (kind) {
    case "mention":
      return {
        subject: `${actorName} mentioned you in "${taskTitle}"`,
        react: MentionEmail({
          actorName,
          taskTitle,
          boardTitle,
          workspaceName,
          commentPreview,
          ctaHref: taskHrefWithComment(ctx),
        }),
        tag: "mention",
      };

    case "assigned":
      return {
        subject: `${actorName} assigned you to "${taskTitle}"`,
        react: AssignedEmail({
          actorName,
          taskTitle,
          boardTitle,
          workspaceName,
          ctaHref: taskHref(ctx),
        }),
        tag: "assigned",
      };

    case "comment_reply":
      return {
        subject: `${actorName} replied to your comment on "${taskTitle}"`,
        react: CommentReplyEmail({
          actorName,
          taskTitle,
          boardTitle,
          workspaceName,
          commentPreview,
          ctaHref: taskHrefWithComment(ctx),
        }),
        tag: "comment_reply",
      };

    case "comment_on_followed":
      return {
        subject: `${actorName} commented on "${taskTitle}"`,
        react: CommentOnFollowedEmail({
          actorName,
          taskTitle,
          boardTitle,
          workspaceName,
          commentPreview,
          ctaHref: taskHrefWithComment(ctx),
        }),
        tag: "comment_on_followed",
      };

    case "status_changed_assigned":
      return {
        subject: `Status changed on "${taskTitle}"`,
        react: StatusChangedEmail({
          actorName,
          taskTitle,
          boardTitle,
          workspaceName,
          fromLabel: null, // label names resolved client-side; IDs are in payload
          toLabel: null,
          relationship: "assigned",
          ctaHref: taskHref(ctx),
        }),
        tag: "status_changed",
      };

    case "status_changed_followed":
      return {
        subject: `Status changed on "${taskTitle}"`,
        react: StatusChangedEmail({
          actorName,
          taskTitle,
          boardTitle,
          workspaceName,
          fromLabel: null,
          toLabel: null,
          relationship: "followed",
          ctaHref: taskHref(ctx),
        }),
        tag: "status_changed",
      };

    case "due_soon":
      return {
        subject: `"${taskTitle}" is due soon`,
        react: DueSoonEmail({
          taskTitle,
          boardTitle,
          workspaceName,
          dueDate: "soon", // Actual date formatting handled by mailer with payload data
          variant: "due_soon",
          ctaHref: taskHref(ctx),
        }),
        tag: "due_soon",
      };

    case "due_overdue":
      return {
        subject: `"${taskTitle}" is overdue`,
        react: DueSoonEmail({
          taskTitle,
          boardTitle,
          workspaceName,
          dueDate: "overdue",
          variant: "due_overdue",
          ctaHref: taskHref(ctx),
        }),
        tag: "due_overdue",
      };

    case "board_invite": {
      const boardNameForInvite = boardTitle !== "a board" ? boardTitle : undefined;
      return {
        subject: `You've been invited to join ${workspaceName} on Donezo`,
        react: InviteEmail({
          inviterName: actorName,
          workspaceName,
          // token is in the payload; acceptHref is constructed by the mailer
          acceptHref: `${siteUrl()}/join/`, // mailer appends token from payload
          isExistingUser: true, // mailer resolves this from the invitation row
          ...(boardNameForInvite ? { boardName: boardNameForInvite } : {}),
        }),
        tag: "board_invite",
      };
    }

    case "role_changed":
      return {
        subject: `Your role in ${workspaceName} has been updated`,
        react: RoleChangedEmail({
          actorName,
          contextName: ctx.board?.title ?? workspaceName,
          contextKind: ctx.board ? "board" : "workspace",
          fromRole: null,
          toRole: "member",
          ctaHref: siteUrl(),
        }),
        tag: "role_changed",
      };

    // Reserved / no email for these kinds.
    case "unassigned":
    case "status_changed":
    case "task_created_in_followed":
      return null;

    default: {
      // TypeScript exhaustiveness — this should never be reached.
      const _exhaustive: never = kind;
      return null;
    }
  }
}
