"use client";

/**
 * Module-level wrapped server actions for the outbox queue.
 *
 * Each constant is created once (not on every render) so the returned function
 * captures the underlying server-action reference at module load time.
 *
 * Only upsert-style actions are wrapped here — inserts and deletes must error
 * immediately when offline (per outbox contract in lib/realtime/outbox.ts).
 *
 * Factored into this module so call-site components can import a stable
 * reference and tests can verify the wrapping without rendering components.
 */

import {
  bulkSetCellValue,
  setCellValue,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions";
import { renameGroup } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions";
import { renameTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { withOutbox } from "@/lib/realtime/outbox";

/** setCellValue wrapped in the outbox — enqueues when offline. */
export const wrappedSetCellValue = withOutbox("setCellValue", setCellValue);

/** renameTask wrapped in the outbox — enqueues when offline. */
export const wrappedRenameTask = withOutbox("renameTask", renameTask);

/** renameGroup wrapped in the outbox — enqueues when offline. */
export const wrappedRenameGroup = withOutbox("renameGroup", renameGroup);

/** bulkSetCellValue wrapped in the outbox — enqueues when offline. */
export const wrappedBulkSetCellValue = withOutbox("bulkSetCellValue", bulkSetCellValue);
