/**
 * apply-group-by — client-side task bucketing.
 *
 * Column-based group-by + DnD interaction contract (Epic 11, cross-slice):
 *   When `effective.groupBy?.kind === "column"`, DnD reorder of tasks across
 *   buckets is DISABLED. Moving a task between alt-group-by buckets would imply
 *   mutating `cell.value`, not `task.group_id` — confusing semantics.
 *   Slice D's drag-handle render must gate on this as well.
 *
 * TODO(slice-D): gate DragHandle render on `effective.groupBy?.kind !== "column"`
 * before exposing the drag affordance to users.
 *
 * Bucket order (per Q13):
 *   - status/priority: by label.position ascending; "Uncategorized" last.
 *   - person: alphabetical (v1 — no display-name resolve; sorts by userId).
 *   - date: ascending ISO string; "No date" last.
 *   - checkbox: Checked first, Unchecked second.
 *   - all others: by def.compare on the value, "Uncategorized" last.
 */

import type { Cell, Column, Task } from "@/components/board/table/types";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import type { Database } from "@/lib/supabase/types";
import type { GroupBy } from "@/lib/views/config-schema";

type Group = Database["public"]["Tables"]["group"]["Row"];

export type GroupBucket = {
  /** Synthetic id. For native groups: the group id. For alt: e.g. `label:<id>` / `person:<uid>` / `none`. */
  key: string;
  /** Display title shown in the group header. */
  label: string;
  /** Optional accent color (for status/priority/native group buckets). */
  color: string | null;
  /** Tasks in this bucket. */
  tasks: Task[];
};

/**
 * Produce a flat list of `GroupBucket`s from a set of tasks.
 *
 * - When `groupBy` is `undefined` or `{ kind: "native" }`: one bucket per
 *   structural group row, in `position` order. Tasks are assigned to the bucket
 *   matching their `task.group_id`.
 * - When `groupBy.kind === "column"`: tasks are bucketed by the value of the
 *   specified column's cell. Structural groups are hidden for this view.
 */
export function applyGroupBy(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  groupBy: GroupBy | undefined,
  structuralGroups: Group[],
): GroupBucket[] {
  // Native (or undefined) — return the existing structural group buckets.
  if (!groupBy || groupBy.kind === "native") {
    return nativeBuckets(tasks, structuralGroups);
  }

  // Column-based — re-bucket by cell value.
  return columnBuckets(tasks, cellsByKey, columns, groupBy.columnId);
}

// ---------------------------------------------------------------------------
// Native grouping
// ---------------------------------------------------------------------------

function nativeBuckets(tasks: Task[], groups: Group[]): GroupBucket[] {
  const sorted = [...groups].sort((a, b) => a.position - b.position);
  return sorted.map((group) => ({
    key: group.id,
    label: group.name,
    color: group.color ?? null,
    tasks: tasks.filter((t) => t.group_id === group.id),
  }));
}

// ---------------------------------------------------------------------------
// Column-based grouping
// ---------------------------------------------------------------------------

function columnBuckets(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  columnId: string,
): GroupBucket[] {
  const column = columns.find((c) => c.id === columnId);
  if (!column) {
    // Unknown column — fall back to a single "All tasks" bucket.
    return [{ key: "all", label: "All tasks", color: null, tasks: [...tasks] }];
  }

  let def: ReturnType<typeof getCellDef>;
  try {
    def = getCellDef(column.type as CellTypeId);
  } catch {
    return [{ key: "all", label: "All tasks", color: null, tasks: [...tasks] }];
  }

  const type = column.type;

  if (type === "status" || type === "priority") {
    return labelBuckets(tasks, cellsByKey, column, def);
  }
  if (type === "person") {
    return personBuckets(tasks, cellsByKey, column, def);
  }
  if (type === "checkbox") {
    return checkboxBuckets(tasks, cellsByKey, column, def);
  }
  if (type === "date") {
    return dateBuckets(tasks, cellsByKey, column, def);
  }

  // Generic fallback: group by string representation of value.
  return genericBuckets(tasks, cellsByKey, column, def);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Label-based grouping for status / priority. Ordered by label.position, "Uncategorized" last. */
function labelBuckets(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  column: Column,
  def: ReturnType<typeof getCellDef>,
): GroupBucket[] {
  // Collect labels from column settings (per-column config carries `labels`).
  // The column settings are typed as `Json` in generated types — treat as unknown.
  const settings = column.settings as Record<string, unknown> | null | undefined;
  type LabelEntry = { id: string; name: string; color: string; position: number };
  const rawLabels = settings?.labels;
  const labels: LabelEntry[] = Array.isArray(rawLabels)
    ? (rawLabels as unknown[]).filter(
        (l): l is LabelEntry =>
          l !== null && typeof l === "object" && "id" in (l as object) && "name" in (l as object),
      )
    : [];

  // Sort labels by position.
  const sortedLabels = [...labels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  // Map tasks to their labelId.
  type LabelValue = { labelId: string } | null;

  const uncategorized: Task[] = [];
  const byLabelId = new Map<string, Task[]>();

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${column.id}`);
    const value = def.fromRow(cell) as LabelValue;
    if (!value?.labelId) {
      uncategorized.push(task);
    } else {
      const list = byLabelId.get(value.labelId) ?? [];
      list.push(task);
      byLabelId.set(value.labelId, list);
    }
  }

  const buckets: GroupBucket[] = sortedLabels
    .map((lbl) => ({
      key: `label:${lbl.id}`,
      label: lbl.name,
      color: lbl.color ?? null,
      tasks: byLabelId.get(lbl.id) ?? [],
    }))
    .filter((b) => b.tasks.length > 0 || sortedLabels.length > 0);

  // Only include labels that exist; also catch tasks with a labelId not in the
  // labels list (orphaned label references).
  const knownLabelIds = new Set(sortedLabels.map((l) => l.id));
  const orphaned: Task[] = [];
  for (const [labelId, ts] of byLabelId) {
    if (!knownLabelIds.has(labelId)) {
      orphaned.push(...ts);
    }
  }

  const uncatBucket: GroupBucket = {
    key: "none",
    label: "Uncategorized",
    color: null,
    tasks: [...uncategorized, ...orphaned],
  };

  // Append "Uncategorized" last per Q13.
  return [...buckets, ...(uncatBucket.tasks.length > 0 ? [uncatBucket] : [])];
}

/** Person-based grouping: key by first userId, "Uncategorized" for empty. */
function personBuckets(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  column: Column,
  def: ReturnType<typeof getCellDef>,
): GroupBucket[] {
  type PersonValue = { userIds: string[] } | null;

  const uncategorized: Task[] = [];
  const byUserId = new Map<string, Task[]>();

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${column.id}`);
    const value = def.fromRow(cell) as PersonValue;
    if (!value || value.userIds.length === 0) {
      uncategorized.push(task);
    } else {
      // v1: key by the first userId only. Array is non-empty (checked above).
      const uid = value.userIds[0] ?? "";
      const list = byUserId.get(uid) ?? [];
      list.push(task);
      byUserId.set(uid, list);
    }
  }

  // Sort alphabetically by userId (display-name resolve deferred to v1.5).
  const sortedUserIds = [...byUserId.keys()].sort((a, b) => a.localeCompare(b));
  const buckets: GroupBucket[] = sortedUserIds.map((uid) => ({
    key: `person:${uid}`,
    label: uid, // v1: userId as label; v1.5 will resolve to display_name
    color: null,
    tasks: byUserId.get(uid) ?? [],
  }));

  if (uncategorized.length > 0) {
    buckets.push({ key: "none", label: "Uncategorized", color: null, tasks: uncategorized });
  }

  return buckets;
}

