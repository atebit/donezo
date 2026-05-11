#!/usr/bin/env tsx
/**
 * Standalone perf-smoke seeder for epic 06 board virtualization.
 *
 * Usage:
 *   pnpm tsx tests/perf/seed-board.ts --board <uuid> --tasks 5000 --groups 20
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env.
 * Uses the service-role admin client. RLS-bypassing — for dev/staging only.
 *
 * NOTE: tsx is not installed as a devDep in this repo. To run this script:
 *   npx tsx tests/perf/seed-board.ts --board <uuid>
 * or install tsx globally: npm i -g tsx
 *
 * Uses a relative import (../../lib/supabase/admin) instead of the @/ alias
 * because tsx resolves paths directly and the tsconfig paths alias requires
 * the Next.js bundler to be active. The @/ alias is also restricted by Biome's
 * noRestrictedImports rule for lib/supabase/admin.
 */

import { adminClient } from "../../lib/supabase/admin";

// Parse CLI args (--board, --tasks, --groups)
function parseArgs(): { board: string; tasks: number; groups: number } {
  const args = process.argv.slice(2);
  const opts: { board?: string; tasks?: number; groups?: number } = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const val = args[i + 1];
    if (key === "board" && val !== undefined) opts.board = val;
    else if (key === "tasks" && val !== undefined) opts.tasks = parseInt(val, 10);
    else if (key === "groups" && val !== undefined) opts.groups = parseInt(val, 10);
  }
  if (!opts.board) throw new Error("--board <uuid> required");
  return { board: opts.board, tasks: opts.tasks ?? 5000, groups: opts.groups ?? 20 };
}

async function main(): Promise<void> {
  const { board, tasks, groups } = parseArgs();
  const tasksPerGroup = Math.ceil(tasks / groups);

  const supabase = adminClient();

  // Insert N groups first; capture their ids
  const groupRows: Array<{ id: string; position: number }> = [];
  for (let i = 0; i < groups; i++) {
    const { data, error } = await supabase
      .from("group")
      .insert({
        board_id: board,
        name: `Perf Group ${i + 1}`,
        color: "#a25ddc",
        position: i + 1,
      })
      .select("id, position")
      .single();
    if (error) throw error;
    groupRows.push(data);
  }
  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`Inserted ${groupRows.length} groups`);

  // Insert tasks evenly distributed across groups
  let totalTasks = 0;
  for (const group of groupRows) {
    const taskBatch: Array<{ group_id: string; title: string; position: number }> = [];
    for (let j = 0; j < tasksPerGroup && totalTasks < tasks; j++) {
      taskBatch.push({
        group_id: group.id,
        title: `Perf Task ${totalTasks + 1}`,
        position: j + 1,
        // NOTE: do NOT set board_id — the task_board_id_consistency trigger handles it
      });
      totalTasks++;
    }
    // Bulk insert per group (faster than per-row)
    // @ts-expect-error: task_board_id_consistency trigger sets board_id from group_id
    const { error } = await supabase.from("task").insert(taskBatch);
    if (error) throw error;
  }

  // biome-ignore lint/suspicious/noConsole: intentional CLI output
  console.log(`Inserted ${totalTasks} tasks across ${groupRows.length} groups`);
}

main().catch((err: unknown) => {
  // biome-ignore lint/suspicious/noConsole: intentional CLI error output
  console.error(err);
  process.exit(1);
});
