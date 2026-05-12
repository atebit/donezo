/**
 * Activity renderers for column.* events.
 *
 * Covered:
 *   column.created, column.renamed, column.reordered, column.duplicated,
 *   column.type_changed, column.deleted, column.settings_updated
 */

import { ActivityLine, getPayloadField, resolveActor } from "./_shared";
import type { ActivityRenderer } from "./index";

export const columnRenderers: Record<string, ActivityRenderer> = {
  "column.created": (event, ctx) => {
    const name = getPayloadField<string>(event.payload, "name");
    const type = getPayloadField<string>(event.payload, "type");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        added column {name ? <span className="font-medium">&ldquo;{name}&rdquo;</span> : ""}
        {type ? <span className="text-fg-muted ml-1">({type})</span> : ""}
      </ActivityLine>
    );
  },

  "column.renamed": (event, ctx) => {
    const from = getPayloadField<string>(event.payload, "from");
    const to = getPayloadField<string>(event.payload, "to");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        renamed column
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

  "column.reordered": (event, ctx) => (
    <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
      reordered columns
    </ActivityLine>
  ),

  "column.duplicated": (event, ctx) => {
    const name = getPayloadField<string>(event.payload, "name");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        duplicated column {name ? <span className="font-medium">&ldquo;{name}&rdquo;</span> : ""}
      </ActivityLine>
    );
  },

  "column.type_changed": (event, ctx) => {
    const from = getPayloadField<string>(event.payload, "from");
    const to = getPayloadField<string>(event.payload, "to");
    const name = getPayloadField<string>(event.payload, "name");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        changed
        {name ? (
          <>
            {" "}
            column <span className="font-medium">&ldquo;{name}&rdquo;</span>
          </>
        ) : (
          " column"
        )}{" "}
        type
        {from && (
          <>
            {" "}
            from <span className="font-medium">{from}</span>
          </>
        )}
        {to && (
          <>
            {" "}
            to <span className="font-medium">{to}</span>
          </>
        )}
      </ActivityLine>
    );
  },

  "column.deleted": (event, ctx) => {
    const name = getPayloadField<string>(event.payload, "name");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        deleted column {name ? <span className="font-medium">&ldquo;{name}&rdquo;</span> : ""}
      </ActivityLine>
    );
  },

  "column.settings_updated": (event, ctx) => {
    const name = getPayloadField<string>(event.payload, "name");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        updated settings for column{" "}
        {name ? <span className="font-medium">&ldquo;{name}&rdquo;</span> : ""}
      </ActivityLine>
    );
  },
};
