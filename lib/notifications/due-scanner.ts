/**
 * lib/notifications/due-scanner.ts
 *
 * Service-role helper that scans date cells and emits `due_soon` /
 * `due_overdue` notifications to assignees for tasks approaching or
 * crossing their due date.
 *
 * DESIGN NOTES
 * ─────────────
 * Multiple date columns per board:
 *   A board can have several date-type columns (e.g. "Start Date", "Due Date",
 *   "Review Date"). The scanner scans ALL of them. For the SELECT query we
 *   consider (task_id, column_id, kind) independently so that, for example, a
 *   task with two date columns can produce a due_soon hit from either column.
 *   However the idempotency key in `task_reminder_sent` is (task_id, kind)
 *   only — so a task fires AT MOST ONE `due_soon` and ONE `due_overdue`
 *   notification regardless of which date column triggered it. The first
 *   column to match "wins" and the INSERT-on-conflict-skip guarantees no
 *   duplicate notification is sent by a concurrent or subsequent run.
 *
 * Idempotency order:
 *   INSERT into task_reminder_sent BEFORE emitting the notification. On PK
 *   conflict (task_id, kind) → skip. This guarantees safety even with
 *   overlapping cron runs.
 *
 * Assignees:
 *   Resolved from `cell` rows where `column.type = 'person'` on the same task,
 *   via json_value.userIds. All current assignees receive the notification —
 *   there is no "originator" for a system-generated due-date event.
 *
 * Best-effort:
 *   Errors at the per-task level are caught and logged; they never propagate
 *   to the caller. The route handler treats the entire scan as best-effort.
 */

