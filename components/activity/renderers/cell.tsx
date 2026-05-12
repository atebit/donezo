/**
 * Activity renderers for cell.* events.
 *
 * Covered: cell.changed, cell.bulk_changed
 *
 * cell.changed payload (from epic 09 activity vocab):
 *   { columnId: string; columnType: string; from: unknown; to: unknown }
 *
 * This is the primary consumer of <CellInline /> — renders from/to values
 * using the same cell registry as the table view, so status pills render
 * with the same colored pill chrome.
 */

import type { CellTypeId } from "@/lib/cells/types";
import { CellInline } from "../CellInline";
import { ActivityLine, getPayloadField, resolveActor } from "./_shared";
import type { ActivityRenderer } from "./index";

export const cellRenderers: Record<string, ActivityRenderer> = {
  "cell.changed": (event, ctx) => {
    const columnId = getPayloadField<string>(event.payload, "columnId");
    const columnType = getPayloadField<string>(event.payload, "columnType");
    const from = getPayloadField<unknown>(event.payload, "from");
    const to = getPayloadField<unknown>(event.payload, "to");

    // Resolve column metadata
    const column = columnId ? ctx.columns.get(columnId) : undefined;
    const colName = column?.name ?? columnId ?? "a column";

    // Validate the column type is a known CellTypeId
    const knownType = columnType as CellTypeId | undefined;

    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        changed <span className="font-medium">{colName}</span>
        {from !== undefined && knownType ? (
          <>
            {" "}
            from <CellInline type={knownType} value={from} />
          </>
        ) : from !== undefined ? (
          <>
            {" "}
            from <span className="font-medium text-fg-muted">{JSON.stringify(from)}</span>
          </>
        ) : null}
        {to !== undefined && knownType ? (
          <>
            {" "}
            to <CellInline type={knownType} value={to} />
          </>
        ) : to !== undefined ? (
          <>
            {" "}
            to <span className="font-medium text-fg-muted">{JSON.stringify(to)}</span>
          </>
        ) : null}
      </ActivityLine>
    );
  },

  "cell.bulk_changed": (event, ctx) => {
    const count = getPayloadField<number>(event.payload, "count");
    const columnId = getPayloadField<string>(event.payload, "columnId");
    const column = columnId ? ctx.columns.get(columnId) : undefined;
    const colName = column?.name ?? columnId ?? "a column";

    return (
      <ActivityLine actor={resolveActor(event.actor_id, ctx.profiles)}>
        updated {count ?? "multiple"} cells in <span className="font-medium">{colName}</span>
      </ActivityLine>
    );
  },
};
