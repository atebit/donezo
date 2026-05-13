/**
 * lane-bucketing.ts — pure function that groups tasks into kanban lanes.
 *
 * Supports group-by column types: status, priority, person, checkbox.
 *
 * Rules per Q8 / Q9 from the dispatch plan:
 *   - status / priority: one lane per label (label.position order); null → "Unassigned" last.
 *   - person: one lane per workspace member (alpha by display_name) + "Unassigned" last.
 *     A task with multiple assignees appears in EVERY assigned member's lane; React keys use
 *     `${laneId}:${taskId}` to prevent collisions.
 *   - checkbox: exactly two lanes — "Unchecked" (null/false) and "Checked" (true).
 *
 * This module has no React / Next.js / Supabase imports; it is a pure data
 * transformation function and is fully unit-testable via Vitest without JSdom.
 */

import type { Cell, Column, Task } from "@/components/board/table/types";
import type { WorkspaceMemberWithProfile } from "@/lib/board/load-board-snapshot";
import type { Database } from "@/lib/supabase/types";

type Label = Database["public"]["Tables"]["label"]["Row"];

export type Lane = {
  /** Stable id used as dnd-kit droppable id and React list key prefix. */
  id: string;
  title: string;
  /** Background colour for the lane header (status/priority label colour). */
  color?: string;
  /** Task ids in task.position ascending order. */
  taskIds: string[];
  /**
   * The cell value that should be written when a card is dropped into this lane
   * via setCellValue. Shape depends on the column type:
   *   - status / priority: { labelId: string | null }
   *   - person: { userIds: [string] } (single-user; overwrites multi-assign)
   *   - checkbox: boolean | null
   */
  dropValue: unknown;
  /** For person lanes: the member id (null = Unassigned). */
  memberId?: string | null;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract the labelId from a cell row (stored in `label_id`). */
function labelIdFromCell(cell: Cell | undefined): string | null {
  return cell?.label_id ?? null;
}

/** Extract user ids from a person cell row (stored in `json_value.userIds`). */
function userIdsFromCell(cell: Cell | undefined): string[] {
  if (!cell?.json_value) return [];
  const json = cell.json_value as { userIds?: unknown };
  if (!Array.isArray(json.userIds)) return [];
  return json.userIds.filter((id): id is string => typeof id === "string");
}

/** Extract boolean from a checkbox cell row (stored in `boolean_value`). */
function checkboxValueFromCell(cell: Cell | undefined): boolean | null {
  if (cell?.boolean_value === true) return true;
  if (cell?.boolean_value === false) return false;
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BucketTasksArgs {
  groupByColumnId: string;
  tasks: Task[];
  /** Map keyed `task_id:column_id` → Cell row (from board store). */
  cellsByKey: Map<string, Cell>;
  columns: Column[];
  /** Map keyed `column_id` → Label[] sorted by label.position asc. */
  labelsByColumn: Map<string, Label[]>;
  /** Workspace members for person lanes. */
  members: WorkspaceMemberWithProfile[];
}

export function bucketTasksIntoLanes(args: BucketTasksArgs): Lane[] {
  const { groupByColumnId, tasks, cellsByKey, columns, labelsByColumn, members } = args;

  const col = columns.find((c) => c.id === groupByColumnId);
  if (!col) return [];

  const colType = col.type;

  // Tasks are already sorted by position ascending from the store hydration.
  // We preserve that order within each lane.

  if (colType === "status" || colType === "priority") {
    return bucketByLabel({ groupByColumnId, tasks, cellsByKey, labelsByColumn });
  }

  if (colType === "person") {
    return bucketByPerson({ groupByColumnId, tasks, cellsByKey, members });
  }

  if (colType === "checkbox") {
    return bucketByCheckbox({ groupByColumnId, tasks, cellsByKey });
  }

  // Unsupported column type — return empty (picker filters to supported types).
  return [];
}

// ---------------------------------------------------------------------------
// Status / priority bucketing
// ---------------------------------------------------------------------------

function bucketByLabel(args: {
  groupByColumnId: string;
  tasks: Task[];
  cellsByKey: Map<string, Cell>;
  labelsByColumn: Map<string, Label[]>;
}): Lane[] {
  const { groupByColumnId, tasks, cellsByKey, labelsByColumn } = args;
  const labels = labelsByColumn.get(groupByColumnId) ?? [];

  // Build a map from label.id → lane index.
  const labelLaneMap = new Map<string, Lane>();
  for (const lbl of labels) {
    labelLaneMap.set(lbl.id, {
      id: lbl.id,
      title: lbl.name,
      color: lbl.color ?? undefined,
      taskIds: [],
      dropValue: { labelId: lbl.id },
    });
  }

  // "Unassigned" lane — always last.
  const unassigned: Lane = {
    id: "unassigned",
    title: "Unassigned",
    taskIds: [],
    dropValue: { labelId: null },
  };

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${groupByColumnId}`);
    const labelId = labelIdFromCell(cell);

    if (labelId && labelLaneMap.has(labelId)) {
      // biome-ignore lint/style/noNonNullAssertion: existence confirmed by has() above
      labelLaneMap.get(labelId)!.taskIds.push(task.id);
    } else {
      unassigned.taskIds.push(task.id);
    }
  }

  const lanes: Lane[] = [...labelLaneMap.values(), unassigned];
  return lanes;
}

// ---------------------------------------------------------------------------
// Person bucketing
// ---------------------------------------------------------------------------

function bucketByPerson(args: {
  groupByColumnId: string;
  tasks: Task[];
  cellsByKey: Map<string, Cell>;
  members: WorkspaceMemberWithProfile[];
}): Lane[] {
  const { groupByColumnId, tasks, cellsByKey, members } = args;

  // Sort members alphabetically by display_name (null names sort last).
  const sortedMembers = [...members].sort((a, b) => {
    const nameA = a.display_name ?? a.email ?? "";
    const nameB = b.display_name ?? b.email ?? "";
    return nameA.localeCompare(nameB);
  });

  // Build lane map keyed by member user_id.
  const memberLaneMap = new Map<string, Lane>();
  for (const member of sortedMembers) {
    memberLaneMap.set(member.user_id, {
      id: member.user_id,
      title: member.display_name ?? member.email ?? member.user_id,
      taskIds: [],
      dropValue: { userIds: [member.user_id] },
      memberId: member.user_id,
    });
  }

  const unassigned: Lane = {
    id: "unassigned",
    title: "Unassigned",
    taskIds: [],
    dropValue: { userIds: [] },
    memberId: null,
  };

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${groupByColumnId}`);
    const userIds = userIdsFromCell(cell);

    if (userIds.length === 0) {
      unassigned.taskIds.push(task.id);
    } else {
      // Task appears in every assigned member's lane (multi-assignee case).
      let appearedInAtLeastOne = false;
      for (const uid of userIds) {
        const lane = memberLaneMap.get(uid);
        if (lane) {
          lane.taskIds.push(task.id);
          appearedInAtLeastOne = true;
        }
      }
      // If all userIds refer to non-members (e.g. removed members), put in unassigned.
      if (!appearedInAtLeastOne) {
        unassigned.taskIds.push(task.id);
      }
    }
  }

  return [...memberLaneMap.values(), unassigned];
}

// ---------------------------------------------------------------------------
// Checkbox bucketing
// ---------------------------------------------------------------------------

function bucketByCheckbox(args: {
  groupByColumnId: string;
  tasks: Task[];
  cellsByKey: Map<string, Cell>;
}): Lane[] {
  const { groupByColumnId, tasks, cellsByKey } = args;

  const unchecked: Lane = {
    id: "unchecked",
    title: "Unchecked",
    taskIds: [],
    dropValue: false,
  };

  const checked: Lane = {
    id: "checked",
    title: "Checked",
    taskIds: [],
    dropValue: true,
  };

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${groupByColumnId}`);
    const val = checkboxValueFromCell(cell);
    if (val === true) {
      checked.taskIds.push(task.id);
    } else {
      unchecked.taskIds.push(task.id);
    }
  }

  return [unchecked, checked];
}
