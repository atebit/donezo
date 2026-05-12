/**
 * Activity renderers for task.* events.
 *
 * Covered:
 *   task.created, task.renamed, task.duplicated, task.deleted, task.moved,
 *   task.bulk_deleted, task.bulk_duplicated, task.bulk_moved
 */

import { ActivityLine, getPayloadField, resolveActor } from "./_shared";
import type { ActivityRenderer } from "./index";

export const taskRenderers: Record<string, ActivityRenderer> = {
  "task.created": (event, ctx) => (
    <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
      created this task
    </ActivityLine>
  ),

  "task.renamed": (event, ctx) => {
    const from = getPayloadField<string>(event.payload, "from");
    const to = getPayloadField<string>(event.payload, "to");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        renamed task
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

  "task.duplicated": (event, ctx) => (
    <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
      duplicated this task
    </ActivityLine>
  ),

  "task.deleted": (event, ctx) => (
    <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
      deleted this task
    </ActivityLine>
  ),

  "task.moved": (event, ctx) => {
    const toGroup = getPayloadField<string>(event.payload, "toGroup");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        moved this task
        {toGroup ? (
          <>
            {" "}
            to group <span className="font-medium">{toGroup}</span>
          </>
        ) : (
          ""
        )}
      </ActivityLine>
    );
  },

  "task.bulk_deleted": (event, ctx) => {
    const count = getPayloadField<number>(event.payload, "count");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        deleted {count ?? "multiple"} tasks
      </ActivityLine>
    );
  },

  "task.bulk_duplicated": (event, ctx) => {
    const count = getPayloadField<number>(event.payload, "count");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        duplicated {count ?? "multiple"} tasks
      </ActivityLine>
    );
  },

  "task.bulk_moved": (event, ctx) => {
    const count = getPayloadField<number>(event.payload, "count");
    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        moved {count ?? "multiple"} tasks
      </ActivityLine>
    );
  },
};
