/**
 * lib/jobs/compact-positions.ts
 *
 * Service-role job: compact fractional positions for "active" boards so that the
 * bisection algorithm in lib/positions.ts never hits POSITION_PRECISION_EXHAUSTED.
 *
 * Algorithm:
 *  1. Find boards updated in the last 7 days (using board.updated_at).
 *  2. For each such board:
 *     a. Fetch live (deleted_at IS NULL) groups ordered by position asc.
 *     b. Rewrite each group's position to (index + 1) * 1000.
 *     c. For each group, fetch live tasks ordered by position asc and rewrite
 *        their positions to (index + 1) * 1000 as well.
 *
 * Spacing at 1000 allows ~999 bisections before the gap falls below 1 — far more
 * than a practical session ever reaches before the next compaction run.
 *
 * Called by app/api/cron/compact-positions/route.ts (weekly, Sunday 05:00 UTC).
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: service-role job; never imported from client code.
import { adminClient } from "@/lib/supabase/admin";

export interface CompactPositionsResult {
  boardsProcessed: number;
  groupsCompacted: number;
  tasksCompacted: number;
}

const POSITION_STEP = 1000;

/**
 * ISO-8601 timestamp for 7 days ago.
 * Extracted as a function so it can be mocked cleanly in tests.
 */
export function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

export async function runCompactPositions(): Promise<CompactPositionsResult> {
  const admin = adminClient();
  const cutoff = sevenDaysAgo();

  // 1. Find active boards (updated in last 7 days, not soft-deleted).
  const { data: boards, error: boardsError } = await admin
    .from("board")
    .select("id")
    .is("deleted_at", null)
    .gte("updated_at", cutoff);

  if (boardsError) {
    const err = new Error(`compact-positions board fetch failed: ${boardsError.message}`);
    Sentry.captureException(err, { tags: { job: "compact-positions" } });
    throw err;
  }

  if (!boards || boards.length === 0) {
    logger.info("[compact-positions] no active boards to compact");
    return { boardsProcessed: 0, groupsCompacted: 0, tasksCompacted: 0 };
  }

  let groupsCompacted = 0;
  let tasksCompacted = 0;

  for (const board of boards) {
    try {
      // 2a. Fetch live groups ordered by position.
      const { data: groups, error: groupsError } = await admin
        .from("group")
        .select("id, position")
        .eq("board_id", board.id)
        .is("deleted_at", null)
        .order("position", { ascending: true });

      if (groupsError) {
        logger.error(
          { boardId: board.id, err: groupsError },
          "[compact-positions] group fetch failed — skipping board",
        );
        continue;
      }

      if (!groups || groups.length === 0) continue;

      // 2b. Rewrite group positions.
      for (let i = 0; i < groups.length; i++) {
        const grp = groups[i];
        if (!grp) continue;
        const newPosition = (i + 1) * POSITION_STEP;
        if (grp.position === newPosition) continue; // already compact

        const { error: updateError } = await admin
          .from("group")
          .update({ position: newPosition })
          .eq("id", grp.id);

        if (updateError) {
          logger.error(
            { groupId: grp.id, err: updateError },
            "[compact-positions] group update failed — skipping",
          );
          continue;
        }
        groupsCompacted++;
      }

      // 2c. For each group, compact task positions.
      for (const group of groups) {
        const { data: tasks, error: tasksError } = await admin
          .from("task")
          .select("id, position")
          .eq("group_id", group.id)
          .is("deleted_at", null)
          .order("position", { ascending: true });

        if (tasksError) {
          logger.error(
            { groupId: group.id, err: tasksError },
            "[compact-positions] task fetch failed — skipping group",
          );
          continue;
        }

        if (!tasks || tasks.length === 0) continue;

        for (let i = 0; i < tasks.length; i++) {
          const tsk = tasks[i];
          if (!tsk) continue;
          const newPosition = (i + 1) * POSITION_STEP;
          if (tsk.position === newPosition) continue;

          const { error: updateError } = await admin
            .from("task")
            .update({ position: newPosition })
            .eq("id", tsk.id);

          if (updateError) {
            logger.error(
              { taskId: tsk.id, err: updateError },
              "[compact-positions] task update failed — skipping",
            );
            continue;
          }
          tasksCompacted++;
        }
      }
    } catch (err) {
      logger.error({ boardId: board.id, err }, "[compact-positions] board processing failed");
      Sentry.captureException(err, {
        tags: { job: "compact-positions" },
        extra: { boardId: board.id },
      });
    }
  }

  logger.info(
    { boardsProcessed: boards.length, groupsCompacted, tasksCompacted },
    "[compact-positions] compaction complete",
  );

  return { boardsProcessed: boards.length, groupsCompacted, tasksCompacted };
}
