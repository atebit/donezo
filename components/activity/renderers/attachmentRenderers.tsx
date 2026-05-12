/**
 * Activity renderers for attachment.* events.
 *
 * Covered:
 *   attachment.uploaded — "{actor} uploaded {filename}"
 *   attachment.deleted  — "{actor} deleted {filename}" (filename shown with strikethrough)
 */

import { Paperclip } from "lucide-react";
import { ActivityLine, getPayloadField, resolveActor } from "./_shared";
import type { ActivityRenderer } from "./index";

export const attachmentRenderers: Record<string, ActivityRenderer> = {
  "attachment.uploaded": (event, ctx) => {
    const filename = getPayloadField<string>(event.payload, "filename");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        <Paperclip
          size={12}
          className="inline-block shrink-0 align-middle mr-0.5"
          aria-hidden="true"
        />
        uploaded{" "}
        {filename ? <span className="font-medium">&ldquo;{filename}&rdquo;</span> : "a file"}
      </ActivityLine>
    );
  },

  "attachment.deleted": (event, ctx) => {
    const filename = getPayloadField<string>(event.payload, "filename");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        <Paperclip
          size={12}
          className="inline-block shrink-0 align-middle mr-0.5"
          aria-hidden="true"
        />
        deleted{" "}
        {filename ? (
          <span className="font-medium line-through">&ldquo;{filename}&rdquo;</span>
        ) : (
          "a file"
        )}
      </ActivityLine>
    );
  },
};
