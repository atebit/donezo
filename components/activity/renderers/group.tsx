/**
 * Activity renderers for group.* events.
 *
 * Covered:
 *   group.created, group.renamed, group.recolored, group.reordered,
 *   group.duplicated, group.deleted
 */

import { ActivityLine, getPayloadField, resolveActor } from "./_shared";
import type { ActivityRenderer } from "./index";

export const groupRenderers: Record<string, ActivityRenderer> = {
  "group.created": (event, ctx) => {
    const name = getPayloadField<string>(event.payload, "name");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        created group {name ? <span className="font-medium">&ldquo;{name}&rdquo;</span> : ""}
      </ActivityLine>
    );
  },

  "group.renamed": (event, ctx) => {
    const from = getPayloadField<string>(event.payload, "from");
    const to = getPayloadField<string>(event.payload, "to");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        renamed group
        {from && (
          <>
            {" "}
            from <span className="font-medium">&ldquo;{from}&rdquo;</span>
          </>
        )}
        {to && (
          <>
            {" "}
            to <span className="font-medium">&ldquo;{to}&rdquo;</span>
          </>
        )}
      </ActivityLine>
    );
  },

  "group.recolored": (event, ctx) => {
    const color = getPayloadField<string>(event.payload, "to");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        changed group color
        {color && (
          <>
            {" "}
            to{" "}
            <span
              className="inline-block w-3 h-3 rounded-full align-middle ml-1"
              style={{ backgroundColor: color }}
              aria-hidden="true"
              title={color}
            />
          </>
        )}
      </ActivityLine>
    );
  },

  "group.reordered": (event, ctx) => (
    <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>reordered groups</ActivityLine>
  ),

  "group.duplicated": (event, ctx) => {
    const name = getPayloadField<string>(event.payload, "name");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        duplicated group {name ? <span className="font-medium">&ldquo;{name}&rdquo;</span> : ""}
      </ActivityLine>
    );
  },

  "group.deleted": (event, ctx) => {
    const name = getPayloadField<string>(event.payload, "name");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        deleted group {name ? <span className="font-medium">&ldquo;{name}&rdquo;</span> : ""}
      </ActivityLine>
    );
  },
};
