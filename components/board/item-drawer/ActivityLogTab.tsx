"use client";

/**
 * ActivityLogTab — activity log tab for the inline item drawer (Epic 16 / Slice G).
 *
 * Read-only chronological list of activity events for the task.
 * Reuses the existing <ActivityList> / <ActivityItem> primitives from epic 09.
 *
 * Forbidden scope: activity log filtering, new server actions.
 */

import { useMemo } from "react";
import { ActivityList } from "@/components/activity/ActivityList";
import type { ActivityRenderCtx, ProfileRow } from "@/components/activity/renderers/index";
import { selectTaskActivity, useBoardStore } from "@/stores/board-store";

interface ActivityLogTabProps {
  taskId: string;
}

export function ActivityLogTab({ taskId }: ActivityLogTabProps) {
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
    // Profiles aren't available in the inline drawer without a server fetch.
    // Pass an empty map — ActivityItem falls back to userId display gracefully.
    const profiles = new Map<string, ProfileRow>();

    return { columns, labelsByColumn, profiles };
  }, [columnsArr, labelsByColumn]);

  return <ActivityList scope={{ kind: "task", taskId }} events={events} ctx={ctx} />;
}
