/**
 * lib/notifications/preferences.ts
 *
 * Preference resolution for a given (userId, kind) pair.
 *
 * Preferences are stored sparsely in notification_preference.prefs (jsonb).
 * Rows are written lazily on updatePreferences — unset kinds inherit DEFAULT_PREFS.
 * This module provides the merge so callers don't need to know the storage detail.
 */

import { DEFAULT_PREFS, type NotificationKind, type PrefEntry } from "@/lib/notifications/kinds";
import type { NotificationPreference } from "@/lib/notifications/types";
// biome-ignore lint/style/noRestrictedImports: service-role read for preference lookup.
import { adminClient } from "@/lib/supabase/admin";

/**
 * Returns the effective `{ inApp, email }` preference for `userId` and `kind`.
 *
 * Logic:
 *   1. Fetch the user's notification_preference row (service-role; table has no
 *      SELECT policy for regular users on behalf of the server).
 *   2. Merge the sparse `prefs` map over DEFAULT_PREFS for the requested kind.
 *   3. If no row exists → use DEFAULT_PREFS (no DB row = all defaults).
 *
 * This function is intended for emitters (server-side, service-role context).
 * It is NOT for the preferences UI (which reads via user-client + RLS).
 */
export async function getPreferenceFor(userId: string, kind: NotificationKind): Promise<PrefEntry> {
  try {
    const { data } = await adminClient()
      .from("notification_preference")
      .select("prefs")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return { ...DEFAULT_PREFS[kind] };

    const prefs = data.prefs as NotificationPreference["prefs"] | null;
    const override = prefs?.[kind];

    if (override && typeof override.inApp === "boolean" && typeof override.email === "string") {
      return { inApp: override.inApp, email: override.email };
    }
    return { ...DEFAULT_PREFS[kind] };
  } catch {
    // Fallback to defaults on any error — preference fetch must never block emit.
    return { ...DEFAULT_PREFS[kind] };
  }
}
