/**
 * lib/jobs/cleanup-orphans.ts
 *
 * Service-role job: delete storage objects in the "attachments" bucket that have
 * no corresponding row in the `attachment` table.
 *
 * Algorithm:
 *  1. Call public.purge_orphan_attachments() — the existing SQL function that
 *     hard-deletes `attachment` rows that are still pending (is_uploaded = false)
 *     after 1 hour (created by migration 20260514000004).
 *  2. Page through ALL storage objects in the "attachments" bucket.
 *  3. For each object, check whether the third path segment (attachmentId) maps to
 *     a live `attachment` row. Path layout: <boardId>/<taskId>/<attachmentId>/<filename>.
 *  4. Collect objects where no row exists and delete them in bulk.
 *
 * Called by app/api/cron/cleanup-orphans/route.ts (hourly).
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: service-role job; never imported from client code.
import { adminClient } from "@/lib/supabase/admin";

export interface CleanupOrphansResult {
  pendingRowsDeleted: number;
  storageObjectsDeleted: number;
}

const BUCKET = "attachments";

/**
 * Extract the attachmentId from a storage object path.
 * Layout: <boardId>/<taskId>/<attachmentId>/<filename>
 * Returns null if the path does not conform.
 */
function attachmentIdFromPath(objectName: string): string | null {
  const parts = objectName.split("/");
  // Must be at least 4 segments.
  if (parts.length < 4) return null;
  const id = parts[2] ?? "";
  // Validate UUID v4 format.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id;
}

/**
 * Page through all objects in the attachments bucket (100 per page).
 * Returns the full list of object names.
 */
async function listAllStorageObjects(): Promise<string[]> {
  const admin = adminClient();
  const PAGE_SIZE = 100;
  const allNames: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list("", { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });

    if (error) {
      throw new Error(`storage list failed at offset ${offset}: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const item of data) {
      allNames.push(item.name);
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allNames;
}

export async function runCleanupOrphans(): Promise<CleanupOrphansResult> {
  const admin = adminClient();

  // Step 1: purge pending (is_uploaded=false) attachment rows via the SQL function.
  const { data: pendingRowsDeleted, error: purgeError } = await admin.rpc(
    "purge_orphan_attachments",
  );
  if (purgeError) {
    const err = new Error(`purge_orphan_attachments RPC failed: ${purgeError.message}`);
    Sentry.captureException(err, { tags: { job: "cleanup-orphans" } });
    throw err;
  }

  logger.info({ pendingRowsDeleted }, "[cleanup-orphans] pending rows purged");

  // Step 2: list all storage objects.
  let objectNames: string[];
  try {
    objectNames = await listAllStorageObjects();
  } catch (err) {
    Sentry.captureException(err, { tags: { job: "cleanup-orphans" } });
    throw err;
  }

  if (objectNames.length === 0) {
    logger.info("[cleanup-orphans] no storage objects found");
    return { pendingRowsDeleted: pendingRowsDeleted ?? 0, storageObjectsDeleted: 0 };
  }

  // Step 3: collect attachment IDs referenced by objects.
  const candidateIds: string[] = [];
  const idToNames = new Map<string, string[]>();
  for (const name of objectNames) {
    const id = attachmentIdFromPath(name);
    if (!id) continue; // skip paths that don't conform to layout
    candidateIds.push(id);
    const existing = idToNames.get(id) ?? [];
    existing.push(name);
    idToNames.set(id, existing);
  }

  if (candidateIds.length === 0) {
    logger.info("[cleanup-orphans] no conforming storage objects found");
    return { pendingRowsDeleted: pendingRowsDeleted ?? 0, storageObjectsDeleted: 0 };
  }

  // Step 4: fetch which of those IDs actually exist in the attachment table.
  const { data: liveRows, error: selectError } = await admin
    .from("attachment")
    .select("id")
    .in("id", candidateIds);

  if (selectError) {
    const err = new Error(`attachment lookup failed: ${selectError.message}`);
    Sentry.captureException(err, { tags: { job: "cleanup-orphans" } });
    throw err;
  }

  const liveIds = new Set((liveRows ?? []).map((r) => r.id));

  // Step 5: collect object names for IDs that have no live attachment row.
  const orphanNames: string[] = [];
  for (const [id, names] of idToNames) {
    if (!liveIds.has(id)) {
      orphanNames.push(...names);
    }
  }

  if (orphanNames.length === 0) {
    logger.info("[cleanup-orphans] no orphan storage objects found");
    return { pendingRowsDeleted: pendingRowsDeleted ?? 0, storageObjectsDeleted: 0 };
  }

  // Step 6: delete orphan storage objects.
  const { error: deleteError } = await admin.storage.from(BUCKET).remove(orphanNames);
  if (deleteError) {
    const err = new Error(`storage remove failed: ${deleteError.message}`);
    Sentry.captureException(err, { tags: { job: "cleanup-orphans" } });
    throw err;
  }

  logger.info(
    { storageObjectsDeleted: orphanNames.length },
    "[cleanup-orphans] orphan storage objects removed",
  );

  return {
    pendingRowsDeleted: pendingRowsDeleted ?? 0,
    storageObjectsDeleted: orphanNames.length,
  };
}
