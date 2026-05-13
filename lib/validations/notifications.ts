/**
 * lib/validations/notifications.ts
 *
 * Zod schemas for notification-related server actions and API inputs.
 * Same schemas validate on client (RHF resolver) and server (action guard).
 *
 * Imports NOTIFICATION_KIND_LIST from kinds.ts so the set is defined in
 * exactly one place (the kinds file) and kept in sync with the DB constraint.
 */

import { z } from "zod";
import { NOTIFICATION_KIND_LIST } from "@/lib/notifications/kinds";

// ---------------------------------------------------------------------------
// UpdatePreferencesSchema
// Used by: account/notifications action (upsert notification_preference row).
// ---------------------------------------------------------------------------

const PrefEntrySchema = z.object({
  inApp: z.boolean(),
  email: z.enum(["instant", "digest", "off"]),
});

export const UpdatePreferencesSchema = z.object({
  /**
   * Sparse map of per-kind overrides.
   * Keys are validated against the NOTIFICATION_KIND_LIST enum.
   * Only provided kinds are upserted; missing keys inherit DEFAULT_PREFS.
   */
  prefs: z
    .record(z.enum(NOTIFICATION_KIND_LIST as [string, ...string[]]), PrefEntrySchema)
    .optional(),
  digestEnabled: z.boolean(),
  digestHour: z.number().int().min(0).max(23),
  digestTimezone: z.string().min(1),
});

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;

// ---------------------------------------------------------------------------
// SetReadStateSchema
// Used by: notifications/actions.ts (markRead / markAllRead server actions).
// Discriminated union: either a list of specific IDs, or markAll: true.
// ---------------------------------------------------------------------------

export const SetReadStateSchema = z.discriminatedUnion("markAll", [
  z.object({
    markAll: z.literal(true),
  }),
  z.object({
    markAll: z.literal(false),
    notificationIds: z.array(z.string().uuid()).min(1),
  }),
]);

export type SetReadStateInput = z.infer<typeof SetReadStateSchema>;

// ---------------------------------------------------------------------------
// FollowTaskSchema / UnfollowTaskSchema
// Used by: notifications/actions.ts (followTask / unfollowTask server actions).
// ---------------------------------------------------------------------------

export const FollowTaskSchema = z.object({
  taskId: z.string().uuid(),
});

export const UnfollowTaskSchema = z.object({
  taskId: z.string().uuid(),
});

export type FollowTaskInput = z.infer<typeof FollowTaskSchema>;
export type UnfollowTaskInput = z.infer<typeof UnfollowTaskSchema>;
