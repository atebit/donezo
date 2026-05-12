/**
 * Activity renderers for comment.* events.
 *
 * Covered:
 *   comment.posted, comment.edited, comment.deleted,
 *   comment.reacted, comment.unreacted
 *
 * Payload shapes (from lib/activity.ts):
 *   comment.posted:    { commentId: string; bodyTextPreview: string }
 *   comment.edited:    { commentId: string }
 *   comment.deleted:   { commentId: string }
 *   comment.reacted:   { commentId: string; emoji: string }
 *   comment.unreacted: { commentId: string; emoji: string }
 */

import { ActivityLine, getPayloadField, resolveActor } from "./_shared";
import type { ActivityRenderer } from "./index";

export const commentRenderers: Record<string, ActivityRenderer> = {
  "comment.posted": (event, ctx) => {
    const preview = getPayloadField<string>(event.payload, "bodyTextPreview");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        posted a comment
        {preview ? (
          <span className="text-fg-muted ml-1 italic truncate max-w-[300px]">
            &ldquo;{preview}&rdquo;
          </span>
        ) : null}
      </ActivityLine>
    );
  },

  "comment.edited": (event, ctx) => (
    <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>edited a comment</ActivityLine>
  ),

  "comment.deleted": (event, ctx) => (
    <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
      deleted a comment
    </ActivityLine>
  ),

  "comment.reacted": (event, ctx) => {
    const emoji = getPayloadField<string>(event.payload, "emoji");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        reacted{emoji ? <> {emoji}</> : ""} to a comment
      </ActivityLine>
    );
  },

  "comment.unreacted": (event, ctx) => {
    const emoji = getPayloadField<string>(event.payload, "emoji");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        removed {emoji ? <>{emoji} </> : ""}reaction from a comment
      </ActivityLine>
    );
  },
};
