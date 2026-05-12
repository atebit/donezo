/**
 * Server-only storage helpers for the attachments pipeline.
 *
 * This module uses `adminClient()` which bypasses RLS — import ONLY from server
 * actions and server-only utilities. Never import from components or client code.
 */

import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: server-only storage HEAD check; no client callsites.
import { adminClient } from "@/lib/supabase/admin";

/**
 * Check whether a storage object exists at the given path in the `attachments` bucket.
 *
 * Implementation: list the parent folder with a search filter for the filename segment.
 * Returns true only if the exact path is found in the listing.
 *
 * Never throws — any error (network, auth, etc.) is caught and returns false.
 */
export async function storageObjectExists(path: string): Promise<boolean> {
  try {
    // Split path into parent folder and filename
    const lastSlash = path.lastIndexOf("/");
    const parent = lastSlash > 0 ? path.slice(0, lastSlash) : "";
    const filename = lastSlash > 0 ? path.slice(lastSlash + 1) : path;

    const { data, error } = await adminClient()
      .storage.from("attachments")
      .list(parent, { search: filename });

    if (error) {
      logger.warn({ err: error, path }, "storageObjectExists: list failed");
      return false;
    }

    if (!data) return false;

    // The search filter is a prefix match, so we verify the exact filename.
    return data.some((item) => item.name === filename);
  } catch (err) {
    logger.warn({ err, path }, "storageObjectExists: unexpected error");
    return false;
  }
}