import { logger } from "@/lib/logger";
import { emit } from "@/lib/notifications/emit";
import type { NotificationKind } from "@/lib/notifications/kinds";
import { getPreferenceFor } from "@/lib/notifications/preferences";
// biome-ignore lint/style/noRestrictedImports: service-role scanner; bypasses RLS intentionally.
import { adminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A due-soon or due-overdue task record as returned by the scanner query. */
type DueTaskRecord = {
  task_id: string;
  column_id: string;
  date_value: string;
  task: {
    id: string;
    board_id: string;
    deleted_at: string | null;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the user IDs of all current assignees for a task.
 * Reads person-type cells bounded to the given taskId.
 */
async function getAssigneeIds(taskId: string): Promise<string[]> {
  const admin = adminClient();
  const { data: personCells, error } = await admin
    .from("cell")
    .select("json_value, column!inner(type)")
    .eq("task_id", taskId)
    .eq("column.type", "person");

  if (error) {
    logger.warn({ err: error, taskId }, "due-scanner: failed to fetch person cells");
    return [];
  }

  const userIds: string[] = [];
  for (const cell of personCells ?? []) {
    const jv = cell.json_value as { userIds?: string[] } | null;
    if (jv?.userIds) {
      for (const uid of jv.userIds) {
        userIds.push(uid);
      }
    }
  }
  return [...new Set(userIds)]; // deduplicate
}

/**
 * Attempt to claim the idempotency slot for (task_id, kind).
 * Returns true if the slot was freshly claimed (this run should emit).
 * Returns false if already sent (skip).
 *
 * Uses INSERT … ON CONFLICT DO NOTHING so concurrent runs are safe.
 * PostgREST returns the inserted row on success; empty data array on conflict.
 */
async function claimReminderSlot(taskId: string, kind: NotificationKind): Promise<boolean> {
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from("task_reminder_sent")
      .insert({ task_id: taskId, kind })
      .select();

    if (error) return false;
    // ON CONFLICT DO NOTHING → data is an empty array (no row inserted).
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    logger.warn({ err, taskId, kind }, "due-scanner: claimReminderSlot unexpected error");
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ScanResult = {
  due_soon: { processed: number; notified: number; skipped: number };
  due_overdue: { processed: number; notified: number; skipped: number };
};

/**
 * Scan date cells and emit due_soon / due_overdue notifications.
 * Returns counts for observability logging in the route handler.
 */
export async function runDueScanner(): Promise<ScanResult> {
  const result: ScanResult = {
    due_soon: { processed: 0, notified: 0, skipped: 0 },
    due_overdue: { processed: 0, notified: 0, skipped: 0 },
  };

  const admin = adminClient();

  // ─── due_soon ──────────────────────────────────────────────────────────────
  // Tasks whose date_value falls within the next 24 hours and have not yet
  // had a due_soon reminder sent.
  const { data: dueSoonRows, error: dueSoonErr } = await admin
    .from("cell")
    .select(
      `
      task_id,
      column_id,
      date_value,
      task!inner(
        id,
        board_id,
        deleted_at
      ),
      column!inner(type)
    `,
    )
    .eq("column.type", "date")
    .not("date_value", "is", null)
    .gte("date_value", new Date().toISOString())
    .lte("date_value", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
    .is("task.deleted_at", null);

  if (dueSoonErr) {
    logger.error({ err: dueSoonErr }, "due-scanner: failed to query due_soon tasks");
  } else {
    const rows = (dueSoonRows ?? []) as unknown as DueTaskRecord[];
    // Deduplicate by task_id — once we claim the slot, subsequent rows for the
    // same task in the same run are no-ops anyway, but this avoids redundant
    // claimReminderSlot calls.
    const seenDueSoon = new Set<string>();
    for (const row of rows) {
      result.due_soon.processed++;
      if (seenDueSoon.has(row.task_id)) {
        result.due_soon.skipped++;
        continue;
      }
      seenDueSoon.add(row.task_id);

      await processDueTask({
        taskId: row.task_id,
        boardId: row.task.board_id,
        dateValue: row.date_value,
        kind: "due_soon",
        stats: result.due_soon,
      });
    }
  }

  // ─── due_overdue ────────────────────────────────────────────────────────────
  // Tasks whose date_value crossed within the last 1 hour and have not yet
  // had a due_overdue reminder sent. The 1-hour window ensures the hourly cron
  // catches every crossing exactly once.
  const { data: overdueRows, error: overdueErr } = await admin
    .from("cell")
    .select(
      `
      task_id,
      column_id,
      date_value,
      task!inner(
        id,
        board_id,
        deleted_at
      ),
      column!inner(type)
    `,
    )
    .eq("column.type", "date")
    .not("date_value", "is", null)
    .lt("date_value", new Date().toISOString())
    .gte("date_value", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .is("task.deleted_at", null);

  if (overdueErr) {
    logger.error({ err: overdueErr }, "due-scanner: failed to query due_overdue tasks");
  } else {
    const rows = (overdueRows ?? []) as unknown as DueTaskRecord[];
    const seenOverdue = new Set<string>();
    for (const row of rows) {
      result.due_overdue.processed++;
      if (seenOverdue.has(row.task_id)) {
        result.due_overdue.skipped++;
        continue;
      }
      seenOverdue.add(row.task_id);

      await processDueTask({
        taskId: row.task_id,
        boardId: row.task.board_id,
        dateValue: row.date_value,
        kind: "due_overdue",
        stats: result.due_overdue,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Per-task processing (best-effort)
// ---------------------------------------------------------------------------

async function processDueTask({
  taskId,
  boardId,
  dateValue,
  kind,
  stats,
}: {
  taskId: string;
  boardId: string;
  dateValue: string;
  kind: "due_soon" | "due_overdue";
  stats: { notified: number; skipped: number };
}): Promise<void> {
  try {
    // 1. Claim the idempotency slot. If it already exists → skip.
    const claimed = await claimReminderSlot(taskId, kind);
    if (!claimed) {
      stats.skipped++;
      return;
    }

    // 2. Resolve assignees.
    const assigneeIds = await getAssigneeIds(taskId);
    if (assigneeIds.length === 0) {
      // No assignees — reminder was still "claimed" to prevent retries
      // on a task that genuinely has no recipients.
      stats.skipped++;
      return;
    }

    // 3. Preference-gate + build emit rows.
    const rows = (
      await Promise.all(
        assigneeIds.map(async (userId) => {
          const pref = await getPreferenceFor(userId, kind);
          if (!pref.inApp) return null;
          return {
            user_id: userId,
            kind,
            payload: {
              actor_id: userId, // system event — no real actor; use recipient as placeholder
              board_id: boardId,
              task_id: taskId,
              due_date: dateValue,
            },
          } as const;
        }),
      )
    ).filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      stats.skipped++;
      return;
    }

    // 4. Emit notifications (best-effort; emit() never throws).
    await emit(rows, `due-scanner:${kind}`);
    stats.notified++;
  } catch (err) {
    logger.warn({ err, taskId, kind }, "due-scanner: processDueTask unexpected error");
    stats.skipped++;
  }
}
