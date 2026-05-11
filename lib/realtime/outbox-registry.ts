"use client";

/**
 * Maps OutboxActionId → the server-action function to invoke on flush.
 *
 * Only upsert-style actions are registered here. Inserts and deletes are
 * intentionally absent — they must error immediately when offline.
 *
 * Note on updateTaskFields: the tasks/actions.ts module does not export an
 * `updateTaskFields` function (as of Epic 08). The OutboxActionId union in
 * stores/types/realtime.ts was amended to remove it. If a future epic adds a
 * general task-field upsert, it should be added here alongside the union update.
 */

import {
  bulkSetCellValue,
  setCellValue,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions";
import { renameGroup } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions";
import { renameTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";

import type { OutboxActionId } from "@/stores/types/realtime";

export const outboxRegistry: Record<OutboxActionId, (...args: unknown[]) => Promise<unknown>> = {
  setCellValue: setCellValue as (...a: unknown[]) => Promise<unknown>,
  bulkSetCellValue: bulkSetCellValue as (...a: unknown[]) => Promise<unknown>,
  renameGroup: renameGroup as (...a: unknown[]) => Promise<unknown>,
  renameTask: renameTask as (...a: unknown[]) => Promise<unknown>,
};
