/**
 * Activity renderers for label.* events.
 *
 * Covered:
 *   label.created, label.renamed, label.recolored, label.reordered, label.deleted
 */

import { ActivityLine, getPayloadField, resolveActor } from "./_shared";
import type { ActivityRenderer } from "./index";

export const labelRenderers: Record<string, ActivityRenderer> = {
  "label.created": (event, ctx) => {
    const name = getPayloadField<string>(event.payload, "name");
    const color = getPayloadField<string>(event.payload, "color");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        added label{" "}
        {name ? (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white ml-1"
            style={{ backgroundColor: color ?? "var(--color-label-gray)" }}
          >
            {name}
          </span>
        ) : (
          ""
        )}
      </ActivityLine>
    );
  },

  "label.renamed": (event, ctx) => {
    const from = getPayloadField<string>(event.payload, "from");
    const to = getPayloadField<string>(event.payload, "to");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        renamed label
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

  "label.recolored": (event, ctx) => {
    const name = getPayloadField<string>(event.payload, "name");
    const color = getPayloadField<string>(event.payload, "to");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        changed color of label{" "}
        {name ? <span className="font-medium">&ldquo;{name}&rdquo;</span> : ""}
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

  "label.reordered": (event, ctx) => (
    <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>reordered labels</ActivityLine>
  ),

  "label.deleted": (event, ctx) => {
    const name = getPayloadField<string>(event.payload, "name");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        deleted label {name ? <span className="font-medium">&ldquo;{name}&rdquo;</span> : ""}
      </ActivityLine>
    );
  },
};