/** Checkbox grouping: Checked / Unchecked only. */
function checkboxBuckets(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  column: Column,
  def: ReturnType<typeof getCellDef>,
): GroupBucket[] {
  const checked: Task[] = [];
  const unchecked: Task[] = [];

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${column.id}`);
    const value = def.fromRow(cell) as boolean | null;
    if (value === true) {
      checked.push(task);
    } else {
      unchecked.push(task);
    }
  }

  const buckets: GroupBucket[] = [];
  if (checked.length > 0) {
    buckets.push({ key: "checkbox:true", label: "Checked", color: null, tasks: checked });
  }
  if (unchecked.length > 0) {
    buckets.push({ key: "checkbox:false", label: "Unchecked", color: null, tasks: unchecked });
  }
  return buckets;
}

/** Date grouping: ascending ISO string; "No date" last. */
function dateBuckets(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  column: Column,
  def: ReturnType<typeof getCellDef>,
): GroupBucket[] {
  const noDates: Task[] = [];
  const byDate = new Map<string, Task[]>();

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${column.id}`);
    const value = def.fromRow(cell) as string | null;
    if (!value) {
      noDates.push(task);
    } else {
      // Normalise to date-only prefix for grouping.
      const dateKey = String(value).slice(0, 10);
      const list = byDate.get(dateKey) ?? [];
      list.push(task);
      byDate.set(dateKey, list);
    }
  }

  const sortedDates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));
  const buckets: GroupBucket[] = sortedDates.map((d) => ({
    key: `date:${d}`,
    label: d,
    color: null,
    tasks: byDate.get(d) ?? [],
  }));

  if (noDates.length > 0) {
    buckets.push({ key: "none", label: "No date", color: null, tasks: noDates });
  }

  return buckets;
}

/** Generic string-representation bucketing, "Uncategorized" last. */
function genericBuckets(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  column: Column,
  def: ReturnType<typeof getCellDef>,
): GroupBucket[] {
  const uncategorized: Task[] = [];
  const byKey = new Map<string, { label: string; tasks: Task[]; sortVal: unknown }>();

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${column.id}`);
    const value = def.fromRow(cell);
    if (value == null) {
      uncategorized.push(task);
    } else {
      const searchStr = def.toSearchString(value, column.settings as never);
      const key = searchStr || JSON.stringify(value);
      const existing = byKey.get(key);
      if (existing) {
        existing.tasks.push(task);
      } else {
        byKey.set(key, { label: searchStr || key, tasks: [task], sortVal: value });
      }
    }
  }

  // Sort buckets using def.compare on the sortVal.
  const entries = [...byKey.entries()].sort(([, a], [, b]) => def.compare(a.sortVal, b.sortVal));

  const buckets: GroupBucket[] = entries.map(([key, { label, tasks }]) => ({
    key: `generic:${key}`,
    label,
    color: null,
    tasks,
  }));

  if (uncategorized.length > 0) {
    buckets.push({ key: "none", label: "Uncategorized", color: null, tasks: uncategorized });
  }

  return buckets;
}
