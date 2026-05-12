"use client";

/**
 * ActivityTab — "Activity" tab in the task drawer.
 *
 * Reads activity events for the task from the board store (selectTaskActivity)
 * and renders them via <ActivityList scope="task" />.
 *
 * The ActivityRenderCtx (columns, labels, profiles) is built from the store's
 * columns + labelsByColumn maps, plus the profiles passed from the server fetch.
 */

import { useMemo } from "react";
import { ActivityList } from "@/components/activity/ActivityList";
import type { ActivityRenderCtx, ProfileRow } from "@/components/activity/renderers/index";
import { selectTaskActivity, useBoardStore } from "@/stores/board-store";

interface ActivityTabProps {
  taskId: string;
  /** Profiles keyed by user id for resolving actor display names. */
  profiles?: Map<
    string,
    { display_name: string | null; avatar_url: string | null; email: string | null }
  >;
}

export function ActivityTab({ taskId, profiles }: ActivityTabProps) {
  const events = useBoardStore((s) => selectTaskActivity(s, taskId));
  const columnsArr = useBoardStore((s) => s.columns);
  const labelsByColumn = useBoardStore((s) => s.labelsByColumn);

  const ctx: ActivityRenderCtx = useMemo(() => {
    const columns = new Map<
      string,
      ActivityRenderCtx["columns"] extends Map<string, infer V> ? V : never
    >();
    for (const col of columnsArr) {
      columns.set(col.id, col);
    }

    const profileMap = new Map<string, ProfileRow>();
    if (profiles) {
      for (const [id, p] of profiles.entries()) {
        profileMap.set(id, {
          id,
          display_name: p.display_name,
          email: p.email,
          avatar_url: p.avatar_url,
          // Required-by-type but unused in renderers — safe synthetic values.
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
          last_workspace_id: null,
        });
      }
    }

    return { columns, labelsByColumn, profiles: profileMap };
  }, [columnsArr, labelsByColumn, profiles]);

  return <ActivityList scope={{ kind: "task", taskId }} events={events} ctx={ctx} />;
}
